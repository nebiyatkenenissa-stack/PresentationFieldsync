import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

function Analytics({ 
  reports: allReports, 
  users, 
  screenTime: allScreenTime, 
  liveStatus: allLiveStatus,
  citizens: allCitizens,
  renderBarChart 
}) {
  const [activeCard, setActiveCard] = useState(null);

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

  // Region stats — only the locations listed in the users list
  const validRegions = useMemo(() => {
    return [...new Set((users || [])
      .map(u => u.region)
      .filter(r => r && r !== 'All'))];
  }, [users]);

  const employeeRegionMap = useMemo(() => {
    const map = {};
    (users || []).forEach(u => {
      if (u.employeeId && u.region && u.region !== 'All') map[u.employeeId] = u.region;
    });
    return map;
  }, [users]);

  const resolveRegion = useCallback((employeeId, fallbackRegion) => {
    if (employeeId && employeeRegionMap[employeeId]) return employeeRegionMap[employeeId];
    return validRegions.includes(fallbackRegion) ? fallbackRegion : 'Other';
  }, [employeeRegionMap, validRegions]);

  const regionStats = useMemo(() => {
    const map = {};
    const ensure = (region) => {
      if (!map[region]) map[region] = { reports: 0, registrations: 0, employees: new Set() };
      return map[region];
    };
    validRegions.forEach(r => ensure(r));
    reports.forEach(r => {
      const region = resolveRegion(r.employeeId, r.region);
      if (region === 'Other') return;
      const entry = ensure(region);
      entry.reports += 1;
      entry.employees.add(r.employeeId);
    });
    citizens.forEach(c => {
      const region = resolveRegion(c.registeredBy, c.region);
      if (region === 'Other') return;
      const entry = ensure(region);
      entry.registrations += 1;
      if (c.registeredBy) entry.employees.add(c.registeredBy);
    });
    return Object.entries(map).map(([region, data]) => ({
      region,
      ...data,
      employees: data.employees.size
    }));
  }, [reports, citizens, validRegions, resolveRegion]);

  // ===== CHART DATA (short names on the bars) =====
  const shortRegion = useCallback((name) => {
    if (!name) return 'N/A';
    return name.length <= 9 ? name : `${name.slice(0, 8)}…`;
  }, []);

  const regionBarData = useMemo(() =>
    regionStats.map(r => ({
      name: shortRegion(r.region),
      fullName: r.region,
      registrations: r.registrations,
      reports: r.reports
    })),
    [regionStats, shortRegion]
  );

  // Employee performance (from filtered data)
  const employeePerformance = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          region: resolveRegion(r.employeeId, r.region),
          totalReports: 0,
          totalRegistrations: 0,
          avgEfficiency: 0,
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
  }, [reports, citizens, screenTime, liveStatus, resolveRegion]);

  // ============================================================
  // DERIVED METRICS
  // ============================================================
  const topOfficers = [...employeePerformance]
    .sort((a, b) => b.totalRegistrations - a.totalRegistrations)
    .slice(0, 5);

  const totalOfficers = users?.filter(u => u.role === 'field_officer').length || 0;
  const totalSupervisors = users?.filter(u => u.role === 'supervisor').length || 0;

  // ----- TEAM LISTS FOR CLICKABLE CARDS (deduped) -----
  const dedupeUsers = useCallback((list) => {
    const seen = new Set();
    return list.filter(u => {
      const key = u.employeeId || u.name || u.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const fieldOfficerList = useMemo(() =>
    dedupeUsers((users || []).filter(u => u.role === 'field_officer')),
    [users, dedupeUsers]
  );

  const supervisorList = useMemo(() =>
    dedupeUsers((users || []).filter(u => u.role === 'supervisor')),
    [users, dedupeUsers]
  );

  const registrationsByEmployee = useMemo(() => {
    const map = {};
    (citizens || []).forEach(c => {
      if (c.registeredBy) map[c.registeredBy] = (map[c.registeredBy] || 0) + 1;
    });
    return map;
  }, [citizens]);

  const dailyRegistrationTrend = useMemo(() => {
    const today = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      data.push({
        date: dateStr,
        value: (citizens || []).filter(c => c.registrationDate?.slice(0, 10) === dateStr).length
      });
    }
    return data;
  }, [citizens]);

  // ============================================================
  // CARD DETAIL RENDERERS (opened on click)
  // ============================================================
  const renderFieldOfficerList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {fieldOfficerList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No field officers found</div>
      ) : (
        fieldOfficerList.map((o) => (
          <div key={o.employeeId || o.name || o.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '18px' }}>👥</span>
            <span style={{ flex: 1, fontWeight: '600', fontSize: '13px' }}>{o.name || o.employeeId || 'Unnamed Officer'}</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{o.region && o.region !== 'All' ? o.region : ''}</span>
            <span style={{ color: '#2563eb', fontWeight: '600', fontSize: '13px' }}>🆔 {registrationsByEmployee[o.employeeId] || 0}</span>
          </div>
        ))
      )}
    </div>
  );

  const renderSupervisorList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {supervisorList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No supervisors found</div>
      ) : (
        supervisorList.map((s) => (
          <div key={s.employeeId || s.name || s.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '18px' }}>👤</span>
            <span style={{ flex: 1, fontWeight: '600', fontSize: '13px' }}>{s.name || s.employeeId || 'Unnamed Supervisor'}</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{s.region && s.region !== 'All' ? s.region : ''}</span>
            <span style={{ color: '#7c3aed', fontWeight: '600', fontSize: '13px' }}>📋 {registrationsByEmployee[s.employeeId] || 0}</span>
          </div>
        ))
      )}
    </div>
  );

  const renderDailyAvgDetail = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {dailyRegistrationTrend.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No registration data available</div>
      ) : (
        (() => {
          const maxVal = Math.max(...dailyRegistrationTrend.map(d => d.value), 1);
          return dailyRegistrationTrend.map((d, idx) => (
            <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '500', minWidth: '70px', color: '#64748b' }}>
                {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <div style={{ flex: 1, height: '24px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max((d.value / maxVal) * 100, 2)}%`,
                  background: 'linear-gradient(90deg, #0b7e4b, #10b981)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '8px',
                  borderRadius: '6px',
                  minWidth: '24px',
                  opacity: idx === dailyRegistrationTrend.length - 1 ? 1 : 0.85
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'white' }}>{d.value}</span>
                </div>
              </div>
            </div>
          ));
        })()
      )}
    </div>
  );

  // ============================================================
  // RENDER – same as before, but using computed filtered values
  // ============================================================
  return (
    <div className="analytics-view" style={{padding: '0'}}>
      {/* ===== HERO HEADER (dashboard style) ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
        borderRadius: '16px',
        padding: '28px 28px 26px',
        margin: '0 0 24px',
        color: 'white',
        boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📊 Statistics &amp; Analytics</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            Data-driven insights and performance metrics
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
            📅 {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span style={{
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid rgba(52,211,153,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            📊 {totalReports} Reports
          </span>
          <span style={{
            background: 'rgba(96,165,250,0.2)',
            border: '1px solid rgba(147,197,253,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            🆔 {totalRegistrations} Registrations
          </span>
        </div>
      </div>

      {/* Key Metrics Dashboard – colorful clickable cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onClick={() => setActiveCard({
          label: 'Field Officers',
          value: totalOfficers,
          icon: '👥',
          color: '#2563eb',
          render: renderFieldOfficerList
        })}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.25)';
        }}>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{totalOfficers}</div>
          <div style={{ fontSize: '14px', opacity: 0.85 }}>👥 Field Officers</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '6px' }}>Click to view team ▸</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onClick={() => setActiveCard({
          label: 'Supervisors',
          value: totalSupervisors,
          icon: '👤',
          color: '#7c3aed',
          render: renderSupervisorList
        })}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.25)';
        }}>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{totalSupervisors}</div>
          <div style={{ fontSize: '14px', opacity: 0.85 }}>👤 Supervisors</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '6px' }}>Click to view team ▸</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #0b7e4b, #065f37)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(11, 126, 75, 0.25)',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          cursor: 'pointer'
        }}
        onClick={() => setActiveCard({
          label: 'Daily Avg Registrations',
          value: dailyAvg,
          icon: '📈',
          color: '#0b7e4b',
          render: renderDailyAvgDetail
        })}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(11, 126, 75, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(11, 126, 75, 0.25)';
        }}>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{dailyAvg}</div>
          <div style={{ fontSize: '14px', opacity: 0.85 }}>📈 Daily Avg Registrations</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '6px' }}>Click to view trend ▸</div>
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
          <div className="chart-container" style={{ width: '100%', height: 280 }}>
            {regionBarData.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(value, _name, item) => [value, item?.payload?.fullName]} />
                  <Legend />
                  <Bar dataKey="registrations" name="Registrations" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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

        {/* Registration Breakdown (card display) */}
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
            <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c'}}>📋 Registration Breakdown</h3>
            <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>Citizens registered per region</p>
          </div>
          {regionStats.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>No data available</div>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px'}}>
              {regionStats.map((region, idx) => (
                <div key={region.region} style={{
                  background: idx % 2 === 0 ? '#f0f4f8' : '#f8fafc',
                  padding: '16px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  <div style={{fontSize: '24px', fontWeight: '700', color: '#1a202c'}}>{region.registrations}</div>
                  <div style={{fontSize: '13px', color: '#64748b'}}>🆔 {region.region}</div>
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
            🏆 Top Region: {regionStats?.length > 0 ? regionStats.sort((a, b) => b.registrations - a.registrations)[0]?.region || 'N/A' : 'N/A'}
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
                  <span style={{color: '#2563eb', fontWeight: '500', fontSize: '13px'}}>🆔 {emp.totalRegistrations} Registered</span>
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
                      👥 {region.employees || 0} Staff
                    </span>
                    <span style={{fontSize: '12px', color: '#2563eb'}}>
                      🆔 {region.registrations} Citizens
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
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 70px rgba(0,0,0,0.4)'
          }} onClick={(e) => e.stopPropagation()}>
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
                title="Close"
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

            <div style={{
              padding: '18px 20px 20px',
              overflowY: 'auto',
              color: '#1a202c',
              fontSize: '13px'
            }}>
              {activeCard.render()}
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
              background: '#f8fafc'
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
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;