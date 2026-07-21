// components/reports/AllReports.js
// Enhanced with date/time, NEW badge, sorting, and clear distinction between self/officer reports

import React, { useState, useMemo, useEffect } from 'react';
import { exportCSV, exportJSON } from '../../utils/helpers';
import { syncQueue, checkRealInternet } from '../../services/database';

function AllReports({ reports, users, supervisorReports }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Check online status and pending sync count
  useEffect(() => {
    const checkStatus = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      const count = syncQueue.count();
      setPendingCount(count);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    const handleQueueUpdate = () => {
      setPendingCount(syncQueue.count());
    };
    window.addEventListener('sync-queue-updated', handleQueueUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
    };
  }, []);

  // Helper: format date/time
  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
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
      filtered = filtered.filter(r => r.region === selectedRegion);
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.region?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRange.start) {
      filtered = filtered.filter(r => (r.reportDate || r.submittedAt) >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(r => (r.reportDate || r.submittedAt) <= dateRange.end);
    }

    return filtered;
  }, [syncedReports, selectedRegion, searchTerm, dateRange]);

  // ===== SUPERVISOR REPORTS =====
  // Sort by submittedAt (newest first) and clearly differentiate type
  const filteredSupervisorReports = useMemo(() => {
    let filtered = supervisorReports || [];
    if (selectedRegion !== 'All') {
      filtered = filtered.filter(r => r.region === selectedRegion);
    }
    // Sort by submittedAt - newest first
    return filtered
      .filter(r => r.synced !== false) // show all synced or pending
      .sort((a, b) => {
        const dateA = a.submittedAt || a.createdAt || a.reportDate;
        const dateB = b.submittedAt || b.createdAt || b.reportDate;
        return new Date(dateB) - new Date(dateA);
      });
  }, [supervisorReports, selectedRegion]);

  // Count offline reports
  const offlineCount = useMemo(() => {
    return reports.filter(r => r.synced === false).length;
  }, [reports]);

  return (
    <div className="all-reports-view">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📋 All Reports</h3>
            <p>Complete overview of all reports from all officers and supervisors</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="form-badge" style={{
              background: isOnline ? '#d1fae5' : '#fee2e2',
              color: isOnline ? '#065f37' : '#991b1b'
            }}>
              {isOnline ? '✅ Online' : '📡 Offline'}
            </span>
            <span className="form-badge">{reports.length} Total Reports</span>
            <span className="form-badge" style={{
              background: '#d1fae5',
              color: '#065f37'
            }}>
              ✅ {syncedReports.length} Synced
            </span>
            {offlineCount > 0 && (
              <span className="form-badge" style={{
                background: '#fef3c7',
                color: '#92400e'
              }}>
                📡 {offlineCount} Offline
              </span>
            )}
          </div>
        </div>

        {/* Offline Banner */}
        {offlineCount > 0 && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#92400e',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>📡 {offlineCount} report(s) waiting to sync. Will appear automatically when online.</span>
            {isOnline && (
              <button
                onClick={() => window.dispatchEvent(new Event('force-sync'))}
                style={{
                  background: '#0b7e4b',
                  color: 'white',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔄 Sync Now
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===== DAILY REPORTS TABLE ===== */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>📊 Daily Field Reports</h3>
            <p>{filteredReports.length} synced reports found</p>
          </div>
          <div className="table-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="🔍 Search reports..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="search-input" 
            />
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)} 
              className="filter-select"
            >
              <option value="All">All Regions</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Central">Central</option>
            </select>
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange({...dateRange, start: e.target.value})} 
              className="date-input" 
              placeholder="Start" 
            />
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange({...dateRange, end: e.target.value})} 
              className="date-input" 
              placeholder="End" 
            />
            <button className="btn-export" onClick={() => exportCSV(filteredReports, 'all_reports')}>📥 CSV</button>
            <button className="btn-export" onClick={() => exportJSON(filteredReports, 'all_reports')}>📥 JSON</button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Officer</th>
                <th>Supervisor</th>
                <th>Site</th>
                <th>Region</th>
                <th>Citizens</th>
                <th>Attendance</th>
                <th>Status</th>
                <th>Sync</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div>
                      {offlineCount > 0 ? (
                        `${offlineCount} report(s) waiting to sync. Will appear when synced.`
                      ) : (
                        'No reports found'
                      )}
                    </div>
                    <small>Try adjusting your filters</small>
                  </td>
                </tr>
              )}
              {filteredReports.map(r => {
                const supervisor = users?.find(u => u.id === r.supervisorId);
                const isNew = isNewReport(r);
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.submittedAt || r.createdAt || r.reportDate)}</td>
                    <td><strong>{r.employeeName}</strong></td>
                    <td>{supervisor?.name || 'N/A'}</td>
                    <td><strong>{r.siteName}</strong></td>
                    <td><span className="region-tag">{r.region}</span></td>
                    <td>{r.registrations}</td>
                    <td>
                      <span className={`attendance-tag ${r.attendance || 'present'}`}>
                        {r.attendance || 'Present'}
                      </span>
                    </td>
                    <td><span className="status-tag">{r.operationalStatus}</span></td>
                    <td>
                      {r.synced ? 
                        <span className="sync-tag synced">✅ Synced</span> : 
                        <span className="sync-tag pending">⏳ Pending</span>
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
                          NEW
                        </span>
                      )}
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
            <h3>👤 Supervisor Reports</h3>
            <p>{filteredSupervisorReports.length} supervisor reports found</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-export" onClick={() => exportCSV(filteredSupervisorReports, 'supervisor_reports_all')}>📥 CSV</button>
            <button className="btn-export" onClick={() => exportJSON(filteredSupervisorReports, 'supervisor_reports_all')}>📥 JSON</button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Type</th>
                <th>Supervisor</th>
                <th>Officer / Self</th>
                <th>Performance</th>
                <th>Rating</th>
                <th>Status</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupervisorReports.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div>No supervisor reports found</div>
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
                          📋 Self Report
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
                          👤 Officer Report
                        </span>
                      )}
                    </td>
                    <td>{r.supervisorName}</td>
                    <td><strong>{displayName}</strong></td>
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
                        {r.overallStatus || r.performance}
                      </span>
                    </td>
                    <td>{isSelfReport ? 'N/A' : `${r.overallRating}/5 ⭐`}</td>
                    <td>
                      <span className="status-tag submitted" style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: r.synced ? '#d1fae5' : '#fef3c7',
                        color: r.synced ? '#065f37' : '#92400e'
                      }}>
                        {r.synced ? '✅ Synced' : '📡 Offline'}
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
                          NEW
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AllReports;