import React, { useState, useMemo } from 'react';
import { exportCSV, exportJSON } from '../../utils/helpers';

function CitizensDatabase({ citizens }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');

  const filteredCitizens = useMemo(() => {
    let filtered = citizens || [];
    
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
  }, [citizens, searchTerm, selectedRegion]);

  return (
    <div className="citizens-database">
      <div className="table-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
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
            <h3 style={{fontSize: '16px', fontWeight: '600'}}>🆔 Citizens Database</h3>
            <p style={{fontSize: '13px', color: '#64748b'}}>
              {citizens.length} total citizens registered
            </p>
          </div>
          <div className="table-actions" style={{display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center'}}>
            <input 
              type="text" 
              placeholder="🔍 Search by name or ID..." 
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
            <button 
              onClick={() => exportCSV(filteredCitizens, 'citizens_database')}
              style={{
                padding: '6px 12px',
                background: '#4a90d9',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                opacity: 1,
                visibility: 'visible'
              }}
            >
              📥 CSV
            </button>
            <button 
              onClick={() => exportJSON(filteredCitizens, 'citizens_database')}
              style={{
                padding: '6px 12px',
                background: '#4a90d9',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                opacity: 1,
                visibility: 'visible'
              }}
            >
              📥 JSON
            </button>
          </div>
        </div>

        <div className="table-wrapper" style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
            <thead>
              <tr style={{background: '#f8fafc'}}>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>Name</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>National ID</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>Region</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>Phone</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>Registered By</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredCitizens.length === 0 && (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', padding: '40px 20px', color: '#64748b'}}>
                    <div style={{fontSize: '48px', marginBottom: '8px'}}>🆔</div>
                    <div>No citizens found</div>
                    <small style={{fontSize: '12px'}}>Try adjusting your filters</small>
                  </td>
                </tr>
              )}
              {filteredCitizens.map(c => (
                <tr key={c.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                  <td style={{padding: '12px 16px', fontWeight: '600'}}>
                    {c.firstName} {c.lastName}
                  </td>
                  <td style={{padding: '12px 16px'}}>
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
                  <td style={{padding: '12px 16px'}}>
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
                  <td style={{padding: '12px 16px'}}>{c.phone}</td>
                  <td style={{padding: '12px 16px'}}>
                    <span style={{fontWeight: '500'}}>{c.registeredByName}</span>
                    <div style={{fontSize: '11px', color: '#64748b'}}>{c.registeredBy}</div>
                  </td>
                  <td style={{padding: '12px 16px', fontSize: '13px'}}>
                    {new Date(c.registrationDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CitizensDatabase;