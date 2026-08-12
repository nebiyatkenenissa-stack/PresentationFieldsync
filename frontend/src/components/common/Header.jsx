// components/common/Header.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db, syncQueue, checkRealInternet, getApiBase } from '../../services/database';
import { getProfilePhotoUrl } from '../../utils/helpers';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';

function Header({ 
  user, 
  isOnline: propIsOnline, 
  syncing: propSyncing, 
  pendingSync: propPendingSync, 
  screenTimeDisplay, 
  isIdle,
  activeTab,
  notifications,
  setNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  onProfileClick
}) {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
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
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let cancelled = false;

    const estimateGeneration = (rttMs) => {
      if (rttMs < 100) return '4g';
      if (rttMs < 300) return '3g';
      return '2g';
    };

    // Fallback when the Network Information API is not available (e.g. Safari):
    // measure real latency against the API and map it to 2G / 3G / 4G.
    const probeLatency = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const start = performance.now();
        await fetch(`${getApiBase()}/api/test`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!cancelled) {
          const rtt = Math.round(performance.now() - start);
          setNetworkInfo({ type: estimateGeneration(rtt), speed: '', latency: `${rtt}ms` });
        }
      } catch (e) {
        if (!cancelled) {
          setNetworkInfo({ type: 'unknown', speed: '', latency: '--' });
        }
      }
    };

    const updateNetworkInfo = () => {
      if (connection) {
        const type = connection.effectiveType || 'unknown'; // 'slow-2g', '2g', '3g', '4g'
        const speed = connection.downlink ? `${connection.downlink.toFixed(1)} Mbps` : '';
        const latency = connection.rtt ? `${connection.rtt}ms` : '';
        setNetworkInfo({ type, speed, latency });
      } else {
        probeLatency();
      }
    };

    updateNetworkInfo();

    const handleOnline = () => {
      if (!connection) probeLatency();
    };

    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }
    window.addEventListener('online', handleOnline);

    const fallbackInterval = setInterval(() => {
      if (!connection && navigator.onLine) probeLatency();
    }, 15000);

    return () => {
      cancelled = true;
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
      window.removeEventListener('online', handleOnline);
      clearInterval(fallbackInterval);
    };
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
      dashboard: 'dashboard',
      register: 'register',
      reports: 'reports',
      report_new: 'report_new',
      tasks: 'tasks',
      leaves: 'leaves',
      permissions: 'permissions',
      attendance: 'attendance',
      manager_attendance: 'manager_attendance',
      screentime: 'screentime',
      supervisor_reports: 'supervisor_reports',
      alerts: 'alerts',
      team: 'team',
      users: 'users',
      analytics: 'analytics',
      citizens: 'citizens',
      audit: 'audit',
      all_reports: 'all_reports',
      verification: 'verification'
    };
    const key = titles[activeTab];
    return key ? t(`header.page_titles.${key}`) : 'FieldSync';
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
    if (!isOnline) return { label: t('header.offline'), color: '#dc2626', bg: '#fee2e2' };
    const typeMap = {
      'slow-2g': '2G',
      '2g': '2G',
      '3g': '3G',
      '4g': '4G',
      '5g': '5G',
      'unknown': t('header.online')
    };
    const type = networkInfo.type || 'unknown';
    const label = typeMap[type] || t('header.online');
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
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Language Selector */}
        <LanguageSelector />
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
                <span>{t('header.notifications', { count: unreadCount })}</span>
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
                    {t('header.mark_all_read')}
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
                    📭 {t('header.no_notifications')}
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
              t('header.offline')
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
            {t('header.syncing')}
          </div>
        )}

        {/* Screen Time */}
        {user?.role === 'field_officer' && screenTimeDisplay && (
          <span style={{
            background: isIdle ? '#fef3c7' : '#d1fae5',
            color: isIdle ? '#92400e' : '#065f37',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {isIdle ? '💤' : '⏱️'} {screenTimeDisplay}
            {isIdle ? ' · ' + (t('header.idle') || 'Idle') : ''}
          </span>
        )}

        {/* User Profile (view-only chip + popover) */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowProfilePopover(v => !v)}
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
                  src={getProfilePhotoUrl(user.profilePhoto)} 
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

          {showProfilePopover && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              width: '280px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              zIndex: 1000,
              marginTop: '8px'
            }}>
              <div style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1e3a5f',
                  flexShrink: 0
                }}>
                  {user?.profilePhoto ? (
                    <img 
                      src={getProfilePhotoUrl(user.profilePhoto)} 
                      alt="Profile" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    user?.name?.charAt(0)?.toUpperCase() || '👤'
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || 'User'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {user?.role?.replace('_', ' ') || ''}
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>{t('header.employee_id') || 'Employee ID'}</span>
                  <span style={{ color: '#1e293b', fontWeight: '500' }}>{user?.employeeId || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>{t('header.email') || 'Email'}</span>
                  <span style={{ color: '#1e293b', fontWeight: '500' }}>{user?.email || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>{t('header.region') || 'Region'}</span>
                  <span style={{ color: '#1e293b', fontWeight: '500' }}>{user?.region || '—'}</span>
                </div>
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => {
                    setShowProfilePopover(false);
                    onProfileClick();
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1e3a5f',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {t('header.view_profile') || 'View / Edit Profile'}
                </button>
              </div>
            </div>
          )}
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