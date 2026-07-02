import React, { useMemo } from 'react';
import { getToday } from '../../utils/helpers';

function Dashboard({ 
  isManager, isSupervisor, isOfficer, user, reports, users, 
  attendance, screenTime, leaves, permissions, totalReports, 
  totalRegistrations, attendanceSummary, teamMembers, 
  pendingLeaves, pendingPermissions, topPerformers, 
  teamPerformance, employeePerformance, renderTrendChart 
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

  // Region stats for chart
  const regionStats = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.region]) map[r.region] = { reports: 0, registrations: 0 };
      map[r.region].reports += 1;
      map[r.region].registrations += r.registrations || 0;
    });
    return Object.entries(map).map(([region, data]) => ({ region, ...data }));
  }, [reports]);

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

  // Get today's attendance for officer
  const todayAttendance = useMemo(() => {
    if (!isOfficer || !user) return null;
    return attendance.find(a => a.employeeId === user.employeeId && a.date === getToday());
  }, [attendance, user, isOfficer]);

  return (
    <div className="dashboard-view">
      {/* ==================== MANAGER VIEW ==================== */}
      {isManager && (
        <>
          <div className="dashboard-header">
            <h2>📊 Manager Dashboard</h2>
            <p>Overview of all field operations</p>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📋</div>
              <div className="stat-info">
                <div className="stat-value">{totalReports}</div>
                <div className="stat-label">Total Reports</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>🆔</div>
              <div className="stat-info">
                <div className="stat-value">{totalRegistrations}</div>
                <div className="stat-label">Citizens Registered</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>👥</div>
              <div className="stat-info">
                <div className="stat-value">{fieldOfficers}</div>
                <div className="stat-label">Field Officers</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>⚡</div>
              <div className="stat-info">
                <div className="stat-value">{attendanceSummary.rate}%</div>
                <div className="stat-label">Attendance Rate</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📅</div>
              <div className="stat-info">
                <div className="stat-value">{pendingLeaves}</div>
                <div className="stat-label">Pending Leaves</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📋</div>
              <div className="stat-info">
                <div className="stat-value">{pendingPermissions}</div>
                <div className="stat-label">Pending Permissions</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-row">
            {/* Registration Trend Chart */}
            <div className="trend-chart-card">
              <div className="chart-header">
                <h3>📈 Registration Trend (Last 7 Days)</h3>
                <p>Daily citizen registration trends</p>
              </div>
              <div className="css-trend-chart">
                <div className="css-trend-labels">
                  {chartData.data.map((d, i) => (
                    <div key={i} className="css-trend-label">{d.date}</div>
                  ))}
                </div>
                <div className="css-trend-bars">
                  {chartData.data.map((d, i) => (
                    <div key={i} className="css-trend-bar-wrapper">
                      <div className="css-trend-bar" style={{ 
                        height: `${(d.value / chartData.max) * 100}%`,
                        background: d.value > 0 ? '#1e3a5f' : '#E5E7EB',
                        minHeight: d.value > 0 ? '20px' : '4px'
                      }}>
                        <span className="css-trend-value">{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Distribution Chart */}
            <div className="trend-chart-card">
              <div className="chart-header">
                <h3>📊 Performance Distribution</h3>
                <p>Report status breakdown</p>
              </div>
              <div className="performance-chart">
                {performanceData.map((item, idx) => {
                  const colors = ['#0b7e4b', '#d97706', '#dc2626'];
                  return (
                    <div key={item.name} className="performance-bar-wrapper">
                      <div className="performance-label">{item.name}</div>
                      <div className="performance-bar-container">
                        <div className="performance-bar" style={{ 
                          width: `${item.value}%`,
                          background: colors[idx % colors.length]
                        }}>
                          <span className="performance-value">{item.value}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Regional Performance Bar Chart */}
          <div className="trend-chart-card">
            <div className="chart-header">
              <h3>📊 Regional Performance</h3>
              <p>Citizens registered by region</p>
            </div>
            <div className="css-chart">
              {regionStats.length > 0 ? (
                regionStats.map((region, idx) => {
                  const maxVal = Math.max(...regionStats.map(r => r.registrations)) || 1;
                  const colors = ['#1e3a5f', '#2b4c7a', '#4a7a9c', '#6b9ec4', '#2d6a4f', '#1a3a5f'];
                  return (
                    <div key={region.region} className="css-chart-bar-wrapper">
                      <div className="css-chart-label">{region.region}</div>
                      <div className="css-chart-bar-container">
                        <div className="css-chart-bar" style={{ 
                          width: `${(region.registrations / maxVal) * 100}%`,
                          background: colors[idx % colors.length]
                        }}>
                          <span className="css-chart-value">{region.registrations}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="chart-empty">No data available</div>
              )}
            </div>
          </div>

          {/* Top Performers */}
          <div className="top-performers">
            <h3>🏆 Top Performing Officers</h3>
            <div className="performer-list">
              {topPerformers.length === 0 ? (
                <div className="empty-state">No performance data available</div>
              ) : (
                topPerformers.map((emp, i) => (
                  <div key={emp.employeeId} className="performer-item">
                    <span className="performer-rank">#{i + 1}</span>
                    <span className="performer-name">{emp.employeeName}</span>
                    <span className="performer-region">{emp.region}</span>
                    <span className="performer-stats">🆔 {emp.totalRegistrations} citizens</span>
                    <span className="performer-efficiency">{emp.avgEfficiency}%</span>
                    <span className="performer-attendance">📊 {Math.round(emp.attendanceRate)}%</span>
                    <span className="performer-trust">🎯 {emp.trustScore || 0}%</span>
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
          <div className="dashboard-header">
            <h2>👨‍💼 Supervisor Dashboard</h2>
            <p>Team overview and performance</p>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>👥</div>
              <div className="stat-info">
                <div className="stat-value">{teamMembers.length}</div>
                <div className="stat-label">Team Members</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📋</div>
              <div className="stat-info">
                <div className="stat-value">{reports.filter(r => teamMembers.some(m => m.employeeId === r.employeeId)).length}</div>
                <div className="stat-label">Team Reports</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>🆔</div>
              <div className="stat-info">
                <div className="stat-value">{reports.filter(r => teamMembers.some(m => m.employeeId === r.employeeId)).reduce((sum, r) => sum + (r.registrations || 0), 0)}</div>
                <div className="stat-label">Team Registrations</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📅</div>
              <div className="stat-info">
                <div className="stat-value">{pendingLeaves}</div>
                <div className="stat-label">Pending Leaves</div>
              </div>
            </div>
          </div>

          {/* Charts Row for Supervisor */}
          <div className="charts-row">
            {/* Team Registration Trend */}
            <div className="trend-chart-card">
              <div className="chart-header">
                <h3>📈 Team Registration Trend (Last 7 Days)</h3>
                <p>Daily registrations by your team</p>
              </div>
              <div className="css-trend-chart">
                <div className="css-trend-labels">
                  {chartData.data.map((d, i) => (
                    <div key={i} className="css-trend-label">{d.date}</div>
                  ))}
                </div>
                <div className="css-trend-bars">
                  {chartData.data.map((d, i) => (
                    <div key={i} className="css-trend-bar-wrapper">
                      <div className="css-trend-bar" style={{ 
                        height: `${(d.value / chartData.max) * 100}%`,
                        background: d.value > 0 ? '#2b4c7a' : '#E5E7EB',
                        minHeight: d.value > 0 ? '20px' : '4px'
                      }}>
                        <span className="css-trend-value">{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team Performance Distribution */}
            <div className="trend-chart-card">
              <div className="chart-header">
                <h3>📊 Team Performance</h3>
                <p>Team report status breakdown</p>
              </div>
              <div className="performance-chart">
                {performanceData.map((item, idx) => {
                  const colors = ['#0b7e4b', '#d97706', '#dc2626'];
                  return (
                    <div key={item.name} className="performance-bar-wrapper">
                      <div className="performance-label">{item.name}</div>
                      <div className="performance-bar-container">
                        <div className="performance-bar" style={{ 
                          width: `${item.value}%`,
                          background: colors[idx % colors.length]
                        }}>
                          <span className="performance-value">{item.value}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Team Performance List */}
          <div className="top-performers">
            <h3>🏆 Team Performance</h3>
            {teamPerformance.length === 0 ? (
              <div className="empty-state"><div>No team performance data yet</div></div>
            ) : (
              <div className="performer-list">
                {teamPerformance.map((emp, i) => (
                  <div key={emp.employeeId} className="performer-item">
                    <span className="performer-rank">#{i + 1}</span>
                    <span className="performer-name">{emp.employeeName}</span>
                    <span className="performer-region">{emp.region}</span>
                    <span className="performer-stats">🆔 {emp.totalRegistrations} citizens</span>
                    <span className="performer-efficiency">{emp.avgEfficiency}%</span>
                    <span className="performer-attendance">📊 {Math.round(emp.attendanceRate)}%</span>
                  </div>
                ))}
                {employeePerformance.find(p => p.employeeId === user.employeeId) && (
                  <div className="performer-item" style={{background: '#e8edf5', border: '2px solid #1e3a5f'}}>
                    <span className="performer-rank">👨‍💼</span>
                    <span className="performer-name">{user.name} (You)</span>
                    <span className="performer-region">{user.region}</span>
                    <span className="performer-stats">🆔 {employeePerformance.find(p => p.employeeId === user.employeeId)?.totalRegistrations || 0} citizens</span>
                    <span className="performer-efficiency">{employeePerformance.find(p => p.employeeId === user.employeeId)?.avgEfficiency || 0}%</span>
                    <span className="performer-attendance">📊 {Math.round(employeePerformance.find(p => p.employeeId === user.employeeId)?.attendanceRate || 0)}%</span>
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
          <div className="dashboard-header">
            <h2>👤 Field Officer Dashboard</h2>
            <p>Your personal performance overview</p>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📋</div>
              <div className="stat-info">
                <div className="stat-value">{reports.filter(r => r.employeeId === user.employeeId).length}</div>
                <div className="stat-label">My Reports</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>🆔</div>
              <div className="stat-info">
                <div className="stat-value">{reports.filter(r => r.employeeId === user.employeeId).reduce((sum, r) => sum + (r.registrations || 0), 0)}</div>
                <div className="stat-label">Citizens Registered</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📅</div>
              <div className="stat-info">
                <div className="stat-value">{pendingLeaves}</div>
                <div className="stat-label">Pending Leaves</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background:'#e8edf5'}}>📋</div>
              <div className="stat-info">
                <div className="stat-value">{pendingPermissions}</div>
                <div className="stat-label">Pending Permissions</div>
              </div>
            </div>
          </div>

          {/* Officer Quick Stats */}
          <div className="officer-quick-stats">
            <div className="quick-stat">
              <span>📋 Today's Reports</span>
              <strong>{reports.filter(r => r.employeeId === user.employeeId && r.reportDate === getToday()).length}</strong>
            </div>
            <div className="quick-stat">
              <span>🆔 Today's Registrations</span>
              <strong>{reports.filter(r => r.employeeId === user.employeeId && r.reportDate === getToday()).reduce((sum, r) => sum + (r.registrations || 0), 0)}</strong>
            </div>
            <div className="quick-stat">
              <span>⚡ Efficiency</span>
              <strong>{Math.round((reports.filter(r => r.employeeId === user.employeeId).reduce((sum, r) => sum + (r.registrations || 0), 0) / (reports.filter(r => r.employeeId === user.employeeId).length || 1) / 100) * 100)}%</strong>
            </div>
            <div className="quick-stat">
              <span>📋 Attendance</span>
              <strong>{todayAttendance?.status || 'Not Marked'}</strong>
            </div>
            <div className="quick-stat">
              <span>🎯 Trust Score</span>
              <strong>{screenTime.find(s => s.employeeId === user.employeeId && s.date === getToday())?.trustScore || 0}%</strong>
            </div>
          </div>

          {/* Officer Performance Chart */}
          <div className="trend-chart-card">
            <div className="chart-header">
              <h3>📈 My Registration Trend (Last 7 Days)</h3>
              <p>Your daily registration performance</p>
            </div>
            <div className="css-trend-chart">
              <div className="css-trend-labels">
                {chartData.data.map((d, i) => (
                  <div key={i} className="css-trend-label">{d.date}</div>
                ))}
              </div>
              <div className="css-trend-bars">
                {chartData.data.map((d, i) => {
                  const officerReports = reports.filter(r => r.employeeId === user.employeeId && r.reportDate === d.date);
                  const officerValue = officerReports.reduce((sum, r) => sum + (r.registrations || 0), 0);
                  return (
                    <div key={i} className="css-trend-bar-wrapper">
                      <div className="css-trend-bar" style={{ 
                        height: `${(officerValue / chartData.max) * 100}%`,
                        background: officerValue > 0 ? '#0b7e4b' : '#E5E7EB',
                        minHeight: officerValue > 0 ? '20px' : '4px'
                      }}>
                        <span className="css-trend-value">{officerValue}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Officer Attendance Status */}
          <div className="attendance-status-card">
            <h3>📊 Today's Attendance Status</h3>
            <div className="attendance-status-grid">
              <div className="status-item">
                <span className="status-label">Status</span>
                <span className={`status-value ${todayAttendance?.status || 'not-marked'}`}>
                  {todayAttendance?.status || 'Not Marked'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Check In</span>
                <span className="status-value">{todayAttendance?.checkIn || '--:--'}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Check Out</span>
                <span className="status-value">{todayAttendance?.checkOut || '--:--'}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Work Hours</span>
                <span className="status-value">{todayAttendance?.workHours || 0}h</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;