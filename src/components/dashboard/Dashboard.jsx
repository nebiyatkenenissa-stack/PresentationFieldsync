import React, { useMemo } from 'react';
import { getToday } from '../../utils/helpers';

function Dashboard({ 
  isManager, isSupervisor, isOfficer, user, reports, users, 
  attendance, screenTime, leaves, permissions, totalReports, 
  totalRegistrations, attendanceSummary, teamMembers, 
  pendingLeaves, pendingPermissions, topPerformers, 
  teamPerformance, employeePerformance, renderTrendChart,
  citizens
}) {
  
  // Calculate registration trend data for chart
  const chartData = useMemo(() => {
    const today = new Date();
    const data = [];
    let max = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const value = reports.filter(r => r.reportDate === dateStr).reduce((sum, r) => sum + (r.registrations || 0), 0);
      data.push({ date: dateStr, value });
      if (value > max) max = value;
    }
    return { data, max: max || 1 };
  }, [reports]);

  // Region stats for chart - using actual citizens
  const regionStats = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.region]) map[r.region] = { reports: 0, registrations: 0 };
      map[r.region].reports += 1;
      map[r.region].registrations += citizens.filter(c => c.region === r.region).length;
    });
    return Object.entries(map).map(([region, data]) => ({ region, ...data }));
  }, [reports, citizens]);

  // Performance distribution for pie chart
  const performanceData = useMemo(() => {
    const total = reports.length || 1;
    const approved = reports.filter(r => r.reviewed).length;
    const pending = reports.filter(r => !r.reviewed && r.status !== 'rejected').length;
    const rejected = reports.filter(r => r.status === 'rejected').length;
    return [
      { name: 'Approved', value: Math.round((approved / total) * 100) },
      { name: 'Pending', value: Math.round((pending / total) * 100) },
      { name: 'Rejected', value: Math.round((rejected / total) * 100) }
    ];
  }, [reports]);

  const fieldOfficers = users.filter(u => u.role === 'field_officer').length;
  const supervisors = users.filter(u => u.role === 'supervisor').length;

  // Get today's attendance for officer
  const todayAttendance = useMemo(() => {
    if (!isOfficer || !user) return null;
    return attendance.find(a => a.employeeId === user.employeeId && a.date === getToday());
  }, [attendance, user, isOfficer]);

  // ========== SUPERVISOR: Get team citizen counts using actual citizens ==========
  const teamCitizenCount = useMemo(() => {
    if (!isSupervisor || !user || !teamMembers) return 0;
    const teamIds = teamMembers.map(m => m.employeeId);
    return citizens.filter(c => teamIds.includes(c.registeredBy)).length;
  }, [citizens, teamMembers, isSupervisor, user]);

  // ========== SUPERVISOR: Get team reports count ==========
  const teamReportsCount = useMemo(() => {
    if (!isSupervisor || !user || !teamMembers) return 0;
    const teamIds = teamMembers.map(m => m.employeeId);
    return reports.filter(r => teamIds.includes(r.employeeId)).length;
  }, [reports, teamMembers, isSupervisor, user]);

  // ========== OFFICER: Get officer's actual citizen count ==========
  const officerCitizenCount = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return citizens.filter(c => c.registeredBy === user.employeeId).length;
  }, [citizens, isOfficer, user]);

  // ========== OFFICER: Get officer's report count ==========
  const officerReportsCount = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return reports.filter(r => r.employeeId === user.employeeId).length;
  }, [reports, isOfficer, user]);

  // ========== OFFICER: Today's registrations using actual citizens ==========
  const officerTodayRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const today = getToday();
    return citizens.filter(c => c.registeredBy === user.employeeId && c.registrationDate?.slice(0, 10) === today).length;
  }, [citizens, isOfficer, user]);

  // ========== OFFICER: Total registrations from actual citizens ==========
  const officerTotalRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return citizens.filter(c => c.registeredBy === user.employeeId).length;
  }, [citizens, isOfficer, user]);

  // Color palette for gradient cards
  const cardColors = [
    { bg: 'linear-gradient(135deg, #1e3a5f, #2a4a7a)', icon: '📋', label: 'Total Reports' },
    { bg: 'linear-gradient(135deg, #0b7e4b, #0a6a3f)', icon: '🆔', label: 'Citizens Registered' },
    { bg: 'linear-gradient(135deg, #7c3aed, #6d28d9)', icon: '👤', label: 'Supervisors' },
    { bg: 'linear-gradient(135deg, #d97706, #b45309)', icon: '👥', label: 'Field Officers' },
    { bg: 'linear-gradient(135deg, #0b7e4b, #0a6a3f)', icon: '⚡', label: 'Attendance Rate' },
    { bg: 'linear-gradient(135deg, #dc2626, #b91c1c)', icon: '📅', label: 'Pending Leaves' },
    { bg: 'linear-gradient(135deg, #2563eb, #1d4ed8)', icon: '📋', label: 'Pending Permissions' }
  ];

  // Color palette for charts
  const chartColors = ['#1e3a5f', '#2b4c7a', '#4a7a9c', '#6b9ec4', '#2d6a4f', '#1a3a5f'];

  return (
    <div className="dashboard-view">
      {/* ==================== MANAGER VIEW ==================== */}
      {isManager && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h2 style={{fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a202c'}}>📊 Manager Dashboard</h2>
              <p style={{color: '#64748b', fontSize: '14px', margin: '4px 0 0 0'}}>Overview of all field operations</p>
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
                📊 {reports?.length || 0} Reports
              </span>
            </div>
          </div>

          {/* Stats Grid - Colorful Gradient Cards */}
          <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px'}}>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(30, 58, 95, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 95, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{totalReports}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📋 Total Reports</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(11, 126, 75, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 126, 75, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{totalRegistrations}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>🆔 Citizens Registered</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              padding: '20px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{supervisors}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>👤 Supervisors</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(217, 119, 6, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{fieldOfficers}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>👥 Field Officers</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(11, 126, 75, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 126, 75, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{attendanceSummary.rate}%</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>⚡ Attendance Rate</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              padding: '20px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{pendingLeaves}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📅 Pending Leaves</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{pendingPermissions}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📋 Pending Permissions</div>
            </div>
          </div>

          {/* Charts Row - Colorful */}
          <div className="charts-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px'}}>
            {/* Registration Trend Chart */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f1f5f9',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <div className="chart-header" style={{marginBottom: '16px'}}>
                <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>📈 Registration Trend (Last 7 Days)</h3>
                <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Daily citizen registration trends</p>
              </div>
              <div className="css-trend-chart">
                <div className="css-trend-labels" style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px'}}>
                  {chartData.data.map((d, i) => (
                    <div key={i} style={{textAlign: 'center', fontSize: '11px', color: '#64748b'}}>{d.date}</div>
                  ))}
                </div>
                <div className="css-trend-bars" style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', height: '180px', alignItems: 'end'}}>
                  {chartData.data.map((d, i) => (
                    <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end'}}>
                      <div 
                        style={{ 
                          width: '100%',
                          height: `${(d.value / chartData.max) * 100}%`,
                          background: d.value > 0 ? `linear-gradient(180deg, ${chartColors[i % chartColors.length]}, ${chartColors[(i + 1) % chartColors.length]})` : '#E5E7EB',
                          minHeight: d.value > 0 ? '20px' : '4px',
                          borderRadius: '4px 4px 0 0',
                          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          cursor: 'pointer',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = 'brightness(1.2)';
                          e.currentTarget.style.transform = 'scaleY(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = 'brightness(1)';
                          e.currentTarget.style.transform = 'scaleY(1)';
                        }}
                      >
                        <span style={{fontSize: '12px', fontWeight: '600', color: '#1a202c', paddingTop: '4px'}}>{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Distribution Chart */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f1f5f9',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <div className="chart-header" style={{marginBottom: '16px'}}>
                <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>📊 Performance Distribution</h3>
                <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Report status breakdown</p>
              </div>
              <div className="performance-chart" style={{display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0'}}>
                {performanceData.map((item, idx) => {
                  const colors = ['#0b7e4b', '#d97706', '#dc2626'];
                  return (
                    <div key={item.name} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <div style={{fontSize: '14px', fontWeight: '500', minWidth: '80px', color: '#1a202c'}}>{item.name}</div>
                      <div style={{flex: 1, height: '32px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', position: 'relative'}}>
                        <div 
                          style={{ 
                            width: `${item.value}%`,
                            height: '100%',
                            background: colors[idx % colors.length],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            borderRadius: '6px',
                            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                            minWidth: '20px',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = 'brightness(1.15)';
                            e.currentTarget.style.transform = 'scaleX(1.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'brightness(1)';
                            e.currentTarget.style.transform = 'scaleX(1)';
                          }}
                        >
                          <span style={{fontSize: '12px', fontWeight: '600', color: 'white'}}>{item.value}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Regional Performance Bar Chart */}
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #f1f5f9',
            marginBottom: '24px',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}>
            <div style={{marginBottom: '16px'}}>
              <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>🌍 Regional Performance</h3>
              <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Citizens registered by region</p>
            </div>
            <div className="css-chart" style={{display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0'}}>
              {regionStats.length > 0 ? (
                regionStats.map((region, idx) => {
                  const maxVal = Math.max(...regionStats.map(r => r.registrations)) || 1;
                  const colors = ['#1e3a5f', '#2b4c7a', '#4a7a9c', '#6b9ec4', '#2d6a4f', '#1a3a5f'];
                  return (
                    <div key={region.region} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <div style={{fontSize: '14px', fontWeight: '500', minWidth: '60px', color: '#1a202c'}}>{region.region}</div>
                      <div style={{flex: 1, height: '32px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', position: 'relative'}}>
                        <div 
                          style={{ 
                            width: `${(region.registrations / maxVal) * 100}%`,
                            height: '100%',
                            background: colors[idx % colors.length],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            borderRadius: '6px',
                            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                            minWidth: '20px',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = 'brightness(1.15)';
                            e.currentTarget.style.transform = 'scaleX(1.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'brightness(1)';
                            e.currentTarget.style.transform = 'scaleX(1)';
                          }}
                        >
                          <span style={{fontSize: '12px', fontWeight: '600', color: 'white'}}>{region.registrations}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>No data available</div>
              )}
            </div>
          </div>

          {/* Top Performers - Colorful */}
          <div className="top-performers" style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #f1f5f9'
          }}>
            <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1a202c'}}>🏆 Top Performing Officers</h3>
            <div className="performer-list" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {topPerformers.length === 0 ? (
                <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No performance data available</div>
              ) : (
                topPerformers.map((emp, i) => (
                  <div 
                    key={emp.employeeId} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      background: i === 0 ? '#fef3c7' : '#f8fafc',
                      borderRadius: '8px',
                      border: i === 0 ? '2px solid #d97706' : '1px solid #e5e7eb',
                      flexWrap: 'wrap',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(6px) scale(1.02)';
                      e.currentTarget.style.background = '#e8edf5';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0) scale(1)';
                      e.currentTarget.style.background = i === 0 ? '#fef3c7' : '#f8fafc';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
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
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== SUPERVISOR VIEW ==================== */}
      {isSupervisor && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h2 style={{fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a202c'}}>👨‍💼 Supervisor Dashboard</h2>
              <p style={{color: '#64748b', fontSize: '14px', margin: '4px 0 0 0'}}>Team overview and performance</p>
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
                👥 {teamMembers?.length || 0} Team Members
              </span>
            </div>
          </div>

          {/* Stats Grid - Colorful */}
          <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px'}}>
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              padding: '20px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{teamMembers.length}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>👥 Team Members</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{teamReportsCount}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📋 Team Reports</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(11, 126, 75, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 126, 75, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{teamCitizenCount}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>🆔 Team Registrations</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              padding: '20px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{pendingLeaves}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📅 Pending Leaves</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px'}}>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f1f5f9',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <div className="chart-header" style={{marginBottom: '16px'}}>
                <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>📈 Team Registration Trend (Last 7 Days)</h3>
                <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Daily registrations by your team</p>
              </div>
              <div className="css-trend-chart">
                <div className="css-trend-labels" style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px'}}>
                  {chartData.data.map((d, i) => (
                    <div key={i} style={{textAlign: 'center', fontSize: '11px', color: '#64748b'}}>{d.date}</div>
                  ))}
                </div>
                <div className="css-trend-bars" style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', height: '180px', alignItems: 'end'}}>
                  {chartData.data.map((d, i) => (
                    <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end'}}>
                      <div 
                        style={{ 
                          width: '100%',
                          height: `${(d.value / chartData.max) * 100}%`,
                          background: d.value > 0 ? 'linear-gradient(180deg, #2b4c7a, #6b9ec4)' : '#E5E7EB',
                          minHeight: d.value > 0 ? '20px' : '4px',
                          borderRadius: '4px 4px 0 0',
                          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = 'brightness(1.2)';
                          e.currentTarget.style.transform = 'scaleY(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = 'brightness(1)';
                          e.currentTarget.style.transform = 'scaleY(1)';
                        }}
                      >
                        <span style={{fontSize: '12px', fontWeight: '600', color: '#1a202c', paddingTop: '4px'}}>{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f1f5f9',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}>
              <div className="chart-header" style={{marginBottom: '16px'}}>
                <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>📊 Team Performance</h3>
                <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Team report status breakdown</p>
              </div>
              <div className="performance-chart" style={{display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0'}}>
                {performanceData.map((item, idx) => {
                  const colors = ['#0b7e4b', '#d97706', '#dc2626'];
                  return (
                    <div key={item.name} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <div style={{fontSize: '14px', fontWeight: '500', minWidth: '80px', color: '#1a202c'}}>{item.name}</div>
                      <div style={{flex: 1, height: '32px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', position: 'relative'}}>
                        <div 
                          style={{ 
                            width: `${item.value}%`,
                            height: '100%',
                            background: colors[idx % colors.length],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            borderRadius: '6px',
                            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                            minWidth: '20px',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = 'brightness(1.15)';
                            e.currentTarget.style.transform = 'scaleX(1.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'brightness(1)';
                            e.currentTarget.style.transform = 'scaleX(1)';
                          }}
                        >
                          <span style={{fontSize: '12px', fontWeight: '600', color: 'white'}}>{item.value}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Team Performance List - Colorful */}
          <div className="top-performers" style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #f1f5f9'
          }}>
            <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1a202c'}}>🏆 Team Performance</h3>
            {teamPerformance.length === 0 ? (
              <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No team performance data yet</div>
            ) : (
              <div className="performer-list" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {teamPerformance.map((emp, i) => (
                  <div 
                    key={emp.employeeId} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      background: i === 0 ? '#fef3c7' : '#f8fafc',
                      borderRadius: '8px',
                      border: i === 0 ? '2px solid #d97706' : '1px solid #e5e7eb',
                      flexWrap: 'wrap',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(6px) scale(1.02)';
                      e.currentTarget.style.background = '#e8edf5';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0) scale(1)';
                      e.currentTarget.style.background = i === 0 ? '#fef3c7' : '#f8fafc';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{fontWeight: '700', color: i === 0 ? '#d97706' : '#64748b', minWidth: '40px'}}>
                      #{i + 1} {i === 0 ? '🏆' : ''}
                    </span>
                    <span style={{fontWeight: '600', flex: 1}}>{emp.employeeName}</span>
                    <span style={{color: '#64748b', fontSize: '13px'}}>{emp.region}</span>
                    <span style={{color: '#2563eb', fontWeight: '500'}}>🆔 {emp.totalRegistrations}</span>
                    <span style={{color: '#0b7e4b', fontWeight: '600'}}>{emp.avgEfficiency}%</span>
                    <span style={{color: '#7c3aed'}}>📊 {Math.round(emp.attendanceRate)}%</span>
                  </div>
                ))}
                {employeePerformance.find(p => p.employeeId === user.employeeId) && (
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      background: '#e8edf5',
                      border: '2px solid #1e3a5f',
                      borderRadius: '8px',
                      flexWrap: 'wrap',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(6px) scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0) scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{fontWeight: '700', color: '#1e3a5f', minWidth: '40px'}}>👨‍💼</span>
                    <span style={{fontWeight: '600', flex: 1}}>{user.name} (You)</span>
                    <span style={{color: '#64748b', fontSize: '13px'}}>{user.region}</span>
                    <span style={{color: '#2563eb', fontWeight: '500'}}>🆔 {employeePerformance.find(p => p.employeeId === user.employeeId)?.totalRegistrations || 0}</span>
                    <span style={{color: '#0b7e4b', fontWeight: '600'}}>{employeePerformance.find(p => p.employeeId === user.employeeId)?.avgEfficiency || 0}%</span>
                    <span style={{color: '#7c3aed'}}>📊 {Math.round(employeePerformance.find(p => p.employeeId === user.employeeId)?.attendanceRate || 0)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== FIELD OFFICER VIEW ==================== */}
      {isOfficer && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h2 style={{fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a202c'}}>👤 Field Officer Dashboard</h2>
              <p style={{color: '#64748b', fontSize: '14px', margin: '4px 0 0 0'}}>Your personal performance overview</p>
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
                📊 {officerReportsCount} Reports
              </span>
            </div>
          </div>

          {/* Stats Grid - Colorful */}
          <div className="stats-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px'}}>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{officerReportsCount}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📋 My Reports</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(11, 126, 75, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 126, 75, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{officerTotalRegistrations}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>🆔 Citizens Registered</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              padding: '20px',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{pendingLeaves}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📅 Pending Leaves</div>
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
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(217, 119, 6, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.2)';
            }}>
              <div style={{fontSize: '28px', fontWeight: '700'}}>{pendingPermissions}</div>
              <div style={{fontSize: '13px', opacity: 0.8}}>📋 Pending Permissions</div>
            </div>
          </div>

          {/* Officer Quick Stats */}
          <div className="officer-quick-stats" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '16px', marginBottom: '24px'}}>
            {[
              { label: "📋 Today's Reports", value: reports.filter(r => r.employeeId === user.employeeId && r.reportDate === getToday()).length },
              { label: "🆔 Today's Registrations", value: officerTodayRegistrations },
              { label: '⚡ Efficiency', value: `${Math.round((officerTotalRegistrations / (officerReportsCount || 1) / 100) * 100)}%` },
              { label: '📋 Attendance', value: todayAttendance?.status || 'Not Marked' },
              { label: '🎯 Trust Score', value: `${screenTime.find(s => s.employeeId === user.employeeId && s.date === getToday())?.trustScore || 0}%` }
            ].map((stat, index) => (
              <div 
                key={index}
                style={{
                  background: 'white',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  cursor: 'pointer',
                  border: '1px solid #f1f5f9'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                  e.currentTarget.style.background = '#f0f4f8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  e.currentTarget.style.background = 'white';
                }}
              >
                <span style={{fontSize: '14px', color: '#64748b'}}>{stat.label}</span>
                <strong style={{fontSize: '20px', color: '#1a202c'}}>{stat.value}</strong>
              </div>
            ))}
          </div>

          {/* Officer Performance Chart */}
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #f1f5f9',
            marginBottom: '24px',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}>
            <div className="chart-header" style={{marginBottom: '16px'}}>
              <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>📈 My Registration Trend (Last 7 Days)</h3>
              <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Your daily registration performance</p>
            </div>
            <div className="css-trend-chart">
              <div className="css-trend-labels" style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px'}}>
                {chartData.data.map((d, i) => (
                  <div key={i} style={{textAlign: 'center', fontSize: '11px', color: '#64748b'}}>{d.date}</div>
                ))}
              </div>
              <div className="css-trend-bars" style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', height: '180px', alignItems: 'end'}}>
                {chartData.data.map((d, i) => {
                  const officerValue = citizens.filter(c => c.registeredBy === user.employeeId && c.registrationDate?.slice(0, 10) === d.date).length;
                  return (
                    <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end'}}>
                      <div 
                        style={{ 
                          width: '100%',
                          height: `${(officerValue / chartData.max) * 100}%`,
                          background: officerValue > 0 ? 'linear-gradient(180deg, #0b7e4b, #4ade80)' : '#E5E7EB',
                          minHeight: officerValue > 0 ? '20px' : '4px',
                          borderRadius: '4px 4px 0 0',
                          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = 'brightness(1.2)';
                          e.currentTarget.style.transform = 'scaleY(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = 'brightness(1)';
                          e.currentTarget.style.transform = 'scaleY(1)';
                        }}
                      >
                        <span style={{fontSize: '12px', fontWeight: '600', color: '#1a202c', paddingTop: '4px'}}>{officerValue}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Officer Attendance Status - Colorful */}
          <div className="attendance-status-card" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #f1f5f9'
          }}>
            <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1a202c'}}>📊 Today's Attendance Status</h3>
            <div className="attendance-status-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px'}}>
              {[
                { label: 'Status', value: todayAttendance?.status || 'Not Marked', color: todayAttendance?.status === 'present' ? '#0b7e4b' : todayAttendance?.status === 'late' ? '#d97706' : todayAttendance?.status === 'absent' ? '#dc2626' : '#6b7f94' },
                { label: 'Check In', value: todayAttendance?.checkIn || '--:--', color: '#1a202c' },
                { label: 'Check Out', value: todayAttendance?.checkOut || '--:--', color: '#1a202c' },
                { label: 'Work Hours', value: `${todayAttendance?.workHours || 0}h`, color: '#1a202c' }
              ].map((item, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.03)';
                    e.currentTarget.style.background = '#e8edf5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                >
                  <span style={{fontSize: '12px', color: '#64748b'}}>{item.label}</span>
                  <span style={{fontSize: '16px', fontWeight: '600', color: item.color}}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;