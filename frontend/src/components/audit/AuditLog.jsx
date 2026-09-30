// components/audit/AuditLog.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { db, checkRealInternet, getApiBase, markAuditCleared, markAuditDeleted } from '../../services/database';
import { exportCSV, exportJSON, getServerBase } from '../../utils/helpers';
import { confirmToast } from '../../utils/confirmToast';

// User-friendly label for each raw action code, so managers see descriptions
// instead of raw database values.
const ACTION_LABELS = {
  LOGIN: 'User logged in',
  LOGOUT: 'User logged out',
  CREATE_USER: 'Created a new user',
  DELETE_USER: 'Deleted a user',
  TOGGLE_USER_STATUS: 'Changed a user status',
  SUBMIT_REPORT: 'Submitted a field report',
  SUPERVISOR_REPORT: 'Reviewed an officer report',
  SUPERVISOR_SELF_REPORT: 'Submitted a supervisor self-report',
  REGISTER_CITIZEN: 'Registered a citizen',
  CREATE_TASK: 'Created a task',
  UPDATE_TASK: 'Updated a task',
  REQUEST_LEAVE: 'Requested leave',
  APPROVE_LEAVE: 'Approved / rejected leave',
  APPROVE_PERMISSION: 'Approved / rejected permission',
  REQUEST_PERMISSION: 'Requested permission',
  EXPORT_CSV: 'Exported data (CSV)',
  EXPORT_JSON: 'Exported data (JSON)'
};

const ACTION_COLORS = {
  LOGIN: { bg: '#d1fae5', color: '#065f37' },
  LOGOUT: { bg: '#fee2e2', color: '#991b1b' },
  CREATE_USER: { bg: '#dbeafe', color: '#1e40af' },
  DELETE_USER: { bg: '#fef3c7', color: '#92400e' },
  TOGGLE_USER_STATUS: { bg: '#fef3c7', color: '#92400e' },
  SUBMIT_REPORT: { bg: '#e0e7ff', color: '#4338ca' },
  SUPERVISOR_REPORT: { bg: '#e0e7ff', color: '#4338ca' },
  SUPERVISOR_SELF_REPORT: { bg: '#e0e7ff', color: '#4338ca' },
  REGISTER_CITIZEN: { bg: '#d1fae5', color: '#065f37' },
  CREATE_TASK: { bg: '#fce7f3', color: '#9d174d' },
  UPDATE_TASK: { bg: '#fce7f3', color: '#9d174d' },
  REQUEST_LEAVE: { bg: '#dbeafe', color: '#1e40af' },
  APPROVE_LEAVE: { bg: '#d1fae5', color: '#065f37' },
  REQUEST_PERMISSION: { bg: '#dbeafe', color: '#1e40af' },
  APPROVE_PERMISSION: { bg: '#d1fae5', color: '#065f37' },
  EXPORT_CSV: { bg: '#f3f4f6', color: '#374151' },
  EXPORT_JSON: { bg: '#f3f4f6', color: '#374151' }
};

const DEFAULT_COLOR = { bg: '#f3f4f6', color: '#374151' };

// Map raw detail keys to friendly labels when the details come as an object.
const DETAIL_KEY_LABELS = {
  email: 'Email',
  name: 'Name',
  userId: 'User ID',
  newStatus: 'New status',
  task: 'Task',
  assignedTo: 'Assigned to',
  employee: 'Employee',
  type: 'Type',
  leaveId: 'Leave ID',
  status: 'Status',
  permissionId: 'Permission ID',
  nationalId: 'National ID',
  registrations: 'Registrations',
  officer: 'Officer',
  rating: 'Rating',
  supervisor: 'Supervisor',
  filename: 'File name'
};

function AuditLog({ auditLog, setAuditLog }) {
  const { t } = useTranslation();
  const [isClearing, setIsClearing] = useState(false);

  // Localized action label for a raw action code, falling back to the
  // module-level English map for any unknown codes.
  const actionLabel = (code) => t(`audit.action_${code}`, { defaultValue: ACTION_LABELS[code] || code });

  // Localized detail-key label, falling back to the friendly module-level map.
  const detailKeyLabel = (k) => t(`audit.detail_${k}`, { defaultValue: DETAIL_KEY_LABELS[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ') });
  const [deletingId, setDeletingId] = useState(null);
  const [localLogs, setLocalLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);

  // Single working source: local state, kept in sync with the prop, sorted newest-first.
  const logs = useMemo(() =>
    [...(localLogs || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [localLogs]
  );

  // Sync local state whenever the prop changes
  useEffect(() => {
    setLocalLogs(auditLog || []);
  }, [auditLog]);

  // Fallback: if prop is empty, fetch from IndexedDB on mount
  useEffect(() => {
    const fetchLogs = async () => {
      if (!auditLog || auditLog.length === 0) {
        const data = await db.audit.toArray();
        setLocalLogs(data);
        if (setAuditLog && typeof setAuditLog === 'function') {
          setAuditLog(data);
        }
      }
    };
    fetchLogs();
  }, [auditLog, setAuditLog]);

  // Refresh function to pull from server and update state
  const handleRefresh = async () => {
    try {
      const response = await fetch(getServerBase() + '/api/audit');
      if (response.ok) {
        const serverLogs = await response.json();
        for (const log of serverLogs) {
          const existing = await db.audit.get(log.id);
          if (!existing && !isAuditClearedLocally(log.id)) {
            await db.audit.add({
              id: log.id,
              userId: log.user_id,
              userName: log.user_name,
              action: log.action,
              details: log.details,
              timestamp: log.timestamp,
              ip: log.ip
            });
          }
        }
        // Refresh local state
        const updated = await db.audit.toArray();
        setLocalLogs(updated);
        if (setAuditLog && typeof setAuditLog === 'function') {
          setAuditLog(updated);
        }
        toast.success(t('audit.refresh_toast'));
      } else {
        toast.error(t('audit.fetch_failed'));
      }
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error(t('audit.refresh_error'));
    }
  };

  const isAuditClearedLocally = (id) => {
    try {
      const parsed = JSON.parse(localStorage.getItem('fieldsync_cleared_audit') || 'null');
      return parsed && Array.isArray(parsed.ids) && parsed.ids.includes(id);
    } catch {
      return false;
    }
  };

  const handleClearAudit = async () => {
    if (!await confirmToast(t('audit.clear_confirm'))) {
      return;
    }

    setIsClearing(true);
    try {
      const clearedIds = (logs || []).map(l => l.id);
      await db.audit.clear();
      setLocalLogs([]);
      if (setAuditLog && typeof setAuditLog === 'function') {
        setAuditLog([]);
      }
      markAuditCleared(clearedIds);

      const online = await checkRealInternet();
      if (online) {
        try {
          const res = await fetch(`${getApiBase()}/audit`, { method: 'DELETE' });
          if (!res.ok) console.warn('Server audit clear returned non-OK status:', res.status);
        } catch (err) {
          console.error('Server clear failed (kept local deletion):', err);
        }
      }

      toast.success(t('audit.cleared_success'));
    } catch (error) {
      console.error('Error clearing audit log:', error);
      toast.error(t('audit.clear_error', { error: error.message }));
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteLog = async (log) => {
    if (!await confirmToast(t('audit.delete_confirm'))) {
      return;
    }
    setDeletingId(log.id);
    try {
      await db.audit.delete(log.id);
      const updated = localLogs.filter(l => l.id !== log.id);
      setLocalLogs(updated);
      if (setAuditLog && typeof setAuditLog === 'function') {
        setAuditLog(updated);
      }
      markAuditDeleted(log.id);
      if (selectedLog && selectedLog.id === log.id) setSelectedLog(null);

      const online = await checkRealInternet();
      if (online) {
        try {
          await fetch(`${getApiBase()}/audit/${log.id}`, { method: 'DELETE' });
        } catch (err) {
          console.error('Server delete failed (kept local deletion):', err);
        }
      }
      toast.success(t('audit.deleted_success'));
    } catch (error) {
      console.error('Error deleting audit record:', error);
      toast.error(t('audit.delete_error', { error: error.message }));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDetails = (details) => {
    if (!details) return '';
    if (typeof details === 'string') {
      try {
        const parsed = JSON.parse(details);
        if (parsed && typeof parsed === 'object') {
          return Object.entries(parsed)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => {
              const label = detailKeyLabel(k);
              const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
              return `${label}: ${value}`;
            })
            .join(' • ');
        }
      } catch {
        return details;
      }
      return details;
    }
    if (typeof details === 'object') {
      try {
        return Object.entries(details)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => {
            const label = detailKeyLabel(k);
            const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return `${label}: ${value}`;
          })
          .join(' • ');
      } catch {
        return JSON.stringify(details);
      }
    }
    return String(details);
  };

  const handleExportCSV = () => {
    if (!logs || logs.length === 0) {
      toast(t('audit.no_records_to_export'));
      return;
    }
    const exportData = logs.map(log => ({
      'Timestamp': new Date(log.timestamp).toLocaleString(),
      'User': log.userName,
      'Action': log.action,
      'Details': typeof log.details === 'object' ? JSON.stringify(log.details) : log.details
    }));
    exportCSV(exportData, 'audit_log');
  };

  const handleExportJSON = () => {
    if (!logs || logs.length === 0) {
      toast(t('audit.no_records_to_export'));
      return;
    }
    exportJSON(logs, 'audit_log');
  };

  return (
    <div className="audit-log" style={{ padding: '20px' }}>
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>{t('audit.title')}</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {t('audit.subtitle')}
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
            {t('audit.records', { count: logs?.length || 0 })}
          </span>
          <button
            onClick={handleRefresh}
            style={{
              background: 'rgba(96,165,250,0.2)',
              border: '1px solid rgba(147,197,253,0.5)',
              color: 'white',
              padding: '7px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            {t('audit.refresh')}
          </button>
        </div>
      </div>

      <div className="table-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div className="table-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{t('audit.activity_records')}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              {t('audit.activities_recorded', { count: logs?.length || 0 })}
            </p>
          </div>
          <div className="table-actions" style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button 
              className="btn-export" 
              onClick={handleExportCSV}
              style={{
                padding: '6px 14px',
                background: '#0b7e4b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (!logs || logs.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: (!logs || logs.length === 0) ? 0.5 : 1
              }}
              disabled={!logs || logs.length === 0}
            >
              📥 CSV
            </button>
            <button 
              className="btn-export" 
              onClick={handleExportJSON}
              style={{
                padding: '6px 14px',
                background: '#1e3a5f',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (!logs || logs.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: (!logs || logs.length === 0) ? 0.5 : 1
              }}
              disabled={!logs || logs.length === 0}
            >
              📥 JSON
            </button>
            <button 
              className="btn-danger" 
              onClick={handleClearAudit}
              disabled={isClearing || !logs || logs.length === 0}
              style={{
                padding: '6px 14px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (isClearing || !logs || logs.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: (isClearing || !logs || logs.length === 0) ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isClearing ? t('audit.clearing') : t('audit.clear_all')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>{t('audit.col_timestamp')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>{t('audit.col_user')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>{t('audit.col_action')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>{t('audit.col_details')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>{t('audit.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan="5" className="empty-state" style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#64748b'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📜</div>
                    <div>{t('audit.no_records')}</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {t('audit.click_refresh')}
                    </div>
                  </td>
                </tr>
              )}
              {logs && logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                    {log.userName}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="status-tag" style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: (ACTION_COLORS[log.action] || DEFAULT_COLOR).bg,
                      color: (ACTION_COLORS[log.action] || DEFAULT_COLOR).color
                    }}>
                      {actionLabel(log.action)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4a5568' }} title={formatDetails(log.details)}>
                    <span style={{
                      display: 'block',
                      maxWidth: '320px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatDetails(log.details)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        title={t('audit.view_detail')}
                        style={{
                          background: '#1e3a5f',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {t('audit.view')}
                      </button>
                      <button
                        onClick={() => handleDeleteLog(log)}
                        disabled={deletingId === log.id}
                        title={t('audit.delete_title')}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: deletingId === log.id ? 'wait' : 'pointer',
                          fontSize: '12px',
                          opacity: deletingId === log.id ? 0.6 : 1
                        }}
                      >
                        {deletingId === log.id ? t('audit.deleting') : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {logs && logs.length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '13px',
            color: '#64748b',
            background: '#fafafa'
          }}>
            <span>
              {t('audit.total_records', { count: logs.length })}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                {t('audit.oldest', { date: logs.length > 0 ? new Date(logs[logs.length - 1]?.timestamp).toLocaleDateString() : t('audit.no_records') })}
              </span>
              <button
                onClick={handleClearAudit}
                disabled={isClearing}
                style={{
                  padding: '4px 12px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isClearing ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  opacity: isClearing ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isClearing ? t('audit.clearing') : t('audit.clear_all')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== DETAIL VIEW (user-friendly) ===== */}
      {selectedLog && (
        <div onClick={() => setSelectedLog(null)} style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '86vh',
            overflowY: 'auto',
            boxShadow: '0 24px 70px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 22px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600' }}>{t('audit.detail_title')}</h3>
              <button
                onClick={() => setSelectedLog(null)}
                title={t('audit.close_title')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b',
                  lineHeight: 1
                }}
              >✕</button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>{t('audit.label_action')}</div>
                <span className="status-tag" style={{
                  padding: '3px 12px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  background: (ACTION_COLORS[selectedLog.action] || DEFAULT_COLOR).bg,
                  color: (ACTION_COLORS[selectedLog.action] || DEFAULT_COLOR).color
                }}>
                  {actionLabel(selectedLog.action)}
                </span>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{t('audit.code', { code: selectedLog.action })}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>{t('audit.label_user')}</div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{selectedLog.userName || '—'}</div>
                {selectedLog.userId && <div style={{ fontSize: '12px', color: '#6b7280' }}>{t('audit.detail_userId', { defaultValue: 'User ID' })}: {selectedLog.userId}</div>}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>{t('audit.label_date_time')}</div>
                <div style={{ fontSize: '14px', color: '#1f2937' }}>{new Date(selectedLog.timestamp).toLocaleString()}</div>
              </div>
              {selectedLog.ip && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>{t('audit.label_ip')}</div>
                  <div style={{ fontSize: '14px', color: '#1f2937' }}>{selectedLog.ip}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>{t('audit.label_description')}</div>
                <div style={{
                  fontSize: '14px',
                  color: '#1f2937',
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {formatDetails(selectedLog.details) || '—'}
                </div>
              </div>
            </div>
            <div style={{
              padding: '12px 22px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => handleDeleteLog(selectedLog)}
                disabled={deletingId === selectedLog.id}
                style={{
                  padding: '7px 16px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deletingId === selectedLog.id ? 'wait' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  opacity: deletingId === selectedLog.id ? 0.6 : 1
                }}
              >
                {deletingId === selectedLog.id ? t('audit.deleting') : t('audit.delete_record')}
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: '7px 16px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                {t('audit.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLog;