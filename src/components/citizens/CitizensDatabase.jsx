// components/citizens/CitizensDatabase.js

import React, { useState, useMemo, useEffect } from 'react';
import { db, checkRealInternet, syncQueue } from '../../services/database';
import { exportCSV, exportJSON } from '../../utils/helpers';

function CitizensDatabase({ citizens }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [allCitizens, setAllCitizens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ===== LOAD ALL CITIZENS (ONLY SYNCED ONES) =====
  const loadAllCitizens = async () => {
    setIsLoading(true);
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
      
      // Count offline citizens (synced === false) - these are hidden
      const offline = dbCitizens.filter(c => c.synced === false);
      setOfflineCount(offline.length);
      
    } catch (error) {
      console.error('Error loading citizens:', error);
      if (citizens) {
        const synced = citizens.filter(c => c.synced === true);
        setAllCitizens(synced);
        const offline = citizens.filter(c => c.synced === false);
        setOfflineCount(offline.length);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ===== CHECK ONLINE STATUS =====
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      
      // IF BACK ONLINE → AUTO SYNC
      if (online) {
        const queueCount = syncQueue.count();
        if (queueCount > 0) {
          console.log(`🔄 Back online! Auto-syncing ${queueCount} citizens...`);
          window.dispatchEvent(new CustomEvent('force-sync'));
        }
      }
    };
    
    checkNetwork();
    const interval = setInterval(checkNetwork, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // ===== LOAD DATA ON MOUNT AND CITIZENS CHANGE =====
  useEffect(() => {
    loadAllCitizens();
  }, [citizens]);

  // ===== LISTEN FOR SYNC EVENTS =====
  useEffect(() => {
    const handleSyncComplete = () => {
      loadAllCitizens();
    };
    
    const handleQueueUpdate = () => {
      const count = syncQueue.count();
      if (count === 0) {
        loadAllCitizens();
      }
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
        c.nationalId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm) ||
        c.registeredByName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedRegion !== 'All') {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }

    if (filterStatus === 'synced') {
      filtered = filtered.filter(c => c.synced === true);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter(c => c.synced === false);
    }

    return filtered;
  }, [allCitizens, searchTerm, selectedRegion, filterStatus]);

  // ===== EXPORT FUNCTIONS =====
  const handleExportCSV = () => {
    if (filteredCitizens.length === 0) {
      alert('No citizens to export');
      return;
    }
    const exportData = filteredCitizens.map(c => ({
      'Name': `${c.firstName} ${c.lastName}`,
      'National ID': c.nationalId,
      'Region': c.region,
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
          {isOnline && offlineCount > 0 && (
            <span style={{
              padding: '2px 12px',
              borderRadius: '12px',
              background: '#fef3c7',
              color: '#92400e',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              ⏳ {offlineCount} syncing...
            </span>
          )}
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

      {/* ===== SYNCING BANNER ===== */}
      {isOnline && offlineCount > 0 && (
        <div style={{
          padding: '12px 16px',
          background: '#dbeafe',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span>🔄 <strong>Syncing:</strong> {offlineCount} citizen(s) being synced...</span>
          <span style={{ fontSize: '12px', color: '#1e40af' }}>
            ⏳ Please wait...
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
              {isOnline && offlineCount > 0 && ` • ${offlineCount} syncing...`}
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
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Central">Central</option>
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>National ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Region</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Phone</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Registered By</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCitizens.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
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
                  <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                    {c.firstName} {c.lastName}
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
                      {c.region}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{c.phone}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: '500' }}>
                      {c.registeredByName || c.registeredBy || 'Unknown'}
                    </span>
                    {c.registeredBy && c.registeredBy !== 'unknown' && (
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        ID: {c.registeredBy}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    {new Date(c.registrationDate || c.createdAt).toLocaleDateString()}
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {new Date(c.registrationDate || c.createdAt).toLocaleTimeString()}
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
            {isOnline && offlineCount > 0 && ` (${offlineCount} syncing...)`}
          </span>
          <span>
            {offlineCount === 0 && isOnline && (
              <span style={{ color: '#065f37' }}>✅ All citizens synced</span>
            )}
            {!isOnline && offlineCount > 0 && (
              <span style={{ color: '#991b1b' }}>📡 {offlineCount} citizen(s) waiting for connection</span>
            )}
            {isOnline && offlineCount > 0 && (
              <span style={{ color: '#1e40af' }}>🔄 {offlineCount} citizen(s) syncing...</span>
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