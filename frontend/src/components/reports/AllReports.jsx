// components/reports/AllReports.jsx
// Enhanced with date/time, NEW badge, sorting, filter by submitter,
// per-row download (JSON) and delete, clear all.

import React, { useState, useMemo, useEffect } from 'react';
import { confirmToast } from '../../utils/confirmToast';
import { exportCSV, exportJSON } from '../../utils/helpers';
import { db, markReportsDeleted } from '../../services/database';
import { getRegionOptions, getEmployeeRegionMap, getServerBase } from '../../utils/helpers';
import useRegions from '../../hooks/useRegions';
import { regionOfPath } from '../../utils/regions';
import UserAvatar from '../common/UserAvatar';
import { useTranslation } from 'react-i18next';

function AllReports({ reports, users, supervisorReports, setReports, setSupervisorReports }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [submitterFilter, setSubmitterFilter] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewingAttachments, setViewingAttachments] = useState(null);

  const regions = useRegions();
  const regionOptions = useMemo(() => getRegionOptions(users, regions), [users, regions]);
  const employeeRegionMap = useMemo(() => getEmployeeRegionMap(users), [users]);
  const userByEmpId = useMemo(() => {
    const map = {};
    (users || []).forEach(u => {
      if (!u || !u.employeeId) return;
      const prev = map[u.employeeId];
      if (!prev || (u.source === 'server' && prev.source !== 'server')) map[u.employeeId] = u;
    });
    return map;
  }, [users]);
  const userById = useMemo(() => {
    const map = {};
    (users || []).forEach(u => {
      if (!u || !u.id) return;
      const prev = map[u.id];
      if (!prev || (u.source === 'server' && prev.source !== 'server')) map[u.id] = u;
    });
    return map;
  }, [users]);

  // ===== DELETE LEGACY DEMO DATA (daily reports saved with compass location like North/East) =====
  // Runs whenever reports change so legacy rows can never come back.
  useEffect(() => {
    const OLD_REGIONS = ['North', 'South', 'East', 'West'];
    const oldReports = reports.filter(r => OLD_REGIONS.includes(r.region));
    if (oldReports.length > 0) {
      oldReports.forEach(r => db.reports.delete(r.id));
      setReports(prev => prev.filter(r => !OLD_REGIONS.includes(r.region)));
      console.log(`🗑️ Deleted ${oldReports.length} legacy daily report(s) with old location format`);
    }
  }, [reports, setReports]);

  // Real region name for a report — from its own location, else the officer's
  // assigned region, else its region field. Never a kebele/woreda/zone name.
  const resolveRegion = (r) => {
    const own = regionOfPath(r?.region, regions);
    if (own) return own;
    if (r?.officerRegion) {
      const officer = regionOfPath(r.officerRegion, regions);
      if (officer) return officer;
    }
    if (r && r.employeeId && employeeRegionMap[r.employeeId]) {
      const assigned = regionOfPath(employeeRegionMap[r.employeeId], regions);
      if (assigned) return assigned;
    }
    return '';
  };

  // Helper: format date/time (mm/dd/yyyy)
  const formatDateTime = (dateStr) => {
    if (!dateStr) return t('allReports.na');
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return t('allReports.na');
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper: check if report is new (< 24h)
  const isNewReport = (report) => {
    const dateStr = report.submittedAt || report.createdAt || report.reportDate;
    if (!dateStr) return false;
    const reportDate = new Date(dateStr);
    const now = new Date();
    const diffHours = (now - reportDate) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // Submitters list for the filter dropdown – ONLY current field officers & supervisors
  const submitters = useMemo(() => {
    const names = new Set();
    (users || []).forEach(u => {
      if ((u.role === 'field_officer' || u.role === 'supervisor') && u.name) names.add(u.name);
    });
    return Array.from(names).sort();
  }, [users]);

  // ===== DAILY REPORTS =====
  // ONLY show synced reports and sort by submittedAt (newest first)
  const syncedReports = useMemo(() => {
    return reports
      .filter(r => r.synced === true)
      .sort((a, b) => {
        const dateA = a.submittedAt || a.createdAt || a.reportDate;
        const dateB = b.submittedAt || b.createdAt || b.reportDate;
        return new Date(dateB) - new Date(dateA);
      });
  }, [reports]);

  const filteredReports = useMemo(() => {
    let filtered = syncedReports;

    if (selectedRegion !== 'All') {
      filtered = filtered.filter(r => resolveRegion(r) === selectedRegion);
    }

    if (submitterFilter !== 'All') {
      filtered = filtered.filter(r => r.employeeName === submitterFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (resolveRegion(r) || r.region)?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRange.start) {
      filtered = filtered.filter(r => (r.reportDate || r.submittedAt) >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(r => (r.reportDate || r.submittedAt) <= dateRange.end);
    }

    return filtered;
  }, [syncedReports, selectedRegion, searchTerm, submitterFilter, dateRange, employeeRegionMap]);

  // ===== SUPERVISOR REPORTS =====
  // Sort by submittedAt (newest first) and clearly differentiate type
  const filteredSupervisorReports = useMemo(() => {
    let filtered = supervisorReports || [];
    if (selectedRegion !== 'All') {
      filtered = filtered.filter(r => resolveRegion(r) === selectedRegion);
    }
    if (submitterFilter !== 'All') {
      filtered = filtered.filter(r => r.supervisorName === submitterFilter || r.officerName === submitterFilter);
    }
    // Sort by submittedAt - newest first
    return filtered
      .filter(r => r.synced !== false) // show all synced or pending
      .sort((a, b) => {
        const dateA = a.submittedAt || a.createdAt || a.reportDate;
        const dateB = b.submittedAt || b.createdAt || b.reportDate;
        return new Date(dateB) - new Date(dateA);
      });
  }, [supervisorReports, selectedRegion, submitterFilter, employeeRegionMap]);

  // ===== DELETE / CLEAR HANDLERS =====
  // Deleted ids are remembered so server pulls don't bring them back.
  const deleteReport = async (id, r) => {
    if (!await confirmToast('Delete this report?')) return;
    markReportsDeleted([r.reportId || r.id], false);
    await db.reports.delete(id);
    setReports(prev => prev.filter(x => x.id !== id));
  };

  const deleteSupervisorReport = async (id) => {
    if (!await confirmToast('Delete this supervisor report?')) return;
    markReportsDeleted([id], true);
    await db.supervisor_reports.delete(id);
    setSupervisorReports(prev => prev.filter(x => x.id !== id));
  };

  const clearAllReports = async () => {
    if (!await confirmToast('Delete ALL reports? This cannot be undone.')) return;
    markReportsDeleted(reports.map(r => r.reportId || r.id), false);
    await db.reports.clear();
    setReports([]);
  };

  const clearSupervisorReports = async () => {
    if (!await confirmToast('Delete ALL supervisor report data? This cannot be undone.')) return;
    markReportsDeleted((supervisorReports || []).map(r => r.id), true);
    await db.supervisor_reports.clear();
    setSupervisorReports([]);
  };

  // Download a single report in the same JSON format as the full export.
  const downloadOne = (report, prefix) => {
    exportJSON([report], `${prefix}_${report.reportId || report.id}`);
  };

  const deleteBtnStyle = {
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fca5a5',
    padding: '3px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap'
  };

  const downloadBtnStyle = {
    background: '#dbeafe',
    color: '#1e40af',
    border: '1px solid #93c5fd',
    padding: '3px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap'
  };

  const openBtnStyle = {
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #86efac',
    padding: '3px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap'
  };

  const resolveAttachmentUrl = (att) => {
    if (att.url && att.url.startsWith('/uploads/')) return `${getServerBase()}${att.url}`;
    if (att.data && att.data.startsWith('data:')) return att.data;
    return null;
  };

  return (
    <div className="all-reports-view">
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📋 {t('nav.all_reports')}</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {t('allReports.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            📊 {t('allReports.field_reports', { count: filteredReports.length })}
          </span>
          <span style={{
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid rgba(52,211,153,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            👤 {t('allReports.supervisor_reports', { count: filteredSupervisorReports.length })}
          </span>
          <button
            onClick={clearAllReports}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            🗑️ {t('allReports.clear_all')}
          </button>
        </div>
      </div>

      {/* ===== DAILY REPORTS TABLE ===== */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>📊 {t('allReports.daily_field_reports')}</h3>
            <p>{t('allReports.synced_reports_found', { count: filteredReports.length })}</p>
          </div>
          <div className="table-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder={`🔍 ${t('allReports.search_placeholder')}`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <select
              value={submitterFilter}
              onChange={e => setSubmitterFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">{t('allReports.all_submitters')}</option>
              {submitters.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="filter-select"
            >
              <option value="All">{t('allReports.all_regions')}</option>
              {regionOptions.filter(r => r !== 'All').map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
              className="date-input"
              placeholder={t('allReports.start')}
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
              className="date-input"
              placeholder={t('allReports.end')}
            />
            <button className="btn-export" onClick={() => exportCSV(filteredReports, 'all_reports')}>📥 CSV</button>
            <button className="btn-export" onClick={() => exportJSON(filteredReports, 'all_reports')}>📥 JSON</button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('allReports.submitted')}</th>
                <th>{t('allReports.submitted_by')}</th>
                <th>{t('common.region')}</th>
                <th>{t('nav.citizens')}</th>
                <th>{t('allReports.files')}</th>
                <th>{t('common.status')}</th>
                <th>{t('nav.sync')}</th>
                <th>{t('allReports.new')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div>{t('allReports.no_reports')}</div>
                    <small>{t('allReports.try_adjusting_filters')}</small>
                  </td>
                </tr>
              )}
              {filteredReports.map(r => {
                const isNew = isNewReport(r);
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.submittedAt || r.createdAt || r.reportDate)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserAvatar user={userByEmpId[r.employeeId]} name={r.employeeName} size={28} />
                        <strong>{r.employeeName}</strong>
                      </div>
                    </td>
                    <td><span className="region-tag">{resolveRegion(r)}</span></td>
                    <td>{r.registrations}</td>
                    <td>
                      {r.attachments && r.attachments.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '500' }}>
                          📎 {r.attachments.length}
                        </span>
                      )}
                    </td>
                    <td><span className="status-tag">{t(`allReports.status.${r.operationalStatus}`)}</span></td>
                    <td>
                      {r.synced ?
                        <span className="sync-tag synced">✅ {t('allReports.synced')}</span> :
                        <span className="sync-tag pending">⏳ {t('allReports.pending')}</span>
                      }
                    </td>
                    <td>
                      {isNew && (
                        <span style={{
                          background: '#dc2626',
                          color: 'white',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          {t('allReports.new')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {r.attachments && r.attachments.length > 0 && (
                          <button onClick={() => setViewingAttachments(r.attachments)} style={openBtnStyle}>📂 {t('allReports.open')}</button>
                        )}
                        <button onClick={() => downloadOne(r, 'report')} style={downloadBtnStyle}>⬇️</button>
                        <button onClick={() => deleteReport(r.id, r)} style={deleteBtnStyle}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== SUPERVISOR REPORTS TABLE ===== */}
      <div className="table-card" style={{marginTop: '24px'}}>
        <div className="table-header">
          <div>
            <h3>👤 {t('allReports.supervisor_reports_title')}</h3>
            <p>{t('allReports.supervisor_reports_found', { count: filteredSupervisorReports.length })}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-export" onClick={() => exportCSV(filteredSupervisorReports, 'supervisor_reports_all')}>📥 CSV</button>
            <button className="btn-export" onClick={() => exportJSON(filteredSupervisorReports, 'supervisor_reports_all')}>📥 JSON</button>
            <button
              onClick={clearSupervisorReports}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️ {t('allReports.clear_data')}
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t('allReports.submitted')}</th>
                <th>{t('allReports.type')}</th>
                <th>{t('allReports.submitted_by')}</th>
                <th>{t('allReports.officer_self')}</th>
                <th>{t('allReports.performance')}</th>
                <th>{t('allReports.rating')}</th>
                <th>{t('allReports.files')}</th>
                <th>{t('common.status')}</th>
                <th>{t('allReports.new')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupervisorReports.length === 0 && (
                <tr>
                  <td colSpan="11" className="empty-state">
                    <div className="empty-icon">👤</div>
                    <div>{t('allReports.no_supervisor_reports')}</div>
                  </td>
                </tr>
              )}
              {filteredSupervisorReports.map(r => {
                const isNew = isNewReport(r);
                const isSelfReport = r.type === 'self_report';
                const displayName = isSelfReport ? r.supervisorName : r.officerName;
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.submittedAt || r.createdAt || r.reportDate)}</td>
                    <td>
                      {isSelfReport ? (
                        <span style={{
                          background: '#dbeafe',
                          color: '#1e40af',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          📋 {t('allReports.self_report')}
                        </span>
                      ) : (
                        <span style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          👤 {t('allReports.officer_report')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserAvatar user={userById[r.supervisorId]} name={r.supervisorName} size={28} />
                        <strong>{r.supervisorName}</strong>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserAvatar user={userById[isSelfReport ? r.supervisorId : r.officerId]} name={displayName} size={28} />
                        {displayName}
                      </div>
                    </td>
                    <td>
                      <span className={`status-tag ${r.overallStatus || r.performance}`} style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: r.overallStatus === 'excellent' || r.performance === 'excellent' ? '#d1fae5' :
                                  r.overallStatus === 'good' || r.performance === 'good' ? '#dbeafe' :
                                  r.overallStatus === 'average' || r.performance === 'average' ? '#fef3c7' :
                                  '#fee2e2',
                        color: r.overallStatus === 'excellent' || r.performance === 'excellent' ? '#065f37' :
                              r.overallStatus === 'good' || r.performance === 'good' ? '#1e40af' :
                              r.overallStatus === 'average' || r.performance === 'average' ? '#92400e' :
                              '#991b1b'
                      }}>
                        {t(`allReports.status.${r.overallStatus || r.performance}`)}
                      </span>
                    </td>
                    <td>{isSelfReport ? t('allReports.na') : `${r.overallRating}/5 ⭐`}</td>
                    <td>
                      {r.attachments && r.attachments.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '500' }}>
                          📎 {r.attachments.length}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="status-tag submitted" style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: r.synced ? '#d1fae5' : '#fef3c7',
                        color: r.synced ? '#065f37' : '#92400e'
                      }}>
                        {r.synced ? `✅ ${t('allReports.synced')}` : `📡 ${t('header.offline')}`}
                      </span>
                    </td>
                    <td>
                      {isNew && (
                        <span style={{
                          background: '#dc2626',
                          color: 'white',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          {t('allReports.new')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {r.attachments && r.attachments.length > 0 && (
                          <button onClick={() => setViewingAttachments(r.attachments)} style={openBtnStyle}>📂 {t('allReports.open')}</button>
                        )}
                        <button onClick={() => downloadOne(r, 'supervisor_report')} style={downloadBtnStyle}>⬇️</button>
                        <button onClick={() => deleteSupervisorReport(r.id)} style={deleteBtnStyle}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== ATTACHMENT VIEWER MODAL ===== */}
      {viewingAttachments && (
        <div onClick={() => setViewingAttachments(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            maxWidth: '700px', width: '100%', maxHeight: '80vh',
            overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>📎 {t('allReports.attachments_modal', { count: viewingAttachments.length })}</h3>
              <button onClick={() => setViewingAttachments(null)} style={{
                background: '#fee2e2', color: '#991b1b', border: 'none',
                padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                fontWeight: '600', fontSize: '13px'
              }}>✕ {t('allReports.close')}</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {viewingAttachments.map((att, i) => {
                const url = resolveAttachmentUrl(att);
                const isImage = att.type?.startsWith('image/') || att.isImage;
                return (
                  <div key={i} style={{
                    border: '1px solid #e5e7eb', borderRadius: '10px',
                    padding: '12px', background: '#f9fafb'
                  }}>
                    {isImage && url ? (
                      <img src={url} alt={att.name} style={{
                        width: '100%', maxHeight: '300px', objectFit: 'contain',
                        borderRadius: '8px', marginBottom: '8px', background: '#fff'
                      }} />
                    ) : (
                      <div style={{
                        padding: '20px', textAlign: 'center', background: '#e5e7eb',
                        borderRadius: '8px', marginBottom: '8px', fontSize: '24px'
                      }}>
                        📄
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>{att.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          {att.type} &middot; {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''}
                        </div>
                      </div>
                      {url && (
                        <a href={url} download={att.name} target="_blank" rel="noopener noreferrer" style={{
                          background: '#dbeafe', color: '#1e40af', padding: '6px 14px',
                          borderRadius: '8px', textDecoration: 'none', fontWeight: '600',
                          fontSize: '12px'
                        }}>⬇️ {t('allReports.download')}</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllReports;
