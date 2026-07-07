// components/attendance/ManagerAttendance.js

import React, { useState, useMemo, useEffect } from 'react';
import { getToday } from '../../utils/helpers';
import { db, syncQueue, checkRealInternet, isDevToolsOffline, clearStuckSyncItems, processSyncQueue } from '../../services/database';

function ManagerAttendance({ 
  attendance, 
  users, 
  setAttendance, 
  addNotification 
}) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // ===== CHECK ONLINE STATUS & AUTO-SYNC =====
  useEffect(() => {
    const checkNetwork = async () => {
      // Check DevTools offline first
      if (isDevToolsOffline()) {
        setIsOnline(false);
        return;
      }
      
      const online = await checkRealInternet();
      setIsOnline(online);
      
      if (online) {
        // FIRST: Clear any stuck sync items
        console.log('🧹 Checking for stuck sync items...');
        await clearStuckSyncItems();
        
        // SECOND: Get pending count
        const count = syncQueue.count();
        setPendingCount(count);
        
        // THIRD: If there are pending items, process them
        if (count > 0) {
          console.log(`🔄 Manager: Auto-syncing ${count} attendance records...`);
          setIsSyncing(true);
          setSyncError(null);
          
          try {
            // Process the sync queue directly
            const result = await processSyncQueue(true);
            console.log('✅ Sync result:', result);
            
            if (result.synced > 0 || result.failed > 0) {
              // Refresh attendance data
              const updatedAttendance = await db.attendance.toArray();
              if (setAttendance) {
                setAttendance(updatedAttendance);
              }
              
              // Check if any items are still pending
              const remaining = syncQueue.count();
              setPendingCount(remaining);
              
              if (remaining === 0) {
                setIsSyncing(false);
                console.log('✅ All items synced successfully!');
              } else {
                console.log(`⏳ ${remaining} items remaining, will retry...`);
                // Try again after a delay
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('force-sync'));
                }, 5000);
              }
            }
          } catch (error) {
            console.error('❌ Sync error:', error);
            setSyncError(error.message);
            setIsSyncing(false);
          }
        } else {
          setIsSyncing(false);
          // Refresh attendance data to show new records
          const updatedAttendance = await db.attendance.toArray();
          if (setAttendance) {
            setAttendance(updatedAttendance);
          }
        }
      } else {
        setIsSyncing(false);
        // Just update pending count
        const count = syncQueue.count();
        setPendingCount(count);
      }
    };

    // Initial check
    checkNetwork();
    
    // Check every 3 seconds
    const interval = setInterval(checkNetwork, 3000);

    // Listen for sync events
    const handleSyncComplete = async () => {
      const count = syncQueue.count();
      setPendingCount(count);
      setIsSyncing(false);
      
      // Refresh attendance data
      const updatedAttendance = await db.attendance.toArray();
      if (setAttendance) setAttendance(updatedAttendance);
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleQueueUpdate = async () => {
      const count = syncQueue.count();
      setPendingCount(count);
      
      // If queue is empty, refresh data
      if (count === 0) {
        const updatedAttendance = await db.attendance.toArray();
        if (setAttendance) setAttendance(updatedAttendance);
        setIsSyncing(false);
      }
    };

    window.addEventListener('sync-complete', handleSyncComplete);
    window.addEventListener('sync-start', handleSyncStart);
    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    window.addEventListener('force-sync', checkNetwork);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('sync-start', handleSyncStart);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('force-sync', checkNetwork);
    };
  }, [setAttendance]);

  // Get all supervisors
  const supervisors = useMemo(() => {
    return users.filter(u => u.role === 'supervisor');
  }, [users]);

  // ⚠️ CRITICAL: Filter attendance - ONLY show SYNCED records (synced === true)
  const filteredAttendance = useMemo(() => {
    let filtered = [...attendance];
    
    // ⚠️ CRITICAL: ONLY SHOW SYNCED RECORDS
    filtered = filtered.filter(a => a.synced === true);
    
    // Only show records submitted to manager
    filtered = filtered.filter(a => a.submittedToManager === true);
    
    // Date filter
    if (selectedDate) {
      filtered = filtered.filter(a => a.date === selectedDate);
    }
    
    // Region filter
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(a => a.region === selectedRegion);
    }
    
    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(a => a.status === selectedStatus);
    }

    // Supervisor filter
    if (selectedSupervisor !== 'all') {
      filtered = filtered.filter(a => a.supervisorId === selectedSupervisor);
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return filtered;
  }, [attendance, selectedDate, selectedRegion, selectedStatus, selectedSupervisor]);

  // Attendance stats - only from synced records
  const attendanceStats = useMemo(() => {
    const total = filteredAttendance.length;
    const present = filteredAttendance.filter(a => a.status === 'present').length;
    const late = filteredAttendance.filter(a => a.status === 'late').length;
    const absent = filteredAttendance.filter(a => a.status === 'absent').length;
    const halfDay = filteredAttendance.filter(a => a.status === 'half_day').length;
    const pendingApproval = filteredAttendance.filter(a => a.approved === false || a.approved === undefined).length;
    const seen = filteredAttendance.filter(a => a.seenByManager === true).length;
    const notSeen = filteredAttendance.filter(a => a.seenByManager !== true).length;
    
    return {
      total,
      present,
      late,
      absent,
      halfDay,
      pendingApproval,
      seen,
      notSeen,
      rate: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [filteredAttendance]);

  // Regions from synced records only
  const regions = useMemo(() => {
    const unique = new Set(
      attendance
        .filter(a => a.synced === true && a.submittedToManager)
        .map(a => a.region)
        .filter(Boolean)
    );
    return ['all', ...unique];
  }, [attendance]);

  // Count offline records (waiting to sync)
  const offlineCount = useMemo(() => {
    return attendance.filter(a => a.synced === false).length;
  }, [attendance]);

  // Count stuck items
  const stuckCount = useMemo(() => {
    return attendance.filter(a => a.synced === 'syncing').length;
  }, [attendance]);

  // Clear stuck items manually
  const handleClearStuck = async () => {
    try {
      const result = await clearStuckSyncItems();
      alert(`🧹 Cleared ${result.clearedStore} stuck records and ${result.clearedQueue} stuck queue items`);
      
      // Refresh data
      const updatedAttendance = await db.attendance.toArray();
      if (setAttendance) setAttendance(updatedAttendance);
      setPendingCount(syncQueue.count());
    } catch (error) {
      console.error('Error clearing stuck items:', error);
      alert('Error clearing stuck items: ' + error.message);
    }
  };

  // Mark attendance as seen by manager
  const markAsSeen = async (id) => {
    try {
      const record = attendance.find(a => a.id === id);
      if (!record || record.seenByManager) return;

      const updatedRecord = {
        ...record,
        seenByManager: true,
        seenAt: new Date().toISOString(),
        seenBy: 'manager'
      };

      await db.attendance.update(id, updatedRecord);
      setAttendance(prev => prev.map(a => a.id === id ? updatedRecord : a));

      if (record.supervisorId && addNotification) {
        const supervisor = users.find(u => u.id === record.supervisorId);
        if (supervisor) {
          await addNotification(
            supervisor.id,
            '👁️ Attendance Seen by Manager',
            `Manager has reviewed attendance for ${record.employeeName} on ${record.date}`,
            'info'
          );
        }
      }

      const officer = users.find(u => u.employeeId === record.employeeId);
      if (officer && addNotification) {
        await addNotification(
          officer.id,
          '👁️ Attendance Seen by Manager',
          `Manager has reviewed your attendance for ${record.date}`,
          'info'
        );
      }

    } catch (error) {
      console.error('Error marking as seen:', error);
    }
  };

  // Approve attendance
  const approveAttendance = async (id, approve) => {
    try {
      const record = attendance.find(a => a.id === id);
      if (!record) return;

      const updatedRecord = {
        ...record,
        approved: approve,
        approvedBy: 'manager',
        approvedAt: new Date().toISOString(),
        managerNotes: approve ? 'Approved by Manager' : 'Rejected by Manager',
        seenByManager: true,
        seenAt: new Date().toISOString()
      };

      await db.attendance.update(id, updatedRecord);
      setAttendance(prev => prev.map(a => a.id === id ? updatedRecord : a));
      
      if (record.supervisorId && addNotification) {
        const supervisor = users.find(u => u.id === record.supervisorId);
        if (supervisor) {
          await addNotification(
            supervisor.id,
            approve ? '✅ Attendance Approved' : '❌ Attendance Rejected',
            `Manager has ${approve ? 'approved' : 'rejected'} attendance for ${record.employeeName} on ${record.date}`,
            approve ? 'success' : 'error'
          );
        }
      }

      const officer = users.find(u => u.employeeId === record.employeeId);
      if (officer && addNotification) {
        await addNotification(
          officer.id,
          approve ? '✅ Attendance Approved' : '❌ Attendance Rejected',
          `Your attendance on ${record.date} has been ${approve ? 'approved ✅' : 'rejected ❌'} by Manager`,
          approve ? 'success' : 'error'
        );
      }
      
      alert(`Attendance ${approve ? 'approved' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Error updating attendance: ' + error.message);
    }
  };

  const getSupervisorName = (supervisorId) => {
    const supervisor = users.find(u => u.id === supervisorId);
    return supervisor ? supervisor.name : 'N/A';
  };

  const getStatusBadge = (status) => {
    const styles = {
      present: { background: '#d1fae5', color: '#065f37' },
      late: { background: '#fef3c7', color: '#92400e' },
      absent: { background: '#fee2e2', color: '#991b1b' },
      half_day: { background: '#fde68a', color: '#78350f' },
      pending: { background: '#e5e7eb', color: '#374151' }
    };
    const style = styles[status] || styles.pending;
    return { ...style, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' };
  };

  return (
    <div className="attendance-management" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isSyncing && (
            <span style={{
              padding: '2px 12px',
              borderRadius: '12px',
              background: '#dbeafe',
              color: '#1e40af',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              🔄 Syncing...
            </span>
          )}
          {stuckCount > 0 && (
            <span style={{
              padding: '2px 12px',
              borderRadius: '12px',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              ⚠️ {stuckCount} stuck
            </span>
          )}
          {offlineCount > 0 && (
            <span style={{
              padding: '2px 12px',
              borderRadius: '12px',
              background: '#fef3c7',
              color: '#92400e',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              📡 {offlineCount} waiting to sync
            </span>
          )}
          {isOnline && pendingCount > 0 && (
            <span style={{
              padding: '2px 12px',
              borderRadius: '12px',
              background: '#dbeafe',
              color: '#1e40af',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              🔄 {pendingCount} syncing...
            </span>
          )}
          {syncError && (
            <span style={{
              padding: '2px 12px',
              borderRadius: '12px',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              ❌ {syncError}
            </span>
          )}
        </div>
      </div>

      {/* ===== OFFLINE BANNER ===== */}
      {offlineCount > 0 && (
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
          <span>
            📡 <strong>Auto-sync in progress:</strong> {offlineCount} attendance record(s) waiting to sync. 
            {isOnline ? ' Will appear automatically when sync completes.' : ' Will sync when internet is back.'}
          </span>
          {isOnline && !isSyncing && offlineCount > 0 && (
            <span style={{ fontSize: '12px', color: '#0b7e4b' }}>
              ⏳ Auto-sync starting...
            </span>
          )}
          {isSyncing && (
            <span style={{ fontSize: '12px', color: '#1e40af' }}>
              🔄 Syncing...
            </span>
          )}
          {!isOnline && (
            <span style={{ fontSize: '12px', color: '#92400e' }}>
              ⏳ Waiting for connection...
            </span>
          )}
        </div>
      )}

      {/* ===== STUCK SYNC BANNER ===== */}
      {stuckCount > 0 && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #dc2626',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span>
            ⚠️ <strong>Stuck sync detected:</strong> {stuckCount} record(s) are stuck in 'syncing' state.
            Auto-clearing in progress...
          </span>
          <button
            onClick={handleClearStuck}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🧹 Clear Stuck
          </button>
        </div>
      )}

      <div className="form-card" style={{
        background: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <div className="form-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#1a202c' }}>📋 Manager Attendance Review</h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
              Review attendance submitted by supervisors
              {filteredAttendance.length > 0 && ` • ${filteredAttendance.length} synced records`}
              {offlineCount > 0 && ` • ${offlineCount} offline`}
              {isSyncing && ' • 🔄 Syncing...'}
              {stuckCount > 0 && ` • ⚠️ ${stuckCount} stuck`}
            </p>
          </div>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            <span className="form-badge" style={{background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
              ⏳ {attendanceStats.pendingApproval} Pending Approval
            </span>
            <span className="form-badge" style={{background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
              👁️ {attendanceStats.seen} Seen
            </span>
            <span className="form-badge" style={{background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
              👁️‍🗨️ {attendanceStats.notSeen} Not Seen
            </span>
            {offlineCount > 0 && (
              <span className="form-badge" style={{background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
                📡 {offlineCount} Offline
              </span>
            )}
            {stuckCount > 0 && (
              <span className="form-badge" style={{background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
                ⚠️ {stuckCount} Stuck
              </span>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="attendance-stats" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px'}}>
          <div className="stat-card" style={{borderLeft: '4px solid #0b7e4b', padding: '12px 16px', background: '#f8fafc', borderRadius: '6px'}}>
            <div className="stat-value" style={{fontSize: '22px', fontWeight: 'bold', color: '#0b7e4b'}}>{attendanceStats.present}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>✅ Present</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #d97706', padding: '12px 16px', background: '#f8fafc', borderRadius: '6px'}}>
            <div className="stat-value" style={{fontSize: '22px', fontWeight: 'bold', color: '#d97706'}}>{attendanceStats.late}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>⏰ Late</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #dc2626', padding: '12px 16px', background: '#f8fafc', borderRadius: '6px'}}>
            <div className="stat-value" style={{fontSize: '22px', fontWeight: 'bold', color: '#dc2626'}}>{attendanceStats.absent}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>❌ Absent</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #6b7280', padding: '12px 16px', background: '#f8fafc', borderRadius: '6px'}}>
            <div className="stat-value" style={{fontSize: '22px', fontWeight: 'bold', color: '#6b7280'}}>{attendanceStats.halfDay}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>📊 Half Day</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #f59e0b', padding: '12px 16px', background: '#f8fafc', borderRadius: '6px'}}>
            <div className="stat-value" style={{fontSize: '22px', fontWeight: 'bold', color: '#f59e0b'}}>{attendanceStats.pendingApproval}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>⏳ Pending</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #2563eb', padding: '12px 16px', background: '#f8fafc', borderRadius: '6px'}}>
            <div className="stat-value" style={{fontSize: '22px', fontWeight: 'bold', color: '#2563eb'}}>{attendanceStats.total}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>📋 Total</div>
          </div>
        </div>

        {/* Filters */}
        <div className="attendance-filters" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px'}}>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Date</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            />
          </div>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Region</label>
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            >
              {regions.map(r => (
                <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
              ))}
            </select>
          </div>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Status</label>
            <select 
              value={selectedStatus} 
              onChange={e => setSelectedStatus(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Supervisor</label>
            <select 
              value={selectedSupervisor} 
              onChange={e => setSelectedSupervisor(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            >
              <option value="all">All Supervisors</option>
              {supervisors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="table-wrapper" style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
            <thead>
              <tr style={{background: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Employee</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Region</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Supervisor</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Date</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Status</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Check In</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Check Out</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Hours</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Submitted By</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Seen Status</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Approval Status</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan="12" className="empty-state" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                    <div className="empty-icon" style={{fontSize: '40px', marginBottom: '8px'}}>📋</div>
                    <div>
                      {offlineCount > 0 
                        ? `${offlineCount} attendance record(s) waiting to sync. They will appear automatically when synced.`
                        : 'No attendance records submitted by supervisors'}
                    </div>
                    {offlineCount > 0 && isOnline && (
                      <div style={{ fontSize: '13px', color: '#0b7e4b', marginTop: '8px' }}>
                        🔄 Auto-sync in progress...
                      </div>
                    )}
                    {offlineCount > 0 && !isOnline && (
                      <div style={{ fontSize: '13px', color: '#92400e', marginTop: '8px' }}>
                        ⏳ Waiting for internet connection...
                      </div>
                    )}
                    {stuckCount > 0 && (
                      <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '8px' }}>
                        ⚠️ {stuckCount} record(s) stuck. Auto-clearing...
                      </div>
                    )}
                  </td>
                </tr>
              )}
              {filteredAttendance.map(a => (
                <tr key={a.id} style={{
                  borderBottom: '1px solid #e2e8f0',
                  background: a.seenByManager ? 'white' : '#fef9e7'
                }}>
                  <td style={{padding: '10px'}}><strong>{a.employeeName}</strong></td>
                  <td style={{padding: '10px'}}>{a.region || 'N/A'}</td>
                  <td style={{padding: '10px'}}>{getSupervisorName(a.supervisorId)}</td>
                  <td style={{padding: '10px'}}>{a.date}</td>
                  <td style={{padding: '10px'}}>
                    <span style={getStatusBadge(a.status)}>
                      {a.status || 'Not Marked'}
                    </span>
                  </td>
                  <td style={{padding: '10px'}}>{a.checkIn || '--'}</td>
                  <td style={{padding: '10px'}}>{a.checkOut || '--'}</td>
                  <td style={{padding: '10px'}}><strong>{a.workHours || 0}h</strong></td>
                  <td style={{padding: '10px'}}>{a.updatedByName || a.supervisorName || 'N/A'}</td>
                  <td style={{padding: '10px'}}>
                    {a.seenByManager ? (
                      <span style={{color: '#0b7e4b', fontSize: '14px', fontWeight: '600'}}>✅ Seen</span>
                    ) : (
                      <span style={{color: '#dc2626', fontSize: '14px', fontWeight: '600'}}>🔴 Not Seen</span>
                    )}
                  </td>
                  <td style={{padding: '10px'}}>
                    {a.approved ? (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#d1fae5',
                        color: '#065f37'
                      }}>✅ Approved</span>
                    ) : (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#fef3c7',
                        color: '#92400e'
                      }}>⏳ Pending</span>
                    )}
                  </td>
                  <td style={{padding: '10px'}}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                      {!a.seenByManager && (
                        <button 
                          className="btn-sm btn-seen"
                          onClick={() => markAsSeen(a.id)}
                          style={{
                            background: '#1e3a5f',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          👁️ Mark Seen
                        </button>
                      )}
                      {!a.approved && (
                        <>
                          <button 
                            className="btn-sm btn-approve"
                            onClick={() => approveAttendance(a.id, true)}
                            style={{
                              background: '#0b7e4b',
                              color: 'white',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button 
                            className="btn-sm btn-reject"
                            onClick={() => approveAttendance(a.id, false)}
                            style={{
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}
                      {a.approved && (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: '#d1fae5',
                          color: '#065f37',
                          fontWeight: '500'
                        }}>
                          ✅ Done
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ManagerAttendance;