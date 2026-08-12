// components/screentime/ScreenTimeManagement.js

import React, { useState, useMemo, useEffect } from 'react';
import { formatTime } from '../../utils/helpers';
import { db, checkRealInternet, syncQueue, deleteScreenTimeRecords } from '../../services/database';

function ScreenTimeManagement({
  screenTime,
  setScreenTime,
  users,
  user,
  isManager,
  isSupervisor,
  isOfficer,
  teamMembers
}) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  // Live copy of screen time records so a running session's exact total
  // and idle time keeps updating on screen without a page reload.
  const [liveScreenTime, setLiveScreenTime] = useState(screenTime);
  const [deletingIds, setDeletingIds] = useState({});
  const [deletingAll, setDeletingAll] = useState(false);

  // ===== LIVE REFRESH FROM INDEXEDDB =====
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const rows = await db.screen_time.toArray();
        if (!cancelled) setLiveScreenTime(rows);
      } catch (e) {
        // ignore
      }
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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

  // ===== CONVERT 24-HOUR TO 12-HOUR =====
  const convertTo12Hour = (time24) => {
    if (!time24) return '--';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  // ===== HELPERS TO CALL SERVER =====
  // (no server helpers needed – limits are no longer managed from this page)

  // ===== FILTERED DATA =====
  const filteredScreenTime = useMemo(() => {
    let filtered = [...liveScreenTime];

    if (selectedDate) {
      // Server-pulled records may carry an ISO timestamp; compare only the date part.
      filtered = filtered.filter(s => String(s.date || '').slice(0, 10) === selectedDate);
    }

    if (isOfficer && user) {
      filtered = filtered.filter(s => s.employeeId === user.employeeId);
    } else if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      filtered = filtered.filter(s => teamIds.includes(s.employeeId) || s.employeeId === user.employeeId);
    } else if (isManager) {
      if (selectedEmployee !== 'all') {
        filtered = filtered.filter(s => s.employeeId === selectedEmployee);
      }
    }

    return filtered;
  }, [liveScreenTime, user, isOfficer, isSupervisor, isManager, teamMembers, selectedDate, selectedEmployee]);

  // ===== SANITIZE CORRUPT RECORDS =====
  // A single session can never legitimately exceed 24h (86400 seconds).
  // Records above that hold broken values (e.g. a unix timestamp) and must be ignored.
  const MAX_TOTAL_SECONDS = 24 * 60 * 60;
  const getValidTotalSeconds = (record) => {
    const v = record?.totalScreenTime;
    return Number.isFinite(v) && v > 0 && v <= MAX_TOTAL_SECONDS ? v : 0;
  };
  const getValidIdleSeconds = (record) => {
    const v = record?.idleTime;
    return Number.isFinite(v) && v > 0 && v <= MAX_TOTAL_SECONDS ? v : 0;
  };

  // ===== STATS =====
  const stats = useMemo(() => {
    const total = filteredScreenTime.length;
    const active = filteredScreenTime.filter(s => s.isLoggedIn).length;
    const completed = filteredScreenTime.filter(s => !s.isLoggedIn && s.logoutTime).length;
    const totalSeconds = filteredScreenTime.reduce((sum, s) => sum + getValidTotalSeconds(s), 0);
    const totalIdleSeconds = filteredScreenTime.reduce((sum, s) => sum + getValidIdleSeconds(s), 0);
    const avgTrust = total > 0 ? Math.round(filteredScreenTime.reduce((sum, s) => sum + (s.trustScore || 0), 0) / total) : 0;
    return { total, active, completed, totalSeconds, totalIdleSeconds, avgTrust };
  }, [filteredScreenTime]);

  // Employee options for manager filter (from the users list so new employees always appear)
  const employeeOptions = useMemo(() => {
    if (!isManager) return [];
    const seen = new Set();
    const employees = [];
    const add = (employeeId, employeeName) => {
      if (employeeId && !seen.has(employeeId)) {
        seen.add(employeeId);
        employees.push({ employeeId, employeeName });
      }
    };
    (users || []).forEach(u => {
      if (u.role === 'field_officer') add(u.employeeId, u.name);
    });
    liveScreenTime.forEach(s => add(s.employeeId, s.employeeName));
    return employees;
  }, [liveScreenTime, users, isManager]);

  // ===== DELETE SCREEN TIME RECORDS =====
  const handleDeleteRecord = async (record) => {
    if (!record || !record.id) return;
    if (!window.confirm(`Delete screen time record for ${record.employeeName || record.employeeId} (${record.date})? This cannot be undone.`)) return;
    setDeletingIds(prev => ({ ...prev, [record.id]: true }));
    try {
      await deleteScreenTimeRecords([record]);
      setLiveScreenTime(prev => prev.filter(s => s.id !== record.id));
      if (setScreenTime) setScreenTime(prev => prev.filter(s => s.id !== record.id));
    } finally {
      setDeletingIds(prev => { const next = { ...prev }; delete next[record.id]; return next; });
    }
  };

  const handleDeleteAll = async () => {
    const records = filteredScreenTime;
    if (records.length === 0) return;
    if (!window.confirm(`Delete ${records.length} screen time record(s)? This cannot be undone.`)) return;
    setDeletingAll(true);
    try {
      await deleteScreenTimeRecords(records);
      const ids = new Set(records.map(s => s.id));
      setLiveScreenTime(prev => prev.filter(s => !ids.has(s.id)));
      if (setScreenTime) setScreenTime(prev => prev.filter(s => !ids.has(s.id)));
    } finally {
      setDeletingAll(false);
    }
  };

  // ===== RENDER TABLE =====
  const renderScreenTimeTable = () => {
    const displayScreenTime = filteredScreenTime;

    if (displayScreenTime.length === 0) {
      return (
        <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>📱</div>
          <div>No screen time records found</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            {selectedDate ? `No records for ${selectedDate}` : 'No screen time has been recorded yet'}
          </div>
        </div>
      );
    }

    return (
      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Login</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logout</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Time</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Idle Time</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trust Score</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayScreenTime.map(s => {
              const totalSecs = getValidTotalSeconds(s);
              const idleSecs = getValidIdleSeconds(s);
              const formattedTime = formatTime(totalSecs);
              const loginTime12 = convertTo12Hour(s.loginTime);
              const logoutTime12 = convertTo12Hour(s.logoutTime);
              const isSynced = s.synced !== false;

              return (
                <tr key={s.id} style={{
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <td style={{ padding: '12px 16px' }}>
                    <strong style={{ fontSize: '14px', color: '#1a1a2e' }}>{s.employeeName}</strong>
                    {s.employeeId === user?.employeeId && (
                      <span style={{ fontSize: '11px', color: '#6b7f94', marginLeft: '6px' }}>(You)</span>
                    )}
                    {!isSynced && (
                      <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📡</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4a5568' }}>{String(s.date || '').slice(0, 10)}</td>
                  <td style={{ padding: '12px 16px', color: '#4a5568' }}>{loginTime12}</td>
                  <td style={{ padding: '12px 16px', color: '#4a5568' }}>{logoutTime12}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="screen-time" style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: '#dbeafe',
                      color: '#1e3a5f'
                    }}>
                      {formattedTime}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                    {idleSecs > 0 ? formatTime(idleSecs) : '00:00:00'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {s.isLoggedIn ? (
                      <span className="status-badge online" style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#d1fae5',
                        color: '#065f37'
                      }}>🟢 Active</span>
                    ) : s.logoutTime ? (
                      <span className="status-badge offline" style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#f3f4f6',
                        color: '#6b7280'
                      }}>
                        🔴 Completed
                      </span>
                    ) : (
                      <span className="status-badge away" style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#f3f4f6',
                        color: '#6b7280'
                      }}>⚪ Not Started</span>
                    )}
                    {!isSynced && <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📡</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`trust-score ${s.trustScore >= 80 ? 'high' : s.trustScore >= 60 ? 'medium' : 'low'}`} style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: s.trustScore >= 80 ? '#d1fae5' : s.trustScore >= 60 ? '#fef3c7' : '#fee2e2',
                      color: s.trustScore >= 80 ? '#065f37' : s.trustScore >= 60 ? '#92400e' : '#991b1b'
                    }}>
                      {s.trustScore || 0}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteRecord(s)}
                      disabled={deletingIds[s.id]}
                      title="Delete this screen time record"
                      style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: deletingIds[s.id] ? 'default' : 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        opacity: deletingIds[s.id] ? 0.5 : 1
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="screentime-management" style={{ padding: '20px' }}>
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📱 Screen Time Control</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {isManager ? 'Monitor all officers work time' :
              isSupervisor ? 'Monitor team members work time' :
              'Your screen time'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid rgba(52,211,153,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            🟢 {stats.active} Active
          </span>
          <span style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            ✅ {stats.completed} Completed
          </span>
          <span style={{
            background: 'rgba(96,165,250,0.2)',
            border: '1px solid rgba(147,197,253,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            📊 {stats.total} Total
          </span>
          {pendingCount > 0 && (
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              📡 {pendingCount} Pending Sync
            </span>
          )}
        </div>
      </div>

      {/* Status Bar */}
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
      </div>

      {/* Offline Banner */}
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
          <span>📡 You are offline. Screen time records will be saved and synced when online.</span>
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

      <div className="form-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Stats Cards */}
        <div className="stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div className="stat-card" style={{
            borderLeftColor: '#1e3a5f',
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '4px solid #1e3a5f'
          }}>
            <div className="stat-icon" style={{ fontSize: '24px' }}>⏱️</div>
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{formatTime(stats.totalSeconds)}</div>
              <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280' }}>Total Work Time</div>
            </div>
          </div>
          <div className="stat-card" style={{
            borderLeftColor: '#d97706',
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '4px solid #d97706'
          }}>
            <div className="stat-icon" style={{ fontSize: '24px' }}>💤</div>
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{formatTime(stats.totalIdleSeconds)}</div>
              <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280' }}>Total Idle Time</div>
            </div>
          </div>
          <div className="stat-card" style={{
            borderLeftColor: '#0b7e4b',
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '4px solid #0b7e4b'
          }}>
            <div className="stat-icon" style={{ fontSize: '24px' }}>✅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{stats.completed}</div>
              <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280' }}>Completed</div>
            </div>
          </div>
          <div className="stat-card" style={{
            borderLeftColor: '#7c3aed',
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '4px solid #7c3aed'
          }}>
            <div className="stat-icon" style={{ fontSize: '24px' }}>🎯</div>
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{stats.avgTrust}%</div>
              <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280' }}>Avg Trust Score</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="attendance-filters" style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          padding: '16px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                opacity: 1,
                visibility: 'visible'
              }}
            />
          </div>

          {isManager && (
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  opacity: 1,
                  visibility: 'visible',
                  background: 'white'
                }}
              >
                <option value="all">All Employees</option>
                {employeeOptions.map(emp => (
                  <option key={emp.employeeId} value={emp.employeeId}>{emp.employeeName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
            <span className="attendance-count" style={{ fontSize: '13px', color: '#64748b' }}>
              {filteredScreenTime.length} records
            </span>
          </div>

          {isOnline && pendingCount > 0 && (
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.dispatchEvent(new Event('force-sync'))}
                style={{
                  background: '#0b7e4b',
                  color: 'white',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                🔄 Sync Now
              </button>
            </div>
          )}

          {filteredScreenTime.length > 0 && (
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: deletingAll ? 'default' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  opacity: deletingAll ? 0.5 : 1
                }}
              >
                {deletingAll ? 'Deleting…' : `🗑️ Delete All (${filteredScreenTime.length})`}
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        {renderScreenTimeTable()}

        {/* Footer pending count */}
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
            <span>⏳ {pendingCount} screen time update(s) pending sync</span>
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
    </div>
  );
}

export default ScreenTimeManagement;