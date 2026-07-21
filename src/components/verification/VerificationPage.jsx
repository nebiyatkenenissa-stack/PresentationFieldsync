// components/verification/VerificationPage.jsx
// FULL – with all card styles, filtering, and synced‑only records

import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../services/database';

function VerificationPage({ 
  users = [], 
  liveStatus = [], 
  reports = [],
  citizens = [],
  attendance = [],
  verificationScore = 100
}) {
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [allVerificationData, setAllVerificationData] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // ===== LOAD SYNCED VERIFICATION DATA =====
  const loadData = async () => {
    try {
      setLoading(true);
      let historyData = [];

      // 1. Load from IndexedDB (only synced = true)
      if (db && db.verification_history) {
        const allRecords = await db.verification_history.toArray();
        if (allRecords && allRecords.length > 0) {
          const syncedRecords = allRecords.filter(r => r.synced === true);
          historyData = syncedRecords;
          console.log(`📥 Loaded ${syncedRecords.length} synced records from IndexedDB`);
        }
      }

      // 2. Also check localStorage for each officer (merge synced history)
      if (users) {
        const officers = users.filter(u => u.role === 'field_officer');
        for (const officer of officers) {
          const saved = localStorage.getItem(`verification_${officer.id}`);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.history && parsed.history.length > 0) {
                const syncedHistory = parsed.history.filter(h => h.synced !== false);
                const officerHistory = syncedHistory.map(h => ({
                  ...h,
                  officerId: officer.id,
                  officerName: officer.name
                }));
                // Merge without duplicates
                const existingIds = new Set(historyData.map(h => h.id));
                for (const item of officerHistory) {
                  if (!existingIds.has(item.id)) {
                    historyData.push(item);
                    existingIds.add(item.id);
                  }
                }
              }
            } catch (e) { /* ignore */ }
          }
        }
      }

      setAllVerificationData(historyData);
      console.log(`📊 Total synced verification records: ${historyData.length}`);
    } catch (error) {
      console.error('Error loading verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===== RELOAD ON UPDATES =====
  useEffect(() => {
    loadData();
  }, [users, refreshKey]);

  useEffect(() => {
    const handleUpdate = () => {
      console.log('🔄 Verification update detected, reloading...');
      setRefreshKey(prev => prev + 1);
    };
    
    window.addEventListener('verification-update', handleUpdate);
    window.addEventListener('sync-complete', handleUpdate);
    
    return () => {
      window.removeEventListener('verification-update', handleUpdate);
      window.removeEventListener('sync-complete', handleUpdate);
    };
  }, []);

  // ===== COMPUTE OFFICER DATA (only from synced records) =====
  const officersData = useMemo(() => {
    if (!users || users.length === 0) return [];

    const officers = users.filter(u => u.role === 'field_officer');
    if (officers.length === 0) return [];

    return officers.map(officer => {
      const history = allVerificationData.filter(h => h.officerId === officer.id);
      const status = liveStatus?.find(l => l.employeeId === officer.employeeId);
      const initialScore = status?.verificationScore || verificationScore || 100;

      const total = history.length;
      const passed = history.filter(h => h.success === true).length;
      const failed = history.filter(h => h.success === false && h.message !== '⏰ Verification skipped').length;
      const skipped = history.filter(h => h.message === '⏰ Verification skipped' || h.answer === 'Skipped').length;

      const avgResponseTime = total > 0 
        ? Math.round(history.reduce((sum, h) => sum + (h.responseTime || 0), 0) / total)
        : 0;

      let trustScore = initialScore;
      if (total > 0 && passed > 0) {
        const historyScore = (passed / total) * 100;
        trustScore = Math.round((initialScore * 0.7) + (historyScore * 0.3));
      }
      trustScore = Math.min(100, Math.max(0, trustScore));

      const today = new Date().toISOString().slice(0, 10);
      const todayReports = reports?.filter(r => 
        r.employeeId === officer.employeeId && r.reportDate === today
      ).length || 0;
      
      const citizenCount = citizens?.filter(c => 
        c.registeredBy === officer.employeeId
      ).length || 0;

      const todayAttendance = attendance?.find(a => 
        a.employeeId === officer.employeeId && a.date === today
      );

      let statusLabel = 'Not Verified';
      let statusColor = '#94a3b8';
      if (total > 0) {
        if (trustScore >= 80) {
          statusLabel = 'Active';
          statusColor = '#16a34a';
        } else if (trustScore >= 60) {
          statusLabel = 'Suspicious';
          statusColor = '#eab308';
        } else {
          statusLabel = 'Inactive';
          statusColor = '#dc2626';
        }
      }

      const questionHistory = history.map(h => ({
        question: h.question || 'Verification check',
        answer: h.answer || 'N/A',
        success: h.success === true,
        timestamp: h.timestamp || new Date().toISOString(),
        responseTime: h.responseTime || 0,
        message: h.message || '',
        score: h.score || 0,
        penalties: Array.isArray(h.penalties) ? h.penalties : []
      }));

      return {
        id: officer.id || 'unknown',
        name: officer.name || 'Unknown',
        region: officer.region || 'N/A',
        employeeId: officer.employeeId || 'N/A',
        trustScore: trustScore,
        hasHistory: total > 0,
        historyCount: total,
        passed: passed || 0,
        failed: failed || 0,
        skipped: skipped || 0,
        avgResponseTime: avgResponseTime || 0,
        questionHistory: questionHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        todayReports: todayReports || 0,
        citizenCount: citizenCount || 0,
        attendanceStatus: todayAttendance?.status || 'Not Marked',
        status: statusLabel,
        statusColor: statusColor,
        lastVerified: history.length > 0 ? history[0]?.timestamp : null,
        lastQuestion: history.length > 0 ? history[0]?.question || 'No history' : 'No history',
        lastResult: history.length > 0 ? history[0]?.success : undefined
      };
    });
  }, [users, liveStatus, allVerificationData, reports, citizens, attendance, verificationScore]);

  // ===== FILTER OFFICERS =====
  const filteredOfficers = useMemo(() => {
    let filtered = officersData;
    if (filter !== 'all') {
      filtered = filtered.filter(o => o.status === filter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(o => 
        (o.name || '').toLowerCase().includes(term) ||
        (o.employeeId || '').toLowerCase().includes(term) ||
        (o.region || '').toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [officersData, filter, searchTerm]);

  // ===== SUMMARY STATS =====
  const summary = useMemo(() => {
    const total = officersData.length;
    const active = officersData.filter(o => o.status === 'Active').length;
    const suspicious = officersData.filter(o => o.status === 'Suspicious').length;
    const inactive = officersData.filter(o => o.status === 'Inactive').length;
    const notVerified = officersData.filter(o => o.status === 'Not Verified').length;
    const avgScore = total > 0 
      ? Math.round(officersData.reduce((sum, o) => sum + (o.trustScore || 0), 0) / total)
      : 0;
    const totalVerifications = officersData.reduce((sum, o) => sum + (o.historyCount || 0), 0);
    const totalPassed = officersData.reduce((sum, o) => sum + (o.passed || 0), 0);

    return { total, active, suspicious, inactive, notVerified, avgScore, totalVerifications, totalPassed };
  }, [officersData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
          <div style={{ color: '#64748b' }}>Loading verification data...</div>
        </div>
      </div>
    );
  }

  if (officersData.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>📋</div>
        <h3 style={{ color: '#1a202c' }}>No Verification Data Found</h3>
        <p style={{ color: '#64748b' }}>
          {allVerificationData.length === 0 ? 
            'No synced verification records yet. Records will appear after they are synced to the server.' :
            'No field officers registered in the system.'
          }
        </p>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>
          Total records in IndexedDB: {allVerificationData.length}
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event('force-sync'))}
          style={{
            marginTop: '12px',
            padding: '8px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🔄 Force Sync Now
        </button>
      </div>
    );
  }

  // ============================================================
  // FULL DASHBOARD WITH OFFICER CARDS (same style as before)
  // ============================================================
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif' }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
            Officer Verification Dashboard
          </h1>
          <p style={{ color: '#475569', fontSize: '15px', margin: '6px 0 0 0' }}>
            Real‑time verification status of all field officers (synced records only)
          </p>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
            Total synced verification records: <strong>{allVerificationData.length}</strong>
          </p>
        </div>
        <div style={{
          padding: '10px 20px',
          background: summary.avgScore >= 80 ? '#f0fdf4' : summary.avgScore >= 60 ? '#fefce8' : '#fef2f2',
          borderRadius: '12px',
          border: '2px solid ' + (summary.avgScore >= 80 ? '#22c55e' : summary.avgScore >= 60 ? '#eab308' : '#ef4444'),
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#475569' }}>Overall Trust Score</div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: summary.avgScore >= 80 ? '#16a34a' : summary.avgScore >= 60 ? '#ca8a04' : '#dc2626'
          }}>
            {summary.avgScore}%
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Total Officers</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a' }}>{summary.total}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Active</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#16a34a' }}>{summary.active}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Suspicious</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#ca8a04' }}>{summary.suspicious}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Inactive</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#dc2626' }}>{summary.inactive}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #94a3b8' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Not Verified</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#64748b' }}>{summary.notVerified}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Total Verifications</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#2563eb' }}>{summary.totalVerifications}</div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: 'white',
        padding: '14px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <input
            type="text"
            placeholder="Search by name, ID or region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('all')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'all' ? '2px solid #0f172a' : '1px solid #d1d5db', background: filter === 'all' ? '#0f172a' : 'white', color: filter === 'all' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>All ({summary.total})</button>
          <button onClick={() => setFilter('Active')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'Active' ? '2px solid #22c55e' : '1px solid #d1d5db', background: filter === 'Active' ? '#22c55e' : 'white', color: filter === 'Active' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Active ({summary.active})</button>
          <button onClick={() => setFilter('Suspicious')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'Suspicious' ? '2px solid #eab308' : '1px solid #d1d5db', background: filter === 'Suspicious' ? '#eab308' : 'white', color: filter === 'Suspicious' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Suspicious ({summary.suspicious})</button>
          <button onClick={() => setFilter('Inactive')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'Inactive' ? '2px solid #ef4444' : '1px solid #d1d5db', background: filter === 'Inactive' ? '#ef4444' : 'white', color: filter === 'Inactive' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Inactive ({summary.inactive})</button>
          <button onClick={() => setFilter('Not Verified')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'Not Verified' ? '2px solid #94a3b8' : '1px solid #d1d5db', background: filter === 'Not Verified' ? '#94a3b8' : 'white', color: filter === 'Not Verified' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Not Verified ({summary.notVerified})</button>
        </div>
      </div>

      {/* OFFICER CARDS – FULL STYLE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredOfficers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '48px' }}>🔍</div>
            <div style={{ color: '#64748b' }}>No officers match the current filters</div>
          </div>
        ) : (
          filteredOfficers.map((officer) => {
            const isExpanded = selectedOfficer === officer.id;
            const statusColor = officer.statusColor || '#94a3b8';
            const hasHistory = officer.hasHistory;

            return (
              <div
                key={officer.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid ' + (isExpanded ? '#3b82f6' : '#e2e8f0'),
                  boxShadow: isExpanded ? '0 4px 12px rgba(59, 130, 246, 0.1)' : '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden'
                }}
              >
                {/* CARD HEADER */}
                <div 
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                  onClick={() => setSelectedOfficer(isExpanded ? null : officer.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: statusColor + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: '600',
                      color: statusColor
                    }}>
                      {officer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#0f172a' }}>{officer.name}</div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {officer.region} • {officer.employeeId}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '500',
                      background: statusColor + '20',
                      color: statusColor
                    }}>
                      {officer.status}
                    </span>
                    <span style={{ fontSize: '26px', fontWeight: '700', color: hasHistory ? statusColor : '#94a3b8' }}>
                      {hasHistory ? officer.trustScore + '%' : '—'}
                    </span>
                    <span style={{ fontSize: '18px', color: '#94a3b8' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* EXPANDED DETAILS */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #e2e8f0' }}>
                    {!hasHistory ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>📋</div>
                        <div>No synced verification history for this officer yet.</div>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>Records will appear after they are synced to the server.</div>
                      </div>
                    ) : (
                      <>
                        {/* METRICS GRID */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '12px',
                          marginTop: '16px'
                        }}>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verifications</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>{officer.historyCount}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #22c55e' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Passed</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#16a34a' }}>{officer.passed}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #ef4444' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Failed</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#dc2626' }}>{officer.failed}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #eab308' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skipped</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#ca8a04' }}>{officer.skipped}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #3b82f6' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Response</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#2563eb' }}>{officer.avgResponseTime}s</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #8b5cf6' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reports Today</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#7c3aed' }}>{officer.todayReports}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #14b8a6' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Citizens</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0d9488' }}>{officer.citizenCount}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #f97316' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance</div>
                            <div style={{ 
                              fontSize: '18px', 
                              fontWeight: '700', 
                              color: officer.attendanceStatus === 'present' ? '#16a34a' 
                                : officer.attendanceStatus === 'late' ? '#eab308' 
                                : '#dc2626' 
                            }}>
                              {officer.attendanceStatus}
                            </div>
                          </div>
                        </div>

                        {/* LAST VERIFIED INFO */}
                        <div style={{
                          marginTop: '16px',
                          padding: '12px 16px',
                          background: '#f1f5f9',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                          fontSize: '13px',
                          color: '#475569'
                        }}>
                          <span>
                            Last Verified: <strong>{officer.lastVerified ? new Date(officer.lastVerified).toLocaleString() : 'Never'}</strong>
                          </span>
                          <span>
                            Last Question: <strong>{officer.lastQuestion}</strong>
                            {officer.lastResult !== undefined && (
                              <span style={{ marginLeft: '6px' }}>{officer.lastResult ? 'Passed' : 'Failed'}</span>
                            )}
                          </span>
                        </div>

                        {/* VERIFICATION HISTORY TABLE */}
                        {officer.questionHistory.length > 0 && (
                          <div style={{ marginTop: '16px' }}>
                            <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', margin: '0 0 10px 0' }}>
                              Verification History ({officer.questionHistory.length} records)
                            </h4>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '13px',
                                background: '#fafbfc',
                                borderRadius: '8px',
                                overflow: 'hidden'
                              }}>
                                <thead>
                                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Time</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Question</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Answer</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Response</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Result</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {officer.questionHistory.slice(0, 20).map((item, idx) => {
                                    const isSuccess = item.success === true;
                                    const isSkipped = item.message === '⏰ Verification skipped' || item.answer === 'Skipped';
                                    const resultText = isSuccess ? 'Passed' : isSkipped ? 'Skipped' : 'Failed';
                                    const resultColor = isSuccess ? '#16a34a' : isSkipped ? '#ca8a04' : '#dc2626';

                                    return (
                                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '--'}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontWeight: '500', color: '#0f172a' }}>
                                          {item.question}
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                                          {item.answer}
                                        </td>
                                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>
                                          {item.responseTime ? item.responseTime + 's' : '--'}
                                        </td>
                                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                          <span style={{
                                            padding: '2px 12px',
                                            borderRadius: '20px',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            background: isSuccess ? '#dcfce7' : isSkipped ? '#fef9c3' : '#fee2e2',
                                            color: resultColor
                                          }}>
                                            {resultText}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {officer.questionHistory.length > 20 && (
                                <div style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '12px', borderTop: '1px solid #e2e8f0' }}>
                                  Showing 20 of {officer.questionHistory.length} records
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default VerificationPage;