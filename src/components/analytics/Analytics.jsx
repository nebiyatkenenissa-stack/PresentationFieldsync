import React, { useMemo } from 'react';

function Analytics({ 
  reports, 
  users, 
  attendance, 
  screenTime, 
  liveStatus,
  totalReports, 
  totalRegistrations, 
  regionStats, 
  employeePerformance,
  renderBarChart 
}) {
  // Calculate averages
  const avgEfficiency = employeePerformance?.length > 0 
    ? Math.round(employeePerformance.reduce((sum, e) => sum + e.avgEfficiency, 0) / employeePerformance.length)
    : 0;
  const avgAttendance = employeePerformance?.length > 0
    ? Math.round(employeePerformance.reduce((sum, e) => sum + e.attendanceRate, 0) / employeePerformance.length)
    : 0;
  const avgTrust = employeePerformance?.length > 0
    ? Math.round(employeePerformance.reduce((sum, e) => sum + (e.trustScore || 0), 0) / employeePerformance.length)
    : 0;

  // Get top officers
  const topOfficers = [...(employeePerformance || [])]
    .sort((a, b) => b.totalRegistrations - a.totalRegistrations)
    .slice(0, 5);

  return (
    <div className="analytics-view" style={{padding: '0'}}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{fontSize: '24px', fontWeight: '700', margin: 0}}>📈 Advanced Analytics</h2>
          <p style={{color: '#64748b', fontSize: '14px', margin: '4px 0 0 0'}}>Comprehensive overview of field operations</p>
        </div>
        <span style={{
          background: '#dbeafe',
          color: '#1e40af',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          Updated: {new Date().toLocaleDateString()}
        </span>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#1e3a5f'}}>{totalReports || 0}</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>📋 Total Reports</div>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#d97706'}}>{totalRegistrations || 0}</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>🆔 Total Citizens</div>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#0b7e4b'}}>{avgEfficiency}%</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>⚡ Avg Efficiency</div>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#7c3aed'}}>{avgAttendance}%</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>📊 Avg Attendance</div>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#dc2626'}}>{avgTrust}%</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>🎯 Avg Trust Score</div>
        </div>
      </div>

      {/* Regional Performance Chart */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <div style={{marginBottom: '16px'}}>
          <h3 style={{fontSize: '18px', fontWeight: '600', margin: 0}}>Regional Performance</h3>
          <p style={{fontSize: '14px', color: '#64748b', margin: '4px 0 0 0'}}>Citizens registered by region</p>
        </div>
        <div className="chart-container">
          {renderBarChart ? renderBarChart() : (
            <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Employee Rankings */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px'}}>🏆 Top Performing Officers</h3>
        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
          {topOfficers.length === 0 && (
            <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No data available</div>
          )}
          {topOfficers.map((emp, i) => (
            <div key={emp.employeeId} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 16px',
              background: i === 0 ? '#fef3c7' : '#f8fafc',
              borderRadius: '8px',
              border: i === 0 ? '2px solid #d97706' : '1px solid #e5e7eb',
              flexWrap: 'wrap'
            }}>
              <span style={{fontWeight: '700', color: i === 0 ? '#d97706' : '#64748b', minWidth: '40px'}}>
                #{i + 1} {i === 0 ? '🏆' : ''}
              </span>
              <span style={{fontWeight: '600', flex: 1}}>{emp.employeeName}</span>
              <span style={{color: '#64748b', fontSize: '13px'}}>{emp.region}</span>
              <span style={{color: '#2563eb', fontWeight: '500'}}>🆔 {emp.totalRegistrations}</span>
              <span style={{color: '#0b7e4b', fontWeight: '600'}}>{emp.avgEfficiency}%</span>
              <span style={{color: '#7c3aed'}}>📊 {Math.round(emp.attendanceRate)}%</span>
              <span style={{color: '#dc2626'}}>🎯 {emp.trustScore || 0}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Region Statistics */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px'}}>📊 Region Statistics</h3>
        {!regionStats || regionStats.length === 0 ? (
          <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No data available</div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {regionStats.map((region, idx) => {
              const maxVal = Math.max(...regionStats.map(r => r.registrations)) || 1;
              const colors = ['#1e3a5f', '#2b4c7a', '#4a7a9c', '#6b9ec4', '#2d6a4f', '#1a3a5f'];
              return (
                <div key={region.region} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <span style={{fontSize: '14px', fontWeight: '500', minWidth: '60px', color: '#1a202c'}}>
                    {region.region}
                  </span>
                  <div style={{flex: 1, height: '32px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', position: 'relative'}}>
                    <div style={{
                      height: '100%',
                      width: `${(region.registrations / maxVal) * 100}%`,
                      background: colors[idx % colors.length],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '8px',
                      borderRadius: '6px',
                      transition: 'width 0.6s ease',
                      minWidth: '20px'
                    }}>
                      <span style={{fontSize: '12px', fontWeight: '600', color: 'white'}}>
                        {region.registrations}
                      </span>
                    </div>
                  </div>
                  <span style={{fontSize: '12px', color: '#64748b'}}>
                    {region.employees || 0} officers
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;