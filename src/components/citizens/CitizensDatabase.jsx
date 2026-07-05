// components/citizens/CitizensDatabase.js

import React, { useState, useMemo, useEffect } from 'react';
import { db, checkRealInternet } from '../../services/database';

function CitizensDatabase({ citizens }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [allCitizens, setAllCitizens] = useState([]);

  // Load all citizens including offline ones
  const loadCitizens = async () => {
    try {
      const dbCitizens = await db.citizens.toArray();
      // Merge with props
      let merged = [...dbCitizens];
      
      if (citizens && citizens.length > 0) {
        const dbIds = new Set(dbCitizens.map(c => c.id));
        const missing = citizens.filter(c => !dbIds.has(c.id));
        merged = [...dbCitizens, ...missing];
      }
      
      merged.sort((a, b) => new Date(b.createdAt || b.registrationDate) - new Date(a.createdAt || a.registrationDate));
      
      setAllCitizens(merged);
      
      const offline = merged.filter(c => c.synced === false);
      setOfflineCount(offline.length);
    } catch (error) {
      console.error('Error loading citizens:', error);
      setAllCitizens(citizens || []);
    }
  };

  useEffect(() => {
    loadCitizens();
  }, [citizens]);

  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
    };
    
    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);
    
    // Listen for sync events
    const handleSync = () => {
      loadCitizens();
    };
    
    window.addEventListener('sync-complete', handleSync);
    window.addEventListener('sync-queue-updated', handleSync);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-complete', handleSync);
      window.removeEventListener('sync-queue-updated', handleSync);
    };
  }, []);

  const filteredCitizens = useMemo(() => {
    let filtered = allCitizens || [];
    
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nationalId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
      );
    }

    if (selectedRegion !== 'All') {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }

    return filtered;
  }, [allCitizens, searchTerm, selectedRegion]);

  return (
    <div className="citizens-database" style={{ padding: '20px' }}>
      {/* Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: isOnline ? '#d1fae5' : '#fee2e2',
        borderRadius: '8px',
        marginBottom: '16px',
        border: isOnline ? '1px solid #0b7e4b' : '1px solid #dc2626'
      }}>
        <span style={{ fontWeight: '500', color: isOnline ? '#065f37' : '#991b1b' }}>
          {isOnline ? '✅ Online' : '❌ Offline'}
        </span>
        {offlineCount > 0 && (
          <span style={{
            padding: '2px 12px',
            borderRadius: '12px',
            background: '#fef3c7',
            color: '#92400e',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            ⏳ {offlineCount} pending sync
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>🆔 Citizens Database</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              {allCitizens.length} total citizens
              {offlineCount > 0 && ` • ${offlineCount} pending sync`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="🔍 Search..." 
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
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>National ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Region</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Phone</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Registered By</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCitizens.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No citizens found
                  </td>
                </tr>
              )}
              {filteredCitizens.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                    {c.firstName} {c.lastName}
                    {!c.synced && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        padding: '1px 8px',
                        borderRadius: '10px',
                        background: '#fef3c7',
                        color: '#92400e'
                      }}>
                        OFFLINE
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
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
                      background: '#e8edf5',
                      color: '#1e3a5f'
                    }}>
                      {c.region}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{c.phone}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {c.registeredByName || c.registeredBy || 'Unknown'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {c.synced ? (
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        background: '#d1fae5',
                        color: '#065f37'
                      }}>
                        ✅ Synced
                      </span>
                    ) : (
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        background: '#fef3c7',
                        color: '#92400e'
                      }}>
                        ⏳ Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          fontSize: '13px',
          color: '#64748b',
          background: '#fafafa'
        }}>
          Showing {filteredCitizens.length} of {allCitizens.length} citizens
          {offlineCount > 0 && (
            <span style={{ marginLeft: '16px', color: '#92400e' }}>
              ⚠️ {offlineCount} pending sync
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default CitizensDatabase;