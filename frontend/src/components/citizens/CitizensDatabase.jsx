// components/citizens/CitizensDatabase.js

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db, checkRealInternet, syncQueue, clearStuckCitizens } from '../../services/database';
import { exportCSV, exportJSON, getProfilePhotoUrl } from '../../utils/helpers';
import UserAvatar from '../common/UserAvatar';

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const formatTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString();
};

// Some legacy / malformed records store coordinates as strings, so coerce
// them to numbers before calling .toFixed() (which throws on non-numbers).
const safeCoords = (lat, lng) => {
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return { latitude: la, longitude: lo };
};

function CitizensDatabase({ citizens, users }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedOfficer, setSelectedOfficer] = useState('All');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [allCitizens, setAllCitizens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  // Lookup users by employee ID so we can show the registering officer's photo.
  const userByEmpId = useMemo(() => {
    const map = {};
    (users || []).forEach(u => { if (u && u.employeeId) map[u.employeeId] = u; });
    return map;
  }, [users]);

  // Region options built ONLY from the regions listed in the users list
  const regionOptions = useMemo(() => {
    const set = new Set();
    (users || []).forEach(u => {
      const r = u && u.region;
      if (r && r !== 'All' && r !== 'all' && r !== '') set.add(r);
    });
    return ['All', ...set];
  }, [users]);

  // Officer options built from the users list (only real field officers)
  const officerOptions = useMemo(() => {
    const map = new Map();
    (users || []).forEach(u => {
      if (u && u.role === 'field_officer' && u.employeeId && u.name) {
        const label = `${u.name} (${u.employeeId})`;
        if (!map.has(u.employeeId)) map.set(u.employeeId, label);
      }
    });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [users]);

  const employeeRegionMap = useMemo(() => {
    const map = {};
    (users || []).forEach(u => {
      if (u && u.employeeId && u.region && u.region !== 'All' && u.region !== 'all') {
        map[u.employeeId] = u.region;
      }
    });
    return map;
  }, [users]);

  const resolveCitizenRegion = (c) => {
    if (c && c.registeredBy && employeeRegionMap[c.registeredBy]) return employeeRegionMap[c.registeredBy];
    return c?.region || '';
  };

  // ===== LOAD ALL CITIZENS (ONLY SYNCED ONES) =====
  // showLoader controls whether the full-page spinner is used. Live refreshes
  // (every few seconds / on sync events) pass false so the syncing indicator
  // can turn ON and OFF without flickering the whole page.
  const loadAllCitizens = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      // Get ONLY synced citizens from IndexedDB
      const dbCitizens = await db.citizens.toArray();
      
      // FILTER: Only show citizens that are synced (synced === true)
      let syncedCitizens = dbCitizens.filter(c => c.synced === true);
      
      // Also check props for any synced citizens not in DB
      if (citizens && citizens.length > 0) {
        const dbIds = new Set(syncedCitizens.map(c => c.id));
        const propsSynced = citizens.filter(c => 
          !dbIds.has(c.id) && c.synced === true
        );
        syncedCitizens = [...syncedCitizens, ...propsSynced];
      }
      
      // Sort by date (NEWEST FIRST)
      syncedCitizens.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.registrationDate || 0);
        const dateB = new Date(b.createdAt || b.registrationDate || 0);
        return dateB - dateA;
      });
      
      setAllCitizens(syncedCitizens);
      
      // Count offline citizens (synced === false OR currently mid-sync as
      // 'syncing'). These are hidden from the table.
      const offline = dbCitizens.filter(c => c.synced === false || c.synced === 'syncing');
      setOfflineCount(offline.length);
      
    } catch (error) {
      console.error('Error loading citizens:', error);
      if (citizens) {
        const synced = citizens.filter(c => c.synced === true);
        setAllCitizens(synced);
        const offline = citizens.filter(c => c.synced === false || c.synced === 'syncing');
        setOfflineCount(offline.length);
      }
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  // ===== CHECK ONLINE STATUS =====
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      
      // Refresh counts live (no spinner) so the "Syncing: N citizen(s) being
      // synced..." indicator turns ON when records need syncing and OFF as
      // soon as the queue drains.
      loadAllCitizens(false);
      
      // IF BACK ONLINE → AUTO SYNC. The global sync engine already auto-syncs
      // the queue every 2s and on the browser 'online' event, so we do NOT
      // re-dispatch 'force-sync' here — that would trigger redundant server
      // pulls on every poll tick while stuck items exist.
      if (online) {
        const queueCount = syncQueue.count();
        if (queueCount > 0) {
          console.log(`🔄 ${queueCount} citizens still pending sync (auto-sync running)`);
        }
      }
    };
    
    checkNetwork();
    const interval = setInterval(checkNetwork, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // ===== LOAD DATA ON MOUNT AND CITIZENS CHANGE =====
  // The full-page spinner is shown ONLY on the very first load. Live refreshes
  // (citizens prop changes after every sync cycle, sync events, queue updates)
  // reload WITHOUT the spinner, otherwise the page flickers between content
  // and "Loading citizens..." and looks stuck.
  useEffect(() => {
    loadAllCitizens(!hasLoadedRef.current);
    hasLoadedRef.current = true;
  }, [citizens]);

  // ===== CLEAN STUCK CITIZENS ON MOUNT =====
  // Permanently-stuck records (mid-sync for >1min, failed past the retry
  // limit, queued 7+ days, or orphaned queue items) are removed so they stop
  // keeping the syncing indicator and sync loop alive forever.
  useEffect(() => {
    clearStuckCitizens().then(() => loadAllCitizens(false));
  }, []);

  // ===== LISTEN FOR SYNC EVENTS =====
  useEffect(() => {
    const handleSyncComplete = () => {
      loadAllCitizens(false);
    };
    
    const handleQueueUpdate = () => {
      loadAllCitizens(false);
    };
    
    window.addEventListener('sync-complete', handleSyncComplete);
    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    
    return () => {
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
    };
  }, []);

  // ===== FILTER CITIZENS =====
  const filteredCitizens = useMemo(() => {
    let filtered = allCitizens || [];
    
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.grandfatherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nationalId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm) ||
        c.registeredByName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedRegion !== 'All') {
      filtered = filtered.filter(c => resolveCitizenRegion(c) === selectedRegion);
    }

    if (selectedOfficer !== 'All') {
      filtered = filtered.filter(c => (c.registeredBy || '') === selectedOfficer);
    }

    if (filterStatus === 'synced') {
      filtered = filtered.filter(c => c.synced === true);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter(c => c.synced === false);
    }

    return filtered;
  }, [allCitizens, searchTerm, selectedRegion, selectedOfficer, filterStatus, employeeRegionMap]);

  // ===== EXPORT FUNCTIONS =====
  const handleExportCSV = () => {
    if (filteredCitizens.length === 0) {
      alert('No citizens to export');
      return;
    }
    const exportData = filteredCitizens.map(c => ({
      'Name': `${c.firstName} ${c.lastName}`,
      'Grandfather Name': c.grandfatherName || '',
      'National ID': c.nationalId,
      'Region': resolveCitizenRegion(c),
      'Phone': c.phone,
      'Email': c.email || '',
      'Registered By': c.registeredByName || c.registeredBy || '',
      'Registration Date': new Date(c.registrationDate || c.createdAt).toLocaleString(),
      'Status': 'Synced'
    }));
    exportCSV(exportData, 'citizens_database');
  };

  const handleExportJSON = () => {
    if (filteredCitizens.length === 0) {
      alert('No citizens to export');
      return;
    }
    exportJSON(filteredCitizens, 'citizens_database');
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '300px',
        fontSize: '16px',
        color: '#64748b'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
          <div>Loading citizens...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="citizens-database" style={{ padding: '20px' }}>
      {/* ===== HERO HEADER (dashboard style) ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
        borderRadius: '16px',
        padding: '28px 28px 26px',
        margin: '0 0 24px',
        color: 'white',
        boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>🆔 Citizens Database</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            Complete registry of all registered citizens — searchable, filterable and exportable.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            🆔 {allCitizens.length} Citizens
          </span>
          <span style={{
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid rgba(52,211,153,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            👥 {officerOptions.length} Officers
          </span>
          {offlineCount > 0 && (
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              📡 {offlineCount} Pending Sync
            </span>
          )}
        </div>
      </div>

      {/* ===== STATUS BAR ===== */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: isOnline ? '#d1fae5' : '#fee2e2',
        borderRadius: '8px',
        marginBottom: '16px',
        border: isOnline ? '1px solid #0b7e4b' : '1px solid #dc2626',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ fontWeight: '500', color: isOnline ? '#065f37' : '#991b1b' }}>
          {isOnline ? '✅ Online' : '❌ Offline'}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isOnline && offlineCount > 0 && (
            <span style={{
              padding: '2px 12px',
              borderRadius: '12px',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              📡 {offlineCount} saved offline
            </span>
          )}
        </div>
      </div>

      {/* ===== OFFLINE BANNER ===== */}
      {!isOnline && offlineCount > 0 && (
        <div style={{
          padding: '12px 16px',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span>📡 <strong>Offline:</strong> {offlineCount} citizen(s) saved locally. Will appear when online.</span>
          <span style={{ fontSize: '12px', color: '#92400e' }}>
            ⏳ Waiting for connection...
          </span>
        </div>
      )}

      {/* ===== TABLE CARD ===== */}
      <div className="table-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* ===== HEADER ===== */}
        <div className="table-header" style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
              🆔 Citizens Database
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              {allCitizens.length} total citizens
              {!isOnline && offlineCount > 0 && ` • ${offlineCount} pending sync`}
            </p>
          </div>
          <div className="table-actions" style={{
            display: 'flex', 
            gap: '8px', 
            flexWrap: 'wrap', 
            alignItems: 'center'
          }}>
            <input 
              type="text" 
              placeholder="🔍 Search by name, ID, or officer..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                minWidth: '180px'
              }}
            />
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'white'
              }}
            >
              <option value="All">All Regions</option>
              {regionOptions.filter(r => r !== 'All').map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select 
              value={selectedOfficer} 
              onChange={e => setSelectedOfficer(e.target.value)}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'white'
              }}
            >
              <option value="All">All Officers</option>
              {officerOptions.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'white'
              }}
            >
              <option value="all">All Status</option>
              <option value="synced">✅ Synced</option>
            </select>
            <button 
              onClick={handleExportCSV}
              style={{
                padding: '6px 12px',
                background: '#0b7e4b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📥 CSV
            </button>
            <button 
              onClick={handleExportJSON}
              style={{
                padding: '6px 12px',
                background: '#1e3a5f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📥 JSON
            </button>
          </div>
        </div>

        {/* ===== TABLE ===== */}
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Photo</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>National ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Region</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Phone</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Registered By</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCitizens.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>🆔</div>
                    <div>
                      {!isOnline && offlineCount > 0 
                        ? 'Citizens saved offline. Will appear when online.' 
                        : 'No citizens found'}
                    </div>
                    <small style={{ fontSize: '12px' }}>
                      {!isOnline && offlineCount > 0 
                        ? `📡 ${offlineCount} citizen(s) waiting to sync` 
                        : 'Try adjusting your filters'}
                    </small>
                  </td>
                </tr>
              )}
              {filteredCitizens.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {c.photo ? (
                      <img
                        src={getProfilePhotoUrl(c.photo)}
                        alt="Citizen"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '22px' }}>👤</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                    {c.firstName} {c.lastName}{c.grandfatherName ? ` ${c.grandfatherName}` : ''}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: '#dbeafe',
                      color: '#1e40af'
                    }}>
                      {c.nationalId}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: '#e8edf5',
                      color: '#1e3a5f'
                    }}>
                      {resolveCitizenRegion(c)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {(() => {
                      const coords = safeCoords(c.latitude, c.longitude);
                      return coords ? (
                        <a
                          href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#0b7e4b',
                            textDecoration: 'none',
                            fontWeight: '500',
                            fontSize: '12px'
                          }}
                          title={`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}${c.gpsAccuracy ? ` (±${Number(c.gpsAccuracy)}m)` : ''}`}
                        >
                          📍 Open Map
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{c.phone}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UserAvatar user={userByEmpId[c.registeredBy]} name={c.registeredByName || c.registeredBy} size={28} />
                      <div>
                        <div style={{ fontWeight: '500' }}>
                          {c.registeredByName || c.registeredBy || 'Unknown'}
                        </div>
                        {c.registeredBy && c.registeredBy !== 'unknown' && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            ID: {c.registeredBy}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    {formatDate(c.registrationDate || c.createdAt)}
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {formatTime(c.registrationDate || c.createdAt)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500',
                      background: '#d1fae5',
                      color: '#065f37'
                    }}>
                      ✅ Synced
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== FOOTER ===== */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '13px',
          color: '#64748b',
          background: '#fafafa'
        }}>
          <span>
            Showing {filteredCitizens.length} of {allCitizens.length} citizens
            {!isOnline && offlineCount > 0 && ` (${offlineCount} offline waiting to sync)`}
          </span>
          <span>
            {offlineCount === 0 && isOnline && (
              <span style={{ color: '#065f37' }}>✅ All citizens synced</span>
            )}
            {!isOnline && offlineCount > 0 && (
              <span style={{ color: '#991b1b' }}>📡 {offlineCount} citizen(s) waiting for connection</span>
            )}
          </span>
        </div>
      </div>

      {/* ===== CSS FOR PULSE ANIMATION ===== */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}

export default CitizensDatabase;