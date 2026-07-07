// components/audit/AuditLog.js

import React, { useState, useEffect } from 'react';
import { db } from '../../services/database';
import { exportCSV, exportJSON } from '../../utils/helpers';

function AuditLog({ auditLog, setAuditLog }) {
  const [isClearing, setIsClearing] = useState(false);
  const [logs, setLogs] = useState(auditLog || []);

  // Update logs when prop changes
  useEffect(() => {
    setLogs(auditLog || []);
  }, [auditLog]);

  // ===== CLEAR AUDIT LOG =====
  const handleClearAudit = async () => {
    if (!window.confirm('⚠️ Are you sure you want to clear ALL audit logs? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    
    try {
      // Method 1: Clear all from IndexedDB
      await db.audit.clear();
      
      // Update local state
      setLogs([]);
      
      // Update parent state
      if (setAuditLog && typeof setAuditLog === 'function') {
        setAuditLog([]);
      }
      
      alert('✅ Audit log cleared successfully!');
    } catch (error) {
      console.error('Error clearing audit log:', error);
      
      // Try alternative method if clear fails
      try {
        const allLogs = await db.audit.toArray();
        for (const log of allLogs) {
          await db.audit.delete(log.id);
        }
        setLogs([]);
        if (setAuditLog && typeof setAuditLog === 'function') {
          setAuditLog([]);
        }
        alert('✅ Audit log cleared successfully!');
      } catch (secondError) {
        console.error('Second attempt failed:', secondError);
        alert('❌ Error clearing audit log: ' + secondError.message);
      }
    } finally {
      setIsClearing(false);
    }
  };

  // ===== EXPORT FUNCTIONS =====
  const handleExportCSV = () => {
    if (logs.length === 0) {
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
    if (logs.length === 0) {
      alert('No audit records to export');
      return;
    }
    exportJSON(logs, 'audit_log');
  };

  return (
    <div className="audit-log" style={{ padding: '20px' }}>
      <div className="table-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* ===== HEADER ===== */}
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
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📜 Audit Log</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              {logs.length} activities recorded
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
                cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: logs.length === 0 ? 0.5 : 1
              }}
              disabled={logs.length === 0}
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
                cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: logs.length === 0 ? 0.5 : 1
              }}
              disabled={logs.length === 0}
            >
              📥 JSON
            </button>
            <button 
              className="btn-danger" 
              onClick={handleClearAudit}
              disabled={isClearing || logs.length === 0}
              style={{
                padding: '6px 14px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (isClearing || logs.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: (isClearing || logs.length === 0) ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isClearing ? '⏳ Clearing...' : '🗑️ Clear All'}
            </button>
          </div>
        </div>

        {/* ===== TABLE ===== */}
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
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-state" style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#64748b'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📜</div>
                    <div>No audit records found</div>
                  </td>
                </tr>
              )}
              {logs.map(log => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== FOOTER ===== */}
        {logs.length > 0 && (
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