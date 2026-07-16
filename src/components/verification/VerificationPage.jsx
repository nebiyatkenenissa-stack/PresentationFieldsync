// components/verification/VerificationPage.jsx

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

  // Load all verification data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        let historyData = [];

        // Try IndexedDB
        if (db && db.verification_history) {
          const data = await db.verification_history.toArray();
          if (data && data.length > 0) {
            historyData = data;
            console.log(`📥 Loaded ${historyData.length} records from IndexedDB`);
          }
        }

        // Also check localStorage for each officer
        if (users) {
          const officers = users.filter(u => u.role === 'field_officer');
          for (const officer of officers) {
            const saved = localStorage.getItem(`verification_${officer.id}`);
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (parsed.history && parsed.history.length > 0) {
                  const officerHistory = parsed.history.map(h => ({
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
              } catch (e) {}
            }
          }
        }

        setAllVerificationData(historyData);
      } catch (error) {
        console.error('Error loading verification data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('verification-update', handleUpdate);
    return () => window.removeEventListener('verification-update', handleUpdate);
  }, [users]);

  // Calculate officers data
  const officersData = useMemo(() => {
    if (!users || users.length === 0) return [];

    const officers = users.filter(u => u.role === 'field_officer');
    if (officers.length === 0) return [];

    return officers.map(officer => {
      const history = allVerificationData.filter(h => h.officerId === officer.id);
      const status = liveStatus?.find(l => l.employeeId === officer.employeeId);
      const score = status?.verificationScore || verificationScore || 100;
      const lastCheck = status?.lastVerified || (history.length > 0 ? history[0]?.timestamp : null);
      
      const total = history.length;
      const passed = history.filter(h => h.success === true).length;
      const failed = history.filter(h => h.success === false && h.message !== '⏰ Verification skipped').length;
      const skipped = history.filter(h => h.message === '⏰ Verification skipped' || h.answer === 'Skipped').length;

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

      const avgResponseTime = total > 0 
        ? Math.round(history.reduce((sum, h) => sum + (h.responseTime || 0), 0) / total)
        : 0;

      let trustScore = score;
      if (total > 0 && passed > 0) {
        const historyScore = (passed / total) * 100;
        trustScore = Math.round((score * 0.7) + (historyScore * 0.3));
      }

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

      const statusLabel = trustScore >= 80 ? 'Active' : trustScore >= 60 ? 'Suspicious' : 'Inactive';
      const statusColor = trustScore >= 80 ? '#0b7e4b' : trustScore >= 60 ? '#f59e0b' : '#dc2626';

      return {
        id: officer.id || 'unknown',
        name: officer.name || 'Unknown',
        region: officer.region || 'N/A',
        employeeId: officer.employeeId || 'N/A',
        trustScore: trustScore,
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
        lastVerified: lastCheck,
        lastQuestion: history.length > 0 ? history[0]?.question || 'No history' : 'No history',
        lastResult: history.length > 0 ? history[0]?.success : undefined
      };
    });
  }, [users, liveStatus, allVerificationData, reports, citizens, attendance, verificationScore]);

  // Filter officers
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

  // Summary
  const summary = useMemo(() => {
    const total = officersData.length;
    const active = officersData.filter(o => o.status === 'Active').length;
    const suspicious = officersData.filter(o => o.status === 'Suspicious').length;
    const inactive = officersData.filter(o => o.status === 'Inactive').length;
    const avgScore = total > 0 
      ? Math.round(officersData.reduce((sum, o) => sum + (o.trustScore || 0), 0) / total)
      : 0;
    const totalVerifications = officersData.reduce((sum, o) => sum + (o.historyCount || 0), 0);
    const totalPassed = officersData.reduce((sum, o) => sum + (o.passed || 0), 0);

    return { total, active, suspicious, inactive, avgScore, totalVerifications, totalPassed };
  }, [officersData]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px' }}>⏳</div>
        <div style={{ color: '#64748b' }}>Loading verification data...</div>
      </div>
    );
  }

  if (officersData.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>🔍</div>
        <h3 style={{ color: '#1a202c' }}>No Field Officers Found</h3>
        <p style={{ color: '#64748b' }}>There are no field officers registered in the system.</p>
        <div style={{ marginTop: '12px', color: '#94a3b8', fontSize: '12px' }}>
          Total users: {users?.length || 0} | Field officers: {users?.filter(u => u.role === 'field_officer').length || 0}
        </div>
        <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '12px' }}>
          Verification records: {allVerificationData.length}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a202c' }}>
            🔍 Officer Verification Dashboard
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
            Monitor and track field officer verification status
          </p>
          <p style={{ color: '#94a3b8', fontSize: '12px' }}>
            Total records: {allVerificationData.length}
          </p>
        </div>
        <div style={{
          padding: '8px 16px',
          background: summary.avgScore >= 80 ? '#d1fae5' : summary.avgScore >= 60 ? '#fef3c7' : '#fee2e2',
          borderRadius: '20px',
          border: `2px solid ${summary.avgScore >= 80 ? '#0b7e4b' : summary.avgScore >= 60 ? '#f59e0b' : '#dc2626'}`
        }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: summary.avgScore >= 80 ? '#0b7e4b' : summary.avgScore >= 60 ? '#92400e' : '#991b1b' }}>
            📊 Overall Trust: {summary.avgScore}%
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{summary.total}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Total Officers</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center', borderLeft: '4px solid #0b7e4b' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0b7e4b' }}>{summary.active}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>✅ Active</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{summary.suspicious}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>🟡 Suspicious</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc2626' }}>{summary.inactive}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>🔴 Inactive</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#2563eb' }}>{summary.totalVerifications}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Total Verifications</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#7c3aed' }}>{summary.totalPassed}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>✅ Passed</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Search officers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '14px', flex: '1', minWidth: '200px' }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('all')} style={{ padding: '8px 16px', borderRadius: '6px', border: filter === 'all' ? '2px solid #1e293b' : '1px solid #e5e7eb', background: filter === 'all' ? '#1e293b' : 'white', color: filter === 'all' ? 'white' : '#64748b', cursor: 'pointer', fontSize: '13px' }}>All ({summary.total})</button>
          <button onClick={() => setFilter('Active')} style={{ padding: '8px 16px', borderRadius: '6px', border: filter === 'Active' ? '2px solid #0b7e4b' : '1px solid #e5e7eb', background: filter === 'Active' ? '#0b7e4b' : 'white', color: filter === 'Active' ? 'white' : '#64748b', cursor: 'pointer', fontSize: '13px' }}>✅ Active ({summary.active})</button>
          <button onClick={() => setFilter('Suspicious')} style={{ padding: '8px 16px', borderRadius: '6px', border: filter === 'Suspicious' ? '2px solid #f59e0b' : '1px solid #e5e7eb', background: filter === 'Suspicious' ? '#f59e0b' : 'white', color: filter === 'Suspicious' ? 'white' : '#64748b', cursor: 'pointer', fontSize: '13px' }}>🟡 Suspicious ({summary.suspicious})</button>
          <button onClick={() => setFilter('Inactive')} style={{ padding: '8px 16px', borderRadius: '6px', border: filter === 'Inactive' ? '2px solid #dc2626' : '1px solid #e5e7eb', background: filter === 'Inactive' ? '#dc2626' : 'white', color: filter === 'Inactive' ? 'white' : '#64748b', cursor: 'pointer', fontSize: '13px' }}>🔴 Inactive ({summary.inactive})</button>
        </div>
      </div>

      {/* Officers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredOfficers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '48px' }}>🔍</div>
            <div style={{ color: '#64748b' }}>No officers match the current filters</div>
          </div>
        ) : (
          filteredOfficers.map((officer) => {
            const id = String(officer.id || 'unknown');
            const name = String(officer.name || 'Unknown');
            const region = String(officer.region || 'N/A');
            const employeeId = String(officer.employeeId || 'N/A');
            const status = String(officer.status || 'Unknown');
            const statusColor = String(officer.statusColor || '#64748b');
            const trustScore = Number(officer.trustScore || 0);
            const historyCount = Number(officer.historyCount || 0);
            const passed = Number(officer.passed || 0);
            const failed = Number(officer.failed || 0);
            const skipped = Number(officer.skipped || 0);
            const avgResponseTime = Number(officer.avgResponseTime || 0);
            const todayReports = Number(officer.todayReports || 0);
            const citizenCount = Number(officer.citizenCount || 0);
            const attendanceStatus = String(officer.attendanceStatus || 'Not Marked');
            const lastVerified = officer.lastVerified || null;
            const lastQuestion = String(officer.lastQuestion || 'No history');
            const lastResult = officer.lastResult;
            const questionHistory = Array.isArray(officer.questionHistory) ? officer.questionHistory : [];

            return (
              <div
                key={id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  border: `1px solid ${selectedOfficer === id ? '#3b82f6' : '#e5e7eb'}`,
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedOfficer(id === selectedOfficer ? null : id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: statusColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', color: statusColor }}>
                      {name.charAt(0) || '👤'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1a202c' }}>{name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{region} • {employeeId}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: statusColor + '20', color: statusColor }}>{status}</span>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: statusColor }}>{trustScore}%</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginTop: '12px', padding: '12px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>Verifications</div><div style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c' }}>{historyCount}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>✅ Passed</div><div style={{ fontSize: '16px', fontWeight: '600', color: '#0b7e4b' }}>{passed}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>❌ Failed</div><div style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626' }}>{failed}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>⏭️ Skipped</div><div style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b' }}>{skipped}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>⏱️ Avg Response</div><div style={{ fontSize: '16px', fontWeight: '600', color: '#2563eb' }}>{avgResponseTime}s</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>📋 Reports Today</div><div style={{ fontSize: '16px', fontWeight: '600', color: '#7c3aed' }}>{todayReports}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>🆔 Citizens</div><div style={{ fontSize: '16px', fontWeight: '600', color: '#0b7e4b' }}>{citizenCount}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#64748b' }}>📊 Attendance</div><div style={{ fontSize: '14px', fontWeight: '600', color: attendanceStatus === 'present' ? '#0b7e4b' : attendanceStatus === 'late' ? '#f59e0b' : '#dc2626' }}>{attendanceStatus}</div></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap', gap: '4px' }}>
                  <span>Last Verified: {lastVerified ? new Date(lastVerified).toLocaleString() : 'Never'}</span>
                  {lastQuestion && lastQuestion !== 'No history' && (
                    <span>Last Question: <strong>{lastQuestion}</strong>{lastResult !== undefined && <span style={{ marginLeft: '4px' }}>{lastResult ? '✅' : '❌'}</span>}</span>
                  )}
                </div>

                {selectedOfficer === id && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #e5e7eb' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px', color: '#1a202c' }}>📋 Verification History ({questionHistory.length} records)</h4>
                    {questionHistory.length > 0 ? (
                      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {questionHistory.slice(0, 20).map((item, index) => {
                          const q = String(item.question || 'Verification check');
                          const a = String(item.answer || 'N/A');
                          const isSuccess = item.success === true;
                          const isSkipped = item.message === '⏰ Verification skipped' || a === 'Skipped';
                          const rt = Number(item.responseTime || 0);
                          const sc = Number(item.score || 0);
                          const ts = String(item.timestamp || new Date().toISOString());
                          const msg = String(item.message || '');
                          const penalties = Array.isArray(item.penalties) ? item.penalties : [];
                          const bgColor = isSuccess ? '#f0fdf4' : isSkipped ? '#fef3c7' : '#fef2f2';
                          const borderColor = isSuccess ? '#0b7e4b' : isSkipped ? '#f59e0b' : '#dc2626';
                          const statusText = isSuccess ? '✅ Passed' : isSkipped ? '⏭️ Skipped' : '❌ Failed';
                          const statusColor2 = isSuccess ? '#0b7e4b' : isSkipped ? '#f59e0b' : '#dc2626';

                          return (
                            <div key={index} style={{ padding: '10px 12px', background: bgColor, borderRadius: '6px', borderLeft: `3px solid ${borderColor}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a202c' }}>{q}</div>
                                  <div style={{ fontSize: '12px', color: '#64748b' }}>Answer: <strong>{a}</strong>{rt > 0 && ` • Response: ${rt}s`}{sc > 0 && ` • Score: ${sc}%`}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '12px', fontWeight: '500', color: statusColor2 }}>{statusText}</div>
                                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(ts).toLocaleTimeString()}</div>
                                </div>
                              </div>
                              {msg && !isSkipped && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{msg}</div>}
                              {penalties.length > 0 && <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '2px' }}>Penalties: {penalties.join(', ')}</div>}
                            </div>
                          );
                        })}
                        {questionHistory.length > 20 && <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', padding: '4px' }}>+{questionHistory.length - 20} more records</div>}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '20px' }}>No verification history for this officer yet.</div>
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