// components/audit/AuditLog.js
import React, { useState, useEffect, useMemo } from 'react';
import { db, checkRealInternet, getApiBase } from '../../services/database';
import { exportCSV, exportJSON, getServerBase } from '../../utils/helpers';

function AuditLog({ auditLog, setAuditLog }) {
  const [isClearing, setIsClearing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [localLogs, setLocalLogs] = useState([]);

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
          if (!existing) {
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
        alert('✅ Audit logs refreshed from server');
      } else {
        alert('❌ Failed to fetch from server');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      alert('❌ Error refreshing audit logs');
    }
  };

  const handleClearAudit = async () => {
    if (!window.confirm('⚠️ Are you sure you want to clear ALL audit logs? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      await db.audit.clear();
      setLocalLogs([]);
      if (setAuditLog && typeof setAuditLog === 'function') {
        setAuditLog([]);
      }

      const online = await checkRealInternet();
      if (online) {
        try {
          await fetch(`${getApiBase()}/audit`, { method: 'DELETE' });
        } catch (err) {
          console.error('Server clear failed (kept local deletion):', err);
        }
      }

      alert('✅ Audit log cleared successfully!');
    } catch (error) {
      console.error('Error clearing audit log:', error);
      alert('❌ Error clearing audit log: ' + error.message);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteLog = async (log) => {
    if (!window.confirm('Delete this audit record?')) {
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

      const online = await checkRealInternet();
      if (online) {
        try {
          await fetch(`${getApiBase()}/audit/${log.id}`, { method: 'DELETE' });
        } catch (err) {
          console.error('Server delete failed (kept local deletion):', err);
        }
      }
    } catch (error) {
      console.error('Error deleting audit record:', error);
      alert('❌ Error deleting audit record: ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    if (!logs || logs.length === 0) {
      alert('No audit records to export');
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
      alert('No audit records to export');
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📜 Audit Log</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            Complete trail of every action performed across the system — logins, user changes, reports and registrations.
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
            📋 {logs?.length || 0} Records
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
            🔄 Refresh
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
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>📋 Activity Records</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              {logs?.length || 0} activities recorded
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
              {isClearing ? '⏳ Clearing...' : '🗑️ Clear All'}
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>User</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Action</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Details</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Actions</th>
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
                    <div>No audit records found</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Click "Refresh" to sync with server
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
                      background: log.action === 'LOGIN' ? '#d1fae5' :
                                log.action === 'LOGOUT' ? '#fee2e2' :
                                log.action === 'CREATE_USER' ? '#dbeafe' :
                                log.action === 'DELETE_USER' ? '#fef3c7' :
                                log.action === 'SUBMIT_REPORT' ? '#e0e7ff' :
                                log.action === 'REGISTER_CITIZEN' ? '#d1fae5' :
                                '#f3f4f6',
                      color: log.action === 'LOGIN' ? '#065f37' :
                             log.action === 'LOGOUT' ? '#991b1b' :
                             log.action === 'CREATE_USER' ? '#1e40af' :
                             log.action === 'DELETE_USER' ? '#92400e' :
                             log.action === 'SUBMIT_REPORT' ? '#4338ca' :
                             log.action === 'REGISTER_CITIZEN' ? '#065f37' :
                             '#374151'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4a5568' }}>
                    {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleDeleteLog(log)}
                      disabled={deletingId === log.id}
                      title="Delete this record"
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
                      {deletingId === log.id ? 'Deleting...' : '🗑️'}
                    </button>
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
              Total: {logs.length} records
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                Oldest: {logs.length > 0 ? new Date(logs[logs.length - 1]?.timestamp).toLocaleDateString() : 'N/A'}
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
                {isClearing ? '⏳ Clearing...' : '🗑️ Clear All'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLog;