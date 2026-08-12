// components/supervisor/SupervisorReports.js – FULLY FIXED (auto-display newest reports, refresh works)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getToday, uid } from '../../utils/helpers';
import { db, syncQueue, checkRealInternet, pullSupervisorReportsFromServer, getApiBase } from '../../services/database';
import UserAvatar from '../common/UserAvatar';

function SupervisorReports({ 
  supervisorReports, 
  users, 
  user, 
  teamMembers,
  setSupervisorReports   // passed from parent to update global state
}) {
  const [showOfficerReport, setShowOfficerReport] = useState(false);
  const [showSelfReport, setShowSelfReport] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [localReports, setLocalReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    officerId: '',
    reportDate: getToday(),
    performance: 'good',
    attendance: 'good',
    quality: 'good',
    punctuality: 'good',
    teamwork: 'good',
    communication: 'good',
    comments: '',
    recommendations: '',
    overallRating: 3
  });

  const [selfForm, setSelfForm] = useState({
    reportDate: getToday(),
    region: user?.region || '',
    siteVisits: 0,
    issuesResolved: 0,
    challenges: '',
    achievements: '',
    teamMorale: 'good',
    resourceStatus: 'adequate',
    recommendations: '',
    overallStatus: 'good'
  });

  // ===== CHECK ONLINE STATUS =====
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      setPendingCount(syncQueue.count());
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);

    const handleQueueUpdate = () => {
      setPendingCount(syncQueue.count());
    };

    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    window.addEventListener('sync-complete', handleQueueUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('sync-complete', handleQueueUpdate);
    };
  }, []);

  // ===== LOAD REPORTS FROM INDEXEDDB =====
  const loadReportsFromDB = useCallback(async () => {
    try {
      const all = await db.supervisor_reports.toArray();
      const filtered = all.filter(r => r.supervisorId === user?.id);
      setLocalReports(filtered);
      return filtered;
    } catch (error) {
      console.error('Error loading reports from IndexedDB:', error);
      return [];
    }
  }, [user]);

  // ===== REFRESH REPORTS (manual & after online) =====
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Manual refresh triggered');
      if (isOnline) {
        await pullSupervisorReportsFromServer();
      }
      const loaded = await loadReportsFromDB();
      // Update parent state if setter provided
      if (setSupervisorReports) {
        setSupervisorReports(loaded);
      }
      // Also update local state (already done in loadReportsFromDB)
      console.log('📥 Reports after refresh:', loaded.length);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, loadReportsFromDB, setSupervisorReports]);

  // ===== USE PROP OR LOCAL REPORTS (prioritise local to show new reports instantly) =====
  const reports = useMemo(() => {
    // If we have local reports, use them (they are the most up-to-date)
    if (localReports.length > 0) {
      return localReports;
    }
    // Fallback to parent prop if local is empty
    if (supervisorReports && supervisorReports.length > 0) {
      const filtered = supervisorReports.filter(r => r.supervisorId === user?.id);
      return filtered;
    }
    return [];
  }, [localReports, supervisorReports, user]);

  // ===== SORTED REPORTS (newest first) =====
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const dateA = a.submittedAt || a.reportDate || a.createdAt;
      const dateB = b.submittedAt || b.reportDate || b.createdAt;
      return new Date(dateB) - new Date(dateA);
    });
  }, [reports]);

  // ===== HELPER: Check if report is NEW (within 24h) =====
  const isNewReport = (report) => {
    const dateStr = report.submittedAt || report.reportDate || report.createdAt;
    if (!dateStr) return false;
    const reportDate = new Date(dateStr);
    const now = new Date();
    const diffHours = (now - reportDate) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // ===== HELPER: Format date/time =====
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

  // ===== HANDLE OFFICER REPORT SUBMIT =====
  const handleOfficerReportSubmit = async (e) => {
    e.preventDefault();
    const officer = users.find(u => u.id === form.officerId);
    if (!officer) { 
      alert('Please select an officer'); 
      return; 
    }

    const online = await checkRealInternet();
    setIsOnline(online);

    try {
      const report = {
        id: uid(),
        supervisorId: user.id,
        supervisorName: user.name,
        officerId: officer.id,
        officerName: officer.name,
        officerRegion: officer.region,
        reportDate: form.reportDate,
        performance: form.performance,
        attendance: form.attendance,
        quality: form.quality,
        punctuality: form.punctuality,
        teamwork: form.teamwork,
        communication: form.communication,
        comments: form.comments,
        recommendations: form.recommendations,
        overallRating: form.overallRating,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        region: officer.region,
        type: 'officer_report',
        synced: false
      };
      
      console.log('📝 Saving officer report:', report);
      
      // 1. Save to IndexedDB
      await db.supervisor_reports.add(report);
      console.log('✅ Officer report saved to IndexedDB');
      
      // 2. Update local state (immediate display)
      setLocalReports(prev => {
        const updated = [report, ...prev];
        console.log('📋 Updated local reports count:', updated.length);
        return updated;
      });
      
      // 3. Update parent state if setter provided
      if (setSupervisorReports) {
        setSupervisorReports(prev => {
          const updated = [report, ...prev];
          console.log('📤 Updated parent reports count:', updated.length);
          return updated;
        });
      }
      
      // 4. If online, send to server
      if (online) {
        try {
          const response = await fetch(`${getApiBase()}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'supervisor_report', data: report })
          });
          
          if (response.ok) {
            await db.supervisor_reports.update(report.id, { synced: true });
            // Update both local and parent states to reflect synced status
            setLocalReports(prev => prev.map(r => r.id === report.id ? { ...r, synced: true } : r));
            if (setSupervisorReports) {
              setSupervisorReports(prev => prev.map(r => r.id === report.id ? { ...r, synced: true } : r));
            }
            alert('✅ Supervisor report submitted successfully!');
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.warn('Server unreachable, queueing report:', err.message);
          syncQueue.add({ type: 'supervisor_report', id: report.id, data: report });
          setPendingCount(syncQueue.count());
          alert('⚠️ Server unreachable. Report saved and will sync later.');
        }
      } else {
        // Offline – queue immediately
        console.warn('Offline, queueing report...');
        syncQueue.add({ type: 'supervisor_report', id: report.id, data: report });
        setPendingCount(syncQueue.count());
        alert('📋 Supervisor report saved OFFLINE! Will sync when online.');
      }
      
      setShowOfficerReport(false);
      setForm({
        officerId: '',
        reportDate: getToday(),
        performance: 'good',
        attendance: 'good',
        quality: 'good',
        punctuality: 'good',
        teamwork: 'good',
        communication: 'good',
        comments: '',
        recommendations: '',
        overallRating: 3
      });
    } catch (error) {
      console.error('Error submitting officer report:', error);
      alert('❌ Error submitting report: ' + error.message);
    }
  };

  // ===== HANDLE SELF REPORT SUBMIT =====
  const handleSelfReportSubmit = async (e) => {
    e.preventDefault();

    const online = await checkRealInternet();
    setIsOnline(online);

    try {
      const report = {
        id: uid(),
        supervisorId: user.id,
        supervisorName: user.name,
        reportDate: selfForm.reportDate,
        region: selfForm.region || user.region,
        siteVisits: selfForm.siteVisits,
        issuesResolved: selfForm.issuesResolved,
        challenges: selfForm.challenges,
        achievements: selfForm.achievements,
        teamMorale: selfForm.teamMorale,
        resourceStatus: selfForm.resourceStatus,
        recommendations: selfForm.recommendations,
        overallStatus: selfForm.overallStatus,
        submittedAt: new Date().toISOString(),
        type: 'self_report',
        synced: false
      };
      
      console.log('📝 Saving self report:', report);
      
      // 1. Save to IndexedDB
      await db.supervisor_reports.add(report);
      console.log('✅ Self report saved to IndexedDB');
      
      // 2. Update local state (immediate display)
      setLocalReports(prev => {
        const updated = [report, ...prev];
        console.log('📋 Updated local reports count:', updated.length);
        return updated;
      });
      
      // 3. Update parent state if setter provided
      if (setSupervisorReports) {
        setSupervisorReports(prev => {
          const updated = [report, ...prev];
          console.log('📤 Updated parent reports count:', updated.length);
          return updated;
        });
      }
      
      // 4. If online, send to server
      if (online) {
        try {
          const response = await fetch(`${getApiBase()}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'supervisor_report', data: report })
          });
          
          if (response.ok) {
            await db.supervisor_reports.update(report.id, { synced: true });
            setLocalReports(prev => prev.map(r => r.id === report.id ? { ...r, synced: true } : r));
            if (setSupervisorReports) {
              setSupervisorReports(prev => prev.map(r => r.id === report.id ? { ...r, synced: true } : r));
            }
            alert('✅ Self report submitted successfully!');
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.warn('Server unreachable, queueing self report:', err.message);
          syncQueue.add({ type: 'supervisor_report', id: report.id, data: report });
          setPendingCount(syncQueue.count());
          alert('⚠️ Server unreachable. Self report saved and will sync later.');
        }
      } else {
        console.warn('Offline, queueing self report...');
        syncQueue.add({ type: 'supervisor_report', id: report.id, data: report });
        setPendingCount(syncQueue.count());
        alert('📋 Self report saved OFFLINE! Will sync when online.');
      }
      
      setShowSelfReport(false);
      setSelfForm({
        reportDate: getToday(),
        region: user?.region || '',
        siteVisits: 0,
        issuesResolved: 0,
        challenges: '',
        achievements: '',
        teamMorale: 'good',
        resourceStatus: 'adequate',
        recommendations: '',
        overallStatus: 'good'
      });
    } catch (error) {
      console.error('Error submitting self report:', error);
      alert('❌ Error submitting self report: ' + error.message);
    }
  };

  // ===== INITIAL LOAD (fallback) =====
  useEffect(() => {
    if (user) {
      loadReportsFromDB().then(loaded => {
        // If parent doesn't have reports, set local
        if (!supervisorReports || supervisorReports.length === 0) {
          setLocalReports(loaded);
        }
      });
    }
  }, [user, loadReportsFromDB, supervisorReports]);

  // ===== LOG REPORTS FOR DEBUGGING =====
  console.log('📋 SupervisorReports rendering, local reports:', localReports.length);
  console.log('📋 SupervisorReports rendering, sorted reports:', sortedReports.length);
  console.log('📋 First 3 sorted reports:', sortedReports.slice(0, 3).map(r => ({ id: r.id, type: r.type, submittedAt: r.submittedAt })));

  return (
    <div className="supervisor-reports-view" style={{ padding: '20px' }}>
      {/* ===== STATUS BAR ===== */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: isOnline ? '#d1fae5' : '#fee2e2',
        borderRadius: '8px',
        marginBottom: '16px',
        border: isOnline ? '1px solid #0b7e4b' : '1px solid #dc2626',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ fontWeight: '500', color: isOnline ? '#065f37' : '#991b1b' }}>
          {isOnline ? '✅ Online' : '❌ Offline'}
        </span>
        {pendingCount > 0 && (
          <span style={{
            background: '#f59e0b',
            color: 'white',
            padding: '2px 12px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            ⏳ {pendingCount} pending sync
          </span>
        )}
        {isLoading && (
          <span style={{
            background: '#dbeafe',
            color: '#1e40af',
            padding: '2px 12px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            🔄 Loading...
          </span>
        )}
      </div>

      {/* ===== OFFLINE BANNER ===== */}
      {!isOnline && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span>📡 You are offline. Reports will be saved and synced when online.</span>
          {pendingCount > 0 && (
            <span style={{
              background: '#f59e0b',
              color: 'white',
              padding: '2px 12px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              {pendingCount} pending sync
            </span>
          )}
        </div>
      )}

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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📋 Supervisor Reports</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            Submit reports about your team members and your own work status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {!isOnline && (
            <span style={{
              background: 'rgba(248,113,113,0.25)',
              border: '1px solid rgba(252,165,165,0.5)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              📡 Offline Mode
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            style={{
              background: 'rgba(96,165,250,0.2)',
              border: '1px solid rgba(147,197,253,0.5)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '24px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* ===== MAIN CARD ===== */}
      <div className="form-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div className="report-actions" style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          padding: '16px 24px'
        }}>
          <button 
            className="btn-primary" 
            onClick={() => setShowOfficerReport(true)}
            style={{
              opacity: 1,
              visibility: 'visible',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#1e3a5f',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📝 Report About Officer
          </button>
          <button 
            className="btn-primary" 
            onClick={() => setShowSelfReport(true)}
            style={{
              opacity: 1,
              visibility: 'visible',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#2b4c7a',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📝 Submit Self Report
          </button>
        </div>
      </div>

      {/* ===== REPORTS TABLE (Enhanced) ===== */}
      <div className="table-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div className="table-header" style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div>
            <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '600' }}>My Supervisor Reports</h3>
            <p style={{ margin: '2px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
              {sortedReports.length} reports submitted
            </p>
          </div>
          {pendingCount > 0 && (
            <span style={{
              background: '#fef3c7',
              color: '#92400e',
              padding: '2px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              ⏳ {pendingCount} pending sync
            </span>
          )}
        </div>

        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280' }}>Submitted</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280' }}>Officer / Self</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280' }}>Performance</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '12px', color: '#6b7280' }}>Rating</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '12px', color: '#6b7280' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '12px', color: '#6b7280' }}>New</th>
              </tr>
            </thead>
            <tbody>
              {sortedReports.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-state" style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📋</div>
                    <div>No supervisor reports found</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Click &quot;Submit Self Report&quot; or &quot;Report About Officer&quot; to add one.</div>
                  </td>
                </tr>
              )}
              {sortedReports.map((r, index) => {
                const isNew = isNewReport(r);
                const displayDate = formatDateTime(r.submittedAt || r.reportDate || r.createdAt);
                return (
                  <tr key={r.id || index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      {displayDate}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      {r.type === 'self_report' ? '📋 Self Report' : '👤 Officer Report'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '500' }}>
                      {(() => {
                        const isSelf = r.type === 'self_report';
                        const name = isSelf ? r.supervisorName : r.officerName;
                        const reportUser = isSelf
                          ? (r.supervisorId ? users.find(u => u.id === r.supervisorId) : user)
                          : users.find(u => u.id === r.officerId);
                        const photo = (reportUser && reportUser.profilePhoto) || null;
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <UserAvatar photo={photo} name={name} role="field_officer" size={26} />
                            {name}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
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
                    <td style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>
                      {r.type === 'self_report' ? 'N/A' : `${r.overallRating}/5 ⭐`}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px' }}>
                      <span className="status-tag submitted" style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: r.synced ? '#d1fae5' : '#fef3c7',
                        color: r.synced ? '#065f37' : '#92400e',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {r.synced ? '✅ Synced' : '📡 Offline'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px' }}>
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

        {/* Footer with pending count */}
        {pendingCount > 0 && (
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid #e5e7eb',
            background: '#fef3c7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#92400e'
          }}>
            <span>⏳ {pendingCount} report(s) pending sync</span>
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

      {/* ===== OFFICER REPORT MODAL ===== */}
      {showOfficerReport && (
        <div className="modal-overlay" onClick={() => setShowOfficerReport(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '640px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>
                📝 Report About Officer
                {!isOnline && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
              </h3>
              <button 
                className="modal-close" 
                onClick={() => setShowOfficerReport(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b',
                  opacity: 1,
                  visibility: 'visible'
                }}
              >✕</button>
            </div>

            {!isOnline && (
              <div style={{
                padding: '12px 16px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <strong>📡 Offline Mode:</strong> Your report will be saved locally and synced automatically when online.
                {pendingCount > 0 && (
                  <span style={{ marginLeft: '8px' }}>
                    ({pendingCount} pending sync)
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleOfficerReportSubmit} className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Select Officer *</label>
                <select 
                  value={form.officerId} 
                  onChange={e => setForm({...form, officerId: e.target.value})}
                  required
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    background: 'white'
                  }}
                >
                  <option value="">Select Officer</option>
                  {teamMembers.map(o => (
                    <option key={o.id} value={o.id}>{o.name} ({o.region})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Report Date *</label>
                <input 
                  type="date" 
                  value={form.reportDate} 
                  onChange={e => setForm({...form, reportDate: e.target.value})}
                  required 
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%'
                  }}
                />
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Performance</label>
                  <select 
                    value={form.performance} 
                    onChange={e => setForm({...form, performance: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Attendance</label>
                  <select 
                    value={form.attendance} 
                    onChange={e => setForm({...form, attendance: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Quality of Work</label>
                  <select 
                    value={form.quality} 
                    onChange={e => setForm({...form, quality: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Punctuality</label>
                  <select 
                    value={form.punctuality} 
                    onChange={e => setForm({...form, punctuality: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Teamwork</label>
                  <select 
                    value={form.teamwork} 
                    onChange={e => setForm({...form, teamwork: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Communication</label>
                  <select 
                    value={form.communication} 
                    onChange={e => setForm({...form, communication: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Overall Rating (1-5) *</label>
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  value={form.overallRating} 
                  onChange={e => setForm({...form, overallRating: parseInt(e.target.value)})}
                  required 
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%'
                  }}
                />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Comments</label>
                <textarea 
                  value={form.comments} 
                  onChange={e => setForm({...form, comments: e.target.value})}
                  placeholder="Any additional comments about the officer..." 
                  rows="3"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '60px'
                  }}
                />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Recommendations</label>
                <textarea 
                  value={form.recommendations} 
                  onChange={e => setForm({...form, recommendations: e.target.value})}
                  placeholder="Recommendations for improvement..." 
                  rows="2"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '60px'
                  }}
                />
              </div>
              <div style={{
                padding: '12px',
                background: !isOnline ? '#fef3c7' : '#dbeafe',
                borderRadius: '8px',
                fontSize: '13px',
                color: !isOnline ? '#92400e' : '#1e40af'
              }}>
                <strong>ℹ️ {isOnline ? 'Online' : 'Offline'}:</strong>
                {isOnline 
                  ? ' This report will be sent immediately.' 
                  : ' This report will be saved offline and synced when online.'}
              </div>
              <div className="modal-actions" style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button 
                  type="submit" 
                  className="btn-submit"
                  style={{
                    opacity: 1,
                    visibility: 'visible',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isOnline ? '#0b7e4b' : '#f59e0b',
                    color: 'white',
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {isOnline ? 'Submit Report' : '💾 Save Offline'}
                </button>
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowOfficerReport(false)}
                  style={{
                    opacity: 1,
                    visibility: 'visible',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#e5e7eb',
                    color: '#374151',
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== SELF REPORT MODAL ===== */}
      {showSelfReport && (
        <div className="modal-overlay" onClick={() => setShowSelfReport(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '640px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>
                📋 Supervisor Self Report
                {!isOnline && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
              </h3>
              <button 
                className="modal-close" 
                onClick={() => setShowSelfReport(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b',
                  opacity: 1,
                  visibility: 'visible'
                }}
              >✕</button>
            </div>

            {!isOnline && (
              <div style={{
                padding: '12px 16px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <strong>📡 Offline Mode:</strong> Your self report will be saved locally and synced automatically when online.
                {pendingCount > 0 && (
                  <span style={{ marginLeft: '8px' }}>
                    ({pendingCount} pending sync)
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleSelfReportSubmit} className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Report Date *</label>
                <input 
                  type="date" 
                  value={selfForm.reportDate} 
                  onChange={e => setSelfForm({...selfForm, reportDate: e.target.value})}
                  required 
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%'
                  }}
                />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Region</label>
                <input 
                  type="text" 
                  value={user?.region || ''} 
                  readOnly
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: '#f3f4f6',
                    color: '#6b7280',
                    cursor: 'not-allowed',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%'
                  }}
                />
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Site Visits *</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={selfForm.siteVisits} 
                    onChange={e => setSelfForm({...selfForm, siteVisits: parseInt(e.target.value) || 0})}
                    required 
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%'
                    }}
                  />
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Issues Resolved</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={selfForm.issuesResolved} 
                    onChange={e => setSelfForm({...selfForm, issuesResolved: parseInt(e.target.value) || 0})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%'
                    }}
                  />
                </div>
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Team Morale</label>
                  <select 
                    value={selfForm.teamMorale} 
                    onChange={e => setSelfForm({...selfForm, teamMorale: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="low">⚠️ Low</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Resource Status</label>
                  <select 
                    value={selfForm.resourceStatus} 
                    onChange={e => setSelfForm({...selfForm, resourceStatus: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="adequate">✅ Adequate</option>
                    <option value="limited">⚠️ Limited</option>
                    <option value="insufficient">❌ Insufficient</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Overall Status</label>
                <select 
                  value={selfForm.overallStatus} 
                  onChange={e => setSelfForm({...selfForm, overallStatus: e.target.value})}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    background: 'white'
                  }}
                >
                  <option value="excellent">⭐ Excellent</option>
                  <option value="good">✅ Good</option>
                  <option value="average">📊 Average</option>
                  <option value="challenging">⚠️ Challenging</option>
                </select>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Challenges Faced</label>
                <textarea 
                  value={selfForm.challenges} 
                  onChange={e => setSelfForm({...selfForm, challenges: e.target.value})}
                  placeholder="Describe any challenges you faced..." 
                  rows="2"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '60px'
                  }}
                />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Achievements</label>
                <textarea 
                  value={selfForm.achievements} 
                  onChange={e => setSelfForm({...selfForm, achievements: e.target.value})}
                  placeholder="Describe your achievements..." 
                  rows="2"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '60px'
                  }}
                />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Recommendations</label>
                <textarea 
                  value={selfForm.recommendations} 
                  onChange={e => setSelfForm({...selfForm, recommendations: e.target.value})}
                  placeholder="Any recommendations..." 
                  rows="2"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '60px'
                  }}
                />
              </div>
              <div style={{
                padding: '12px',
                background: !isOnline ? '#fef3c7' : '#dbeafe',
                borderRadius: '8px',
                fontSize: '13px',
                color: !isOnline ? '#92400e' : '#1e40af'
              }}>
                <strong>ℹ️ {isOnline ? 'Online' : 'Offline'}:</strong>
                {isOnline 
                  ? ' This report will be sent immediately.' 
                  : ' This report will be saved offline and synced when online.'}
              </div>
              <div className="modal-actions" style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button 
                  type="submit" 
                  className="btn-submit"
                  style={{
                    opacity: 1,
                    visibility: 'visible',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isOnline ? '#0b7e4b' : '#f59e0b',
                    color: 'white',
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {isOnline ? 'Submit Self Report' : '💾 Save Offline'}
                </button>
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowSelfReport(false)}
                  style={{
                    opacity: 1,
                    visibility: 'visible',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#e5e7eb',
                    color: '#374151',
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupervisorReports;