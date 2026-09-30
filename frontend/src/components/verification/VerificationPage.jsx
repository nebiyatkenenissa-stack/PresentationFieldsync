// components/verification/VerificationPage.jsx
// FULL – with all card styles, filtering, and synced‑only records

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { confirmToast } from '../../utils/confirmToast';
import { db, checkRealInternet, syncQueue, getApiBase } from '../../services/database';
import UserAvatar from '../common/UserAvatar';

function VerificationPage({ 
  users = [], 
  liveStatus = [], 
  reports = [],
  citizens = [],
  supervisorId = null
}) {
  const { t } = useTranslation();
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
        const officers = users.filter(u => u.role === 'field_officer' && (!supervisorId || u.supervisorId === supervisorId));
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

  // ===== REMOVE A VERIFICATION RECORD =====
  const handleRemoveVerification = async (record, officer) => {
    if (!record || !record.id) return;
    if (!await confirmToast(t('verification.remove_confirm', {
      name: officer.name,
      question: record.question || t('verification.verifying_check'),
      answer: record.answer || t('verification.n_a')
    }))) return;

    try {
      // 1. Remove from IndexedDB
      if (db && db.verification_history) {
        await db.verification_history.delete(record.id);
      }

      // 2. Remove from the officer's localStorage history
      const officerId = record.officerId || officer.id;
      const saved = localStorage.getItem(`verification_${officerId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.history) {
            parsed.history = parsed.history.filter(h => h.id !== record.id);
            localStorage.setItem(`verification_${officerId}`, JSON.stringify(parsed));
          }
        } catch (e) { /* ignore */ }
      }

      // 3. Delete from server if online, otherwise queue for later sync
      const online = await checkRealInternet();
      if (online) {
        try {
          const response = await fetch(`${getApiBase()}/verification/${record.id}`, { method: 'DELETE' });
          if (!response.ok) {
            console.warn('Server delete failed, queueing:', response.status);
            syncQueue.add({ type: 'verification_delete', id: record.id, data: { id: record.id } });
          }
        } catch (err) {
          console.warn('Server delete failed, queueing:', err.message);
          syncQueue.add({ type: 'verification_delete', id: record.id, data: { id: record.id } });
        }
      } else {
        syncQueue.add({ type: 'verification_delete', id: record.id, data: { id: record.id } });
      }

      // 4. Refresh the view
      window.dispatchEvent(new CustomEvent('verification-update', { detail: { officerId } }));
      setRefreshKey(prev => prev + 1);
      toast(t('verification.removed'));
    } catch (error) {
      console.error('Error removing verification record:', error);
      toast(t('verification.remove_error', { error: error.message }));
    }
  };

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

    const officers = users.filter(u => u.role === 'field_officer' && (!supervisorId || u.supervisorId === supervisorId));
    if (officers.length === 0) return [];

    return officers.map(officer => {
      const history = allVerificationData.filter(h => h.officerId === officer.id);
      const status = liveStatus?.find(l => l.employeeId === officer.employeeId);

      const total = history.length;
      const passed = history.filter(h => h.success === true).length;
      const failed = history.filter(h => h.success === false && h.answer !== 'Skipped').length;
      const skipped = history.filter(h => h.answer === 'Skipped').length;

      const avgResponseTime = total > 0 
        ? Math.round(history.reduce((sum, h) => sum + (h.responseTime || 0), 0) / total)
        : 0;

      const today = new Date().toISOString().slice(0, 10);
      const todayReports = reports?.filter(r => 
        r.employeeId === officer.employeeId && r.reportDate === today
      ).length || 0;
      
      const citizenCount = citizens?.filter(c => 
        c.registeredBy === officer.employeeId
      ).length || 0;

      let statusLabel = 'Not Verified';
      let statusColor = '#94a3b8';
      if (total > 0) {
        statusLabel = 'Active';
        statusColor = '#16a34a';
      }

      // Flag as suspicious after multiple consecutive failed verifications
      const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      let consecutiveFailures = 0;
      for (const h of sortedHistory) {
        if (h.success === false) {
          consecutiveFailures += 1;
        } else {
          break;
        }
      }
      const suspicious = consecutiveFailures >= 3;
      if (suspicious) {
        statusLabel = 'Suspicious';
        statusColor = '#dc2626';
      }

      const questionHistory = history.map(h => ({
        id: h.id,
        officerId: h.officerId,
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
        name: officer.name || t('verification.unknown'),
        photo: officer.profilePhoto || null,
        region: officer.region || t('verification.n_a'),
        employeeId: officer.employeeId || t('verification.n_a'),
        hasHistory: total > 0,
        historyCount: total,
        passed: passed || 0,
        failed: failed || 0,
        skipped: skipped || 0,
        avgResponseTime: avgResponseTime || 0,
        questionHistory: questionHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        todayReports: todayReports || 0,
        citizenCount: citizenCount || 0,
        status: statusLabel,
        statusColor: statusColor,
        suspicious,
        consecutiveFailures,
        lastVerified: history.length > 0 ? history[0]?.timestamp : null,
        lastQuestion: history.length > 0 ? history[0]?.question || t('verification.no_history') : t('verification.no_history'),
        lastResult: history.length > 0 ? history[0]?.success : undefined
      };
    });
  }, [users, liveStatus, allVerificationData, reports, citizens, supervisorId, t]);

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
    const notVerified = officersData.filter(o => o.status === 'Not Verified').length;
    const totalVerifications = officersData.reduce((sum, o) => sum + (o.historyCount || 0), 0);
    const totalPassed = officersData.reduce((sum, o) => sum + (o.passed || 0), 0);

    return { total, active, suspicious, notVerified, totalVerifications, totalPassed };
  }, [officersData]);

  const statusText = (status) => {
    if (status === 'Active') return t('verification.active_label');
    if (status === 'Suspicious') return t('verification.status_suspicious');
    return t('verification.not_verified');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
          <div style={{ color: '#64748b' }}>{t('verification.loading')}</div>
        </div>
      </div>
    );
  }

  if (officersData.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>📋</div>
        <h3 style={{ color: '#1a202c' }}>{t('verification.no_verification_data_found')}</h3>
        <p style={{ color: '#64748b' }}>
          {allVerificationData.length === 0 ? 
            t('verification.no_synced_records') :
            (supervisorId ? t('verification.no_officers_team') : t('verification.no_officers_system'))
          }
        </p>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>
          {t('verification.total_records_indexeddb', { count: allVerificationData.length })}
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
          {t('verification.force_sync_now')}
        </button>
      </div>
    );
  }

  // ============================================================
  // FULL DASHBOARD WITH OFFICER CARDS (same style as before)
  // ============================================================
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>🛡️ {t('verification.title')}</h2>
            <span style={{
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '600',
              background: 'rgba(52,211,153,0.25)',
              border: '1px solid rgba(52,211,153,0.5)',
              color: '#ffffff'
            }}>
              {t('verification.supervisor_badge')}
            </span>
          </div>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {t('verification.subtitle')}
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
            📋 {t('verification.records', { count: allVerificationData.length })}
          </span>
          <span style={{
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid rgba(52,211,153,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            👥 {t('verification.officers', { count: summary.total })}
          </span>
          <span style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid rgba(252,211,77,0.4)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            ⚡ {t('verification.active', { count: summary.active })}
          </span>
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
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{t('verification.total_officers')}</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a' }}>{summary.total}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{t('verification.active_label')}</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#16a34a' }}>{summary.active}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{t('verification.suspicious')}</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#ca8a04' }}>{summary.suspicious}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #94a3b8' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{t('verification.not_verified')}</div>
          <div style={{ fontSize: '30px', fontWeight: '700', color: '#64748b' }}>{summary.notVerified}</div>
        </div>
        <div style={{ background: 'white', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{t('verification.total_verifications')}</div>
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
            placeholder={t('verification.search_placeholder')}
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
          <button onClick={() => setFilter('all')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'all' ? '2px solid #0f172a' : '1px solid #d1d5db', background: filter === 'all' ? '#0f172a' : 'white', color: filter === 'all' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{t('verification.all_filters')} ({summary.total})</button>
          <button onClick={() => setFilter('Active')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'Active' ? '2px solid #22c55e' : '1px solid #d1d5db', background: filter === 'Active' ? '#22c55e' : 'white', color: filter === 'Active' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{t('verification.active_label')} ({summary.active})</button>
          <button onClick={() => setFilter('Suspicious')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'Suspicious' ? '2px solid #eab308' : '1px solid #d1d5db', background: filter === 'Suspicious' ? '#eab308' : 'white', color: filter === 'Suspicious' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{t('verification.status_suspicious')} ({summary.suspicious})</button>
          <button onClick={() => setFilter('Not Verified')} style={{ padding: '6px 16px', borderRadius: '20px', border: filter === 'Not Verified' ? '2px solid #94a3b8' : '1px solid #d1d5db', background: filter === 'Not Verified' ? '#94a3b8' : 'white', color: filter === 'Not Verified' ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{t('verification.not_verified')} ({summary.notVerified})</button>
        </div>
      </div>

      {/* OFFICER CARDS – FULL STYLE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredOfficers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '48px' }}>🔍</div>
            <div style={{ color: '#64748b' }}>{t('verification.no_officers_match')}</div>
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
                    <UserAvatar photo={officer.photo} name={officer.name} role="field_officer" size={44} />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        {officer.name}
                        {officer.suspicious && (
                          <span style={{
                            padding: '2px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca'
                          }}>
                            ⚠️ {t('verification.status_suspicious')}
                          </span>
                        )}
                      </div>
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
                      {statusText(officer.status)}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: hasHistory ? statusColor : '#94a3b8' }}>
                      {hasHistory ? t('verification.verifications_count', { count: officer.historyCount }) : '—'}
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
                        <div>{t('verification.no_history_yet')}</div>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>{t('verification.history_will_appear')}</div>
                      </div>
                    ) : (
                      <>
                        {/* SUSPICIOUS WARNING */}
                        {officer.suspicious && (
                          <div style={{
                            marginTop: '16px',
                            padding: '12px 16px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderLeft: '4px solid #dc2626',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#991b1b'
                          }}>
                            ⚠️ <strong>{t('verification.flagged_suspicious')}</strong> {t('verification.consecutive_failures', { count: officer.consecutiveFailures })}
                          </div>
                        )}

                        {/* METRICS GRID */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '12px',
                          marginTop: '16px'
                        }}>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verification.metric_verifications')}</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>{officer.historyCount}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #22c55e' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verification.metric_passed')}</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#16a34a' }}>{officer.passed}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #ef4444' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verification.metric_failed')}</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#dc2626' }}>{officer.failed}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #eab308' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verification.metric_skipped')}</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#ca8a04' }}>{officer.skipped}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #3b82f6' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verification.metric_avg_response')}</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#2563eb' }}>{officer.avgResponseTime}{t('verification.secs', { count: officer.avgResponseTime })}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #8b5cf6' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verification.metric_reports_today')}</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#7c3aed' }}>{officer.todayReports}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '3px solid #14b8a6' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verification.metric_citizens')}</div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0d9488' }}>{officer.citizenCount}</div>
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
                            {t('verification.last_verified')} <strong>{officer.lastVerified ? new Date(officer.lastVerified).toLocaleString() : t('verification.never')}</strong>
                          </span>
                          <span>
                            {t('verification.last_question')} <strong>{officer.lastQuestion}</strong>
                            {officer.lastResult !== undefined && (
                              <span style={{ marginLeft: '6px' }}>{officer.lastResult ? t('verification.passed') : t('verification.failed_result')}</span>
                            )}
                          </span>
                        </div>

                        {/* VERIFICATION HISTORY TABLE */}
                        {officer.questionHistory.length > 0 && (
                          <div style={{ marginTop: '16px' }}>
                            <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', margin: '0 0 10px 0' }}>
                              {t('verification.history_title', { count: officer.questionHistory.length })}
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
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('verification.col_timestamp')}</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('verification.col_question')}</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('verification.col_answer')}</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('verification.col_response')}</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('verification.col_result')}</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t('verification.col_actions')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {officer.questionHistory.slice(0, 20).map((item, idx) => {
                                    const isSuccess = item.success === true;
                                    const isSkipped = item.message === '⏰ Verification skipped' || item.answer === 'Skipped';
                                    const resultText = isSuccess ? t('verification.passed') : isSkipped ? t('verification.skipped_result') : t('verification.failed_result');
                                    const resultColor = isSuccess ? '#16a34a' : isSkipped ? '#ca8a04' : '#dc2626';

                                    return (
                                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : '--'}
                                        </td>
                                        <td style={{ padding: '10px 14px', fontWeight: '500', color: '#0f172a' }}>
                                          {item.question}
                                        </td>
                                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                                          {item.answer}
                                        </td>
                                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>
                                          {item.responseTime ? t('verification.secs', { count: item.responseTime }) : '--'}
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
                                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveVerification(item, officer); }}
                                            title={t('verification.remove_title')}
                                            style={{
                                              background: '#fee2e2',
                                              color: '#991b1b',
                                              border: '1px solid #fecaca',
                                              padding: '4px 12px',
                                              borderRadius: '6px',
                                              cursor: 'pointer',
                                              fontSize: '12px',
                                              fontWeight: '500',
                                              whiteSpace: 'nowrap'
                                            }}
                                          >
                                            {t('verification.remove')}
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {officer.questionHistory.length > 20 && (
                                <div style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '12px', borderTop: '1px solid #e2e8f0' }}>
                                  {t('verification.showing_records', { count: officer.questionHistory.length })}
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