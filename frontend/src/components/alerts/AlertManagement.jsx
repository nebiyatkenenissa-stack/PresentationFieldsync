// components/alerts/AlertManagement.js - FULL WITH SERVER SYNC

import React, { useState, useEffect, useMemo } from 'react';
import { db, checkRealInternet, syncQueue, getApiBase } from '../../services/database';
import { uid, exportCSV, getToday } from '../../utils/helpers';
import UserAvatar from '../common/UserAvatar';

const API_BASE_URL = getApiBase();

function AlertManagement({ alerts, setAlerts, users, user, isManager, isSupervisor, isOfficer, teamMembers, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('alert');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [newAlert, setNewAlert] = useState({
    title: '',
    message: '',
    priority: 'medium',
    targetAll: true,
    targetEmployeeId: '',
    recipients: []
  });

  // Deleted alert ids (persisted per device so removed inbox items stay hidden)
  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('fieldsync_deleted_alerts') || '[]');
    } catch {
      return [];
    }
  });

  const persistDeletedIds = (ids) => {
    localStorage.setItem('fieldsync_deleted_alerts', JSON.stringify(ids));
  };

  // Officers supervised by this supervisor (for supervisor target lists)
  const teamOfficers = (teamMembers && teamMembers.length > 0 ? teamMembers : users)
    .filter(u => u && u.role === 'field_officer' && u.supervisorId === user?.id);

  const myManager = (users || []).find(u => u.role === 'manager' && u.id === user?.managerId);

  // Lookup users by employee ID so we can show their profile photo next to a message.
  const userByEmpId = useMemo(() => {
    const map = {};
    (users || []).forEach(u => { if (u && u.employeeId) map[u.employeeId] = u; });
    return map;
  }, [users]);

  // Recipients a supervisor/officer may choose from (manager + their team / their supervisor + manager)
  const getRecipientOptions = () => {
    const opts = [];
    const seen = new Set();
    const add = (u) => {
      if (u && !seen.has(u.id)) {
        seen.add(u.id);
        opts.push(u);
      }
    };
    if (isOfficer) {
      add((users || []).find(u => u.id === user?.supervisorId));
      add((users || []).find(u => u.role === 'manager'));
    } else if (isSupervisor) {
      teamOfficers.forEach(add);
      add((users || []).find(u => u.role === 'manager'));
      if (myManager) add(myManager);
    }
    return opts;
  };

  const toggleRecipient = (id) => {
    setNewAlert(prev => ({
      ...prev,
      recipients: prev.recipients.includes(id)
        ? prev.recipients.filter(r => r !== id)
        : [...prev.recipients, id]
    }));
  };

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

  const filteredAlerts = (alerts || [])
    .filter(a => a.type !== 'bottleneck')
    // Messages that haven't reached the server yet stay hidden. They sync
    // automatically when internet is back and appear at that same moment.
    .filter(a => a.pending !== true)
    .filter(a => a.sentBy !== user?.employeeId)
    .filter(a => !deletedIds.includes(a.id))
    .filter(a => {
    if (isManager) {
      // Manager only sees messages addressed to them or broadcast to everyone.
      // Officer messages sent to the supervisor only stay hidden from the manager.
      const targets = a.targetUsers || [];
      const isForMe = targets.some(t => t.id === user?.id) || a.targetEmployeeId === user?.employeeId;
      const isBroadcast = a.targetAll === true;
      return isForMe || isBroadcast;
    }
    const targets = a.targetUsers || [];
    const isForMe = targets.some(t => t.id === user?.id) || a.targetEmployeeId === user?.employeeId;
    const isMine = a.sentBy === user?.employeeId;
    const managerEmployeeId = (users || []).find(u => u.role === 'manager')?.employeeId;
    if (isSupervisor) {
      const forMyTeam = targets.some(t => t.supervisorId === user?.id || teamOfficers.some(o => o.id === t.id));
      const fromMyTeamOfficer = teamOfficers.some(o => o.employeeId === a.sentBy);
      const fromManager = a.sentBy === managerEmployeeId;
      return isForMe || isMine || forMyTeam || fromMyTeamOfficer || fromManager;
    }
    if (isOfficer) {
      const mySupervisor = (users || []).find(u => u.id === user?.supervisorId);
      const fromMySupervisor = !!mySupervisor && a.sentBy === mySupervisor.employeeId;
      const fromManager = a.sentBy === managerEmployeeId;
      return isForMe || isMine || fromMySupervisor || fromManager;
    }
    return true;
  });

  const getTargetUsers = () => {
    const targetUsers = [];

    if (isOfficer) {
      // Officer message -> supervisor + manager (or the ones they picked)
      const sup = (users || []).find(u => u.id === user?.supervisorId);
      const manager = (users || []).find(u => u.role === 'manager');
      const candidates = [sup, manager].filter(Boolean);
      const selected = candidates.filter(u => newAlert.recipients.includes(u.id));
      return dedupe(selected.length > 0 ? selected : candidates);
    }

    if (isSupervisor) {
      // Supervisor message -> their team officers + the manager (or the ones they picked)
      const candidates = [];
      const seen = new Set();
      const add = (u) => {
        if (u && !seen.has(u.id)) {
          seen.add(u.id);
          candidates.push(u);
        }
      };
      teamOfficers.forEach(add);
      const manager = (users || []).find(u => u.role === 'manager');
      add(manager);
      if (myManager) add(myManager);
      const selected = candidates.filter(u => newAlert.recipients.includes(u.id));
      return dedupe(selected.length > 0 ? selected : candidates);
    }

    // Manager -> all officers + supervisors (+ other managers)
    if (newAlert.targetAll) {
      const fieldUsers = users.filter(u => u.role === 'field_officer' || u.role === 'supervisor');
      targetUsers.push(...fieldUsers);
    } else if (newAlert.targetEmployeeId) {
      const targetUser = users.find(u => u.employeeId === newAlert.targetEmployeeId);
      if (targetUser) targetUsers.push(targetUser);
    }
    const managers = users.filter(u => u.role === 'manager' && u.id !== user?.id);
    targetUsers.push(...managers);

    return dedupe(targetUsers);
  };

  const dedupe = (arr) => {
    const uniqueUsers = [];
    const seenIds = new Set();
    for (const u of arr) {
      if (u && !seenIds.has(u.id)) {
        seenIds.add(u.id);
        uniqueUsers.push(u);
      }
    }
    return uniqueUsers;
  };

  const handleSendAlert = async (e) => {
    e.preventDefault();
    
    if (!newAlert.title || !newAlert.message) {
      alert('Please fill all required fields');
      return;
    }

    const isBottleneck = modalMode === 'bottleneck';

    const online = await checkRealInternet();
    setIsOnline(online);
    setIsSubmitting(true);

    try {
      const targetUsers = getTargetUsers();
      
      const alertObj = {
        id: uid(),
        title: isBottleneck ? `🚧 Bottleneck: ${newAlert.title}` : newAlert.title,
        message: newAlert.message,
        priority: isBottleneck ? 'high' : newAlert.priority,
        type: isBottleneck ? 'bottleneck' : 'emergency',
        timestamp: new Date().toISOString(),
        read: false,
        targetAll: isManager && newAlert.targetAll,
        targetEmployeeId: (isManager && newAlert.targetAll) ? null : newAlert.targetEmployeeId,
        sentBy: user.employeeId,
        sentByName: user.name,
        sentByRole: user.role,
        synced: false,
        // True until the server confirms it. While true the message is hidden
        // from every inbox; once synced it is shown automatically.
        pending: true,
        targetUsers: targetUsers.map(u => ({
          id: u.id,
          name: u.name,
          employeeId: u.employeeId,
          role: u.role
        }))
      };

      // 1. Save alert to IndexedDB
      await db.alerts.add(alertObj);
      if (setAlerts) {
        setAlerts(prev => [alertObj, ...(prev || [])]);
      }

      // 2. Create notifications for all target users (both online and offline)
      for (const targetUser of targetUsers) {
        const notification = {
          id: uid(),
          userId: targetUser.id,
          title: `🚨 ${alertObj.title}`,
          message: alertObj.message,
          type: 'error',
          read: false,
          timestamp: new Date().toISOString(),
          link: '/alerts'
        };
        try {
          await db.notifications.add(notification);
        } catch (err) {
          console.error(`Error saving notification for ${targetUser.name}:`, err);
        }
        if (addNotification) {
          try {
            await addNotification(targetUser.id, `🚨 ${alertObj.title}`, alertObj.message, 'error', '/alerts');
          } catch (err) {
            console.error(`Error calling addNotification:`, err);
          }
        }
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notifications-updated'));
      }

      // 3. Sync to server if online, else queue
      if (online) {
        try {
          const response = await fetch(`${API_BASE_URL}/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertObj)
          });
          if (response.ok) {
            await db.alerts.update(alertObj.id, { synced: true, pending: false });
            if (setAlerts) {
              setAlerts(prev => prev.map(a => a.id === alertObj.id ? { ...a, synced: true, pending: false } : a));
            }
            console.log('✅ Alert synced to server');
          } else {
            throw new Error('Server error');
          }
        } catch (error) {
          console.error('Failed to sync alert:', error);
          syncQueue.add({
            type: 'alert',
            id: alertObj.id,
            data: alertObj
          });
          setPendingCount(syncQueue.count());
        }
      } else {
        syncQueue.add({
          type: 'alert',
          id: alertObj.id,
          data: alertObj
        });
        setPendingCount(syncQueue.count());
        console.log('📡 Alert saved offline. Notifications created locally.');
      }

      alert(`${isBottleneck ? '🚧 Bottleneck report sent to' : '✉️ Message sent to'} ${targetUsers.length} recipient(s)!`);
      setShowModal(false);
      setModalMode('alert');
      setNewAlert({
        title: '',
        message: '',
        priority: 'medium',
        targetAll: true,
        targetEmployeeId: '',
        recipients: []
      });
    } catch (error) {
      console.error('Error sending alert:', error);
      alert('❌ Error sending alert: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markAlertRead = async (alertId) => {
    try {
      const online = await checkRealInternet();
      setIsOnline(online);

      await db.alerts.update(alertId, { read: true, synced: online ? true : false });
      if (setAlerts) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
      }

      if (!online) {
        syncQueue.add({
          type: 'alert_read',
          id: alertId,
          data: { alertId, read: true }
        });
        setPendingCount(syncQueue.count());
      } else {
        // Also update server if online (PUT /api/alerts/:id)
        try {
          const response = await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true })
          });
          if (!response.ok) console.warn('Failed to update alert read status on server');
        } catch (err) {
          console.error('Error updating alert read status:', err);
        }
      }
    } catch (error) {
      console.error('Error marking alert read:', error);
    }
  };

  const markDeleted = (ids) => {
    setDeletedIds(prev => {
      const next = [...new Set([...prev, ...ids])];
      persistDeletedIds(next);
      return next;
    });
  };

  const handleDeleteAlert = async (e, alertId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this message from your inbox?')) return;
    try {
      await db.alerts.delete(alertId);
      if (setAlerts) setAlerts(prev => (prev || []).filter(a => a.id !== alertId));
      markDeleted([alertId]);
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleDeleteAllAlerts = async () => {
    if (filteredAlerts.length === 0) { alert('No messages to delete'); return; }
    if (!window.confirm(`Delete all ${filteredAlerts.length} message(s) from your inbox?`)) return;
    const ids = filteredAlerts.map(a => a.id);
    try {
      await db.alerts.bulkDelete(ids);
      if (setAlerts) setAlerts(prev => (prev || []).filter(a => !ids.includes(a.id)));
      markDeleted(ids);
    } catch (error) {
      console.error('Error deleting alerts:', error);
    }
  };

  const handleDownloadMessages = () => {
    if (filteredAlerts.length === 0) { alert('No messages to download'); return; }
    const data = filteredAlerts.map(a => ({
      Title: a.title,
      Message: a.message,
      Priority: a.priority,
      From: a.sentByName || a.sentBy,
      'Sent Date': new Date(a.timestamp).toLocaleString(),
      Read: a.read ? 'Yes' : 'No'
    }));
    exportCSV(data, `messages_${getToday()}`);
  };

  const unreadCount = filteredAlerts.filter(a => !a.read).length;
  const pendingSyncAlerts = filteredAlerts.filter(a => !a.synced).length;

  return (
    <div className="alerts-view" style={{ padding: '20px' }}>
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>✉️ Messages &amp; Alerts</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {isOfficer
              ? 'Send and receive messages with your supervisor and manager'
              : 'Send and manage messages'}
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
            📋 {filteredAlerts.length} Messages
          </span>
          <span style={{
            background: 'rgba(248,113,113,0.25)',
            border: '1px solid rgba(252,165,165,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {unreadCount} Unread
          </span>
          {pendingSyncAlerts > 0 && (
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              📡 {pendingSyncAlerts} Pending Sync
            </span>
          )}
          <button
            onClick={() => { setModalMode('alert'); setShowModal(true); }}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '24px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            ✉️ Send Message {!isOnline && '📡'}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', background: isOnline ? '#d1fae5' : '#fee2e2',
        borderRadius: '8px', marginBottom: '16px',
        border: isOnline ? '1px solid #0b7e4b' : '1px solid #dc2626',
        flexWrap: 'wrap', gap: '8px'
      }}>
        <span style={{ fontWeight: '500', color: isOnline ? '#065f37' : '#991b1b' }}>
          {isOnline ? '✅ Online' : '❌ Offline'}
        </span>
        {pendingCount > 0 && (
          <span style={{ background: '#f59e0b', color: 'white', padding: '2px 12px', borderRadius: '12px', fontSize: '12px' }}>
            ⏳ {pendingCount} pending sync
          </span>
        )}
      </div>

      {!isOnline && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', padding: '12px 16px',
          borderRadius: '8px', marginBottom: '16px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'
        }}>
          <span>📡 You are offline. Alerts will be saved locally and notifications sent immediately.</span>
        </div>
      )}

      <div style={{
        background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '24px', marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px', flexWrap: 'wrap', gap: '10px'
        }}>
          <div>
            <h3 style={{fontSize: '16px', fontWeight: '600'}}>📥 Inbox</h3>
            <p style={{fontSize: '13px', color: '#64748b'}}>
              {filteredAlerts.length} message(s) in your inbox
            </p>
          </div>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
            {(isSupervisor || isManager) && (
              <button
                onClick={handleDownloadMessages}
                style={{
                  background: '#0f766e', color: 'white', padding: '8px 16px',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '500', display: 'inline-flex',
                  alignItems: 'center', gap: '6px'
                }}
              >
                ⬇️ Download
              </button>
            )}
            {filteredAlerts.length > 0 && (
              <button
                onClick={handleDeleteAllAlerts}
                style={{
                  background: '#fee2e2', color: '#991b1b', padding: '8px 16px',
                  border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '500', display: 'inline-flex',
                  alignItems: 'center', gap: '6px'
                }}
              >
                🗑️ Delete All
              </button>
            )}
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {filteredAlerts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div style={{fontSize: '48px', marginBottom: '8px'}}>✉️</div>
              <div>No messages</div>
            </div>
          )}
          {filteredAlerts.map(a => (
            <div key={a.id} onClick={() => markAlertRead(a.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '16px 20px', cursor: 'pointer',
                background: !a.read ? '#fef3c7' : '#f8fafc',
                border: !a.read ? '2px solid #d97706' : '1px solid #e5e7eb',
                borderRadius: '8px', position: 'relative'
              }}>
              <div style={{fontSize: '24px'}}>
                {a.priority === 'high' || a.priority === 'critical' ? '🔴' : a.priority === 'medium' ? '🟡' : '🔵'}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontWeight: '600', fontSize: '15px'}}>
                  {a.title}
                  {a.type === 'bottleneck' && <span style={{ marginLeft: '8px', background: '#d97706', color: 'white', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>BOTTLENECK</span>}
                  {!a.read && <span style={{ marginLeft: '8px', background: '#d97706', color: 'white', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>NEW</span>}
                  {!a.synced && <span style={{ marginLeft: '8px', background: '#f59e0b', color: 'white', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>📡</span>}
                </div>
                <div style={{color: '#374151', fontSize: '14px', marginTop: '2px'}}>{a.message}</div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <UserAvatar user={userByEmpId[a.sentBy]} name={a.sentByName} size={20} />
                    <span>From: {a.sentByName}</span>
                  </span>
                  <span>{new Date(a.timestamp).toLocaleString()}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px',
                    background: a.priority === 'high' || a.priority === 'critical' ? '#fee2e2' : a.priority === 'medium' ? '#fef3c7' : '#dbeafe',
                    color: a.priority === 'high' || a.priority === 'critical' ? '#991b1b' : a.priority === 'medium' ? '#92400e' : '#1e40af',
                    fontSize: '10px', fontWeight: '500'
                  }}>{a.priority}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteAlert(e, a.id)}
                title="Delete message"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '16px', color: '#9ca3af', padding: '4px',
                  opacity: 0.7, lineHeight: 1
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 999
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            maxWidth: '640px', width: '95%', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>
                {modalMode === 'bottleneck' ? '🚧 Report Bottleneck' : '✉️ Send Message'}
                {!isOnline && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
              </h3>
              <button onClick={() => { setShowModal(false); setModalMode('alert'); }} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {!isOnline && (
              <div style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', marginBottom: '16px' }}>
                <strong>📡 Offline Mode:</strong> Notifications will be sent immediately. Alert data will sync when online.
              </div>
            )}

            <form onSubmit={handleSendAlert} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{fontSize: '13px', fontWeight: '500'}}>{modalMode === 'bottleneck' ? 'Problem Title *' : 'Title *'}</label>
                <input type="text" value={newAlert.title} onChange={e => setNewAlert({...newAlert, title: e.target.value})} placeholder={modalMode === 'bottleneck' ? 'e.g. Road blocked, no network, broken equipment' : 'Enter title'} required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}} />
              </div>
              <div>
                <label style={{fontSize: '13px', fontWeight: '500'}}>{modalMode === 'bottleneck' ? 'Description *' : 'Message *'}</label>
                <textarea value={newAlert.message} onChange={e => setNewAlert({...newAlert, message: e.target.value})} placeholder={modalMode === 'bottleneck' ? 'Describe the problem, where it happened, and how it is blocking your work...' : 'Enter alert message'} rows="4" required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', minHeight: '60px', width: '100%'}} />
              </div>
              {modalMode !== 'bottleneck' && (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{fontSize: '13px', fontWeight: '500'}}>Priority</label>
                  <select value={newAlert.priority} onChange={e => setNewAlert({...newAlert, priority: e.target.value})} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                {isManager ? (
                  <div>
                    <label style={{fontSize: '13px', fontWeight: '500'}}>Target</label>
                    <select value={newAlert.targetAll} onChange={e => setNewAlert({...newAlert, targetAll: e.target.value === 'true'})} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}}>
                      <option value="true">All Officers</option>
                      <option value="false">Specific Officer</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{fontSize: '13px', fontWeight: '500'}}>Recipients</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', maxHeight: '170px', overflowY: 'auto', background: 'white' }}>
                      {getRecipientOptions().map(u => (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1f2937', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={newAlert.recipients.includes(u.id)}
                            onChange={() => toggleRecipient(u.id)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          {u.name}
                          <span style={{ color: '#6b7280', fontSize: '11px' }}>({u.role === 'manager' ? 'Manager' : 'Team'})</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {newAlert.recipients.length === 0
                        ? (isSupervisor ? 'No selection – sent to your whole team + the manager' : 'No selection – sent to your supervisor + the manager')
                        : `${newAlert.recipients.length} recipient(s) selected`}
                    </div>
                  </div>
                )}
              </div>
              {isManager && !newAlert.targetAll && (
                <div>
                  <label style={{fontSize: '13px', fontWeight: '500'}}>Target Officer</label>
                  <select value={newAlert.targetEmployeeId} onChange={e => setNewAlert({...newAlert, targetEmployeeId: e.target.value})} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}}>
                    <option value="">Select Officer</option>
                    {users.filter(u => u.role === 'field_officer').map(u => (
                      <option key={u.id} value={u.employeeId}>{u.name} ({u.region})</option>
                    ))}
                  </select>
                </div>
              )}
              </>
              )}
              {modalMode === 'bottleneck' && (
                <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
                  <strong>🚧</strong> This report will be sent to your {isOfficer ? 'supervisor and the manager' : 'manager'} so the bottleneck can be resolved quickly.
                </div>
              )}
              <div style={{ padding: '12px', background: !isOnline ? '#fef3c7' : '#dbeafe', borderRadius: '8px', fontSize: '13px', color: !isOnline ? '#92400e' : '#1e40af' }}>
                <strong>ℹ️ {isOnline ? 'Online' : 'Offline'}:</strong>
                {isOnline ? ' Alert and notifications sent immediately.' : ' Notifications sent immediately. Alert synced when online.'}
              </div>
              <div style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button type="submit" disabled={isSubmitting} style={{
                  background: modalMode === 'bottleneck' ? '#d97706' : '#dc2626', color: 'white', border: 'none', padding: '10px 24px',
                  borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '14px',
                  fontWeight: '500', opacity: isSubmitting ? 0.7 : 1
                }}>
                  {isSubmitting ? 'Sending...' : (isOnline ? (modalMode === 'bottleneck' ? '🚧 Send Report' : '✉️ Send Message') : '💾 Save Offline')}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setModalMode('alert'); }} style={{
                  background: '#e5e7eb', color: '#374151', border: 'none', padding: '10px 24px',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500'
                }}>
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

export default AlertManagement;