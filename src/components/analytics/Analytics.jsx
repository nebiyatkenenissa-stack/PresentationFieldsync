import React, { useMemo } from 'react';

function Analytics({ 
  reports: allReports, 
  users, 
  attendance: allAttendance, 
  screenTime: allScreenTime, 
  liveStatus: allLiveStatus,
  citizens: allCitizens,
  renderBarChart 
}) {
  // ============================================================
  // FILTER ONLY SYNCED DATA
  // ============================================================
  const reports = useMemo(() => 
    (allReports || []).filter(r => r.synced === true), 
    [allReports]
  );
  
  const citizens = useMemo(() => 
    (allCitizens || []).filter(c => c.synced === true), 
    [allCitizens]
  );
  
  const attendance = useMemo(() => 
    (allAttendance || []).filter(a => a.synced === true), 
    [allAttendance]
  );
  
  const screenTime = useMemo(() => 
    (allScreenTime || []).filter(s => s.synced === true), 
    [allScreenTime]
  );
  
  const liveStatus = useMemo(() => 
    (allLiveStatus || []).filter(l => l.synced === true), 
    [allLiveStatus]
  );

  // ============================================================
  // COMPUTE METRICS FROM FILTERED DATA
  // ============================================================
  const totalReports = reports.length;
  const totalRegistrations = citizens.length;

  // Days with reports (for daily average)
  const daysWithReports = new Set(reports.map(r => r.reportDate)).size || 1;
  const dailyAvg = Math.round(totalRegistrations / daysWithReports);

  // Completion rate (approved / reviewed)
  const approvedReports = reports.filter(r => r.reviewed).length;
  const completionRate = totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0;

  // Region stats (from filtered reports & citizens)
  const regionStats = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.region]) map[r.region] = { reports: 0, registrations: 0, employees: new Set() };
      map[r.region].reports += 1;
    });
    citizens.forEach(c => {
      if (!map[c.region]) map[c.region] = { reports: 0, registrations: 0, employees: new Set() };
      map[c.region].registrations += 1;
      if (c.registeredBy) map[c.region].employees.add(c.registeredBy);
    });
    return Object.entries(map).map(([region, data]) => ({
      region,
      ...data,
      employees: data.employees.size
    }));
  }, [reports, citizens]);

  // Employee performance (from filtered data)
  const employeePerformance = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          region: r.region,
          totalReports: 0,
          totalRegistrations: 0,
          avgEfficiency: 0,
          attendanceRate: 0,
          totalWorkHours: 0,
          lateDays: 0,
          absentDays: 0,
          trustScore: 0,
          productivityScore: 0,
          tasksCompleted: 0,
          tasksInProgress: 0
        };
      }
      map[r.employeeId].totalReports += 1;
    });

    // Add registrations from citizens
    citizens.forEach(c => {
      if (c.registeredBy && map[c.registeredBy]) {
        map[c.registeredBy].totalRegistrations += 1;
      }
    });

    // Attendance
    attendance.forEach(a => {
      if (map[a.employeeId]) {
        const totalAtt = attendance.filter(att => att.employeeId === a.employeeId).length;
        const presentAtt = attendance.filter(att => att.employeeId === a.employeeId && att.status === 'present').length;
        map[a.employeeId].attendanceRate = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 0;
        map[a.employeeId].totalWorkHours += a.workHours || 0;
        if (a.status === 'late') map[a.employeeId].lateDays += 1;
        if (a.status === 'absent') map[a.employeeId].absentDays += 1;
      }
    });

    // Screen time trust scores
    screenTime.forEach(s => {
      if (map[s.employeeId]) {
        map[s.employeeId].trustScore = (s.trustScore && !isNaN(s.trustScore)) ? s.trustScore : 0;
      }
    });

    // Live status
    liveStatus.forEach(l => {
      if (map[l.employeeId]) {
        map[l.employeeId].productivityScore = l.productivityScore || 0;
        map[l.employeeId].tasksCompleted = l.tasksCompleted || 0;
        map[l.employeeId].tasksInProgress = l.tasksInProgress || 0;
      }
    });

    // Calculate avg efficiency (registrations per report, normalized)
    Object.values(map).forEach(emp => {
      emp.avgEfficiency = emp.totalReports > 0 
        ? Math.round((emp.totalRegistrations / (emp.totalReports * 100)) * 100) 
        : 0;
    });

    return Object.values(map);
  }, [reports, citizens, attendance, screenTime, liveStatus]);

  // ============================================================
  // DERIVED METRICS
  // ============================================================
  const avgEfficiency = employeePerformance.length > 0 
    ? Math.round(employeePerformance.reduce((sum, e) => sum + e.avgEfficiency, 0) / employeePerformance.length)
    : 0;

  const avgAttendance = employeePerformance.length > 0
    ? Math.round(employeePerformance.reduce((sum, e) => sum + e.attendanceRate, 0) / employeePerformance.length)
    : 0;

  const avgTrust = employeePerformance.length > 0
    ? Math.round(employeePerformance.reduce((sum, e) => sum + (e.trustScore || 0), 0) / employeePerformance.length)
    : 0;

  const topOfficers = [...employeePerformance]
    .sort((a, b) => b.totalRegistrations - a.totalRegistrations)
    .slice(0, 5);

  const totalOfficers = users?.filter(u => u.role === 'field_officer').length || 0;
  const totalSupervisors = users?.filter(u => u.role === 'supervisor').length || 0;

  const lowPerformers = [...employeePerformance]
    .filter(e => e.avgEfficiency < 30)
    .sort((a, b) => a.avgEfficiency - b.avgEfficiency)
    .slice(0, 3);

  // ============================================================
  // RENDER – same as before, but using computed filtered values
  // ============================================================
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
          <h2 style={{fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a202c'}}>📊 Statistics & Analytics</h2>
          <p style={{color: '#64748b', fontSize: '14px', margin: '4px 0 0 0'}}>Data-driven insights and performance metrics</p>
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
            📊 {totalReports} Reports
          </span>
        </div>
      </div>

      {/* Key Metrics Dashboard - With Hover Effects */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
          <div style={{fontSize: '32px', fontWeight: '700'}}>{totalRegistrations}</div>
          <div style={{fontSize: '14px', opacity: 0.8}}>🆔 Total Citizens Registered</div>
          <div style={{fontSize: '12px', opacity: 0.6, marginTop: '4px'}}>📈 +{dailyAvg} avg per day</div>
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
          <div style={{fontSize: '32px', fontWeight: '700'}}>{completionRate}%</div>
          <div style={{fontSize: '14px', opacity: 0.8}}>✅ Report Completion Rate</div>
          <div style={{fontSize: '12px', opacity: 0.6, marginTop: '4px'}}>📋 {approvedReports} approved out of {totalReports}</div>
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
          <div style={{fontSize: '32px', fontWeight: '700'}}>{avgEfficiency}%</div>
          <div style={{fontSize: '14px', opacity: 0.8}}>⚡ Average Efficiency</div>
          <div style={{fontSize: '12px', opacity: 0.6, marginTop: '4px'}}>🎯 Target: 80%</div>
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
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.2)';
        }}>
          <div style={{fontSize: '32px', fontWeight: '700'}}>{avgTrust}%</div>
          <div style={{fontSize: '14px', opacity: 0.8}}>🎯 Average Trust Score</div>
          <div style={{fontSize: '12px', opacity: 0.6, marginTop: '4px'}}>🔒 Based on screen time</div>
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
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
        }}>
          <div style={{fontSize: '32px', fontWeight: '700'}}>{lowPerformers.length}</div>
          <div style={{fontSize: '14px', opacity: 0.8}}>⚠️ Low Performers</div>
          <div style={{fontSize: '12px', opacity: 0.6, marginTop: '4px'}}>📉 Below 30% efficiency</div>
        </div>
      </div>

      {/* Two Column Layout - With Hover Effects */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* Regional Performance Chart */}
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
          <div style={{marginBottom: '16px'}}>
            <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>🌍 Regional Performance</h3>
            <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Citizens registered by region</p>
          </div>
          <div className="chart-container">
            {renderBarChart ? renderBarChart() : (
              <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>
                No data available
              </div>
            )}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '13px',
            color: '#64748b'
          }}>
            <span>🏆 Top Region: {regionStats?.length > 0 ? regionStats.sort((a, b) => b.registrations - a.registrations)[0]?.region || 'N/A' : 'N/A'}</span>
            <span>📊 Total Regions: {regionStats?.length || 0}</span>
          </div>
        </div>

        {/* Top Performers */}
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
          <h3 style={{fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#1a202c'}}>🏆 Top Performers</h3>
          {topOfficers.length === 0 ? (
            <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No data available</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {topOfficers.map((emp, i) => (
                <div key={emp.employeeId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
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
                }}>
                  <span style={{
                    fontWeight: '700',
                    color: i === 0 ? '#d97706' : '#64748b',
                    fontSize: i === 0 ? '18px' : '14px',
                    minWidth: '40px'
                  }}>
                    #{i + 1} {i === 0 ? '🏆' : ''}
                  </span>
                  <span style={{fontWeight: '600', flex: 1, fontSize: '14px'}}>{emp.employeeName}</span>
                  <span style={{color: '#64748b', fontSize: '12px'}}>{emp.region}</span>
                  <span style={{color: '#2563eb', fontWeight: '500', fontSize: '13px'}}>🆔 {emp.totalRegistrations}</span>
                  <span style={{color: '#0b7e4b', fontWeight: '600', fontSize: '13px'}}>{emp.avgEfficiency}%</span>
                  <span style={{color: '#7c3aed', fontSize: '13px'}}>📊 {Math.round(emp.attendanceRate)}%</span>
                  <span style={{color: '#dc2626', fontSize: '13px'}}>🎯 {emp.trustScore || 0}%</span>
                </div>
              ))}
            </div>
          )}
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '13px',
            color: '#64748b',
            textAlign: 'center'
          }}>
            🎯 Top performer registered {topOfficers[0]?.totalRegistrations || 0} citizens
          </div>
        </div>
      </div>

      {/* Quick Stats Cards - With Hover Effects */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
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
        }}>
          <div>
            <div style={{fontSize: '12px', color: '#64748b'}}>Field Officers</div>
            <div style={{fontSize: '24px', fontWeight: '700', color: '#1a202c'}}>{totalOfficers}</div>
          </div>
          <div style={{fontSize: '32px'}}>👥</div>
        </div>
        <div style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
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
        }}>
          <div>
            <div style={{fontSize: '12px', color: '#64748b'}}>Supervisors</div>
            <div style={{fontSize: '24px', fontWeight: '700', color: '#1a202c'}}>{totalSupervisors}</div>
          </div>
          <div style={{fontSize: '32px'}}>👤</div>
        </div>
        <div style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
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
        }}>
          <div>
            <div style={{fontSize: '12px', color: '#64748b'}}>Daily Avg Registrations</div>
            <div style={{fontSize: '24px', fontWeight: '700', color: '#1a202c'}}>{dailyAvg}</div>
          </div>
          <div style={{fontSize: '32px'}}>📈</div>
        </div>
        <div style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
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
        }}>
          <div>
            <div style={{fontSize: '12px', color: '#64748b'}}>Report Approval Rate</div>
            <div style={{fontSize: '24px', fontWeight: '700', color: '#1a202c'}}>{completionRate}%</div>
          </div>
          <div style={{fontSize: '32px'}}>✅</div>
        </div>
      </div>

      {/* Low Performers Warning - With Hover Effects */}
      {lowPerformers.length > 0 && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(220, 38, 38, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
            <span style={{fontSize: '20px'}}>⚠️</span>
            <h3 style={{fontSize: '16px', fontWeight: '600', color: '#991b1b', margin: 0}}>Low Performers Alert</h3>
          </div>
          <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
            {lowPerformers.map(emp => (
              <div key={emp.employeeId} style={{
                background: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #fca5a5',
                flex: '1',
                minWidth: '150px',
                transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{fontWeight: '600', fontSize: '14px'}}>{emp.employeeName}</div>
                <div style={{fontSize: '12px', color: '#64748b'}}>Efficiency: <span style={{color: '#dc2626', fontWeight: '600'}}>{emp.avgEfficiency}%</span></div>
                <div style={{fontSize: '12px', color: '#64748b'}}>Registrations: {emp.totalRegistrations}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize: '12px', color: '#991b1b', marginTop: '12px'}}>
            💡 These officers need additional training and support to improve performance.
          </div>
        </div>
      )}

      {/* Region Statistics - With Hover Effects */}
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
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
          <div>
            <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>📊 Region Statistics</h3>
            <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Detailed breakdown by region</p>
          </div>
          <span style={{fontSize: '12px', color: '#64748b'}}>
            Total: {regionStats?.reduce((sum, r) => sum + r.registrations, 0) || 0} citizens
          </span>
        </div>
        {!regionStats || regionStats.length === 0 ? (
          <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>No data available</div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {regionStats.map((region, idx) => {
              const maxVal = Math.max(...regionStats.map(r => r.registrations)) || 1;
              const colors = ['#1e3a5f', '#2b4c7a', '#4a7a9c', '#6b9ec4', '#2d6a4f', '#1a3a5f'];
              const percentage = Math.round((region.registrations / maxVal) * 100);
              return (
                <div 
                  key={region.region} 
                  style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    cursor: 'pointer',
                    padding: '4px 0',
                    borderRadius: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.padding = '4px 8px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.padding = '4px 0';
                  }}
                >
                  <span style={{fontSize: '14px', fontWeight: '500', minWidth: '70px', color: '#1a202c'}}>
                    {region.region}
                  </span>
                  <div style={{flex: 1, height: '28px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', position: 'relative'}}>
                    <div 
                      style={{
                        height: '100%',
                        width: `${percentage}%`,
                        background: colors[idx % colors.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '8px',
                        borderRadius: '6px',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                        minWidth: '30px',
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
                      <span style={{fontSize: '12px', fontWeight: '600', color: 'white'}}>
                        {region.registrations}
                      </span>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: '12px', minWidth: '120px'}}>
                    <span style={{fontSize: '12px', color: '#64748b'}}>
                      👥 {region.employees || 0}
                    </span>
                    <span style={{fontSize: '12px', color: '#2563eb'}}>
                      📊 {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '8px',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.padding = '8px 12px';
          e.currentTarget.style.borderRadius = '6px';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.padding = '0';
        }}>
          <span>🏆 Best Region: {regionStats?.length > 0 ? regionStats.sort((a, b) => b.registrations - a.registrations)[0]?.region || 'N/A' : 'N/A'}</span>
          <span>📈 Total Reports: {totalReports}</span>
          <span>🆔 Total Citizens: {totalRegistrations}</span>
        </div>
      </div>
    </div>
  );
}

export default Analytics;