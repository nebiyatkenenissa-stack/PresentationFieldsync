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
  setSelectedOfficer,
  citizens // ADDED: citizens array for accurate counting
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

  // Get team stats - Using actual citizens count
  const teamStats = useMemo(() => {
    const totalMembers = displayMembers.length;
    const activeMembers = displayMembers.filter(m => m.status === 'active').length;
    const onlineMembers = liveStatus?.filter(l => 
      displayMembers.some(m => m.employeeId === l.employeeId) && l.status === 'online'
    ).length || 0;
    
    const totalReports = reports.filter(r => 
      displayMembers.some(m => m.employeeId === r.employeeId)
    ).length;
    
    // ✅ FIX: Use actual citizens count instead of report registrations
    const totalRegistrations = citizens.filter(c => 
      displayMembers.some(m => m.employeeId === c.registeredBy)
    ).length;

    return { totalMembers, activeMembers, onlineMembers, totalReports, totalRegistrations };
  }, [displayMembers, reports, liveStatus, citizens]);

  // Get performance for a member - Using actual citizens count
  const getMemberPerformance = (member) => {
    const perf = employeePerformance?.find(p => p.employeeId === member.employeeId);
    const todayAtt = attendance?.find(a => a.employeeId === member.employeeId && a.date === getToday());
    const memberScreen = screenTime?.find(s => s.employeeId === member.employeeId && s.date === getToday());
    const memberStatus = liveStatus?.find(l => l.employeeId === member.employeeId);
    
    // ✅ FIX: Get actual citizens registered by this officer
    const actualRegistrations = citizens.filter(c => c.registeredBy === member.employeeId).length;

    return {
      reports: perf?.totalReports || 0,
      registrations: actualRegistrations, // ✅ Use actual citizens count
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
    <div className="team-view" style={{padding: '0'}}>
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
          <h2 style={{fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a202c'}}>👥 Team Management</h2>
          <p style={{color: '#64748b', fontSize: '14px', margin: '4px 0 0 0'}}>
            {isManager ? 'Manage all team members' : 'View your team members'}
          </p>
        </div>
        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
          <span style={{
            background: '#dbeafe',
            color: '#1e40af',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            📅 {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span style={{
            background: '#d1fae5',
            color: '#065f37',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            👥 {displayMembers.length} Members
          </span>
        </div>
      </div>

      {/* Stats Cards - Gradient with Hover */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f, #2a4a7a)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(30, 58, 95, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(30, 58, 95, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 95, 0.2)';
        }}>
          <div style={{fontSize: '28px', fontWeight: '700'}}>{teamStats.totalMembers}</div>
          <div style={{fontSize: '13px', opacity: 0.8}}>👥 Total Members</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #0b7e4b, #0a6a3f)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(11, 126, 75, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(11, 126, 75, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 126, 75, 0.2)';
        }}>
          <div style={{fontSize: '28px', fontWeight: '700'}}>{teamStats.onlineMembers}</div>
          <div style={{fontSize: '13px', opacity: 0.8}}>🟢 Online Now</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
        }}>
          <div style={{fontSize: '28px', fontWeight: '700'}}>{teamStats.totalReports}</div>
          <div style={{fontSize: '13px', opacity: 0.8}}>📋 Total Reports</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #d97706, #b45309)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(217, 119, 6, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.2)';
        }}>
          {/* ✅ FIX: Display actual citizens count */}
          <div style={{fontSize: '28px', fontWeight: '700'}}>{teamStats.totalRegistrations}</div>
          <div style={{fontSize: '13px', opacity: 0.8}}>🆔 Citizens Registered</div>
        </div>
      </div>

      {/* Filters - Enhanced */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '20px',
        alignItems: 'center',
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #f1f5f9',
        transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f0f4f8';
        e.currentTarget.style.borderColor = '#e2e8f0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#f8fafc';
        e.currentTarget.style.borderColor = '#f1f5f9';
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
            minWidth: '200px',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            outline: 'none'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#1e3a5f';
            e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 95, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#d1d5db';
            e.target.style.boxShadow = 'none';
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
            background: 'white',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            outline: 'none',
            cursor: 'pointer'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#1e3a5f';
            e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 95, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#d1d5db';
            e.target.style.boxShadow = 'none';
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

      {/* Team Cards Grid - Enhanced Hover */}
      <div className="team-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '16px'
      }}>
        {displayMembers.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #f1f5f9',
            color: '#64748b',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <div style={{fontSize: '48px', marginBottom: '8px'}}>👥</div>
            <div>No team members found</div>
          </div>
        )}
        {displayMembers.map((member, index) => {
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
                transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                border: '1px solid #f1f5f9',
                position: 'relative',
                animationDelay: `${index * 0.05}s`,
                opacity: 0,
                animation: 'fadeInUp 0.5s ease forwards'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.12)';
                e.currentTarget.style.borderColor = '#1e3a5f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#f1f5f9';
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
                             perf.status === 'offline' ? '#dc2626' : '#d97706',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
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
                  fontSize: '24px',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.background = '#d1dbe8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = '#e8edf5';
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
                    marginTop: '2px',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1e3a5f';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#e8edf5';
                    e.currentTarget.style.color = '#1e3a5f';
                  }}>
                    {member.region}
                  </div>
                </div>
              </div>

              {/* Stats Grid - ✅ Using actual citizens count */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '12px'
              }}>
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: '18px', fontWeight: '700', color: '#2563eb'}}>
                    {perf.reports}
                  </div>
                  <div style={{fontSize: '11px', color: '#64748b'}}>📋 Reports</div>
                </div>
                <div style={{textAlign: 'center'}}>
                  {/* ✅ FIX: Display actual citizens count */}
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
                color: '#4a90d9',
                transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1e3a5f';
                e.currentTarget.style.fontWeight = '600';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#4a90d9';
                e.currentTarget.style.fontWeight = '400';
              }}>
                Click to view details →
              </div>
            </div>
          );
        })}
      </div>

      {/* Officer Detail Modal - Enhanced */}
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
            maxWidth: '640px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'slideUp 0.3s ease',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div>
                <h3 style={{fontSize: '24px', fontWeight: '700', color: '#1a202c', margin: 0}}>
                  {selectedOfficer.name}
                </h3>
                <p style={{color: '#64748b', fontSize: '14px', margin: '4px 0 0 0'}}>
                  {selectedOfficer.employeeId} • {selectedOfficer.role?.replace('_', ' ')}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOfficer(null)} 
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1a202c';
                  e.currentTarget.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.transform = 'rotate(0)';
                }}
              >
                ✕
              </button>
            </div>

            {/* Detail Grid - Enhanced */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {[
                { label: 'Employee ID', value: selectedOfficer.employeeId },
                { label: 'Region', value: selectedOfficer.region },
                { label: 'Role', value: selectedOfficer.role?.replace('_', ' ') },
                { label: 'Shift', value: selectedOfficer.shift || 'Day' },
                { label: 'Status', value: selectedOfficer.status, color: selectedOfficer.status === 'active' ? '#0b7e4b' : '#dc2626' },
                { label: 'Phone', value: selectedOfficer.phone || 'N/A' }
              ].map((item, index) => (
                <div key={index} style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e8edf5';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.transform = 'scale(1)';
                }}>
                  <div style={{fontSize: '11px', color: '#64748b'}}>{item.label}</div>
                  <div style={{fontWeight: '600', color: item.color || '#1a202c'}}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Performance Summary - Enhanced with actual citizens */}
            <div style={{borderTop: '1px solid #f1f5f9', paddingTop: '16px'}}>
              <h4 style={{fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1a202c'}}>
                📊 Performance Summary
              </h4>
              {(() => {
                const perf = employeePerformance?.find(p => p.employeeId === selectedOfficer.employeeId);
                const screen = screenTime?.find(s => s.employeeId === selectedOfficer.employeeId && s.date === getToday());
                const status = liveStatus?.find(l => l.employeeId === selectedOfficer.employeeId);
                // ✅ FIX: Get actual citizens count
                const actualRegistrations = citizens.filter(c => c.registeredBy === selectedOfficer.employeeId).length;
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '8px'
                  }}>
                    {[
                      { label: '📋 Reports', value: perf?.totalReports || 0, color: '#2563eb' },
                      { label: '🆔 Citizens', value: actualRegistrations, color: '#d97706' }, // ✅ Actual citizens
                      { label: '⚡ Efficiency', value: `${perf?.avgEfficiency || 0}%`, color: '#0b7e4b' },
                      { label: '📊 Attendance', value: `${Math.round(perf?.attendanceRate || 0)}%`, color: '#7c3aed' },
                      { label: '🎯 Trust Score', value: `${screen?.trustScore || 0}%`, color: '#dc2626' },
                      { label: '📱 Productivity', value: `${status?.productivityScore || 0}%`, color: '#4a90d9' }
                    ].map((item, index) => (
                      <div key={index} style={{
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        textAlign: 'center',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e8edf5';
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      }}>
                        <div style={{fontSize: '22px', fontWeight: '700', color: item.color}}>{item.value}</div>
                        <div style={{fontSize: '11px', color: '#64748b'}}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Close Button */}
            <div style={{marginTop: '16px', display: 'flex', gap: '10px'}}>
              <button 
                onClick={() => setSelectedOfficer(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #1e3a5f, #2a4a7a)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  opacity: 1,
                  visibility: 'visible'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(30, 58, 95, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
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