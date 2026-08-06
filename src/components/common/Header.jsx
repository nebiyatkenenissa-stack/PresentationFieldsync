// components/common/Header.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { db, syncQueue, checkRealInternet } from '../../services/database';
import NetworkStatus from './NetworkStatus'; // We'll keep this but we'll override its display with our own.

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
  markAllNotificationsRead,
  onProfileClick
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isOnline, setIsOnline] = useState(propIsOnline || navigator.onLine);
  const [syncing, setSyncing] = useState(propSyncing || false);
  const [pendingSync, setPendingSync] = useState(propPendingSync || 0);
  const [syncProgress, setSyncProgress] = useState(0);

  // ===== REAL NETWORK INFO =====
  const [networkInfo, setNetworkInfo] = useState({
    type: 'unknown',
    speed: '--',
    latency: '--'
  });

  useEffect(() => {
    const updateNetworkInfo = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        const type = connection.effectiveType || 'unknown'; // 'slow-2g', '2g', '3g', '4g'
        const speed = connection.downlink ? `${connection.downlink.toFixed(1)} Mbps` : '--';
        const latency = connection.rtt ? `${connection.rtt}ms` : '--';
        setNetworkInfo({ type, speed, latency });
      } else {
        // Fallback: if Network API not available, just show 'Online'
        setNetworkInfo({ type: 'online', speed: '--', latency: '--' });
      }
    };

    updateNetworkInfo();

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
      return () => connection.removeEventListener('change', updateNetworkInfo);
    }
  }, []);

  // ===== CHECK NETWORK (real internet) =====
  useEffect(() => {
    const checkNetwork = async () => {
      if (!navigator.onLine) {
        if (isOnline !== false) setIsOnline(false);
        return;
      }
      const online = await checkRealInternet();
      if (online !== isOnline) {
        setIsOnline(online);
        if (online) {
          const queueCount = syncQueue.count();
          if (queueCount > 0) {
            console.log(`📤 Back online with ${queueCount} pending items`);
            setTimeout(() => window.dispatchEvent(new CustomEvent('force-sync')), 1000);
          }
        }
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 3000);
    const handleOnline = () => checkNetwork();
    const handleOffline = () => checkNetwork();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  // ===== SYNC EVENTS =====
  useEffect(() => {
    const handleSyncStart = () => {
      setSyncing(true);
      setSyncProgress(0);
    };
    const handleSyncProgress = (event) => {
      if (event.detail) setSyncProgress(event.detail.progress || 0);
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
          const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
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
          const updated = notifications.map(n => n.userId === user?.id ? { ...n, read: true } : n);
          setNotifications(updated);
        }
      } catch (error) {
        console.error('Error marking all read:', error);
      }
    }
  };

  // Network status display helper
  const getNetworkDisplay = () => {
    if (!isOnline) return { label: 'Offline', color: '#dc2626', bg: '#fee2e2' };
    if (!navigator.connection) return { label: 'Online', color: '#065f37', bg: '#d1fae5' };
    const typeMap = {
      'slow-2g': '2G',
      '2g': '2G',
      '3g': '3G',
      '4g': '4G',
      '5g': '5G',
      'unknown': 'Online'
    };
    const type = networkInfo.type || 'unknown';
    const label = typeMap[type] || 'Online';
    const speed = networkInfo.speed !== '--' ? networkInfo.speed : '';
    const latency = networkInfo.latency !== '--' ? networkInfo.latency : '';
    return {
      label: label,
      speed: speed,
      latency: latency,
      color: '#065f37',
      bg: '#d1fae5'
    };
  };

  const netDisplay = getNetworkDisplay();

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

        {/* ===== REAL NETWORK STATUS (no click, no pending info) ===== */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: isOnline ? '#d1fae5' : '#fee2e2',
            border: isOnline ? '1px solid #0b7e4b' : '1px solid #dc2626',
            cursor: 'default',
            userSelect: 'none'
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            display: 'inline-block',
            background: isOnline ? '#0b7e4b' : '#dc2626',
            animation: isOnline ? 'none' : 'pulse 1.5s ease-in-out infinite'
          }}></span>
          <span style={{ fontWeight: '600', fontSize: '12px', color: isOnline ? '#065f37' : '#991b1b' }}>
            {isOnline ? (
              <>
                📶 {netDisplay.label}
                {netDisplay.speed && ` (${netDisplay.speed})`}
                {netDisplay.latency && ` ${netDisplay.latency}`}
              </>
            ) : (
              'Offline'
            )}
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

        {/* User Profile */}
        <div 
          onClick={onProfileClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '4px 8px 4px 4px',
            borderRadius: '50px',
            border: '1px solid #e5e7eb',
            background: 'white',
            transition: 'all 0.2s',
            userSelect: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e3a5f'
          }}>
            {user?.profilePhoto ? (
              <img 
                src={`http://localhost:5000${user.profilePhoto}`} 
                alt="Profile" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() || '👤'
            )}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>
              {user?.role?.replace('_', ' ') || ''}
            </div>
          </div>
        </div>

      </div>

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