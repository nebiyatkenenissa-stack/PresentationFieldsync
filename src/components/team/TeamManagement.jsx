import React, { useState, useMemo } from 'react';
import { getToday } from '../../utils/helpers';

function TeamManagement({ 
  users, 
  user, 
  isManager, 
  isSupervisor, 
  teamMembers, 
  reports, 
  attendance, 
  screenTime, 
  liveStatus,
  employeePerformance,
  selectedOfficer,
  setSelectedOfficer
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState('All');

  // Get team members
  const displayMembers = useMemo(() => {
    let members = isManager 
      ? users.filter(u => u.role === 'field_officer' || u.role === 'supervisor')
      : teamMembers;

    if (searchTerm) {
      members = members.filter(m => 
        m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterRegion !== 'All') {
      members = members.filter(m => m.region === filterRegion);
    }

    return members;
  }, [users, teamMembers, isManager, searchTerm, filterRegion]);

  // Get team stats
  const teamStats = useMemo(() => {
    const totalMembers = displayMembers.length;
    const activeMembers = displayMembers.filter(m => m.status === 'active').length;
    const onlineMembers = liveStatus?.filter(l => 
      displayMembers.some(m => m.employeeId === l.employeeId) && l.status === 'online'
    ).length || 0;
    
    const totalReports = reports.filter(r => 
      displayMembers.some(m => m.employeeId === r.employeeId)
    ).length;
    
    const totalRegistrations = reports.filter(r => 
      displayMembers.some(m => m.employeeId === r.employeeId)
    ).reduce((sum, r) => sum + (r.registrations || 0), 0);

    return { totalMembers, activeMembers, onlineMembers, totalReports, totalRegistrations };
  }, [displayMembers, reports, liveStatus]);

  // Get performance for a member
  const getMemberPerformance = (member) => {
    const perf = employeePerformance?.find(p => p.employeeId === member.employeeId);
    const todayAtt = attendance?.find(a => a.employeeId === member.employeeId && a.date === getToday());
    const memberScreen = screenTime?.find(s => s.employeeId === member.employeeId && s.date === getToday());
    const memberStatus = liveStatus?.find(l => l.employeeId === member.employeeId);

    return {
      reports: perf?.totalReports || 0,
      registrations: perf?.totalRegistrations || 0,
      efficiency: perf?.avgEfficiency || 0,
      attendance: todayAtt?.status || 'Not Marked',
      trustScore: memberScreen?.trustScore || 0,
      status: memberStatus?.status || 'offline',
      productivity: memberStatus?.productivityScore || 0
    };
  };

  // Get region options
  const regions = ['All', 'North', 'South', 'East', 'West', 'Central'];

  return (
    <div className="team-view">
      {/* Header with Stats */}
      <div className="team-header" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="stat-card" style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#1e3a5f'}}>{teamStats.totalMembers}</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>👥 Total Members</div>
        </div>
        <div className="stat-card" style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#0b7e4b'}}>{teamStats.onlineMembers}</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>🟢 Online Now</div>
        </div>
        <div className="stat-card" style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#2563eb'}}>{teamStats.totalReports}</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>📋 Total Reports</div>
        </div>
        <div className="stat-card" style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '28px', fontWeight: '700', color: '#d97706'}}>{teamStats.totalRegistrations}</div>
          <div style={{fontSize: '14px', color: '#64748b'}}>🆔 Citizens Registered</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '20px',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="🔍 Search by name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            flex: '1',
            minWidth: '200px'
          }}
        />
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            background: 'white'
          }}
        >
          {regions.map(r => (
            <option key={r} value={r}>{r === 'All' ? '🌍 All Regions' : r}</option>
          ))}
        </select>
        <span style={{color: '#64748b', fontSize: '14px'}}>
          {displayMembers.length} members found
        </span>
      </div>

      {/* Team Cards Grid */}
      <div className="team-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {displayMembers.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px',
            color: '#64748b'
          }}>
            <div style={{fontSize: '48px', marginBottom: '8px'}}>👥</div>
            <div>No team members found</div>
          </div>
        )}
        {displayMembers.map(member => {
          const perf = getMemberPerformance(member);
          return (
            <div 
              key={member.id} 
              className="team-card"
              onClick={() => setSelectedOfficer(member)}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '1px solid #e5e7eb',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Status Badge */}
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                display: 'flex',
                gap: '6px',
                alignItems: 'center'
              }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: perf.status === 'online' ? '#0b7e4b' : 
                             perf.status === 'offline' ? '#dc2626' : '#d97706'
                }}></span>
                <span style={{fontSize: '11px', color: '#64748b', textTransform: 'capitalize'}}>
                  {perf.status}
                </span>
              </div>

              {/* Avatar & Name */}
              <div style={{display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px'}}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#e8edf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  {member.role === 'supervisor' ? '👨‍💼' : '👤'}
                </div>
                <div>
                  <div style={{fontWeight: '600', fontSize: '16px', color: '#1a202c'}}>
                    {member.name}
                  </div>
                  <div style={{fontSize: '13px', color: '#64748b'}}>
                    {member.employeeId} • {member.role?.replace('_', ' ')}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: '#e8edf5',
                    color: '#1e3a5f',
                    marginTop: '2px'
                  }}>
                    {member.region}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '12px'
              }}>
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: '18px', fontWeight: '700', color: '#2563eb'}}>
                    {perf.reports}
                  </div>
                  <div style={{fontSize: '11px', color: '#64748b'}}>📋 Reports</div>
                </div>
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: '18px', fontWeight: '700', color: '#d97706'}}>
                    {perf.registrations}
                  </div>
                  <div style={{fontSize: '11px', color: '#64748b'}}>🆔 Citizens</div>
                </div>
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: '18px', fontWeight: '700', color: '#0b7e4b'}}>
                    {perf.efficiency}%
                  </div>
                  <div style={{fontSize: '11px', color: '#64748b'}}>⚡ Efficiency</div>
                </div>
              </div>

              {/* Additional Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid #f3f4f6'
              }}>
                <div style={{fontSize: '12px', color: '#64748b'}}>
                  📊 Attendance: <span style={{
                    fontWeight: '500',
                    color: perf.attendance === 'present' ? '#0b7e4b' : 
                           perf.attendance === 'late' ? '#d97706' : '#dc2626'
                  }}>
                    {perf.attendance}
                  </span>
                </div>
                <div style={{fontSize: '12px', color: '#64748b'}}>
                  🎯 Trust: <span style={{fontWeight: '500', color: '#1e3a5f'}}>
                    {perf.trustScore}%
                  </span>
                </div>
                <div style={{fontSize: '12px', color: '#64748b'}}>
                  📱 {perf.productivity}%
                </div>
              </div>

              {/* Click to view detail */}
              <div style={{
                marginTop: '10px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#4a90d9'
              }}>
                Click to view details →
              </div>
            </div>
          );
        })}
      </div>

      {/* Officer Detail Modal */}
      {selectedOfficer && (
        <div className="officer-detail-modal" onClick={() => setSelectedOfficer(null)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="officer-detail" onClick={(e) => e.stopPropagation()} style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'slideUp 0.3s ease'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h3 style={{fontSize: '24px', fontWeight: '700', color: '#1a202c'}}>
                {selectedOfficer.name}
              </h3>
              <button 
                onClick={() => setSelectedOfficer(null)} 
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px'}}>
                <div style={{fontSize: '11px', color: '#64748b'}}>Employee ID</div>
                <div style={{fontWeight: '600'}}>{selectedOfficer.employeeId}</div>
              </div>
              <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px'}}>
                <div style={{fontSize: '11px', color: '#64748b'}}>Region</div>
                <div style={{fontWeight: '600'}}>{selectedOfficer.region}</div>
              </div>
              <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px'}}>
                <div style={{fontSize: '11px', color: '#64748b'}}>Role</div>
                <div style={{fontWeight: '600'}}>{selectedOfficer.role?.replace('_', ' ')}</div>
              </div>
              <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px'}}>
                <div style={{fontSize: '11px', color: '#64748b'}}>Shift</div>
                <div style={{fontWeight: '600'}}>{selectedOfficer.shift || 'Day'}</div>
              </div>
              <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px'}}>
                <div style={{fontSize: '11px', color: '#64748b'}}>Status</div>
                <div style={{fontWeight: '600', color: selectedOfficer.status === 'active' ? '#0b7e4b' : '#dc2626'}}>
                  {selectedOfficer.status}
                </div>
              </div>
              <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px'}}>
                <div style={{fontSize: '11px', color: '#64748b'}}>Phone</div>
                <div style={{fontWeight: '600'}}>{selectedOfficer.phone || 'N/A'}</div>
              </div>
            </div>

            <div style={{borderTop: '1px solid #e5e7eb', paddingTop: '16px'}}>
              <h4 style={{fontSize: '16px', fontWeight: '600', marginBottom: '12px'}}>
                📊 Performance Summary
              </h4>
              {(() => {
                const perf = employeePerformance?.find(p => p.employeeId === selectedOfficer.employeeId);
                const screen = screenTime?.find(s => s.employeeId === selectedOfficer.employeeId && s.date === getToday());
                const status = liveStatus?.find(l => l.employeeId === selectedOfficer.employeeId);
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '8px'
                  }}>
                    <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center'}}>
                      <div style={{fontSize: '20px', fontWeight: '700', color: '#2563eb'}}>{perf?.totalReports || 0}</div>
                      <div style={{fontSize: '11px', color: '#64748b'}}>📋 Reports</div>
                    </div>
                    <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center'}}>
                      <div style={{fontSize: '20px', fontWeight: '700', color: '#d97706'}}>{perf?.totalRegistrations || 0}</div>
                      <div style={{fontSize: '11px', color: '#64748b'}}>🆔 Citizens</div>
                    </div>
                    <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center'}}>
                      <div style={{fontSize: '20px', fontWeight: '700', color: '#0b7e4b'}}>{perf?.avgEfficiency || 0}%</div>
                      <div style={{fontSize: '11px', color: '#64748b'}}>⚡ Efficiency</div>
                    </div>
                    <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center'}}>
                      <div style={{fontSize: '20px', fontWeight: '700', color: '#7c3aed'}}>{Math.round(perf?.attendanceRate || 0)}%</div>
                      <div style={{fontSize: '11px', color: '#64748b'}}>📊 Attendance</div>
                    </div>
                    <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center'}}>
                      <div style={{fontSize: '20px', fontWeight: '700', color: '#dc2626'}}>{screen?.trustScore || 0}%</div>
                      <div style={{fontSize: '11px', color: '#64748b'}}>🎯 Trust Score</div>
                    </div>
                    <div style={{padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center'}}>
                      <div style={{fontSize: '20px', fontWeight: '700', color: '#4a90d9'}}>{status?.productivityScore || 0}%</div>
                      <div style={{fontSize: '11px', color: '#64748b'}}>📱 Productivity</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{marginTop: '16px', display: 'flex', gap: '10px'}}>
              <button 
                onClick={() => setSelectedOfficer(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#1e3a5f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  opacity: 1,
                  visibility: 'visible'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamManagement;