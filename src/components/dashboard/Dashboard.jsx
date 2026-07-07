// components/dashboard/Dashboard.js

import React, { useMemo, useCallback } from 'react';
import { getToday } from '../../utils/helpers';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell
} from 'recharts';

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

  // Region stats with East, South, North, West
  const regionStats = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.region]) map[r.region] = { reports: 0, registrations: 0 };
      map[r.region].reports += 1;
      map[r.region].registrations += citizens.filter(c => c.region === r.region).length;
    });
    return Object.entries(map).map(([region, data]) => ({ region, ...data }));
  }, [reports, citizens]);

  // ===== REAL DATA: Report Status Distribution =====
  const reportStatusData = useMemo(() => {
    if (!reports || reports.length === 0) return [];
    const statuses = { 'Approved': 0, 'Pending': 0, 'Rejected': 0 };
    reports.forEach(r => {
      if (r.reviewed && r.status !== 'rejected') statuses['Approved']++;
      else if (r.status === 'rejected') statuses['Rejected']++;
      else statuses['Pending']++;
    });
    return Object.entries(statuses)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [reports]);

  // ===== REAL DATA: Today's Attendance Status =====
  const todayAttendanceData = useMemo(() => {
    if (!attendance || attendance.length === 0) return [];
    const today = getToday();
    const todayAtt = attendance.filter(a => a.date === today);
    if (todayAtt.length === 0) return [];
    const statuses = { 'Present': 0, 'Late': 0, 'Absent': 0, 'Half Day': 0 };
    todayAtt.forEach(a => {
      if (a.status === 'present') statuses['Present']++;
      else if (a.status === 'late') statuses['Late']++;
      else if (a.status === 'absent') statuses['Absent']++;
      else if (a.status === 'half_day') statuses['Half Day']++;
    });
    return Object.entries(statuses)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [attendance]);

  // ===== REAL DATA: Leave Status Distribution =====
  const leaveStatusData = useMemo(() => {
    if (!leaves || leaves.length === 0) return [];
    const statuses = { 'Approved': 0, 'Pending': 0, 'Rejected': 0 };
    leaves.forEach(l => {
      if (l.status === 'approved') statuses['Approved']++;
      else if (l.status === 'rejected') statuses['Rejected']++;
      else statuses['Pending']++;
    });
    return Object.entries(statuses)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [leaves]);

  // ===== REAL DATA: Permission Status Distribution =====
  const permissionStatusData = useMemo(() => {
    if (!permissions || permissions.length === 0) return [];
    const statuses = { 'Approved': 0, 'Pending': 0, 'Rejected': 0 };
    permissions.forEach(p => {
      if (p.status === 'approved') statuses['Approved']++;
      else if (p.status === 'rejected') statuses['Rejected']++;
      else statuses['Pending']++;
    });
    return Object.entries(statuses)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [permissions]);

  // ===== REAL DATA: Officer's personal performance =====
  const officerPerformanceData = useMemo(() => {
    if (!isOfficer || !user) return [];
    const today = getToday();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const registrations = citizens.filter(c => 
        c.registeredBy === user.employeeId && 
        c.registrationDate?.slice(0, 10) === dateStr
      ).length;
      const reportsCount = reports.filter(r => 
        r.employeeId === user.employeeId && 
        r.reportDate === dateStr
      ).length;
      last7Days.push({ 
        date: dateStr, 
        registrations, 
        reports: reportsCount,
        efficiency: reportsCount > 0 ? Math.round((registrations / reportsCount) * 100) : 0
      });
    }
    return last7Days;
  }, [citizens, reports, isOfficer, user]);

  const fieldOfficers = users.filter(u => u.role === 'field_officer').length;
  const supervisors = users.filter(u => u.role === 'supervisor').length;

  // Get today's attendance for officer
  const todayAttendance = useMemo(() => {
    if (!isOfficer || !user) return null;
    return attendance.find(a => a.employeeId === user.employeeId && a.date === getToday());
  }, [attendance, user, isOfficer]);

  // ========== SUPERVISOR: Team citizen counts ==========
  const teamCitizenCount = useMemo(() => {
    if (!isSupervisor || !user || !teamMembers) return 0;
    const teamIds = teamMembers.map(m => m.employeeId);
    return citizens.filter(c => teamIds.includes(c.registeredBy)).length;
  }, [citizens, teamMembers, isSupervisor, user]);

  // ========== SUPERVISOR: Team reports count ==========
  const teamReportsCount = useMemo(() => {
    if (!isSupervisor || !user || !teamMembers) return 0;
    const teamIds = teamMembers.map(m => m.employeeId);
    return reports.filter(r => teamIds.includes(r.employeeId)).length;
  }, [reports, teamMembers, isSupervisor, user]);

  // ========== OFFICER: Officer's actual citizen count ==========
  const officerCitizenCount = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return citizens.filter(c => c.registeredBy === user.employeeId).length;
  }, [citizens, isOfficer, user]);

  // ========== OFFICER: Officer's report count ==========
  const officerReportsCount = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return reports.filter(r => r.employeeId === user.employeeId).length;
  }, [reports, isOfficer, user]);

  // ========== OFFICER: Today's registrations ==========
  const officerTodayRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const today = getToday();
    return citizens.filter(c => c.registeredBy === user.employeeId && c.registrationDate?.slice(0, 10) === today).length;
  }, [citizens, isOfficer, user]);

  // ========== OFFICER: Total registrations ==========
  const officerTotalRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return citizens.filter(c => c.registeredBy === user.employeeId).length;
  }, [citizens, isOfficer, user]);

  const CHART_COLORS = ['#1e3a5f', '#2d6a4f', '#7c3aed', '#d97706', '#0b7e4b', '#2563eb'];

  // Custom tooltip for charts - memoized to prevent recreation
  const CustomTooltip = useCallback(({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          background: 'white', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          fontSize: '13px'
        }}>
          <p style={{ margin: 0, fontWeight: '600', color: '#1a202c' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color }}>
              {entry.name}: <strong>{entry.value}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  }, []);

  // Pre-compute chart data to prevent recreation
  const registrationChartData = useMemo(() => {
    return chartData.data.map(d => ({ name: d.date, value: d.value }));
  }, [chartData.data]);

  const officerRegistrationChartData = useMemo(() => {
    if (!isOfficer || !user) return [];
    return officerPerformanceData.map(d => ({ date: d.date, value: d.registrations }));
  }, [officerPerformanceData, isOfficer, user]);

  const officerEfficiencyChartData = useMemo(() => {
    if (!isOfficer || !user) return [];
    return officerPerformanceData.map(d => ({ date: d.date, value: d.efficiency }));
  }, [officerPerformanceData, isOfficer, user]);

  // Memoized chart render function
  const renderChart = useCallback((type, data, colors = CHART_COLORS, xAxisKey = 'name') => {
    if (!data || data.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px' }}>
          No data available
        </div>
      );
    }

    const getStatusColor = (name) => {
      const colorMap = {
        'Approved': '#0b7e4b',
        'Pending': '#d97706',
        'Rejected': '#dc2626',
        'Present': '#0b7e4b',
        'Late': '#d97706',
        'Absent': '#dc2626',
        'Half Day': '#7c3aed'
      };
      return colorMap[name] || '#1e3a5f';
    };

    switch(type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: '#4a5568' }} />
              <YAxis tick={{ fontSize: 12, fill: '#4a5568' }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getStatusColor(entry.name) || CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#4a5568' }} />
              <YAxis tick={{ fontSize: 12, fill: '#4a5568' }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ r: 4, fill: colors[0] }} />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#4a5568' }} />
              <YAxis tick={{ fontSize: 12, fill: '#4a5568' }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      
      default:
        return null;
    }
  }, [CustomTooltip]);

  // Chart wrapper component
  const ChartWrapper = useCallback(({ children, title, subtitle }) => (
    <div style={{
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #e5e7eb',
      height: '100%'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1a202c' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  ), []);

  // Stats Card component
  const StatsCard = useCallback(({ label, value, color, icon }) => (
    <div style={{
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      padding: '20px',
      borderRadius: '8px',
      color: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    }}>
      <div style={{ fontSize: '26px', fontWeight: '700' }}>{value}</div>
      <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>{icon} {label}</div>
    </div>
  ), []);

  return (
    <div className="dashboard-view" style={{ padding: '0 4px' }}>
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
              <h2 style={{fontSize: '22px', fontWeight: '700', margin: 0, color: '#1a202c'}}>📊 Manager Dashboard</h2>
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
                📅 {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

          {/* Stats Grid */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px'}}>
            <StatsCard label="Total Reports" value={totalReports} color="#1e3a5f" icon="📋" />
            <StatsCard label="Citizens" value={totalRegistrations} color="#2d6a4f" icon="🆔" />
            <StatsCard label="Supervisors" value={supervisors} color="#7c3aed" icon="👤" />
            <StatsCard label="Field Officers" value={fieldOfficers} color="#d97706" icon="👥" />
            <StatsCard label="Attendance Rate" value={`${attendanceSummary.rate}%`} color="#0b7e4b" icon="⚡" />
            <StatsCard label="Pending Leaves" value={pendingLeaves} color="#dc2626" icon="📅" />
            <StatsCard label="Pending Permissions" value={pendingPermissions} color="#2563eb" icon="📋" />
          </div>

          {/* Charts Row - Real Data Only */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '24px'
          }}>
            {reportStatusData.length > 0 && (
              <ChartWrapper title="📊 Report Status" subtitle="Approved, Pending, Rejected reports">
                {renderChart('bar', reportStatusData)}
              </ChartWrapper>
            )}
            
            {todayAttendanceData.length > 0 && (
              <ChartWrapper title="📋 Today's Attendance" subtitle="Attendance distribution for today">
                {renderChart('bar', todayAttendanceData)}
              </ChartWrapper>
            )}
            
            {leaveStatusData.length > 0 && (
              <ChartWrapper title="📅 Leave Status" subtitle="Approved, Pending, Rejected leaves">
                {renderChart('bar', leaveStatusData)}
              </ChartWrapper>
            )}
            
            {permissionStatusData.length > 0 && (
              <ChartWrapper title="📋 Permission Status" subtitle="Approved, Pending, Rejected permissions">
                {renderChart('bar', permissionStatusData)}
              </ChartWrapper>
            )}
          </div>

          {/* Registration Trend */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px'
          }}>
            <ChartWrapper title="📈 Registration Trend" subtitle="Daily citizen registrations (Last 7 days)">
              {renderChart('bar', registrationChartData, ['#1e3a5f'])}
            </ChartWrapper>

            <ChartWrapper title="📊 Performance Distribution" subtitle="Report status breakdown">
              {renderChart('bar', reportStatusData)}
            </ChartWrapper>
          </div>

          {/* Top Performers */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#1a202c'}}>🏆 Top Performing Officers</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
              {topPerformers.length === 0 ? (
                <div style={{textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '14px'}}>No performance data available</div>
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
                      borderRadius: '6px',
                      border: i === 0 ? '1px solid #d97706' : '1px solid #e5e7eb',
                      flexWrap: 'wrap',
                      fontSize: '13px'
                    }}
                  >
                    <span style={{fontWeight: '700', color: i === 0 ? '#d97706' : '#64748b', minWidth: '30px'}}>
                      #{i + 1}
                    </span>
                    <span style={{fontWeight: '600', flex: 1}}>{emp.employeeName}</span>
                    <span style={{color: '#64748b'}}>{emp.region}</span>
                    <span style={{color: '#2563eb', fontWeight: '500'}}>🆔 {emp.totalRegistrations}</span>
                    <span style={{color: '#0b7e4b', fontWeight: '600'}}>{emp.avgEfficiency}%</span>
                    <span style={{color: '#7c3aed'}}>📊 {Math.round(emp.attendanceRate)}%</span>
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
              <h2 style={{fontSize: '22px', fontWeight: '700', margin: 0, color: '#1a202c'}}>👨‍💼 Supervisor Dashboard</h2>
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
                📅 {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

          {/* Stats Grid */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px'}}>
            <StatsCard label="Team Members" value={teamMembers.length} color="#7c3aed" icon="👥" />
            <StatsCard label="Team Reports" value={teamReportsCount} color="#2563eb" icon="📋" />
            <StatsCard label="Team Registrations" value={teamCitizenCount} color="#0b7e4b" icon="🆔" />
            <StatsCard label="Pending Leaves" value={pendingLeaves} color="#dc2626" icon="📅" />
          </div>

          {/* Charts - Real Data Only */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '24px'
          }}>
            {reportStatusData.length > 0 && (
              <ChartWrapper title="📊 Team Report Status" subtitle="Approved, Pending, Rejected reports">
                {renderChart('bar', reportStatusData)}
              </ChartWrapper>
            )}
            
            {leaveStatusData.length > 0 && (
              <ChartWrapper title="📅 Team Leave Status" subtitle="Approved, Pending, Rejected leaves">
                {renderChart('bar', leaveStatusData)}
              </ChartWrapper>
            )}
          </div>

          {/* Registration Trend */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px'
          }}>
            <ChartWrapper title="📈 Team Registration Trend" subtitle="Daily registrations (Last 7 days)">
              {renderChart('bar', registrationChartData, ['#2d6a4f'])}
            </ChartWrapper>

            <ChartWrapper title="📊 Team Performance" subtitle="Team report status breakdown">
              {renderChart('bar', reportStatusData)}
            </ChartWrapper>
          </div>

          {/* Team Performance List */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#1a202c'}}>🏆 Team Performance</h3>
            {teamPerformance.length === 0 ? (
              <div style={{textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '14px'}}>No team performance data yet</div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                {teamPerformance.map((emp, i) => (
                  <div 
                    key={emp.employeeId} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      background: i === 0 ? '#fef3c7' : '#f8fafc',
                      borderRadius: '6px',
                      border: i === 0 ? '1px solid #d97706' : '1px solid #e5e7eb',
                      flexWrap: 'wrap',
                      fontSize: '13px'
                    }}
                  >
                    <span style={{fontWeight: '700', color: i === 0 ? '#d97706' : '#64748b', minWidth: '30px'}}>
                      #{i + 1}
                    </span>
                    <span style={{fontWeight: '600', flex: 1}}>{emp.employeeName}</span>
                    <span style={{color: '#64748b'}}>{emp.region}</span>
                    <span style={{color: '#2563eb', fontWeight: '500'}}>🆔 {emp.totalRegistrations}</span>
                    <span style={{color: '#0b7e4b', fontWeight: '600'}}>{emp.avgEfficiency}%</span>
                    <span style={{color: '#7c3aed'}}>📊 {Math.round(emp.attendanceRate)}%</span>
                  </div>
                ))}
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
              <h2 style={{fontSize: '22px', fontWeight: '700', margin: 0, color: '#1a202c'}}>👤 Field Officer Dashboard</h2>
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
                📅 {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

          {/* Stats Grid */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px'}}>
            <StatsCard label="My Reports" value={officerReportsCount} color="#2563eb" icon="📋" />
            <StatsCard label="Citizens Registered" value={officerTotalRegistrations} color="#0b7e4b" icon="🆔" />
            <StatsCard label="Pending Leaves" value={pendingLeaves} color="#dc2626" icon="📅" />
            <StatsCard label="Pending Permissions" value={pendingPermissions} color="#d97706" icon="📋" />
          </div>

          {/* Quick Stats */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px'}}>
            {[
              { label: "Today's Reports", value: reports.filter(r => r.employeeId === user.employeeId && r.reportDate === getToday()).length },
              { label: "Today's Registrations", value: officerTodayRegistrations },
              { label: 'Efficiency', value: `${Math.round((officerTotalRegistrations / (officerReportsCount || 1) / 100) * 100)}%` },
              { label: 'Attendance', value: todayAttendance?.status || 'Not Marked' },
              { label: 'Trust Score', value: `${screenTime.find(s => s.employeeId === user.employeeId && s.date === getToday())?.trustScore || 0}%` }
            ].map((stat, index) => (
              <div 
                key={index}
                style={{
                  background: 'white',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #e5e7eb'
                }}
              >
                <span style={{fontSize: '12px', color: '#64748b'}}>{stat.label}</span>
                <strong style={{fontSize: '16px', color: '#1a202c'}}>{stat.value}</strong>
              </div>
            ))}
          </div>

          {/* Officer Performance Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px'
          }}>
            <ChartWrapper title="📈 My Registration Trend" subtitle="Your daily registrations (Last 7 days)">
              {renderChart('area', officerRegistrationChartData, ['#0b7e4b'])}
            </ChartWrapper>

            <ChartWrapper title="⚡ Efficiency Trend" subtitle="Registrations per report">
              {renderChart('line', officerEfficiencyChartData, ['#7c3aed'])}
            </ChartWrapper>
          </div>

          {/* Today's Attendance */}
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#1a202c'}}>📊 Today's Attendance</h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px'}}>
              {[
                { label: 'Status', value: todayAttendance?.status || 'Not Marked', color: todayAttendance?.status === 'present' ? '#0b7e4b' : todayAttendance?.status === 'late' ? '#d97706' : todayAttendance?.status === 'absent' ? '#dc2626' : '#64748b' },
                { label: 'Check In', value: todayAttendance?.checkIn || '--:--', color: '#1a202c' },
                { label: 'Check Out', value: todayAttendance?.checkOut || '--:--', color: '#1a202c' },
                { label: 'Work Hours', value: `${todayAttendance?.workHours || 0}h`, color: '#1a202c' }
              ].map((item, index) => (
                <div key={index} style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: item.color }}>{item.value}</div>
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