// components/common/Header.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { db, syncQueue, checkRealInternet, isDevToolsOffline } from '../../services/database';
import NetworkStatus from './NetworkStatus';

function Header({ 
  user, 
  isOnline: propIsOnline, 
  syncing: propSyncing, 
  pendingSync: propPendingSync, 
  screenTimeDisplay, 
  activeTab,
  notifications,
  setNotifications,
  markNotificationRead,
  markAllNotificationsRead
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isOnline, setIsOnline] = useState(propIsOnline || navigator.onLine);
  const [syncing, setSyncing] = useState(propSyncing || false);
  const [pendingSync, setPendingSync] = useState(propPendingSync || 0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  // ===== CHECK NETWORK (DEVOPS FIRST) =====
  useEffect(() => {
    const checkNetwork = async () => {
      // 1. Check DevTools offline first
      if (!navigator.onLine) {
        console.log('🔌 Header: DevTools says OFFLINE');
        if (isOnline !== false) {
          setIsOnline(false);
        }
        return;
      }
      
      // 2. Then check real internet
      const online = await checkRealInternet();
      if (online !== isOnline) {
        console.log(`🔄 Header: Network changed to: ${online ? 'Online' : 'Offline'}`);
        setIsOnline(online);
        
        if (online) {
          const queueCount = syncQueue.count();
          if (queueCount > 0) {
            console.log(`📤 Back online with ${queueCount} pending items`);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('force-sync'));
            }, 1000);
          }
        }
      }
    };

    checkNetwork();
    
    // Check every 2 seconds (fast for DevTools testing)
    const interval = setInterval(checkNetwork, 2000);

    const handleOnline = () => {
      console.log('🔄 Header: Browser online event');
      checkNetwork();
    };
    
    const handleOffline = () => {
      console.log('🔄 Header: Browser offline event');
      checkNetwork();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  // ===== LISTEN FOR SYNC EVENTS =====
  useEffect(() => {
    const handleSyncStart = () => {
      setSyncing(true);
      setSyncProgress(0);
    };

    const handleSyncProgress = (event) => {
      if (event.detail) {
        setSyncProgress(event.detail.progress || 0);
      }
    };

    const handleSyncComplete = (event) => {
      setSyncing(false);
      const queueCount = syncQueue.count();
      setPendingSync(queueCount);
      
      if (event.detail && event.detail.synced > 0) {
        console.log(`✅ Sync complete: ${event.detail.synced} items synced`);
      }
    };

    const handleQueueUpdated = () => {
      const queueCount = syncQueue.count();
      setPendingSync(queueCount);
      
      db.citizens.filter(c => c.synced === false).count().then(count => {
        if (count > 0) {
          console.log(`📋 ${count} offline citizens pending sync`);
        }
      });
    };

    window.addEventListener('sync-start', handleSyncStart);
    window.addEventListener('sync-progress', handleSyncProgress);
    window.addEventListener('sync-complete', handleSyncComplete);
    window.addEventListener('sync-queue-updated', handleQueueUpdated);

    handleQueueUpdated();

    return () => {
      window.removeEventListener('sync-start', handleSyncStart);
      window.removeEventListener('sync-progress', handleSyncProgress);
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('sync-queue-updated', handleQueueUpdated);
    };
  }, []);

  useEffect(() => {
    if (propPendingSync !== undefined && propPendingSync !== pendingSync) {
      setPendingSync(propPendingSync);
    }
  }, [propPendingSync]);

  useEffect(() => {
    if (propSyncing !== undefined && propSyncing !== syncing) {
      setSyncing(propSyncing);
    }
  }, [propSyncing]);

  const userNotifications = useMemo(() => {
    if (!notifications || !user) return [];
    return notifications
      .filter(n => n.userId === user.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [notifications, user]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  const getTitle = () => {
    const titles = {
      dashboard: 'Dashboard',
      register: 'Citizen Registration',
      reports: 'Reports',
      report_new: 'New Report',
      tasks: 'Task Management',
      leaves: 'Leave Management',
      permissions: 'Permission Management',
      attendance: 'Attendance Management',
      manager_attendance: 'Manager Attendance',
      screentime: 'Screen Time Control',
      supervisor_reports: 'Supervisor Reports',
      alerts: 'Alerts',
      team: 'Team Management',
      users: 'User Management',
      analytics: 'Analytics',
      citizens: 'Citizens Database',
      audit: 'Audit Log',
      all_reports: 'All Reports'
    };
    return titles[activeTab] || 'FieldSync';
  };

  const handleMarkRead = async (id) => {
    if (markNotificationRead) {
      await markNotificationRead(id);
    } else {
      try {
        await db.notifications.update(id, { read: true });
        if (setNotifications) {
          const updated = notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
          );
          setNotifications(updated);
        }
      } catch (error) {
        console.error('Error marking notification read:', error);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (markAllNotificationsRead) {
      await markAllNotificationsRead();
    } else {
      try {
        const userNotifs = notifications.filter(n => n.userId === user?.id);
        for (const n of userNotifs) {
          await db.notifications.update(n.id, { read: true });
        }
        if (setNotifications) {
          const updated = notifications.map(n => 
            n.userId === user?.id ? { ...n, read: true } : n
          );
          setNotifications(updated);
        }
      } catch (error) {
        console.error('Error marking all read:', error);
      }
    }
  };

  const handleForceSync = async () => {
    // Check DevTools offline first
    if (!navigator.onLine) {
      alert('🔌 DevTools says you are offline! Please disable offline mode in DevTools.');
      return;
    }
    
    const online = await checkRealInternet();
    if (online) {
      const queueCount = syncQueue.count();
      if (queueCount === 0) {
        alert('✅ All data is synced! No pending items.');
        return;
      }
      alert(`🔄 Syncing ${queueCount} items...`);
      window.dispatchEvent(new CustomEvent('force-sync'));
    } else {
      alert('❌ You are offline! Please connect to the internet to sync.');
    }
  };

  const [offlineCitizenCount, setOfflineCitizenCount] = useState(0);
  
  useEffect(() => {
    const countOfflineCitizens = async () => {
      try {
        const count = await db.citizens.filter(c => c.synced === false).count();
        setOfflineCitizenCount(count);
      } catch (error) {
        console.error('Error counting offline citizens:', error);
      }
    };
    
    countOfflineCitizens();
    
    const handleQueueUpdate = () => {
      countOfflineCitizens();
    };
    
    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    window.addEventListener('sync-complete', handleQueueUpdate);
    
    return () => {
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('sync-complete', handleQueueUpdate);
    };
  }, []);

  // ===== SYNC DETAILS POPUP =====
  const SyncDetailsPopup = () => {
    if (!showSyncDetails) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: '60px',
        right: '20px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        padding: '16px 20px',
        zIndex: 1000,
        minWidth: '280px',
        maxWidth: '350px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <strong style={{ fontSize: '14px' }}>🔄 Sync Status</strong>
          <button
            onClick={() => setShowSyncDetails(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>
        
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>Status:</span>
            <span style={{ fontWeight: '500', color: isOnline ? '#065f37' : '#991b1b' }}>
              {isOnline ? '✅ Online' : '❌ Offline'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>Pending Items:</span>
            <span style={{ fontWeight: '500', color: pendingSync > 0 ? '#92400e' : '#065f37' }}>
              {pendingSync > 0 ? `${pendingSync} items` : '✅ All synced'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>Offline Citizens:</span>
            <span style={{ fontWeight: '500', color: offlineCitizenCount > 0 ? '#92400e' : '#065f37' }}>
              {offlineCitizenCount > 0 ? `${offlineCitizenCount} pending` : '✅ All synced'}
            </span>
          </div>
          {syncing && (
            <div style={{ 
              marginTop: '8px',
              padding: '8px',
              background: '#eff6ff',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#1e40af'
            }}>
              🔄 Syncing in progress... {syncProgress > 0 && `${syncProgress}%`}
            </div>
          )}
        </div>
        
        <button
          onClick={handleForceSync}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '8px',
            background: isOnline ? '#0b7e4b' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isOnline ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: '500'
          }}
          disabled={!isOnline}
        >
          {isOnline ? '🔄 Sync Now' : '📡 Offline - Cannot Sync'}
        </button>
      </div>
    );
  };

  return (
    <header className="main-header" style={{
      background: 'white',
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #e5e7eb',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexWrap: 'wrap',
      gap: '8px'
    }}>
      <div className="header-left">
        <h1 style={{fontSize: '18px', fontWeight: '600', margin: 0}}>{getTitle()}</h1>
      </div>

      <div className="header-right" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Notification Bell */}
        <div className="notification-container" style={{position: 'relative'}}>
          <button 
            className="notification-btn" 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              position: 'relative',
              padding: '4px'
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#dc2626',
                color: 'white',
                fontSize: '10px',
                fontWeight: '700',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              width: '360px',
              maxHeight: '440px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              zIndex: 1000,
              marginTop: '8px'
            }}>
              <div style={{
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                <span>Notifications ({unreadCount} unread)</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{
                maxHeight: '360px',
                overflowY: 'auto'
              }}>
                {userNotifications.length === 0 && (
                  <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '14px'
                  }}>
                    📭 No notifications
                  </div>
                )}
                {userNotifications.slice(0, 15).map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => handleMarkRead(n.id)}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      background: !n.read ? '#eff6ff' : 'white',
                      borderLeft: !n.read ? '3px solid #2563eb' : 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = !n.read ? '#eff6ff' : 'white'}
                  >
                    <div style={{fontWeight: '500', fontSize: '13px'}}>{n.title}</div>
                    <div style={{fontSize: '12px', color: '#64748b', marginTop: '2px'}}>{n.message}</div>
                    <div style={{fontSize: '10px', color: '#9ca3af', marginTop: '4px'}}>
                      {new Date(n.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== NETWORK SPEED STATUS ===== */}
        <NetworkStatus />

        {/* ===== ONLINE STATUS ===== */}
        <div 
          onClick={() => setShowSyncDetails(!showSyncDetails)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: isOnline ? '#d1fae5' : '#fee2e2',
            border: isOnline ? '1px solid #0b7e4b' : '1px solid #dc2626',
            cursor: 'pointer'
          }}
          title="Click for sync details"
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            display: 'inline-block',
            background: isOnline ? '#0b7e4b' : '#dc2626',
            animation: isOnline ? 'none' : 'pulse 1.5s ease-in-out infinite'
          }}></span>
          <span style={{ 
            fontWeight: '600', 
            fontSize: '12px',
            color: isOnline ? '#065f37' : '#991b1b'
          }}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Syncing Indicator */}
        {syncing && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#2563eb',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#2563eb',
              animation: 'pulse 0.8s ease-in-out infinite'
            }}></span>
            Syncing...
          </div>
        )}

        {/* Pending Sync Badge */}
        {pendingSync > 0 && (
          <span 
            onClick={() => setShowSyncDetails(!showSyncDetails)}
            style={{
              padding: '2px 10px',
              borderRadius: '16px',
              color: 'white',
              fontSize: '11px',
              fontWeight: '600',
              background: isOnline ? '#0b7e4b' : '#dc2626',
              cursor: 'pointer'
            }}
          >
            {isOnline ? '🔄' : '⏳'} {pendingSync}
          </span>
        )}

        {/* Offline Citizens Badge */}
        {offlineCitizenCount > 0 && (
          <span style={{
            padding: '2px 10px',
            borderRadius: '16px',
            background: '#fef3c7',
            color: '#92400e',
            fontSize: '11px',
            fontWeight: '500'
          }}>
            📋 {offlineCitizenCount} offline
          </span>
        )}

        {/* Screen Time */}
        {user?.role === 'field_officer' && screenTimeDisplay && (
          <span style={{
            background: '#d1fae5',
            color: '#065f37',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            ⏱️ {screenTimeDisplay}
          </span>
        )}

        {/* Manual Sync Button */}
        <button
          onClick={handleForceSync}
          disabled={!isOnline}
          style={{
            background: isOnline ? '#1e3a5f' : '#9ca3af',
            color: 'white',
            border: 'none',
            padding: '4px 12px',
            borderRadius: '6px',
            cursor: isOnline ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'background 0.2s',
            opacity: isOnline ? 1 : 0.6
          }}
        >
          🔄 Sync
        </button>

        {/* Clear Queue Button (Manager Only) */}
        {user?.role === 'manager' && (
          <button
            onClick={() => {
              if (window.confirm('⚠️ Clear all pending sync items? This cannot be undone.')) {
                syncQueue.clear();
                localStorage.removeItem('failedSyncItems');
                setPendingSync(0);
                alert('✅ Sync queue cleared!');
                window.location.reload();
              }
            }}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500'
            }}
          >
            🗑️ Clear Queue
          </button>
        )}
      </div>

      {/* Sync Details Popup */}
      <SyncDetailsPopup />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </header>
  );
}

export default Header;