// components/alerts/AlertManagement.js - FULL WITH SERVER SYNC

import React, { useState, useEffect } from 'react';
import { db, checkRealInternet, syncQueue } from '../../services/database';
import { uid } from '../../utils/helpers';

const API_BASE_URL = 'http://localhost:5000/api';

function AlertManagement({ alerts, setAlerts, users, user, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [newAlert, setNewAlert] = useState({
    title: '',
    message: '',
    priority: 'medium',
    targetAll: true,
    targetEmployeeId: ''
  });

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

  const filteredAlerts = alerts || [];

  const getTargetUsers = () => {
    const targetUsers = [];
    
    if (newAlert.targetAll) {
      const fieldUsers = users.filter(u => u.role === 'field_officer' || u.role === 'supervisor');
      targetUsers.push(...fieldUsers);
    } else if (newAlert.targetEmployeeId) {
      const targetUser = users.find(u => u.employeeId === newAlert.targetEmployeeId);
      if (targetUser) targetUsers.push(targetUser);
    }
    
    const managers = users.filter(u => u.role === 'manager' && u.id !== user.id);
    targetUsers.push(...managers);
    
    const uniqueUsers = [];
    const seenIds = new Set();
    for (const u of targetUsers) {
      if (!seenIds.has(u.id)) {
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

    const online = await checkRealInternet();
    setIsOnline(online);
    setIsSubmitting(true);

    try {
      const targetUsers = getTargetUsers();
      
      const alertObj = {
        id: uid(),
        title: newAlert.title,
        message: newAlert.message,
        priority: newAlert.priority,
        type: 'emergency',
        timestamp: new Date().toISOString(),
        read: false,
        targetAll: newAlert.targetAll,
        targetEmployeeId: newAlert.targetAll ? null : newAlert.targetEmployeeId,
        sentBy: user.employeeId,
        sentByName: user.name,
        synced: false,
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
            await db.alerts.update(alertObj.id, { synced: true });
            if (setAlerts) {
              setAlerts(prev => prev.map(a => a.id === alertObj.id ? { ...a, synced: true } : a));
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

      alert(`🚨 Alert sent to ${targetUsers.length} recipient(s)!`);
      setShowModal(false);
      setNewAlert({
        title: '',
        message: '',
        priority: 'medium',
        targetAll: true,
        targetEmployeeId: ''
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

  const unreadCount = filteredAlerts.filter(a => !a.read).length;
  const pendingSyncAlerts = filteredAlerts.filter(a => !a.synced).length;

  return (
    <div className="alerts-view" style={{ padding: '20px' }}>
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
            <h3 style={{fontSize: '18px', fontWeight: '600'}}>🔔 Emergency Alerts</h3>
            <p style={{fontSize: '14px', color: '#64748b'}}>
              Send and manage emergency alerts
              {pendingSyncAlerts > 0 && ` • ${pendingSyncAlerts} pending sync`}
            </p>
          </div>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              {unreadCount} Unread
            </span>
            <button 
              onClick={() => setShowModal(true)}
              style={{
                background: '#dc2626', color: 'white', padding: '8px 16px',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', fontWeight: '500', display: 'inline-flex',
                alignItems: 'center', gap: '6px'
              }}
            >
              🚨 Send Alert {!isOnline && '📡'}
            </button>
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {filteredAlerts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div style={{fontSize: '48px', marginBottom: '8px'}}>🔔</div>
              <div>No alerts</div>
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
                  {!a.read && <span style={{ marginLeft: '8px', background: '#d97706', color: 'white', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>NEW</span>}
                  {!a.synced && <span style={{ marginLeft: '8px', background: '#f59e0b', color: 'white', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>📡</span>}
                </div>
                <div style={{color: '#374151', fontSize: '14px', marginTop: '2px'}}>{a.message}</div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span>From: {a.sentByName}</span>
                  <span>{new Date(a.timestamp).toLocaleString()}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px',
                    background: a.priority === 'high' || a.priority === 'critical' ? '#fee2e2' : a.priority === 'medium' ? '#fef3c7' : '#dbeafe',
                    color: a.priority === 'high' || a.priority === 'critical' ? '#991b1b' : a.priority === 'medium' ? '#92400e' : '#1e40af',
                    fontSize: '10px', fontWeight: '500'
                  }}>{a.priority}</span>
                </div>
              </div>
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
                🚨 Send Emergency Alert
                {!isOnline && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {!isOnline && (
              <div style={{ padding: '12px 16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', marginBottom: '16px' }}>
                <strong>📡 Offline Mode:</strong> Notifications will be sent immediately. Alert data will sync when online.
              </div>
            )}

            <form onSubmit={handleSendAlert} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{fontSize: '13px', fontWeight: '500'}}>Alert Title *</label>
                <input type="text" value={newAlert.title} onChange={e => setNewAlert({...newAlert, title: e.target.value})} placeholder="Enter alert title" required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}} />
              </div>
              <div>
                <label style={{fontSize: '13px', fontWeight: '500'}}>Message *</label>
                <textarea value={newAlert.message} onChange={e => setNewAlert({...newAlert, message: e.target.value})} placeholder="Enter alert message" rows="4" required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', minHeight: '60px', width: '100%'}} />
              </div>
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
                <div>
                  <label style={{fontSize: '13px', fontWeight: '500'}}>Target</label>
                  <select value={newAlert.targetAll} onChange={e => setNewAlert({...newAlert, targetAll: e.target.value === 'true'})} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%'}}>
                    <option value="true">All Officers</option>
                    <option value="false">Specific Officer</option>
                  </select>
                </div>
              </div>
              {!newAlert.targetAll && (
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
              <div style={{ padding: '12px', background: !isOnline ? '#fef3c7' : '#dbeafe', borderRadius: '8px', fontSize: '13px', color: !isOnline ? '#92400e' : '#1e40af' }}>
                <strong>ℹ️ {isOnline ? 'Online' : 'Offline'}:</strong>
                {isOnline ? ' Alert and notifications sent immediately.' : ' Notifications sent immediately. Alert synced when online.'}
              </div>
              <div style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button type="submit" disabled={isSubmitting} style={{
                  background: '#dc2626', color: 'white', border: 'none', padding: '10px 24px',
                  borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '14px',
                  fontWeight: '500', opacity: isSubmitting ? 0.7 : 1
                }}>
                  {isSubmitting ? 'Sending...' : (isOnline ? '🚨 Send Alert' : '💾 Save Offline')}
                </button>
                <button type="button" onClick={() => setShowModal(false)} style={{
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