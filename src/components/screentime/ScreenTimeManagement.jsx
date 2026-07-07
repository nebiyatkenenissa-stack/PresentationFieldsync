// components/screentime/ScreenTimeManagement.js

import React, { useState, useMemo, useEffect } from 'react';
import { formatTime } from '../../utils/helpers';
import { db, checkRealInternet, syncQueue } from '../../services/database';

function ScreenTimeManagement({ 
  screenTime, 
  user, 
  isManager, 
  isSupervisor, 
  isOfficer,
  teamMembers,
  addNotification,
  setScreenTime 
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

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

  // ===== CONVERT 24-HOUR TO 12-HOUR FORMAT =====
  const convertTo12Hour = (time24) => {
    if (!time24) return '--';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  // Get filtered screen time based on role
  const filteredScreenTime = useMemo(() => {
    let filtered = [...screenTime];

    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter(s => s.date === selectedDate);
    }

    // Filter by role
    if (isOfficer && user) {
      filtered = filtered.filter(s => s.employeeId === user.employeeId);
    } else if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      filtered = filtered.filter(s => teamIds.includes(s.employeeId) || s.employeeId === user.employeeId);
    } else if (isManager) {
      // Manager sees all
      if (selectedEmployee !== 'all') {
        filtered = filtered.filter(s => s.employeeId === selectedEmployee);
      }
    }

    // Filter by status (exceeded/normal)
    if (selectedStatus === 'exceeded') {
      filtered = filtered.filter(s => (s.totalScreenTime || 0) > (s.screenTimeLimit || 8 * 3600));
    } else if (selectedStatus === 'normal') {
      filtered = filtered.filter(s => (s.totalScreenTime || 0) <= (s.screenTimeLimit || 8 * 3600));
    }

    return filtered;
  }, [screenTime, user, isOfficer, isSupervisor, isManager, teamMembers, selectedDate, selectedEmployee, selectedStatus]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredScreenTime.length;
    const exceeded = filteredScreenTime.filter(s => (s.totalScreenTime || 0) > (s.screenTimeLimit || 8 * 3600)).length;
    const normal = filteredScreenTime.filter(s => (s.totalScreenTime || 0) <= (s.screenTimeLimit || 8 * 3600)).length;
    const totalHours = filteredScreenTime.reduce((sum, s) => sum + (s.totalScreenTime || 0), 0);
    const avgTrust = total > 0 ? Math.round(filteredScreenTime.reduce((sum, s) => sum + (s.trustScore || 0), 0) / total) : 0;
    
    return { total, exceeded, normal, totalHours, avgTrust };
  }, [filteredScreenTime]);

  // Get employee list for manager filter
  const employeeOptions = useMemo(() => {
    if (!isManager) return [];
    const unique = new Set();
    const employees = [];
    screenTime.forEach(s => {
      if (!unique.has(s.employeeId)) {
        unique.add(s.employeeId);
        employees.push({ employeeId: s.employeeId, employeeName: s.employeeName });
      }
    });
    return employees;
  }, [screenTime, isManager]);

  // ===== HANDLE SET LIMIT (OFFLINE SUPPORT) =====
  const handleSetLimit = async (screenTimeId, currentLimit) => {
    if (!isManager) return;
    if (isUpdating) return;
    
    const newLimit = window.prompt('Enter new screen time limit (hours):', currentLimit || 8);
    if (newLimit !== null) {
      const limit = parseInt(newLimit);
      if (limit >= 4 && limit <= 12) {
        setIsUpdating(true);
        try {
          const online = await checkRealInternet();
          setIsOnline(online);

          const updatedData = { 
            screenTimeLimit: limit * 3600,
            verified: true,
            verifiedBy: user.employeeId,
            synced: online ? true : false
          };

          await db.screen_time.update(screenTimeId, updatedData);
          
          // Update local state
          if (setScreenTime) {
            const updated = screenTime.map(s => 
              s.id === screenTimeId ? { ...s, ...updatedData } : s
            );
            setScreenTime(updated);
          }

          if (!online) {
            syncQueue.add({
              type: 'screen_time_update',
              id: screenTimeId,
              data: { screenTimeId, limit }
            });
            setPendingCount(syncQueue.count());
            alert(`📱 Screen time limit saved OFFLINE! Will sync when online.`);
            
            if (addNotification) {
              addNotification(
                user.id, 
                '💾 Offline Save', 
                `Screen time limit updated to ${limit}h offline. Will sync when online.`, 
                'warning'
              );
            }
          } else {
            if (addNotification) {
              addNotification(
                user.id, 
                '📱 Screen Time Limit Updated', 
                `Screen time limit updated to ${limit}h`, 
                'success'
              );
            }
            alert(`✅ Screen time limit updated to ${limit} hours!`);
          }
        } catch (error) {
          console.error('Error updating screen time limit:', error);
          alert('❌ Error updating screen time limit: ' + error.message);
        } finally {
          setIsUpdating(false);
        }
      } else {
        alert('Please enter a value between 4 and 12 hours');
      }
    }
  };

  // Format total hours
  const formatTotalHours = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="screentime-management" style={{ padding: '20px' }}>
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
          <span>📡 You are offline. Screen time limits will be saved and synced when online.</span>
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
        <div className="form-header" style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📱 Screen Time Control</h3>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              {isManager ? 'Monitor all officers work time' : 
               isSupervisor ? 'Monitor team members work time' : 
               'Your screen time'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              ⏱️ {stats.exceeded} Exceeded
            </span>
            <span className="form-badge" style={{ background: '#d1fae5', color: '#065f37', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              ✅ {stats.normal} Normal
            </span>
            <span className="form-badge" style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              📊 {stats.total} Total
            </span>
            {pendingCount > 0 && (
              <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                📡 {pendingCount} pending
              </span>
            )}
          </div>
        </div>

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
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{formatTotalHours(stats.totalHours)}</div>
              <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280' }}>Total Work Time</div>
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
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{stats.normal}</div>
              <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280' }}>Within Limit</div>
            </div>
          </div>
          <div className="stat-card" style={{ 
            borderLeftColor: '#dc2626',
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '4px solid #dc2626'
          }}>
            <div className="stat-icon" style={{ fontSize: '24px' }}>⚠️</div>
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{stats.exceeded}</div>
              <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280' }}>Exceeded Limit</div>
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

          <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
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
              <option value="all">All Status</option>
              <option value="normal">✅ Within Limit</option>
              <option value="exceeded">⚠️ Exceeded</option>
            </select>
          </div>

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
        </div>

        {/* Table */}
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Login</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logout</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Time</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Limit</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trust Score</th>
                {(isManager || isSupervisor) && <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredScreenTime.length === 0 ? (
                <tr>
                  <td colSpan={(isManager || isSupervisor) ? "9" : "8"} className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📱</div>
                    <div>No screen time records found</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {selectedDate ? `No records for ${selectedDate}` : 'Select a date to view records'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredScreenTime.map(s => {
                  const totalSecs = s.totalScreenTime || 0;
                  const formattedTime = formatTime(totalSecs);
                  const limitHours = Math.floor((s.screenTimeLimit || 8 * 3600) / 3600);
                  const isExceeded = totalSecs > (s.screenTimeLimit || 8 * 3600);
                  const loginTime12 = convertTo12Hour(s.loginTime);
                  const logoutTime12 = convertTo12Hour(s.logoutTime);
                  const isSynced = s.synced !== false;
                  
                  return (
                    <tr key={s.id} style={{ 
                      borderBottom: '1px solid #f3f4f6',
                      background: isExceeded ? '#fef2f2' : 'inherit'
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
                      <td style={{ padding: '12px 16px', color: '#4a5568' }}>{s.date}</td>
                      <td style={{ padding: '12px 16px', color: '#4a5568' }}>{loginTime12}</td>
                      <td style={{ padding: '12px 16px', color: '#4a5568' }}>{logoutTime12}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`screen-time ${isExceeded ? 'exceeded' : 'normal'}`} style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: isExceeded ? '#fee2e2' : '#d1fae5',
                          color: isExceeded ? '#991b1b' : '#065f37'
                        }}>
                          {formattedTime}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4a5568' }}>{limitHours}h</td>
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
                          <span className={`status-badge ${isExceeded ? 'exceeded' : 'offline'}`} style={{
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            background: isExceeded ? '#fee2e2' : '#f3f4f6',
                            color: isExceeded ? '#991b1b' : '#6b7280'
                          }}>
                            {isExceeded ? '⚠️ Exceeded' : '🔴 Completed'}
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
                      {(isManager || isSupervisor) && (
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            className="btn-sm btn-approve"
                            onClick={() => handleSetLimit(s.id, limitHours)}
                            disabled={isUpdating}
                            style={{
                              background: isOnline ? '#1e3a5f' : '#f59e0b',
                              color: 'white',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: isUpdating ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              opacity: 1,
                              visibility: 'visible',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isOnline ? 'Set Limit' : '📡 Offline'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
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