// components/alerts/AlertManagement.js

import React, { useState, useEffect } from 'react';
import { db, checkRealInternet, syncQueue } from '../../services/database';
import { uid } from '../../utils/helpers';

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

  const filteredAlerts = alerts || [];

  // ===== SEND ALERT (OFFLINE SUPPORT) =====
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
        synced: online ? true : false
      };

      // Save to IndexedDB
      await db.alerts.add(alertObj);
      
      // Update state
      if (setAlerts) {
        setAlerts([alertObj, ...alerts]);
      }
      
      // Handle offline
      if (!online) {
        syncQueue.add({
          type: 'alert',
          id: alertObj.id,
          data: alertObj
        });
        setPendingCount(syncQueue.count());
        
        alert('📢 Alert saved OFFLINE! Will sync when online.');
        
        if (addNotification) {
          addNotification(
            user.id, 
            '💾 Offline Save', 
            `Alert "${alertObj.title}" saved offline. Will sync when online.`, 
            'warning'
          );
        }
      } else {
        // Notify target users (only when online)
        if (newAlert.targetAll) {
          users.filter(u => u.role === 'field_officer' || u.role === 'supervisor').forEach(o => {
            if (addNotification) {
              addNotification(o.id, `🚨 ${alertObj.title}`, alertObj.message, 'error');
            }
          });
        } else if (newAlert.targetEmployeeId) {
          const targetUser = users.find(u => u.employeeId === newAlert.targetEmployeeId);
          if (targetUser && addNotification) {
            addNotification(targetUser.id, `🚨 ${alertObj.title}`, alertObj.message, 'error');
          }
        }
        
        alert('🚨 Alert sent successfully!');
      }
      
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

  // ===== MARK ALERT READ (OFFLINE SUPPORT) =====
  const markAlertRead = async (alertId) => {
    try {
      const online = await checkRealInternet();
      setIsOnline(online);

      const updatedData = {
        read: true,
        synced: online ? true : false
      };

      await db.alerts.update(alertId, updatedData);
      
      if (setAlerts) {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, ...updatedData } : a));
      }

      if (!online) {
        syncQueue.add({
          type: 'alert_read',
          id: alertId,
          data: { alertId, read: true }
        });
        setPendingCount(syncQueue.count());
      }
    } catch (error) {
      console.error('Error marking alert read:', error);
    }
  };

  // ===== GET UNREAD COUNT =====
  const unreadCount = filteredAlerts.filter(a => !a.read).length;
  const pendingSyncAlerts = filteredAlerts.filter(a => !a.synced).length;

  return (
    <div className="alerts-view" style={{ padding: '20px' }}>
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
          <span>📡 You are offline. Alerts will be saved and synced when online.</span>
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
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div className="form-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h3 style={{fontSize: '18px', fontWeight: '600'}}>🔔 Emergency Alerts</h3>
            <p style={{fontSize: '14px', color: '#64748b'}}>
              Send and manage emergency alerts to field officers
              {pendingSyncAlerts > 0 && ` • ${pendingSyncAlerts} pending sync`}
            </p>
          </div>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
            <span style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {unreadCount} Unread
            </span>
            {isOnline && pendingCount > 0 && (
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
            )}
            <button 
              className="btn-primary" 
              onClick={() => setShowModal(true)}
              style={{
                background: '#dc2626',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: 1,
                visibility: 'visible'
              }}
            >
              🚨 Send Alert {!isOnline && '📡'}
            </button>
          </div>
        </div>

        <div className="alerts-list" style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {filteredAlerts.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#64748b'
            }}>
              <div style={{fontSize: '48px', marginBottom: '8px'}}>🔔</div>
              <div>No alerts</div>
            </div>
          )}
          {filteredAlerts.map(a => (
            <div 
              key={a.id} 
              onClick={() => markAlertRead(a.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px 20px',
                background: !a.read ? '#fef3c7' : '#f8fafc',
                border: !a.read ? '2px solid #d97706' : '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              <div style={{fontSize: '24px'}}>
                {a.priority === 'high' || a.priority === 'critical' ? '🔴' : 
                 a.priority === 'medium' ? '🟡' : '🔵'}
              </div>
              <div style={{flex: 1}}>
                <div style={{fontWeight: '600', fontSize: '15px'}}>
                  {a.title}
                  {!a.read && (
                    <span style={{
                      marginLeft: '8px',
                      background: '#d97706',
                      color: 'white',
                      padding: '1px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600'
                    }}>
                      NEW
                    </span>
                  )}
                  {!a.synced && (
                    <span style={{
                      marginLeft: '8px',
                      background: '#f59e0b',
                      color: 'white',
                      padding: '1px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600'
                    }}>
                      📡
                    </span>
                  )}
                </div>
                <div style={{color: '#374151', fontSize: '14px', marginTop: '2px'}}>
                  {a.message}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '4px',
                  flexWrap: 'wrap'
                }}>
                  <span>From: {a.sentByName}</span>
                  <span>{new Date(a.timestamp).toLocaleString()}</span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: a.priority === 'high' || a.priority === 'critical' ? '#fee2e2' : 
                               a.priority === 'medium' ? '#fef3c7' : '#dbeafe',
                    color: a.priority === 'high' || a.priority === 'critical' ? '#991b1b' : 
                           a.priority === 'medium' ? '#92400e' : '#1e40af',
                    fontSize: '10px',
                    fontWeight: '500'
                  }}>
                    {a.priority}
                  </span>
                  {!a.synced && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#fef3c7',
                      color: '#92400e',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}>
                      📡 Pending Sync
                    </span>
                  )}
                </div>
              </div>
              {!a.read && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#d97706'
                }}></div>
              )}
            </div>
          ))}
        </div>

        {/* Footer with pending count */}
        {pendingCount > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: '#fef3c7',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#92400e'
          }}>
            <span>⏳ {pendingCount} alert(s) pending sync</span>
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

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '640px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'slideUp 0.3s ease'
          }}>
            <div className="modal-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>
                🚨 Send Emergency Alert
                {!isOnline && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)} style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#64748b'
              }}>✕</button>
            </div>

            {/* Offline Warning in Modal */}
            {!isOnline && (
              <div style={{
                padding: '12px 16px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <strong>📡 Offline Mode:</strong> Alert will be saved locally and synced automatically when online.
                {pendingCount > 0 && (
                  <span style={{ marginLeft: '8px' }}>
                    ({pendingCount} pending sync)
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleSendAlert} className="modal-form" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Alert Title *</label>
                <input 
                  type="text" 
                  value={newAlert.title} 
                  onChange={e => setNewAlert({...newAlert, title: e.target.value})}
                  placeholder="Enter alert title" 
                  required
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Message *</label>
                <textarea 
                  value={newAlert.message} 
                  onChange={e => setNewAlert({...newAlert, message: e.target.value})}
                  placeholder="Enter alert message" 
                  rows="4"
                  required
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', minHeight: '60px'}}
                />
              </div>
              <div className="form-row" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px'
              }}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Priority</label>
                  <select 
                    value={newAlert.priority} 
                    onChange={e => setNewAlert({...newAlert, priority: e.target.value})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Target</label>
                  <select 
                    value={newAlert.targetAll} 
                    onChange={e => setNewAlert({...newAlert, targetAll: e.target.value === 'true'})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  >
                    <option value="true">All Officers</option>
                    <option value="false">Specific Officer</option>
                  </select>
                </div>
              </div>
              {!newAlert.targetAll && (
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Target Officer</label>
                  <select 
                    value={newAlert.targetEmployeeId} 
                    onChange={e => setNewAlert({...newAlert, targetEmployeeId: e.target.value})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  >
                    <option value="">Select Officer</option>
                    {users.filter(u => u.role === 'field_officer').map(u => (
                      <option key={u.id} value={u.employeeId}>{u.name} ({u.region})</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{
                padding: '12px',
                background: !isOnline ? '#fef3c7' : '#dbeafe',
                borderRadius: '8px',
                fontSize: '13px',
                color: !isOnline ? '#92400e' : '#1e40af'
              }}>
                <strong>ℹ️ {isOnline ? 'Online' : 'Offline'}:</strong>
                {isOnline 
                  ? ' This alert will be sent immediately to all recipients.' 
                  : ' This alert will be saved offline and synced when online.'}
              </div>
              <div className="modal-actions" style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button 
                  type="submit" 
                  className="btn-submit btn-danger" 
                  disabled={isSubmitting}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: isSubmitting ? 0.7 : 1,
                    visibility: 'visible',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSubmitting ? 'Sending...' : (isOnline ? '🚨 Send Alert' : '💾 Save Offline')}
                </button>
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowModal(false)}
                  style={{
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'inline-flex'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default AlertManagement;