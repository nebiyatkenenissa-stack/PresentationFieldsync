// components/attendance/ManagerAttendance.js – FULL FIXED (manager sees only synced records)

import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getToday } from '../../utils/helpers';
import { db, syncQueue, checkRealInternet, clearStuckSyncItems, processSyncQueue } from '../../services/database';
import useRegions from '../../hooks/useRegions';
import { buildRegionOptions, regionOfPath } from '../../utils/regions';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  // The REAL region list (Amhara, Oromia, ...) from the backend.
  const regionList = useRegions();

  // ===== CHECK ONLINE STATUS & AUTO-SYNC =====
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      
      if (online) {
        console.log('🧹 Checking for stuck sync items...');
        await clearStuckSyncItems();
        
        const count = syncQueue.count();
        setPendingCount(count);
        
        if (count > 0) {
          console.log(`🔄 Manager: Auto-syncing ${count} attendance records...`);
          setIsSyncing(true);
          setSyncError(null);
          
          try {
            const result = await processSyncQueue(true);
            console.log('✅ Sync result:', result);
            
            const updatedAttendance = await db.attendance.toArray();
            if (setAttendance) setAttendance(updatedAttendance);
            
            const remaining = syncQueue.count();
            setPendingCount(remaining);
            
            if (remaining === 0) {
              setIsSyncing(false);
              console.log('✅ All items synced successfully!');
            } else {
              console.log(`⏳ ${remaining} items remaining, will retry...`);
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('force-sync'));
              }, 5000);
            }
          } catch (error) {
            console.error('❌ Sync error:', error);
            setSyncError(error.message);
            setIsSyncing(false);
          }
        } else {
          setIsSyncing(false);
          const updatedAttendance = await db.attendance.toArray();
          if (setAttendance) setAttendance(updatedAttendance);
        }
      } else {
        setIsSyncing(false);
        const count = syncQueue.count();
        setPendingCount(count);
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 3000);

    const handleSyncComplete = async () => {
      const count = syncQueue.count();
      setPendingCount(count);
      setIsSyncing(false);
      const updatedAttendance = await db.attendance.toArray();
      if (setAttendance) setAttendance(updatedAttendance);
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleQueueUpdate = async () => {
      const count = syncQueue.count();
      setPendingCount(count);
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

  // ===== FILTER: MANAGER SEES ONLY RECORDS STORED IN POSTGRESQL (synced === true) =====
  const filteredAttendance = useMemo(() => {
    let filtered = [...attendance];
    
    // 🔒 CRITICAL: Only show records that have been successfully stored in PostgreSQL
    filtered = filtered.filter(a => a.synced === true);
    
    // Only records submitted to manager
    filtered = filtered.filter(a => a.submittedToManager === true);
    
    // Date filter
    if (selectedDate) {
      filtered = filtered.filter(a => a.date === selectedDate);
    }
    
    // Region filter (compares the real region name, not the raw path)
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(a => regionOfPath(a.region, regionList) === selectedRegion);
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
  }, [attendance, selectedDate, selectedRegion, selectedStatus, selectedSupervisor, regionList]);

  // Attendance stats
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

  // Regions come from the REAL region list (utils/regions.js).
  const regions = useMemo(
    () => buildRegionOptions(attendance.filter(a => a.submittedToManager === true).map(a => a.region), regionList),
    [attendance, regionList]
  );

  // Count offline records (waiting to sync)
  const offlineCount = useMemo(() => {
    return attendance.filter(a => a.synced === false && a.submittedToManager === true).length;
  }, [attendance]);

  // Count stuck items
  const stuckCount = useMemo(() => {
    return attendance.filter(a => a.synced === 'syncing').length;
  }, [attendance]);

  // Clear stuck items manually
  const handleClearStuck = async () => {
    try {
      const result = await clearStuckSyncItems();
      toast(t('managerattendance.cleared_stuck_toast', { clearedStore: result.clearedStore, clearedQueue: result.clearedQueue }));
      const updatedAttendance = await db.attendance.toArray();
      if (setAttendance) setAttendance(updatedAttendance);
      setPendingCount(syncQueue.count());
    } catch (error) {
      console.error('Error clearing stuck items:', error);
      toast(t('managerattendance.error_clearing_stuck', { error: error.message }));
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
            t('managerattendance.notif_seen_title'),
            t('managerattendance.notif_seen_manager_body', { name: record.employeeName, date: record.date }),
            'info',
            '/dashboard'
          );
        }
      }

      const officer = users.find(u => u.employeeId === record.employeeId);
      if (officer && addNotification) {
        await addNotification(
          officer.id,
          t('managerattendance.notif_seen_title'),
          t('managerattendance.notif_seen_officer_body', { date: record.date }),
          'info',
          '/dashboard'
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
        managerNotes: approve ? t('managerattendance.approved_by_manager') : t('managerattendance.rejected_by_manager'),
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
            approve ? t('managerattendance.notif_approved_title') : t('managerattendance.notif_rejected_title'),
            approve ? t('managerattendance.notif_approved_manager_body', { name: record.employeeName, date: record.date }) : t('managerattendance.notif_rejected_manager_body', { name: record.employeeName, date: record.date }),
            approve ? 'success' : 'error',
            '/dashboard'
          );
        }
      }

      const officer = users.find(u => u.employeeId === record.employeeId);
      if (officer && addNotification) {
        await addNotification(
          officer.id,
          approve ? t('managerattendance.notif_approved_title') : t('managerattendance.notif_rejected_title'),
          approve ? t('managerattendance.notif_approved_officer_body', { date: record.date }) : t('managerattendance.notif_rejected_officer_body', { date: record.date }),
          approve ? 'success' : 'error',
          '/dashboard'
        );
      }
      
      toast(approve ? t('managerattendance.attendance_approved_success') : t('managerattendance.attendance_rejected_success'));
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast(t('managerattendance.error_updating_attendance', { error: error.message }));
    }
  };

  const getSupervisorName = (supervisorId) => {
    const supervisor = users.find(u => u.id === supervisorId);
    return supervisor ? supervisor.name : t('supervisor.na');
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
          {isOnline ? `✅ ${t('header.online')}` : `❌ ${t('header.offline')}`}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isSyncing && (
            <span style={{ padding: '2px 12px', borderRadius: '12px', background: '#dbeafe', color: '#1e40af', fontSize: '12px', fontWeight: '500' }}>
🔄 {t('header.syncing')}
            </span>
          )}
          {stuckCount > 0 && (
            <span style={{ padding: '2px 12px', borderRadius: '12px', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: '500' }}>
              ⚠ ️ {t('managerattendance.stuck_count', { count: stuckCount })}
            </span>
          )}
          {offlineCount > 0 && (
            <span style={{ padding: '2px 12px', borderRadius: '12px', background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: '500' }}>
              📡 {t('managerattendance.waiting_to_sync', { count: offlineCount })}
            </span>
          )}
          {isOnline && pendingCount > 0 && (
            <span style={{ padding: '2px 12px', borderRadius: '12px', background: '#dbeafe', color: '#1e40af', fontSize: '12px', fontWeight: '500' }}>
              🔄 {t('managerattendance.pending_syncing', { count: pendingCount })}
            </span>
          )}
          {syncError && (
            <span style={{ padding: '2px 12px', borderRadius: '12px', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: '500' }}>
              ❌ {t('managerattendance.sync_error', { error: syncError })}
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
            📡 <strong>{t('managerattendance.waiting_for_sync_title')}</strong> {t('managerattendance.waiting_for_sync_records', { count: offlineCount })}{' '}
            {isOnline ? t('managerattendance.will_appear_auto') : t('managerattendance.will_sync_when_online')}
          </span>
          {isOnline && !isSyncing && offlineCount > 0 && (
            <span style={{ fontSize: '12px', color: '#0b7e4b' }}>⏳ {t('managerattendance.auto_sync_starting')}</span>
          )}
          {isSyncing && (
            <span style={{ fontSize: '12px', color: '#1e40af' }}>🔄 {t('header.syncing')}</span>
          )}
          {!isOnline && (
            <span style={{ fontSize: '12px', color: '#92400e' }}>⏳ {t('managerattendance.waiting_for_connection')}</span>
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
            ⚠ ️ <strong>{t('managerattendance.stuck_detected_title')}</strong> {t('managerattendance.stuck_detected_records', { count: stuckCount })}{' '}{t('managerattendance.auto_clearing_in_progress')}
          </span>
          <button onClick={handleClearStuck} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            🧹 {t('managerattendance.clear_stuck')}
          </button>
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📋 {t('managerattendance.title')}</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {t('managerattendance.hero_subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid rgba(252,211,77,0.4)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            ⏳ {t('managerattendance.pending_count', { count: attendanceStats.pendingApproval })}
          </span>
          <span style={{
            background: 'rgba(96,165,250,0.2)',
            border: '1px solid rgba(147,197,253,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            👁️ {t('managerattendance.seen_count', { count: attendanceStats.seen })}
          </span>
          <span style={{
            background: 'rgba(248,113,113,0.25)',
            border: '1px solid rgba(252,165,165,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            👁️‍🗨️ {t('managerattendance.not_seen_count', { count: attendanceStats.notSeen })}
          </span>
          {offlineCount > 0 && (
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              📡 {t('managerattendance.offline_count', { count: offlineCount })}
            </span>
          )}
          {stuckCount > 0 && (
            <span style={{
              background: 'rgba(248,113,113,0.25)',
              border: '1px solid rgba(252,165,165,0.5)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              ⚠ ️ {t('managerattendance.stuck_badge', { count: stuckCount })}
            </span>
          )}
        </div>
      </div>

      <div className="form-card" style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
        {/* Stats Cards */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px'}}>
          {[
            { label: `✅ ${t('managerattendance.status.present')}`, value: attendanceStats.present, color: '#0b7e4b' },
            { label: `⏰ ${t('managerattendance.status.late')}`, value: attendanceStats.late, color: '#d97706' },
            { label: `❌ ${t('managerattendance.status.absent')}`, value: attendanceStats.absent, color: '#dc2626' },
            { label: `📊 ${t('managerattendance.status.half_day')}`, value: attendanceStats.halfDay, color: '#6b7280' },
            { label: `⏳ ${t('managerattendance.pending')}`, value: attendanceStats.pendingApproval, color: '#f59e0b' },
            { label: `📋 ${t('managerattendance.total')}`, value: attendanceStats.total, color: '#2563eb' }
          ].map((stat, i) => (
            <div key={i} style={{borderLeft: `4px solid ${stat.color}`, padding: '12px 16px', background: '#f8fafc', borderRadius: '6px'}}>
              <div style={{fontSize: '22px', fontWeight: 'bold', color: stat.color}}>{stat.value}</div>
              <div style={{fontSize: '12px', color: '#64748b'}}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px'}}>
          <div><label style={{fontSize: '13px', fontWeight: '500'}}>{t('common.date')}</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}} />
          </div>
          <div><label style={{fontSize: '13px', fontWeight: '500'}}>{t('common.region')}</label>
            <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}}>
              <option value="all">{t('managerattendance.all_regions')}</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label style={{fontSize: '13px', fontWeight: '500'}}>{t('common.status')}</label>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}}>
              <option value="all">{t('managerattendance.all_status')}</option>
              <option value="present">{t('managerattendance.status.present')}</option>
              <option value="late">{t('managerattendance.status.late')}</option>
              <option value="absent">{t('managerattendance.status.absent')}</option>
              <option value="half_day">{t('managerattendance.status.half_day')}</option>
            </select>
          </div>
          <div><label style={{fontSize: '13px', fontWeight: '500'}}>{t('managerattendance.supervisor_label')}</label>
            <select value={selectedSupervisor} onChange={e => setSelectedSupervisor(e.target.value)} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}}>
              <option value="all">{t('managerattendance.all_supervisors')}</option>
              {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Attendance Table */}
        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
            <thead>
              <tr style={{background: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('managerattendance.employee')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('common.region')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('managerattendance.supervisor_label')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('common.date')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('common.status')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('attendance.check_in')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('attendance.check_out')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('attendance.hours_worked')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('managerattendance.submitted_by')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('managerattendance.seen')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('managerattendance.approval')}</th>
                <th style={{padding: '10px', textAlign: 'left'}}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.length === 0 ? (
                <tr><td colSpan="12" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                  <div style={{fontSize: '40px', marginBottom: '8px'}}>📋</div>
                  <div>{offlineCount > 0 ? t('managerattendance.records_waiting_to_sync', { count: offlineCount }) : t('managerattendance.no_records_submitted')}</div>
                </td></tr>
              ) : (
                filteredAttendance.map(a => (
                  <tr key={a.id} style={{borderBottom: '1px solid #e2e8f0', background: a.seenByManager ? 'white' : '#fef9e7'}}>
                    <td style={{padding: '10px'}}><strong>{a.employeeName}</strong></td>
                    <td style={{padding: '10px'}}>{a.region || t('supervisor.na')}</td>
                    <td style={{padding: '10px'}}>{getSupervisorName(a.supervisorId)}</td>
                    <td style={{padding: '10px'}}>{a.date}</td>
                    <td style={{padding: '10px'}}><span style={getStatusBadge(a.status)}>{t(`managerattendance.status.${a.status || 'not_marked'}`, { defaultValue: a.status || 'Not Marked' })}</span></td>
                    <td style={{padding: '10px'}}>{a.checkIn || '--'}</td>
                    <td style={{padding: '10px'}}>{a.checkOut || '--'}</td>
                    <td style={{padding: '10px'}}><strong>{a.workHours || 0}{t('managerattendance.hours_unit')}</strong></td>
                    <td style={{padding: '10px'}}>{a.updatedByName || a.supervisorName || t('supervisor.na')}</td>
                    <td style={{padding: '10px'}}>{a.seenByManager ? <span style={{color: '#0b7e4b'}}>✅ {t('managerattendance.seen')}</span> : <span style={{color: '#dc2626'}}>🔴 {t('managerattendance.not_seen')}</span>}</td>
                    <td style={{padding: '10px'}}>{a.approved ? <span style={{padding: '4px 12px', borderRadius: '20px', background: '#d1fae5', color: '#065f37', fontSize: '12px'}}>✅ {t('managerattendance.approved')}</span> : <span style={{padding: '4px 12px', borderRadius: '20px', background: '#fef3c7', color: '#92400e', fontSize: '12px'}}>⏳ {t('managerattendance.pending')}</span>}</td>
                    <td style={{padding: '10px'}}>
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                        {!a.seenByManager && <button onClick={() => markAsSeen(a.id)} style={{background: '#1e3a5f', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px'}}>👁️ {t('managerattendance.mark_seen')}</button>}
                        {!a.approved && <><button onClick={() => approveAttendance(a.id, true)} style={{background: '#0b7e4b', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px'}}>✅ {t('common.approve')}</button><button onClick={() => approveAttendance(a.id, false)} style={{background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px'}}>❌ {t('common.reject')}</button></>}
                        {a.approved && <span style={{padding: '4px 10px', borderRadius: '4px', fontSize: '11px', background: '#d1fae5', color: '#065f37'}}>✅ {t('managerattendance.done')}</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ManagerAttendance;

