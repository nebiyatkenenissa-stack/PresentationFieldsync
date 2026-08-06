// components/dashboard/Dashboard.js - FINAL
// - Removed Approved/Pending/Rejected status chart
// - Added Report Submission Trend (daily report counts)
// - Top performers ranked by registration count (highest first)

import React, { useMemo, useCallback } from 'react';
import { getToday } from '../../utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell
} from 'recharts';
import VerificationPopup from '../verification/VerificationPopup';
import { useVerification } from '../../hooks/useVerification';

function Dashboard({
  isManager, isSupervisor, isOfficer, user,
  reports, users, attendance, leaves, permissions, citizens,
  teamMembers, liveStatus
}) {
  // ===== VERIFICATION =====
  const {
    showPopup,
    verificationScore,
    verificationHistory,
    handleAnswer,
    handleClose,
    lastVerified
  } = useVerification(isOfficer ? user?.id : null, isOfficer ? user?.name : null);

  // ============================================================
  // ALL DATA COMPUTED FROM RAW ARRAYS – SYNCED-ONLY
  // ============================================================

  // ----- TOTALS – ONLY SYNCED RECORDS -----
  const realTotalReports = useMemo(() => {
    return (reports || []).filter(r => r.synced === true).length;
  }, [reports]);

  const realTotalCitizens = useMemo(() => {
    return (citizens || []).filter(c => c.synced === true).length;
  }, [citizens]);

  const realSupervisors = useMemo(() => (users || []).filter(u => u.role === 'supervisor').length, [users]);
  const realFieldOfficers = useMemo(() => (users || []).filter(u => u.role === 'field_officer').length, [users]);

  // ----- ATTENDANCE RATE – ONLY SYNCED ATTENDANCE -----
  const realAttendanceRate = useMemo(() => {
    const syncedAttendance = (attendance || []).filter(a => a.synced !== false);
    if (!syncedAttendance || syncedAttendance.length === 0) return 0;
    const total = syncedAttendance.length;
    const present = syncedAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
    return Math.round((present / total) * 100);
  }, [attendance]);

  // ----- REGISTRATION TREND – ONLY SYNCED CITIZENS -----
  const registrationTrendData = useMemo(() => {
    const syncedCitizens = (citizens || []).filter(c => c.synced === true);
    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const value = syncedCitizens.filter(c => c.registrationDate?.slice(0, 10) === dateStr).length;
      data.push({ date: dateStr, value });
    }
    return data;
  }, [citizens]);

  // ----- REPORT SUBMISSION TREND – ONLY SYNCED REPORTS (NEW) -----
  const reportSubmissionTrendData = useMemo(() => {
    const syncedReports = (reports || []).filter(r => r.synced === true);
    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const value = syncedReports.filter(r => r.reportDate === dateStr).length;
      data.push({ date: dateStr, value });
    }
    return data;
  }, [reports]);

  // ----- TODAY'S ATTENDANCE (synced) -----
  const todayAttendanceData = useMemo(() => {
    const syncedAttendance = (attendance || []).filter(a => a.synced !== false);
    if (!syncedAttendance || syncedAttendance.length === 0) return [];
    const today = getToday();
    const todayAtt = syncedAttendance.filter(a => a.date === today);
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

  // ----- OFFICER PERFORMANCE (synced) -----
  const officerPerformanceData = useMemo(() => {
    if (!isOfficer || !user) return [];
    const syncedCitizens = (citizens || []).filter(c => c.synced === true);
    const syncedReports = (reports || []).filter(r => r.synced === true);
    const today = getToday();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const registrations = syncedCitizens.filter(c =>
        c.registeredBy === user.employeeId &&
        c.registrationDate?.slice(0, 10) === dateStr
      ).length;
      const reportsCount = syncedReports.filter(r =>
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

  // ----- TEAM COUNTS FOR SUPERVISOR (synced) -----
  const teamCitizenCount = useMemo(() => {
    if (!isSupervisor || !user || !teamMembers) return 0;
    const teamIds = (teamMembers || []).map(m => m.employeeId);
    const syncedCitizens = (citizens || []).filter(c => c.synced === true);
    return syncedCitizens.filter(c => teamIds.includes(c.registeredBy)).length;
  }, [citizens, teamMembers, isSupervisor, user]);

  const teamReportsCount = useMemo(() => {
    if (!isSupervisor || !user || !teamMembers) return 0;
    const teamIds = (teamMembers || []).map(m => m.employeeId);
    const syncedReports = (reports || []).filter(r => r.synced === true);
    return syncedReports.filter(r => teamIds.includes(r.employeeId)).length;
  }, [reports, teamMembers, isSupervisor, user]);

  // ----- OFFICER PERSONAL STATS (synced) -----
  const officerReportsCount = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const syncedReports = (reports || []).filter(r => r.synced === true);
    return syncedReports.filter(r => r.employeeId === user.employeeId).length;
  }, [reports, isOfficer, user]);

  const officerTotalRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const syncedCitizens = (citizens || []).filter(c => c.synced === true);
    return syncedCitizens.filter(c => c.registeredBy === user.employeeId).length;
  }, [citizens, isOfficer, user]);

  const officerTodayRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const syncedCitizens = (citizens || []).filter(c => c.synced === true);
    const today = getToday();
    return syncedCitizens.filter(c =>
      c.registeredBy === user.employeeId &&
      c.registrationDate?.slice(0, 10) === today
    ).length;
  }, [citizens, isOfficer, user]);

  const todayAttendance = useMemo(() => {
    if (!isOfficer || !user) return null;
    const syncedAttendance = (attendance || []).filter(a => a.synced !== false);
    return syncedAttendance.find(a => a.employeeId === user.employeeId && a.date === getToday());
  }, [attendance, user, isOfficer]);

  // ============================================================
  // TOP PERFORMERS – RANKED BY REGISTRATION COUNT (HIGHEST FIRST)
  // ============================================================
  const realTopPerformers = useMemo(() => {
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
          trustScore: 0,
        };
      }
      map[r.employeeId].totalReports += 1;
    });

    citizens.forEach(c => {
      if (c.registeredBy && map[c.registeredBy] && c.synced === true) {
        map[c.registeredBy].totalRegistrations += 1;
      }
    });

    Object.values(map).forEach(emp => {
      emp.avgEfficiency = emp.totalReports > 0
        ? Math.round((emp.totalRegistrations / emp.totalReports) * 100)
        : 0;
    });

    attendance.forEach(a => {
      if (map[a.employeeId] && a.synced !== false) {
        const totalAtt = attendance.filter(att => att.employeeId === a.employeeId && att.synced !== false).length;
        const presentAtt = attendance.filter(att => att.employeeId === a.employeeId && (att.status === 'present' || att.status === 'late') && att.synced !== false).length;
        map[a.employeeId].attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
      }
    });

    // 🔥 RANKED BY REGISTRATION COUNT (HIGHEST FIRST)
    return Object.values(map)
      .filter(emp => emp.totalRegistrations > 0)
      .sort((a, b) => b.totalRegistrations - a.totalRegistrations)
      .slice(0, 5);
  }, [reports, citizens, attendance]);

  // ============================================================
  // TEAM PERFORMANCE – RANKED BY REGISTRATION COUNT (HIGHEST FIRST)
  // ============================================================
  const realTeamPerformance = useMemo(() => {
    if (!isSupervisor || !user || !teamMembers) return [];
    const teamIds = teamMembers.map(m => m.employeeId);
    const map = {};
    reports.forEach(r => {
      if (teamIds.includes(r.employeeId) && !map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          region: r.region,
          totalReports: 0,
          totalRegistrations: 0,
          avgEfficiency: 0,
          attendanceRate: 0,
        };
      }
      if (map[r.employeeId]) {
        map[r.employeeId].totalReports += 1;
      }
    });
    citizens.forEach(c => {
      if (c.registeredBy && map[c.registeredBy] && c.synced === true) {
        map[c.registeredBy].totalRegistrations += 1;
      }
    });
    Object.values(map).forEach(emp => {
      emp.avgEfficiency = emp.totalReports > 0
        ? Math.round((emp.totalRegistrations / emp.totalReports) * 100)
        : 0;
    });
    attendance.forEach(a => {
      if (map[a.employeeId] && a.synced !== false) {
        const totalAtt = attendance.filter(att => att.employeeId === a.employeeId && att.synced !== false).length;
        const presentAtt = attendance.filter(att => att.employeeId === a.employeeId && (att.status === 'present' || att.status === 'late') && att.synced !== false).length;
        map[a.employeeId].attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
      }
    });
    // 🔥 RANKED BY REGISTRATION COUNT (HIGHEST FIRST)
    return Object.values(map)
      .filter(emp => emp.totalRegistrations > 0)
      .sort((a, b) => b.totalRegistrations - a.totalRegistrations);
  }, [reports, citizens, attendance, teamMembers, isSupervisor, user]);

  // ============================================================
  // STYLING
  // ============================================================
  const colors = {
    bg: '#f1f5f9',
    cardBg: '#ffffff',
    cardBorder: '#e5e7eb',
    textPrimary: '#1a202c',
    textSecondary: '#64748b',
    shadow: '0 1px 3px rgba(0,0,0,0.08)',
    inputBg: '#f8fafc',
    chartGrid: '#e5e7eb',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e5e7eb',
    statusBadgeBg: '#f8fafc',
  };

  const CHART_COLORS = ['#1e3a5f', '#2d6a4f', '#7c3aed', '#d97706', '#0b7e4b', '#2563eb'];

  const CustomTooltip = useCallback(({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: colors.tooltipBg,
          padding: '12px 16px',
          borderRadius: '8px',
          border: `1px solid ${colors.tooltipBorder}`,
          boxShadow: colors.shadow,
          fontSize: '13px',
          color: colors.textPrimary
        }}>
          <p style={{ margin: 0, fontWeight: '600' }}>{label}</p>
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

  const renderChart = useCallback((type, data, chartColors = CHART_COLORS, xAxisKey = 'date') => {
    if (!data || data.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, fontSize: '14px' }}>
          No data available
        </div>
      );
    }

    const commonProps = {
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
              <Bar dataKey="value" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
              <Line type="monotone" dataKey="value" stroke={chartColors[0]} strokeWidth={2} dot={{ r: 4, fill: chartColors[0] }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
              <Area type="monotone" dataKey="value" stroke={chartColors[0]} fill={chartColors[0]} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  }, []);

  const ChartWrapper = useCallback(({ children, title, subtitle }) => (
    <div style={{
      background: colors.cardBg,
      padding: '20px',
      borderRadius: '8px',
      boxShadow: colors.shadow,
      border: `1px solid ${colors.cardBorder}`,
      height: '100%'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: colors.textPrimary }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '4px 0 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  ), []);

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

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="dashboard-view" style={{
      padding: '0 4px',
      backgroundColor: colors.bg,
      color: colors.textPrimary,
      minHeight: '100vh',
    }}>
      {/* ===== VERIFICATION POPUP ===== */}
      {isOfficer && showPopup && (
        <VerificationPopup
          officerId={user?.id}
          officerName={user?.name}
          onAnswer={handleAnswer}
          onClose={handleClose}
        />
      )}

      {/* ===== OFFICER VERIFICATION SCORE BADGE ===== */}
      {isOfficer && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '12px',
          gap: '12px',
          flexWrap: 'wrap',
          paddingRight: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: (verificationScore || 0) >= 80 ? '#d1fae5' : (verificationScore || 0) >= 60 ? '#fef3c7' : '#fee2e2',
            borderRadius: '20px',
            border: `1px solid ${(verificationScore || 0) >= 80 ? '#0b7e4b' : (verificationScore || 0) >= 60 ? '#f59e0b' : '#dc2626'}`
          }}>
            <span style={{ fontSize: '14px' }}>🎯</span>
            <span style={{ fontSize: '13px', fontWeight: '500', color: '#1a202c' }}>
              Verification Score: <strong style={{
                color: (verificationScore || 0) >= 80 ? '#0b7e4b' : (verificationScore || 0) >= 60 ? '#f59e0b' : '#dc2626'
              }}>{verificationScore || 0}%</strong>
            </span>
            <span style={{
              fontSize: '11px',
              color: (verificationScore || 0) >= 80 ? '#0b7e4b' : (verificationScore || 0) >= 60 ? '#f59e0b' : '#dc2626',
              fontWeight: '500'
            }}>
              {(verificationScore || 0) >= 80 ? '🟢 Verified' : (verificationScore || 0) >= 60 ? '🟡 Attention' : '🔴 Action Required'}
            </span>
          </div>
          {lastVerified && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: colors.statusBadgeBg,
              borderRadius: '20px',
              border: `1px solid ${colors.cardBorder}`
            }}>
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                Last Verified: {new Date(lastVerified).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ==================== MANAGER VIEW ==================== */}
      {isManager && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '0 16px'
          }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: colors.textPrimary }}>📊 Manager Dashboard</h2>
              <p style={{ color: colors.textSecondary, fontSize: '14px', margin: '4px 0 0 0' }}>Overview of all field operations (synced data only)</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                📊 {realTotalReports} Reports (synced)
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px', padding: '0 16px' }}>
            <StatsCard label="Total Reports (synced)" value={realTotalReports} color="#1e3a5f" icon="📋" />
            <StatsCard label="Citizens (synced)" value={realTotalCitizens} color="#2d6a4f" icon="🆔" />
            <StatsCard label="Supervisors" value={realSupervisors} color="#7c3aed" icon="👤" />
            <StatsCard label="Field Officers" value={realFieldOfficers} color="#d97706" icon="👥" />
            <StatsCard label="Attendance Rate (synced)" value={`${realAttendanceRate}%`} color="#0b7e4b" icon="⚡" />
          </div>

          {/* Charts Row – Report Submission Trend + Today's Attendance */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '24px',
            padding: '0 16px'
          }}>
            <ChartWrapper title="📋 Report Submission Trend (synced)" subtitle="Daily report submissions (Last 7 days)">
              {renderChart('bar', reportSubmissionTrendData, ['#2563eb'])}
            </ChartWrapper>

            {todayAttendanceData.length > 0 && (
              <ChartWrapper title="📋 Today's Attendance (synced)" subtitle="Attendance distribution for today">
                {renderChart('bar', todayAttendanceData)}
              </ChartWrapper>
            )}
          </div>

          {/* Registration Trend + Report Trend */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
            padding: '0 16px'
          }}>
            <ChartWrapper title="📈 Registration Trend (synced)" subtitle="Daily citizen registrations (Last 7 days)">
              {renderChart('area', registrationTrendData, ['#0b7e4b'])}
            </ChartWrapper>

            <ChartWrapper title="📊 Report Submission Trend (synced)" subtitle="Daily reports submitted (Last 7 days)">
              {renderChart('line', reportSubmissionTrendData, ['#2563eb'])}
            </ChartWrapper>
          </div>

          {/* Top Performers – RANKED BY REGISTRATIONS (HIGHEST FIRST) */}
          <div style={{
            background: colors.cardBg,
            padding: '20px',
            borderRadius: '8px',
            boxShadow: colors.shadow,
            border: `1px solid ${colors.cardBorder}`,
            margin: '0 16px 24px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: colors.textPrimary }}>🏆 Top Performing Officers (by Registrations)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(!realTopPerformers || realTopPerformers.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary, fontSize: '14px' }}>No performance data available</div>
              ) : (
                realTopPerformers.map((emp, i) => (
                  <div
                    key={emp.employeeId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      background: i === 0 ? '#fef3c7' : colors.inputBg,
                      borderRadius: '6px',
                      border: i === 0 ? '1px solid #d97706' : `1px solid ${colors.cardBorder}`,
                      flexWrap: 'wrap',
                      fontSize: '13px',
                      color: colors.textPrimary
                    }}
                  >
                    <span style={{ fontWeight: '700', color: i === 0 ? '#d97706' : colors.textSecondary, minWidth: '30px' }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontWeight: '600', flex: 1 }}>{emp.employeeName}</span>
                    <span style={{ color: colors.textSecondary }}>{emp.region}</span>
                    <span style={{ color: '#2563eb', fontWeight: '500' }}>🆔 {emp.totalRegistrations || 0}</span>
                    <span style={{ color: '#0b7e4b', fontWeight: '600' }}>{emp.avgEfficiency || 0}%</span>
                    <span style={{ color: '#7c3aed' }}>📊 {Math.round(emp.attendanceRate || 0)}%</span>
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
            gap: '12px',
            padding: '0 16px'
          }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: colors.textPrimary }}>👨‍💼 Supervisor Dashboard</h2>
              <p style={{ color: colors.textSecondary, fontSize: '14px', margin: '4px 0 0 0' }}>Team overview (synced data only)</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px', padding: '0 16px' }}>
            <StatsCard label="Team Members" value={teamMembers?.length || 0} color="#7c3aed" icon="👥" />
            <StatsCard label="Team Reports (synced)" value={teamReportsCount} color="#2563eb" icon="📋" />
            <StatsCard label="Team Registrations (synced)" value={teamCitizenCount} color="#0b7e4b" icon="🆔" />
          </div>

          {/* Charts Row – Report Submission Trend */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '24px',
            padding: '0 16px'
          }}>
            <ChartWrapper title="📋 Team Report Submission Trend (synced)" subtitle="Daily team report submissions (Last 7 days)">
              {renderChart('bar', reportSubmissionTrendData, ['#2563eb'])}
            </ChartWrapper>
          </div>

          {/* Registration Trend + Report Trend */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
            padding: '0 16px'
          }}>
            <ChartWrapper title="📈 Team Registration Trend (synced)" subtitle="Daily team registrations (Last 7 days)">
              {renderChart('area', registrationTrendData, ['#0b7e4b'])}
            </ChartWrapper>

            <ChartWrapper title="📊 Team Report Submission Trend (synced)" subtitle="Daily team reports (Last 7 days)">
              {renderChart('line', reportSubmissionTrendData, ['#2563eb'])}
            </ChartWrapper>
          </div>

          {/* Team Performance – RANKED BY REGISTRATIONS (HIGHEST FIRST) */}
          <div style={{
            background: colors.cardBg,
            padding: '20px',
            borderRadius: '8px',
            boxShadow: colors.shadow,
            border: `1px solid ${colors.cardBorder}`,
            margin: '0 16px 24px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: colors.textPrimary }}>🏆 Team Performance (by Registrations)</h3>
            {(!realTeamPerformance || realTeamPerformance.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary, fontSize: '14px' }}>No team performance data yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {realTeamPerformance.map((emp, i) => (
                  <div
                    key={emp.employeeId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      background: i === 0 ? '#fef3c7' : colors.inputBg,
                      borderRadius: '6px',
                      border: i === 0 ? '1px solid #d97706' : `1px solid ${colors.cardBorder}`,
                      flexWrap: 'wrap',
                      fontSize: '13px',
                      color: colors.textPrimary
                    }}
                  >
                    <span style={{ fontWeight: '700', color: i === 0 ? '#d97706' : colors.textSecondary, minWidth: '30px' }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontWeight: '600', flex: 1 }}>{emp.employeeName}</span>
                    <span style={{ color: colors.textSecondary }}>{emp.region}</span>
                    <span style={{ color: '#2563eb', fontWeight: '500' }}>🆔 {emp.totalRegistrations || 0}</span>
                    <span style={{ color: '#0b7e4b', fontWeight: '600' }}>{emp.avgEfficiency || 0}%</span>
                    <span style={{ color: '#7c3aed' }}>📊 {Math.round(emp.attendanceRate || 0)}%</span>
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
            gap: '12px',
            padding: '0 16px'
          }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: colors.textPrimary }}>👤 Field Officer Dashboard</h2>
              <p style={{ color: colors.textSecondary, fontSize: '14px', margin: '4px 0 0 0' }}>Your personal performance (synced data only)</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                📊 {officerReportsCount} Reports (synced)
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px', padding: '0 16px' }}>
            <StatsCard label="My Reports (synced)" value={officerReportsCount} color="#2563eb" icon="📋" />
            <StatsCard label="Citizens Registered (synced)" value={officerTotalRegistrations} color="#0b7e4b" icon="🆔" />
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px', padding: '0 16px' }}>
            {[
              { label: "Today's Reports (synced)", value: (reports || []).filter(r => r.employeeId === user.employeeId && r.reportDate === getToday() && r.synced).length },
              { label: "Today's Registrations (synced)", value: officerTodayRegistrations },
              { label: 'Efficiency', value: `${Math.round((officerTotalRegistrations / (officerReportsCount || 1) / 100) * 100)}%` },
              { label: 'Attendance', value: todayAttendance?.status || 'Not Marked' }
            ].map((stat, index) => (
              <div
                key={index}
                style={{
                  background: colors.cardBg,
                  padding: '14px 16px',
                  borderRadius: '8px',
                  boxShadow: colors.shadow,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: `1px solid ${colors.cardBorder}`
                }}
              >
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>{stat.label}</span>
                <strong style={{ fontSize: '16px', color: colors.textPrimary }}>{stat.value}</strong>
              </div>
            ))}
          </div>

          {/* Officer Performance Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
            padding: '0 16px'
          }}>
            <ChartWrapper title="📈 My Registration Trend (synced)" subtitle="Your daily registrations (Last 7 days)">
              {renderChart('area', officerPerformanceData.map(d => ({ date: d.date, value: d.registrations })), ['#0b7e4b'])}
            </ChartWrapper>

            <ChartWrapper title="⚡ Efficiency Trend (synced)" subtitle="Registrations per report">
              {renderChart('line', officerPerformanceData.map(d => ({ date: d.date, value: d.efficiency })), ['#7c3aed'])}
            </ChartWrapper>
          </div>

          {/* Today's Attendance */}
          <div style={{
            background: colors.cardBg,
            borderRadius: '8px',
            padding: '20px',
            boxShadow: colors.shadow,
            border: `1px solid ${colors.cardBorder}`,
            margin: '0 16px 24px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: colors.textPrimary }}>📊 Today's Attendance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
              {[
                { label: 'Status', value: todayAttendance?.status || 'Not Marked', color: todayAttendance?.status === 'present' ? '#0b7e4b' : todayAttendance?.status === 'late' ? '#d97706' : todayAttendance?.status === 'absent' ? '#dc2626' : colors.textSecondary },
                { label: 'Check In', value: todayAttendance?.checkIn || '--:--', color: colors.textPrimary },
                { label: 'Check Out', value: todayAttendance?.checkOut || '--:--', color: colors.textPrimary },
                { label: 'Work Hours', value: `${todayAttendance?.workHours || 0}h`, color: colors.textPrimary }
              ].map((item, index) => (
                <div key={index} style={{ padding: '10px', background: colors.inputBg, borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: colors.textSecondary }}>{item.label}</div>
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