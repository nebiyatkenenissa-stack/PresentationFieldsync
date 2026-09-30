// components/dashboard/Dashboard.js - FINAL
// - Removed Approved/Pending/Rejected status chart
// - Added Report Submission Trend (daily report counts)
// - Top performers ranked by registration count (highest first)

import React, { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getToday } from '../../utils/helpers';
import { OLD_REGION_NAMES } from '../../services/database';
import useRegions from '../../hooks/useRegions';
import {
  buildRecordLocationPath, parseLocationHierarchy, regionOfPath
} from '../../utils/regions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell,
  PieChart, Pie
} from 'recharts';
import VerificationPopup from '../verification/VerificationPopup';
import { useVerification } from '../../hooks/useVerification';
import useIsMobile from '../../hooks/useIsMobile';

function Dashboard({
  isManager, isSupervisor, isOfficer, user,
  reports, supervisorReports, users, leaves, permissions, citizens,
  teamMembers, liveStatus, loading
}) {
  const isMobile = useIsMobile();
  const { t, i18n } = useTranslation();

  const todayLabel = useMemo(() => {
    const lng = i18n.resolvedLanguage || i18n.language || 'en';
    const locale = lng === 'en' ? 'en-US' : lng;
    const options = { calendar: 'gregory', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    try {
      return new Date().toLocaleDateString(locale, options);
    } catch (e) {
      return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
  }, [i18n.resolvedLanguage, i18n.language]);

  // ===== VERIFICATION =====
  const {
    showPopup,
    handleAnswer,
    handleClose
  } = useVerification(isOfficer ? user?.id : null, isOfficer ? user?.name : null);

  // The REAL Ethiopia region list (Amhara, Oromia, Addis Ababa, ...) loaded
  // from the backend `locations` table. Every region label below comes from
  // this list, never from a kebele / woreda / zone name.
  const regions = useRegions();

  // ============================================================
  // ALL DATA COMPUTED FROM RAW ARRAYS – REAL DATA
  // ============================================================

  // ----- TOTALS (real data – all local + server records) -----
  // Total = field officer reports actually synced to the server (real data,
  // same as the "All Reports" page) PLUS supervisor reports.
  const realTotalReports = useMemo(() => {
    const fieldCount = (reports || []).filter(r => r.synced === true).length;
    const supervisorCount = (supervisorReports || []).filter(r => r.synced === true).length;
    return fieldCount + supervisorCount;
  }, [reports, supervisorReports]);

  const realTotalCitizens = useMemo(() => (citizens || []).length, [citizens]);

  const realSupervisors = useMemo(() => (users || []).filter(u => u.role === 'supervisor').length, [users]);
  const realFieldOfficers = useMemo(() => (users || []).filter(u => u.role === 'field_officer').length, [users]);

  // ----- REGIONAL HIERARCHY (Country > Region > Zone > Woreda > Kebele > Community) -----
  // Shared parser from utils/regions.js (single source of truth).
  const parseHierarchy = useCallback((path) => parseLocationHierarchy(path), []);

  // Human readable description, always led by the REAL region name:
  // "Amhara · West Gojjam · Merawi".
  const describeLocation = useCallback((path) => {
    const region = regionOfPath(path, regions);
    const h = parseHierarchy(path);
    const names = [region || h.region, h.zone, h.woreda].filter(Boolean);
    if (names.length === 0) {
      const raw = typeof path === 'string' ? path.trim() : '';
      return raw || 'N/A';
    }
    return names.join(' · ');
  }, [regions, parseHierarchy]);

  // Woreda-level bucket (woreda > zone > region) for the breakdown chart.
  const woredaLocation = useCallback((path) => {
    const h = parseHierarchy(path);
    return h.woreda || h.zone || h.region || '';
  }, [parseHierarchy]);

  // Map each employee to their assigned location as listed in the users list.
  // Legacy compass names (North/South/East/West) are old demo data and are skipped.
  const employeeLocationMap = useMemo(() => {
    const map = {};
    (users || []).forEach(u => {
      if (u.employeeId && u.region && u.region !== 'All' && u.region !== 'all' && !OLD_REGION_NAMES.includes(u.region)) {
        map[u.employeeId] = u.region;
      }
    });
    return map;
  }, [users]);

  const resolveLocationPath = useCallback((employeeId, fallbackPath) => {
    if (employeeId && employeeLocationMap[employeeId]) {
      const assigned = employeeLocationMap[employeeId];
      if (assigned && assigned !== 'All' && assigned !== 'all' && !OLD_REGION_NAMES.includes(assigned)) return assigned;
    }
    if (fallbackPath && typeof fallbackPath === 'object' && !Array.isArray(fallbackPath)) {
      fallbackPath = buildRecordLocationPath(fallbackPath);
    }
    if (Array.isArray(fallbackPath)) {
      return fallbackPath.map(l => (l && l.name) || l).filter(Boolean).join(' > ');
    }
    if (fallbackPath && typeof fallbackPath === 'string') {
      const trimmed = fallbackPath.trim();
      if (trimmed && !OLD_REGION_NAMES.includes(trimmed)) return trimmed;
    }
    return 'Other';
  }, [employeeLocationMap, buildRecordLocationPath]);

  const regionStatsData = useMemo(() => {
    // Buckets are the REAL region names from the database `locations` table.
    // Seed the list so every region is represented even when it has no data.
    const map = {};
    (regions || []).forEach(r => {
      map[r.name] = { name: r.name, fullPath: '', reports: 0, registrations: 0, woredas: new Set(), officers: new Set() };
    });
    const ensure = (name) => {
      if (!map[name]) map[name] = { name, fullPath: '', reports: 0, registrations: 0, woredas: new Set(), officers: new Set() };
      return map[name];
    };
    const regionOf = (path) => regionOfPath(path, regions);

    (reports || []).forEach(r => {
      const path = resolveLocationPath(r.employeeId, r.region || r.locationPath || r);
      if (path === 'Other') return;
      const region = regionOf(path);
      if (!region) return;
      const entry = ensure(region);
      if (!entry.fullPath) entry.fullPath = path;
      entry.reports += 1;
      entry.officers.add(r.employeeId);
      const w = woredaLocation(path);
      if (w && w !== region) entry.woredas.add(w);
    });

    (citizens || []).forEach(c => {
      const path = resolveLocationPath(c.registeredBy, c.region || c.locationPath || c);
      if (path === 'Other') return;
      const region = regionOf(path);
      if (!region) return;
      const entry = ensure(region);
      if (!entry.fullPath) entry.fullPath = path;
      entry.registrations += 1;
    });

    return Object.values(map)
      .map(s => ({
        name: s.name,
        fullPath: s.fullPath,
        reports: s.reports,
        registrations: s.registrations,
        woredas: s.woredas.size,
        officers: s.officers.size
      }))
      .sort((a, b) => b.reports - a.reports);
  }, [reports, citizens, regions, resolveLocationPath, woredaLocation]);

  const regionHierarchyData = useMemo(() => {
    // Location chart data – only regions that actually have activity.
    // Real region names come from the region database.
    return regionStatsData
      .filter(s => s.reports > 0 || s.registrations > 0)
      .slice(0, 8)
      .map(s => ({
        name: s.name,
        Reports: s.reports,
        Registrations: s.registrations
      }));
  }, [regionStatsData]);

  const woredaBreakdownData = useMemo(() => {
    const map = {};
    const collect = (employeeId, path, key) => {
      const resolved = resolveLocationPath(employeeId, path);
      if (resolved === 'Other') return;
      const name = woredaLocation(resolved);
      if (!name) return;
      if (!map[name]) map[name] = { name, reports: 0, registrations: 0 };
      map[name][key] += 1;
    };
    (reports || []).forEach(r => collect(r.employeeId, r.region || r.locationPath, 'reports'));
    (citizens || []).forEach(c => collect(c.registeredBy, c.region, 'registrations'));
    return Object.values(map)
      .sort((a, b) => b.reports - a.reports)
      .slice(0, 8)
      .map(s => ({ name: s.name, Reports: s.reports, Registrations: s.registrations }));
  }, [reports, citizens, resolveLocationPath, woredaLocation]);

  // ----- WORKLOAD / OPERATIONAL REAL DATA -----
  const activeOfficersToday = useMemo(() => {
    const today = getToday();
    const activeIds = new Set((reports || [])
      .filter(r => String(r.reportDate || '').slice(0, 10) === today)
      .map(r => r.employeeId));
    return activeIds.size;
  }, [reports]);

  // ----- TEAM MEMBER IDS FOR THE SUPERVISOR (real data) -----
  const teamIds = useMemo(() => {
    if (!isSupervisor || !user) return [];
    return (teamMembers || []).map(m => m.employeeId).filter(Boolean);
  }, [isSupervisor, user, teamMembers]);

  // ----- REGISTRATION TREND – REAL DATA -----
  const registrationTrendData = useMemo(() => {
    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const value = (citizens || []).filter(c => c.registrationDate?.slice(0, 10) === dateStr).length;
      data.push({ date: dateStr, value });
    }
    return data;
  }, [citizens]);

  // ----- REPORT SUBMISSION TREND – REAL DATA -----
  const reportSubmissionTrendData = useMemo(() => {
    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const fieldCount = (reports || []).filter(r => r.synced === true && String(r.reportDate || '').slice(0, 10) === dateStr).length;
      const supervisorCount = (supervisorReports || []).filter(r => {
        const date = r.reportDate || r.submittedAt;
        return date && date.slice(0, 10) === dateStr;
      }).length;
      data.push({ date: dateStr, value: fieldCount + supervisorCount });
    }
    return data;
  }, [reports, supervisorReports]);

  // ----- SUPERVISOR TEAM TRENDS – REAL DATA (distinct from the manager view) -----
  const teamRegistrationTrendData = useMemo(() => {
    if (!isSupervisor || !user) return [];
    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const value = (citizens || []).filter(c =>
        teamIds.includes(c.registeredBy) && c.registrationDate?.slice(0, 10) === dateStr
      ).length;
      data.push({ date: dateStr, value });
    }
    return data;
  }, [citizens, teamIds, isSupervisor, user]);

  const teamReportSubmissionTrendData = useMemo(() => {
    if (!isSupervisor || !user) return [];
    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const value = (reports || []).filter(r =>
        (teamIds.includes(r.employeeId) || r.employeeId === user?.employeeId) &&
        String(r.reportDate || '').slice(0, 10) === dateStr
      ).length;
      data.push({ date: dateStr, value });
    }
    return data;
  }, [reports, teamIds, isSupervisor, user]);

  // ----- TEAM REPORT SHARE (bar chart – reports per team member) -----
  // Seeded from the full team roster so EVERY member is on the chart, even
  // the ones who have not submitted a report yet (they simply show 0).
  const teamMemberShareData = useMemo(() => {
    if (!isSupervisor || !user) return [];
    const map = {};
    (teamMembers || []).forEach(m => {
      if (!m || !m.employeeId) return;
      map[m.employeeId] = { name: m.name || m.employeeName || m.employeeId, value: 0 };
    });
    (reports || []).forEach(r => {
      if (!teamIds.includes(r.employeeId)) return;
      if (!map[r.employeeId]) {
        map[r.employeeId] = { name: r.employeeName || r.employeeId, value: 0 };
      }
      map[r.employeeId].value += 1;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [reports, teamIds, teamMembers, isSupervisor, user]);

  // ----- OFFICER PERFORMANCE (personal, real data) -----
  const officerPerformanceData = useMemo(() => {
    if (!isOfficer || !user) return [];
    const today = getToday();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const registrations = (citizens || []).filter(c =>
        c.registeredBy === user.employeeId &&
        c.registrationDate?.slice(0, 10) === dateStr
      ).length;
      const reportsCount = (reports || []).filter(r =>
        r.employeeId === user.employeeId &&
        String(r.reportDate || '').slice(0, 10) === dateStr
      ).length;
      last7Days.push({
        date: dateStr,
        registrations,
        reports: reportsCount
      });
    }
    return last7Days;
  }, [citizens, reports, isOfficer, user]);

  // ----- TEAM COUNTS FOR SUPERVISOR (real data) -----
  const teamCitizenCount = useMemo(() => {
    if (!isSupervisor || !user) return 0;
    return (citizens || []).filter(c => teamIds.includes(c.registeredBy)).length;
  }, [citizens, teamIds, isSupervisor, user]);

  const teamReportsCount = useMemo(() => {
    if (!isSupervisor || !user) return 0;
    return (reports || []).filter(r => teamIds.includes(r.employeeId) || r.employeeId === user?.employeeId).length;
  }, [reports, teamIds, isSupervisor, user]);

  // ----- EXTRA TEAM KPIs FOR THE SUPERVISOR HERO / CARDS (real data) -----
  const teamActiveToday = useMemo(() => {
    if (!isSupervisor || !user) return 0;
    const today = getToday();
    return new Set((reports || [])
      .filter(r => (teamIds.includes(r.employeeId) || r.employeeId === user?.employeeId) && String(r.reportDate || '').slice(0, 10) === today)
      .map(r => r.employeeId)).size;
  }, [reports, teamIds, isSupervisor, user]);

  const teamPendingRequests = useMemo(() => {
    if (!isSupervisor || !user) return 0;
    const ids = new Set([...teamIds, user?.employeeId].filter(Boolean));
    const leavesCount = (leaves || []).filter(l => ids.has(l.employeeId) && l.status === 'pending').length;
    const permsCount = (permissions || []).filter(p => ids.has(p.employeeId) && p.status === 'pending').length;
    return leavesCount + permsCount;
  }, [leaves, permissions, teamIds, isSupervisor, user]);

  // ----- OFFICER PERSONAL STATS (real data) -----
  const officerReportsCount = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return (reports || []).filter(r => r.employeeId === user.employeeId).length;
  }, [reports, isOfficer, user]);

  const officerTotalRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    return (citizens || []).filter(c => c.registeredBy === user.employeeId).length;
  }, [citizens, isOfficer, user]);

  const officerTodayRegistrations = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const today = getToday();
    return (citizens || []).filter(c =>
      c.registeredBy === user.employeeId &&
      c.registrationDate?.slice(0, 10) === today
    ).length;
  }, [citizens, isOfficer, user]);

  const officerTodayReports = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const today = getToday();
    return (reports || []).filter(r =>
      r.employeeId === user.employeeId &&
      String(r.reportDate || '').slice(0, 10) === today
    ).length;
  }, [reports, isOfficer, user]);

  const officerPendingRequests = useMemo(() => {
    if (!isOfficer || !user) return 0;
    const leavesCount = (leaves || []).filter(l => l.employeeId === user.employeeId && l.status === 'pending').length;
    const permsCount = (permissions || []).filter(p => p.employeeId === user.employeeId && p.status === 'pending').length;
    return leavesCount + permsCount;
  }, [leaves, permissions, isOfficer, user]);

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
          location: describeLocation(resolveLocationPath(r.employeeId, r.region)),
          totalReports: 0,
          totalRegistrations: 0,
        };
      }
      map[r.employeeId].totalReports += 1;
    });

    citizens.forEach(c => {
      if (c.registeredBy && map[c.registeredBy]) {
        map[c.registeredBy].totalRegistrations += 1;
      }
    });

    // 🔥 RANKED BY REGISTRATION COUNT (HIGHEST FIRST)
    return Object.values(map)
      .filter(emp => emp.totalRegistrations > 0)
      .sort((a, b) => b.totalRegistrations - a.totalRegistrations)
      .slice(0, 5);
  }, [reports, citizens, resolveLocationPath, describeLocation]);

  // ============================================================
  // TEAM PERFORMANCE – RANKED BY REGISTRATION COUNT (HIGHEST FIRST)
  // ============================================================
  const realTeamPerformance = useMemo(() => {
    if (!isSupervisor || !user) return [];
    const map = {};
    reports.forEach(r => {
      if (teamIds.includes(r.employeeId) && !map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          location: describeLocation(resolveLocationPath(r.employeeId, r.region)),
          totalReports: 0,
          totalRegistrations: 0,
        };
      }
      if (map[r.employeeId]) {
        map[r.employeeId].totalReports += 1;
      }
    });
    citizens.forEach(c => {
      if (c.registeredBy && map[c.registeredBy]) {
        map[c.registeredBy].totalRegistrations += 1;
      }
    });
    // 🔥 RANKED BY REGISTRATION COUNT (HIGHEST FIRST)
    return Object.values(map)
      .filter(emp => emp.totalRegistrations > 0)
      .sort((a, b) => b.totalRegistrations - a.totalRegistrations);
  }, [reports, citizens, teamIds, isSupervisor, user, resolveLocationPath, describeLocation]);

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

  // Card currently shown in the detail box (null = closed)
  const [activeCard, setActiveCard] = useState(null);

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

  const LoadingBar = useCallback(({ label }) => (
    <div style={{ padding: '34px 20px', textAlign: 'center' }}>
      <div style={{
        width: '100%',
        maxWidth: '300px',
        margin: '0 auto 12px',
        height: '8px',
        background: '#e2e8f0',
        borderRadius: '20px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: '40%',
          borderRadius: '20px',
          background: 'linear-gradient(90deg, #2563eb, #0b7e4b)',
          animation: 'fieldsyncLoading 1.2s ease-in-out infinite'
        }} />
      </div>
      <div style={{ fontSize: '12px', color: colors.textSecondary }}>{label || t('dashboard.loading_chart')}</div>
    </div>
  ), [colors.textSecondary, t]);

  const renderChart = useCallback((type, data, chartColors = CHART_COLORS, xAxisKey = 'date', seriesName) => {
    if (loading) {
      return <LoadingBar />;
    }
    if (!data || data.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, fontSize: '14px' }}>
          {t('dashboard.no_data_available')}
        </div>
      );
    }

    const commonProps = {
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={isMobile ? 230 : 280}>
            <BarChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
              <Bar dataKey="value" name={seriesName || 'value'} fill={chartColors[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={isMobile ? 230 : 280}>
            <LineChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
              <Line type="monotone" dataKey="value" name={seriesName || 'value'} stroke={chartColors[0]} strokeWidth={2} dot={{ r: 4, fill: chartColors[0] }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={isMobile ? 230 : 280}>
            <AreaChart data={data} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} />
              <Tooltip content={CustomTooltip} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
              <Area type="monotone" dataKey="value" name={seriesName || 'value'} stroke={chartColors[0]} fill={chartColors[0]} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  }, [loading, LoadingBar, isMobile, t]);

  const ChartWrapper = useCallback(({ children, title, subtitle }) => (
    <div style={{
      background: colors.cardBg,
      padding: isMobile ? '14px 12px' : '20px',
      borderRadius: '8px',
      boxShadow: colors.shadow,
      border: `1px solid ${colors.cardBorder}`,
      height: '100%'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '600', margin: 0, color: colors.textPrimary }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '4px 0 0 0' }}>{subtitle}</p>}
      </div>
      {loading ? <LoadingBar /> : children}
    </div>
  ), [loading, LoadingBar, isMobile]);

  const StatsCard = useCallback(({ label, value, color, icon, detail }) => (
    <div style={{
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      padding: isMobile ? '14px' : '20px',
      borderRadius: '8px',
      color: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'all 0.2s ease',
      cursor: detail ? 'pointer' : 'default'
    }}
      onClick={() => { if (detail) setActiveCard({ label, icon, color, value, render: detail }); }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      }}>
      <div style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '700' }}>{value}</div>
      <div style={{ fontSize: isMobile ? '11px' : '13px', opacity: 0.85, marginTop: '4px' }}>{icon} {label}</div>
      {detail && <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '6px' }}>{t('dashboard.click_to_view_details')}</div>}
    </div>
  ), [setActiveCard, isMobile, t]);

  // ============================================================
  // CARD DETAIL DATA (used inside the detail box)
  // ============================================================
  const reportsByOfficer = useMemo(() => {
    const map = {};
    (reports || []).filter(r => r.synced === true).forEach(r => {
      if (!map[r.employeeId]) map[r.employeeId] = {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        location: describeLocation(resolveLocationPath(r.employeeId, r.region)),
        count: 0
      };
      map[r.employeeId].count += 1;
    });
    (supervisorReports || []).forEach(r => {
      const key = r.supervisorId || r.supervisorName || 'Unknown';
      if (!map[key]) map[key] = {
        employeeId: key,
        employeeName: r.supervisorName || key,
        location: describeLocation(resolveLocationPath(key, r.region || r.officerRegion)),
        count: 0
      };
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [reports, supervisorReports, resolveLocationPath, describeLocation]);

  const citizensByOfficer = useMemo(() => {
    const map = {};
    (citizens || []).forEach(c => {
      const empId = c.registeredBy;
      if (!empId) return;
      const emp = (users || []).find(u => u.employeeId === empId);
      if (!map[empId]) map[empId] = {
        employeeId: empId,
        employeeName: (emp && emp.name) || c.employeeName || empId,
        location: resolveLocationPath(empId, c.region),
        count: 0
      };
      map[empId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [citizens, users, resolveLocationPath]);

  const activeOfficersTodayList = useMemo(() => {
    const today = getToday();
    const map = {};
    (reports || []).filter(r => String(r.reportDate || '').slice(0, 10) === today).forEach(r => {
      if (!map[r.employeeId]) map[r.employeeId] = {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        count: 0
      };
      map[r.employeeId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [reports]);

  // Seeded from the full team roster so EVERY member is on the chart, even
  // the ones who have not registered a citizen yet (they simply show 0).
  const teamRegistrationsByMember = useMemo(() => {
    if (!isSupervisor || !user) return [];
    const map = {};
    (teamMembers || []).forEach(m => {
      if (!m || !m.employeeId) return;
      map[m.employeeId] = {
        employeeId: m.employeeId,
        employeeName: m.name || m.employeeName || m.employeeId,
        count: 0
      };
    });
    (citizens || []).filter(c => teamIds.includes(c.registeredBy)).forEach(c => {
      if (!map[c.registeredBy]) {
        map[c.registeredBy] = {
          employeeId: c.registeredBy,
          employeeName: c.registeredByName || c.registeredBy,
          count: 0
        };
      }
      map[c.registeredBy].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [citizens, teamIds, teamMembers, isSupervisor, user]);

  const myReportsList = useMemo(() => {
    if (!isOfficer || !user) return [];
    return (reports || [])
      .filter(r => r.employeeId === user.employeeId)
      .sort((a, b) => String(b.reportDate || '').localeCompare(String(a.reportDate || '')));
  }, [reports, isOfficer, user]);

  const myCitizensList = useMemo(() => {
    if (!isOfficer || !user) return [];
    return (citizens || [])
      .filter(c => c.registeredBy === user.employeeId)
      .sort((a, b) => String(b.registrationDate || '').localeCompare(String(a.registrationDate || '')));
  }, [citizens, isOfficer, user]);

  const myTodayReportsList = useMemo(() => {
    if (!isOfficer || !user) return [];
    const today = getToday();
    return (reports || [])
      .filter(r => r.employeeId === user.employeeId && String(r.reportDate || '').slice(0, 10) === today)
      .sort((a, b) => String(b.submittedAt || b.reportDate || '').localeCompare(String(a.submittedAt || a.reportDate || '')));
  }, [reports, isOfficer, user]);

  const myTodayCitizensList = useMemo(() => {
    if (!isOfficer || !user) return [];
    const today = getToday();
    return (citizens || [])
      .filter(c => c.registeredBy === user.employeeId && String(c.registrationDate || '').slice(0, 10) === today)
      .sort((a, b) => String(b.registrationDate || '').localeCompare(String(a.registrationDate || '')));
  }, [citizens, isOfficer, user]);

  const myPendingRequestsList = useMemo(() => {
    if (!isOfficer || !user) return [];
    const items = [];
    (leaves || []).filter(l => l.employeeId === user.employeeId && l.status === 'pending').forEach(l => {
      items.push({
        type: `🗓️ ${t('dashboard.leave')}`,
        name: l.employeeName || l.employeeId,
        detail: `${l.leaveType || t('dashboard.leave')} · ${l.startDate || ''} → ${l.endDate || ''}`
      });
    });
    (permissions || []).filter(p => p.employeeId === user.employeeId && p.status === 'pending').forEach(p => {
      items.push({
        type: `⏳ ${t('dashboard.permission')}`,
        name: p.employeeName || p.employeeId,
        detail: `${p.permissionType || t('dashboard.permission')} · ${p.fromTime || ''}`
      });
    });
    return items;
  }, [leaves, permissions, isOfficer, user]);

  const statusPillColor = (status) => {
    if (!status || status === 'active') return '#0b7e4b';
    if (status === 'suspended' || status === 'inactive') return '#dc2626';
    return '#64748b';
  };

  const DetailRow = ({ name, sub, value, color, progress, icon }) => {
    const col = color || colors.textPrimary;
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '10px',
        marginBottom: '8px',
        background: colors.inputBg,
        border: `1px solid ${colors.cardBorder}`
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: `${col}1f`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          fontWeight: '600',
          color: col,
          flexShrink: 0
        }}>
          {icon || (name ? name.charAt(0).toUpperCase() : '•')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: '600',
            fontSize: '13px',
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>{name}</div>
          {sub && <div style={{
            fontSize: '11px',
            color: colors.textSecondary,
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>{sub}</div>}
          {typeof progress === 'number' && (
            <div style={{
              height: '4px',
              background: '#e2e8f0',
              borderRadius: '99px',
              marginTop: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(4, Math.min(100, progress))}%`,
                background: col,
                borderRadius: '99px'
              }} />
            </div>
          )}
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: '99px',
          background: `${col}1f`,
          color: col,
          fontSize: '12px',
          fontWeight: '700',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>
          {value}
        </div>
      </div>
    );
  };

  const EmptyDetail = ({ msg, icon = '📭' }) => (
    <div style={{ textAlign: 'center', padding: '36px 20px' }}>
      <div style={{ fontSize: '34px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ color: colors.textSecondary, fontSize: '14px' }}>{msg || t('dashboard.no_data_available')}</div>
    </div>
  );

  const DetailSummary = ({ text }) => (
    <div style={{
      fontSize: '12px',
      fontWeight: '600',
      color: colors.textPrimary,
      background: colors.inputBg,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '8px',
      padding: '8px 12px',
      marginBottom: '12px'
    }}>
      {text}
    </div>
  );

  // ============================================================
  // CARD DETAIL PANEL BUILDERS (opened when a KPI card is clicked)
  // ============================================================
  const totalReportsDetail = () => {
    const max = reportsByOfficer.length ? reportsByOfficer[0].count : 1;
    return (
      <>
        <DetailSummary text={t('dashboard.submitters_total_reports', { count: reportsByOfficer.length, total: realTotalReports })} />
        {reportsByOfficer.length === 0 ? <EmptyDetail msg={t('dashboard.no_reports_yet')} icon="📋" /> :
          reportsByOfficer.map((e, i) => (
            <DetailRow key={e.employeeId || i} name={e.employeeName || e.employeeId} sub={e.location} value={`${e.count}`} icon="📋" color="#2563eb" progress={(e.count / max) * 100} />
          ))}
      </>
    );
  };

  const citizensDetail = () => {
    const max = citizensByOfficer.length ? citizensByOfficer[0].count : 1;
    return (
      <>
        <DetailSummary text={t('dashboard.officers_total_registrations', { count: citizensByOfficer.length, total: realTotalCitizens })} />
        {citizensByOfficer.length === 0 ? <EmptyDetail msg={t('dashboard.no_citizens_registered_yet')} icon="🆔" /> :
          citizensByOfficer.map((e, i) => (
            <DetailRow key={e.employeeId || i} name={e.employeeName} sub={e.location} value={`${e.count}`} icon="🆔" color="#0b7e4b" progress={(e.count / max) * 100} />
          ))}
      </>
    );
  };

  const officersDetail = () => {
    const list = (users || []).filter(u => u.role === 'field_officer');
    return (
      <>
        <DetailSummary text={t('dashboard.field_officers_count', { count: list.length })} />
        {list.length === 0 ? <EmptyDetail msg={t('dashboard.no_field_officers_yet')} icon="👥" /> :
          list.map((u, i) => (
            <DetailRow key={u.id || i} name={u.name || u.employeeId} sub={`${u.employeeId || ''} · ${u.region || t('dashboard.no_location')}`} value={u.status ? t(`dashboard.status.${u.status}`, { defaultValue: u.status }) : t('dashboard.status.active')} icon="👤" color={statusPillColor(u.status)} />
          ))}
      </>
    );
  };

  const supervisorsDetail = () => {
    const list = (users || []).filter(u => u.role === 'supervisor');
    return (
      <>
        <DetailSummary text={t('dashboard.supervisors_count', { count: list.length })} />
        {list.length === 0 ? <EmptyDetail msg={t('dashboard.no_supervisors_yet')} icon="👤" /> :
          list.map((u, i) => (
            <DetailRow key={u.id || i} name={u.name || u.employeeId} sub={`${u.employeeId || ''} · ${u.region || t('dashboard.no_location')}`} value={u.status ? t(`dashboard.status.${u.status}`, { defaultValue: u.status }) : t('dashboard.status.active')} icon="👨‍💼" color={statusPillColor(u.status)} />
          ))}
      </>
    );
  };

  const activeTodayDetail = () => {
    const max = activeOfficersTodayList.length ? activeOfficersTodayList[0].count : 1;
    return (
      <>
        <DetailSummary text={t('dashboard.officers_active_today', { count: activeOfficersTodayList.length, date: getToday() })} />
        {activeOfficersTodayList.length === 0 ? <EmptyDetail msg={t('dashboard.no_officers_active_today')} icon="⚡" /> :
          activeOfficersTodayList.map((e, i) => (
            <DetailRow key={e.employeeId || i} name={e.employeeName || e.employeeId} sub={e.employeeId} value={`${e.count}`} icon="⚡" color="#0b7e4b" progress={(e.count / max) * 100} />
          ))}
      </>
    );
  };

  const teamMembersDetail = () => {
    const list = (teamMembers || []).filter(Boolean);
    return (
      <>
        <DetailSummary text={t('dashboard.team_members_count', { count: list.length })} />
        {list.length === 0 ? <EmptyDetail msg={t('dashboard.no_team_members_yet')} icon="👥" /> :
          list.map((m, i) => (
            <DetailRow key={m.employeeId || i} name={m.name || m.employeeName || m.employeeId} sub={`${m.employeeId || ''} · ${m.region || t('dashboard.no_location')}`} value={m.status ? t(`dashboard.status.${m.status}`, { defaultValue: m.status }) : t('dashboard.status.active')} icon="👤" color={statusPillColor(m.status)} />
          ))}
      </>
    );
  };

  const teamReportsDetail = () => {
    const max = teamMemberShareData.length ? (teamMemberShareData[0].value || 1) : 1;
    return (
      <>
        <DetailSummary text={t('dashboard.members_total_team_reports', { count: teamMemberShareData.length, total: teamReportsCount })} />
        {teamMemberShareData.length === 0 ? <EmptyDetail msg={t('dashboard.no_team_reports_yet')} icon="📋" /> :
          teamMemberShareData.map((e, i) => (
            <DetailRow key={i} name={e.name} value={`${e.value}`} icon="📋" color="#2563eb" progress={(e.value / max) * 100} />
          ))}
      </>
    );
  };

  const teamRegistrationsDetail = () => {
    const max = teamRegistrationsByMember.length ? (teamRegistrationsByMember[0].count || 1) : 1;
    return (
      <>
        <DetailSummary text={t('dashboard.members_total_team_registrations', { count: teamRegistrationsByMember.length, total: teamCitizenCount })} />
        {teamRegistrationsByMember.length === 0 ? <EmptyDetail msg={t('dashboard.no_team_registrations_yet')} icon="🆔" /> :
          teamRegistrationsByMember.map((e, i) => (
            <DetailRow key={e.employeeId || i} name={e.employeeName} value={`${e.count}`} icon="🆔" color="#0b7e4b" progress={(e.count / max) * 100} />
          ))}
      </>
    );
  };

  const teamActiveTodayDetail = () => {
    const today = getToday();
    const map = {};
    (reports || []).filter(r =>
      (teamIds.includes(r.employeeId) || r.employeeId === user?.employeeId) &&
      String(r.reportDate || '').slice(0, 10) === today
    ).forEach(r => {
      if (!map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName || r.employeeId,
          count: 0
        };
      }
      map[r.employeeId].count += 1;
    });
    const list = Object.values(map).sort((a, b) => b.count - a.count);
    const max = list.length ? list[0].count : 1;
    return (
      <>
        <DetailSummary text={t('dashboard.team_members_active_today', { count: list.length, date: today })} />
        {list.length === 0 ? <EmptyDetail msg={t('dashboard.no_team_members_active_today')} icon="⚡" /> :
          list.map((e, i) => (
            <DetailRow key={e.employeeId || i} name={e.employeeName} sub={e.employeeId} value={`${e.count}`} icon="⚡" color="#d97706" progress={(e.count / max) * 100} />
          ))}
      </>
    );
  };

  const teamPendingRequestsDetail = () => {
    const ids = new Set([...teamIds, user?.employeeId].filter(Boolean));
    const items = [];
    (leaves || []).filter(l => ids.has(l.employeeId) && l.status === 'pending').forEach(l => {
      items.push({
        type: `🗓️ ${t('dashboard.leave')}`,
        name: l.employeeName || l.employeeId,
        detail: `${l.leaveType || t('dashboard.leave')} · ${l.startDate || ''} → ${l.endDate || ''}`
      });
    });
    (permissions || []).filter(p => ids.has(p.employeeId) && p.status === 'pending').forEach(p => {
      items.push({
        type: `⏳ ${t('dashboard.permission')}`,
        name: p.employeeName || p.employeeId,
        detail: `${p.permissionType || t('dashboard.permission')} · ${p.fromTime || ''}`
      });
    });
    return (
      <>
        <DetailSummary text={t('dashboard.pending_requests_count', { count: items.length })} />
        {items.length === 0 ? <EmptyDetail msg={t('dashboard.no_pending_requests')} icon="🎉" /> :
          items.map((r, i) => (
            <DetailRow key={i} name={r.name} sub={r.detail} value={r.type} color="#dc2626" />
          ))}
      </>
    );
  };

  const myReportsDetail = () => (
    <>
      <DetailSummary text={t('dashboard.reports_submitted_by_you', { count: myReportsList.length })} />
      {myReportsList.length === 0 ? <EmptyDetail msg={t('dashboard.you_have_no_reports_yet')} icon="📋" /> :
        myReportsList.map((r, i) => (
          <DetailRow key={r.id || i} name={r.reportDate || t('dashboard.unknown_date')} sub={r.region || t('dashboard.no_location')} value="📋" icon="📄" color="#2563eb" />
        ))}
    </>
  );

  const myCitizensDetail = () => (
    <>
      <DetailSummary text={t('dashboard.citizens_registered_by_you', { count: myCitizensList.length })} />
      {myCitizensList.length === 0 ? <EmptyDetail msg={t('dashboard.you_have_registered_none_yet')} icon="🆔" /> :
        myCitizensList.map((c, i) => (
          <DetailRow key={c.id || i} name={`${c.firstName || ''} ${c.lastName || ''} ${c.grandFatherName || ''}`.trim()} sub={c.nationalId || t('dashboard.no_national_id')} value={c.registrationDate || '—'} icon="🆔" color="#0b7e4b" />
        ))}
    </>
  );

  const myTodayReportsDetail = () => (
    <>
      <DetailSummary text={t('dashboard.reports_submitted_today', { count: myTodayReportsList.length, date: getToday() })} />
      {myTodayReportsList.length === 0 ? <EmptyDetail msg={t('dashboard.no_reports_submitted_today')} icon="📄" /> :
        myTodayReportsList.map((r, i) => (
          <DetailRow key={r.id || i} name={r.reportDate || t('dashboard.unknown_date')} sub={r.region || t('dashboard.no_location')} value="📋" icon="📄" color="#7c3aed" />
        ))}
    </>
  );

  const myTodayRegistrationsDetail = () => (
    <>
      <DetailSummary text={t('dashboard.citizens_registered_today', { count: myTodayCitizensList.length, date: getToday() })} />
      {myTodayCitizensList.length === 0 ? <EmptyDetail msg={t('dashboard.no_citizens_registered_today')} icon="✍️" /> :
        myTodayCitizensList.map((c, i) => (
          <DetailRow key={c.id || i} name={`${c.firstName || ''} ${c.lastName || ''} ${c.grandFatherName || ''}`.trim()} sub={c.nationalId || 'No national ID'} value={c.registrationDate || '—'} icon="✍️" color="#d97706" />
        ))}
    </>
  );

  const myPendingRequestsDetail = () => (
    <>
      <DetailSummary text={t('dashboard.pending_requests_count', { count: myPendingRequestsList.length })} />
      {myPendingRequestsList.length === 0 ? <EmptyDetail msg={t('dashboard.no_pending_requests_for_you')} icon="🎉" /> :
        myPendingRequestsList.map((r, i) => (
          <DetailRow key={i} name={r.name} sub={r.detail} value={r.type} color="#dc2626" />
        ))}
    </>
  );

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

      <style>{`
        @keyframes fieldsyncLoading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fieldsyncFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* ==================== MANAGER VIEW ==================== */}
      {isManager && (
        <>
          {/* ===== HERO HEADER ===== */}
          <div style={{
            background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
            borderRadius: '16px',
            padding: isMobile ? '18px 14px' : '28px 28px 26px',
            margin: isMobile ? '0 0 16px' : '0 16px 24px',
            color: 'white',
            boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📊 {t('dashboard.manager_dashboard')}</h2>
              <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '520px' }}>
                {t('dashboard.manager_overview')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                📅 {todayLabel}
              </span>
              <span style={{
                background: 'rgba(16,185,129,0.2)',
                border: '1px solid rgba(52,211,153,0.5)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                📊 {realTotalReports} Reports
              </span>
              <span style={{
                background: 'rgba(96,165,250,0.2)',
                border: '1px solid rgba(147,197,253,0.5)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                🆔 {realTotalCitizens} Registrations
              </span>
            </div>
          </div>

          {/* ===== KPI STATS (real data) ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(165px, 1fr))', gap: isMobile ? '10px' : '14px', marginBottom: '24px', padding: isMobile ? '0 10px' : '0 16px' }}>
            <StatsCard label={t('dashboard.total_reports')} value={realTotalReports} color="#1e3a5f" icon="📋" detail={totalReportsDetail} />
            <StatsCard label={t('dashboard.citizens_registered')} value={realTotalCitizens} color="#2d6a4f" icon="🆔" detail={citizensDetail} />
            <StatsCard label={t('dashboard.field_officers')} value={realFieldOfficers} color="#d97706" icon="👥" detail={officersDetail} />
            <StatsCard label={t('dashboard.supervisors')} value={realSupervisors} color="#7c3aed" icon="👤" detail={supervisorsDetail} />
            <StatsCard label={t('dashboard.active_officers_today')} value={activeOfficersToday} color="#0b7e4b" icon="⚡" detail={activeTodayDetail} />
          </div>

          {/* ===== TREND CHARTS (real data) ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '24px',
            padding: isMobile ? '0 10px' : '0 16px'
          }}>
            <ChartWrapper title={`📈 ${t('dashboard.report_submission_trend')}`} subtitle={t('dashboard.daily_reports_subtitle')}>
              {renderChart('area', reportSubmissionTrendData, ['#2563eb'], 'date', t('dashboard.reports'))}
            </ChartWrapper>
            <ChartWrapper title={`🆔 ${t('dashboard.registration_trend')}`} subtitle={t('dashboard.daily_registrations_subtitle')}>
              {renderChart('area', registrationTrendData, ['#0b7e4b'], 'date', t('dashboard.registrations'))}
            </ChartWrapper>
          </div>

          {/* ===== REGIONAL HIERARCHY CHARTS (real data) ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
            padding: isMobile ? '0 10px' : '0 16px'
          }}>
            <ChartWrapper title={`🌍 ${t('dashboard.reports_by_location')}`} subtitle={t('dashboard.reports_by_location_subtitle')}>
              {loading ? <LoadingBar /> : regionHierarchyData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, fontSize: '14px' }}>{t('dashboard.no_location_data')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                  <BarChart data={regionHierarchyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.textSecondary }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} allowDecimals={false} />
                    <Tooltip content={CustomTooltip} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
                    <Bar dataKey="Reports" name={t('dashboard.reports')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Registrations" name={t('dashboard.registrations')} fill="#0b7e4b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartWrapper>

            <ChartWrapper title={`🏙️ ${t('dashboard.woreda_kebele_breakdown')}`} subtitle={t('dashboard.lower_hierarchy_subtitle')}>
              {loading ? <LoadingBar /> : woredaBreakdownData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, fontSize: '14px' }}>{t('dashboard.no_woreda_kebele_data')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                  <BarChart data={woredaBreakdownData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.textSecondary }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} allowDecimals={false} />
                    <Tooltip content={CustomTooltip} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: colors.textSecondary }} />
                    <Bar dataKey="Reports" name={t('dashboard.reports')} fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Registrations" name={t('dashboard.registrations')} fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartWrapper>
          </div>

          {/* ===== REGIONAL HIERARCHY SUMMARY TABLE ===== */}
          <div style={{
            background: colors.cardBg,
            padding: isMobile ? '14px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: colors.shadow,
            border: `1px solid ${colors.cardBorder}`,
            margin: isMobile ? '0 0 16px' : '0 16px 24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: colors.textPrimary }}>🗺️ {t('dashboard.location_coverage')}</h3>
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                {t('dashboard.described_by_region')}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.cardBorder}`, color: colors.textSecondary, textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.table_region')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.woredas')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.officers')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.reports')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.registrations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {regionStatsData.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: colors.textSecondary }}>{t('dashboard.no_location_data')}</td></tr>
                  ) : (
                    regionStatsData
                      .filter(s => s.reports > 0 || s.registrations > 0)
                      .map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${colors.cardBorder}` }}>
                        <td style={{ padding: '9px 10px', fontWeight: '600' }}>{r.name}</td>
                        <td style={{ padding: '9px 10px' }}>{r.woredas}</td>
                        <td style={{ padding: '9px 10px' }}>{r.officers}</td>
                        <td style={{ padding: '9px 10px', color: '#2563eb', fontWeight: '600' }}>{r.reports}</td>
                        <td style={{ padding: '9px 10px', color: '#0b7e4b', fontWeight: '600' }}>{r.registrations}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== TOP PERFORMERS ===== */}
          <div style={{
            background: colors.cardBg,
            padding: isMobile ? '14px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: colors.shadow,
            border: `1px solid ${colors.cardBorder}`,
            margin: isMobile ? '0 0 16px' : '0 16px 24px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: colors.textPrimary }}>🏆 {t('dashboard.top_performers_by_registrations')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(!realTopPerformers || realTopPerformers.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary, fontSize: '14px' }}>{t('dashboard.no_performance_data')}</div>
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
                      borderRadius: '8px',
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
                    <span style={{ color: colors.textSecondary, fontSize: '12px' }}>{emp.location}</span>
                    <span style={{ color: '#2563eb', fontWeight: '500' }}>🆔 {emp.totalRegistrations || 0}</span>
                    <span style={{ color: '#7c3aed' }}>📊 {t('dashboard.reports_count', { count: emp.totalReports || 0 })}</span>
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
          {/* ===== HERO HEADER ===== */}
          <div style={{
            background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
            borderRadius: '16px',
            padding: isMobile ? '18px 14px' : '28px 28px 26px',
            margin: isMobile ? '0 0 16px' : '0 16px 24px',
            color: 'white',
            boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '700', margin: '0 0 6px 0' }}>👨‍💼 {t('dashboard.supervisor_dashboard')}</h2>
              <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '520px' }}>
                {t('dashboard.supervisor_overview')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                📅 {todayLabel}
              </span>
              <span style={{
                background: 'rgba(16,185,129,0.2)',
                border: '1px solid rgba(52,211,153,0.5)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                📊 {t('dashboard.reports_badge', { count: teamReportsCount })}
              </span>
              <span style={{
                background: 'rgba(96,165,250,0.2)',
                border: '1px solid rgba(147,197,253,0.5)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                🆔 {t('dashboard.registrations_badge', { count: teamCitizenCount })}
              </span>
            </div>
          </div>

          {/* ===== KPI STATS (real data) ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(165px, 1fr))', gap: isMobile ? '10px' : '14px', marginBottom: '24px', padding: isMobile ? '0 10px' : '0 16px' }}>
            <StatsCard label={t('dashboard.team_members')} value={teamMembers?.length || 0} color="#7c3aed" icon="👥" detail={teamMembersDetail} />
            <StatsCard label={t('dashboard.team_reports')} value={teamReportsCount} color="#2563eb" icon="📋" detail={teamReportsDetail} />
            <StatsCard label={t('dashboard.team_registrations')} value={teamCitizenCount} color="#0b7e4b" icon="🆔" detail={teamRegistrationsDetail} />
            <StatsCard label={t('dashboard.active_today')} value={teamActiveToday} color="#d97706" icon="⚡" detail={teamActiveTodayDetail} />
            <StatsCard label={t('dashboard.pending_requests')} value={teamPendingRequests} color="#dc2626" icon="⏳" detail={teamPendingRequestsDetail} />
          </div>

          {/* ===== TREND CHARTS (real data) ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '24px',
            padding: isMobile ? '0 10px' : '0 16px'
          }}>
            <ChartWrapper title={`📈 ${t('dashboard.team_report_submission_trend')}`} subtitle={t('dashboard.team_report_subtitle')}>
              {renderChart('area', teamReportSubmissionTrendData, ['#2563eb'], 'date', t('dashboard.reports'))}
            </ChartWrapper>
            <ChartWrapper title={`🆔 ${t('dashboard.team_registration_trend')}`} subtitle={t('dashboard.team_registration_subtitle')}>
              {renderChart('area', teamRegistrationTrendData, ['#0b7e4b'], 'date', t('dashboard.registrations'))}
            </ChartWrapper>
          </div>

          {/* ===== TEAM BREAKDOWN CHARTS (real data) ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
            padding: isMobile ? '0 10px' : '0 16px'
          }}>
            <ChartWrapper title={`📋 ${t('dashboard.team_reports_by_member')}`} subtitle={t('dashboard.team_reports_by_member_subtitle')}>
              {loading ? <LoadingBar /> : teamMemberShareData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, fontSize: '14px' }}>{t('dashboard.no_team_report_data')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                  <BarChart data={teamMemberShareData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.textSecondary }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} allowDecimals={false} />
                    <Tooltip content={CustomTooltip} />
                    <Bar dataKey="value" name={t('dashboard.reports')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartWrapper>

            <ChartWrapper title={`🆔 ${t('dashboard.team_registrations_by_member')}`} subtitle={t('dashboard.team_registrations_by_member_subtitle')}>
              {loading ? <LoadingBar /> : teamRegistrationsByMember.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, fontSize: '14px' }}>{t('dashboard.no_team_registration_data')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                  <BarChart data={teamRegistrationsByMember} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                    <XAxis dataKey="employeeName" tick={{ fontSize: 11, fill: colors.textSecondary }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} allowDecimals={false} />
                    <Tooltip content={CustomTooltip} />
                    <Bar dataKey="count" name={t('dashboard.registrations')} fill="#0b7e4b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartWrapper>
          </div>

          {/* ===== TEAM PERFORMANCE – RANKED BY REGISTRATIONS (HIGHEST FIRST) ===== */}
          <div style={{
            background: colors.cardBg,
            padding: isMobile ? '14px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: colors.shadow,
            border: `1px solid ${colors.cardBorder}`,
            margin: isMobile ? '0 0 16px' : '0 16px 24px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: colors.textPrimary }}>🏆 {t('dashboard.team_performance')}</h3>
            {(!realTeamPerformance || realTeamPerformance.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary, fontSize: '14px' }}>{t('dashboard.no_team_performance_yet')}</div>
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
                      borderRadius: '8px',
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
                    <span style={{ color: colors.textSecondary, fontSize: '12px' }}>{emp.location}</span>
                    <span style={{ color: '#2563eb', fontWeight: '500' }}>🆔 {emp.totalRegistrations || 0}</span>
                    <span style={{ color: '#7c3aed' }}>📊 {t('dashboard.reports_count', { count: emp.totalReports || 0 })}</span>
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
          {/* ===== HERO HEADER (manager dashboard style) ===== */}
          <div style={{
            background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
            borderRadius: '16px',
            padding: isMobile ? '18px 14px' : '28px 28px 26px',
            margin: isMobile ? '0 0 16px' : '0 16px 24px',
            color: 'white',
            boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '700', margin: '0 0 6px 0' }}>👤 {t('dashboard.officer_dashboard')}</h2>
              <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '520px' }}>
                {t('dashboard.officer_overview')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                📅 {todayLabel}
              </span>
              <span style={{
                background: 'rgba(16,185,129,0.2)',
                border: '1px solid rgba(52,211,153,0.5)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                📊 {t('dashboard.reports_badge', { count: officerReportsCount })}
              </span>
              <span style={{
                background: 'rgba(96,165,250,0.2)',
                border: '1px solid rgba(147,197,253,0.5)',
                padding: '6px 14px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                🆔 {t('dashboard.registrations_badge', { count: officerTotalRegistrations })}
              </span>
            </div>
          </div>

          {/* ===== KPI STATS (real data, clickable) ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(165px, 1fr))', gap: isMobile ? '10px' : '14px', marginBottom: '24px', padding: isMobile ? '0 10px' : '0 16px' }}>
            <StatsCard label={t('dashboard.my_reports')} value={officerReportsCount} color="#2563eb" icon="📋" detail={myReportsDetail} />
            <StatsCard label={t('dashboard.my_registrations')} value={officerTotalRegistrations} color="#0b7e4b" icon="🆔" detail={myCitizensDetail} />
            <StatsCard label={t('dashboard.today_reports')} value={officerTodayReports} color="#7c3aed" icon="📄" detail={myTodayReportsDetail} />
            <StatsCard label={t('dashboard.today_registrations')} value={officerTodayRegistrations} color="#d97706" icon="✍️" detail={myTodayRegistrationsDetail} />
            <StatsCard label={t('dashboard.pending_requests')} value={officerPendingRequests} color="#dc2626" icon="⏳" detail={myPendingRequestsDetail} />
          </div>

          {/* ===== MY REGISTRATION TREND (real data) ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '24px',
            padding: isMobile ? '0 10px' : '0 16px'
          }}>
            <ChartWrapper title={`🆔 ${t('dashboard.my_registration_trend')}`} subtitle={t('dashboard.my_registration_trend_subtitle')}>
              {renderChart('area', officerPerformanceData.map(d => ({ date: d.date, value: d.registrations })), ['#0b7e4b'], 'date', t('dashboard.registrations'))}
            </ChartWrapper>
          </div>

          {/* ===== MY WEEKLY PERFORMANCE (ranked, real data) ===== */}
          <div style={{
            background: colors.cardBg,
            padding: isMobile ? '14px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: colors.shadow,
            border: `1px solid ${colors.cardBorder}`,
            margin: isMobile ? '0 0 16px' : '0 16px 24px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: colors.textPrimary }}>🏆 {t('dashboard.my_weekly_performance')}</h3>
            {(!officerPerformanceData || officerPerformanceData.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary, fontSize: '14px' }}>{t('dashboard.no_performance_data')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {officerPerformanceData.slice().reverse().map((d, i) => (
                  <div
                    key={d.date}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      background: i === 0 ? '#fef3c7' : colors.inputBg,
                      borderRadius: '8px',
                      border: i === 0 ? '1px solid #d97706' : `1px solid ${colors.cardBorder}`,
                      flexWrap: 'wrap',
                      fontSize: '13px',
                      color: colors.textPrimary
                    }}
                  >
                    <span style={{ fontWeight: '700', color: i === 0 ? '#d97706' : colors.textSecondary, minWidth: '96px' }}>
                      {d.date}
                    </span>
                    <span style={{ fontWeight: '600', flex: 1 }}>{d.date === getToday() ? t('dashboard.today') : ''}</span>
                    <span style={{ color: '#0b7e4b', fontWeight: '600' }}>✍️ {t('dashboard.registrations_count', { count: d.registrations || 0 })}</span>
                    <span style={{ color: '#2563eb', fontWeight: '500' }}>📋 {t('dashboard.reports_count', { count: d.reports || 0 })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== CARD DETAIL BOX (opened when a KPI card is clicked) ===== */}
      {activeCard && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: 'fieldsyncFadeIn 0.18s ease'
        }} onClick={() => setActiveCard(null)}>
          <div style={{
            background: colors.cardBg,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 70px rgba(0,0,0,0.4)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header with big value */}
            <div style={{
              padding: '22px 24px',
              background: `linear-gradient(135deg, ${activeCard.color}, ${activeCard.color}99 60%, ${activeCard.color}55)`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {activeCard.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', opacity: 0.85, fontWeight: '500' }}>{activeCard.label}</div>
                <div style={{ fontSize: '34px', fontWeight: '800', lineHeight: 1.1, marginTop: '2px' }}>{activeCard.value}</div>
              </div>
              <button
                onClick={() => setActiveCard(null)}
                title={t('dashboard.close')}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                  border: 'none',
                  color: 'white',
                  fontSize: '16px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  flexShrink: 0
                }}
              >✕</button>
            </div>

            {/* Body */}
            <div style={{
              padding: '18px 20px 20px',
              overflowY: 'auto',
              color: colors.textPrimary,
              fontSize: '13px'
            }}>
              {activeCard.render()}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: `1px solid ${colors.cardBorder}`,
              textAlign: 'center',
              background: colors.inputBg
            }}>
              <button
                onClick={() => setActiveCard(null)}
                style={{
                  padding: '8px 26px',
                  borderRadius: '99px',
                  border: 'none',
                  background: `linear-gradient(135deg, ${activeCard.color}, ${activeCard.color}cc)`,
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >{t('dashboard.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;