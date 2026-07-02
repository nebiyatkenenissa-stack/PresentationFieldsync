import React from 'react';
import { exportCSV, exportJSON } from '../../utils/helpers';

function AuditLog({ auditLog }) {
  return (
    <div className="audit-log">
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>📜 Audit Log</h3>
            <p>{auditLog.length} activities recorded</p>
          </div>
          <div className="table-actions">
            <button className="btn-export" onClick={() => exportCSV(auditLog, 'audit_log')}>📥 CSV</button>
            <button className="btn-export" onClick={() => exportJSON(auditLog, 'audit_log')}>📥 JSON</button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-state">
                    <div className="empty-icon">📜</div>
                    <div>No audit records found</div>
                  </td>
                </tr>
              )}
              {auditLog.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.userName}</td>
                  <td><span className="status-tag">{log.action}</span></td>
                  <td>{typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AuditLog;