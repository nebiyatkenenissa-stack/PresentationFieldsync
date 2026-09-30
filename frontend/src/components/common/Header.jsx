// components/common/Header.jsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import i18n from '../../utils/i18n';
import { db, syncQueue, checkRealInternet } from '../../services/database';
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
  onProfileClick,
  onLogout,
  setActiveTab
}) {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isOnline, setIsOnline] = useState(propIsOnline || navigator.onLine);
  const [syncing, setSyncing] = useState(propSyncing || false);
  const [pendingSync, setPendingSync] = useState(propPendingSync || 0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [profilePhotoFailed, setProfilePhotoFailed] = useState(false);

  const cachedPhotoUrl = user?.profilePhotoCache ? getProfilePhotoUrl(user.profilePhotoCache) : null;
  const currentPhoto = user?.profilePhoto || user?.profile_photo || null;
  const headerPhotoUrl = profilePhotoFailed && cachedPhotoUrl
    ? cachedPhotoUrl
    : (currentPhoto ? getProfilePhotoUrl(currentPhoto) : null);

  // ===== CHECK NETWORK (real internet) =====
  const isFirstNetworkCheck = useRef(true);
  useEffect(() => {
    const checkNetwork = async () => {
      let online = false;
      if (navigator.onLine) {
        online = await checkRealInternet();
      }
      if (online !== isOnline) {
        setIsOnline(online);
        if (!isFirstNetworkCheck.current) {
          if (online) {
            toast.success('🟢 Back online. Connected to the server.');
          } else {
            toast.error('🔴 Offline — server unreachable. Data will be saved locally.');
          }
        }
        if (online) {
          const queueCount = syncQueue.count();
          if (queueCount > 0) {
            console.log(`📤 Back online with ${queueCount} pending items`);
            setTimeout(() => window.dispatchEvent(new CustomEvent('force-sync')), 1000);
          }
        }
      }
      isFirstNetworkCheck.current = false;
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
      profile: 'profile',
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

  // Network status is reported via toast notifications (no inline indicator).

  // ============================================================
  // OPEN A NOTIFICATION
  //   welcome  -> stays on the current page, just the detail box
  //   anything else -> also follows the notification's page
  // ============================================================
  const NOTIFICATION_TYPES = {
    success: { icon: '✅', color: '#0b7e4b', bg: '#ecfdf5', label: 'Success' },
    error: { icon: '❌', color: '#dc2626', bg: '#fef2f2', label: 'Alert' },
    warning: { icon: '⚠️', color: '#d97706', bg: '#fffbeb', label: 'Warning' },
    info: { icon: 'ℹ️', color: '#2563eb', bg: '#eff6ff', label: 'Information' }
  };

  const LINK_TO_TAB = {
    '/dashboard': 'dashboard',
    '/profile': 'profile',
    '/register': 'register',
    '/reports': 'reports',
    '/report_new': 'report_new',
    '/tasks': 'tasks',
    '/permissions': 'permissions',
    '/screentime': 'screentime',
    '/supervisor_reports': 'supervisor_reports',
    '/team': 'team',
    '/users': 'users',
    '/analytics': 'analytics',
    '/citizens': 'citizens',
    '/audit': 'audit',
    '/all_reports': 'all_reports',
    '/alerts': 'alerts',
    '/verification': 'verification'
  };

  const TAB_ACCESS = {
    dashboard: ['manager', 'supervisor', 'field_officer'],
    profile: ['manager', 'supervisor', 'field_officer'],
    register: ['field_officer'],
    reports: ['supervisor', 'field_officer'],
    report_new: ['field_officer'],
    tasks: ['supervisor', 'field_officer'],
    permissions: ['manager', 'supervisor', 'field_officer'],
    screentime: ['supervisor'],
    supervisor_reports: ['supervisor'],
    team: ['supervisor'],
    users: ['manager'],
    analytics: ['manager'],
    citizens: ['manager'],
    audit: ['manager'],
    all_reports: ['manager'],
    alerts: ['manager', 'supervisor', 'field_officer'],
    verification: ['supervisor']
  };

  const isWelcomeNotification = (n) => /welcome/i.test(n?.title || '');

  const resolveTargetTab = (n) => {
    const tab = LINK_TO_TAB[n?.link];
    if (!tab) return null;
    const allowed = TAB_ACCESS[tab];
    if (allowed && !allowed.includes(user?.role)) return null;
    return tab;
  };

  const handleNotificationClick = async (n) => {
    await handleMarkRead(n.id);
    setShowDropdown(false);
    setSelectedNotification(n);
    if (isWelcomeNotification(n)) return;
    const tab = resolveTargetTab(n);
    if (tab) setActiveTab?.(tab);
  };

  const closeNotificationDetail = () => setSelectedNotification(null);

  const selectedType = NOTIFICATION_TYPES[selectedNotification?.type] || NOTIFICATION_TYPES.info;
  const selectedTab = isWelcomeNotification(selectedNotification) ? null : resolveTargetTab(selectedNotification);
  const selectedPageTitle = selectedTab ? t(`header.page_titles.${selectedTab}`) : null;

  const timeAgo = (ts) => {
    const then = new Date(ts).getTime();
    if (Number.isNaN(then)) return null;
    const diffSeconds = Math.round((then - Date.now()) / 1000);
    const units = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60]
    ];
    try {
      const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
      for (const [unit, seconds] of units) {
        if (Math.abs(diffSeconds) >= seconds || unit === 'minute') {
          return rtf.format(Math.round(diffSeconds / seconds), unit);
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  // Escape closes the detail box without leaving the current page.
  useEffect(() => {
    if (!selectedNotification) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedNotification(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNotification]);

  // The profile popover now carries the logout action, so dismiss it on
  // outside click or Escape instead of leaving it stuck open.
  useEffect(() => {
    if (!showProfilePopover) return;
    const onPointerDown = (e) => {
      if (
        e.target.closest('[data-profile-chip]') ||
        e.target.closest('[data-profile-popover]')
      ) return;
      setShowProfilePopover(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowProfilePopover(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showProfilePopover]);

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
                {unreadCount > 99 ? '99+' : unreadCount}
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
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      background: !n.read ? '#eff6ff' : 'white',
                      borderLeft: !n.read ? '3px solid #2563eb' : 'none',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = !n.read ? '#eff6ff' : 'white'}
                  >
                    <div style={{fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none'}}>
                      {n.read && <span style={{ color: '#065f37', fontSize: '11px' }}>✓</span>}
                      <span style={{ textDecoration: 'none', opacity: n.read ? 0.7 : 1 }}>{n.title}</span>
                    </div>
                    <div style={{fontSize: '12px', color: '#64748b', marginTop: '2px', textDecoration: 'none'}}>{n.message}</div>
                    <div style={{fontSize: '10px', color: '#9ca3af', marginTop: '4px', textDecoration: 'none'}}>
                      {new Date(n.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== REAL NETWORK STATUS: now reported via toast notifications ===== */}

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
            data-profile-chip
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
              {headerPhotoUrl ? (
                <img 
                  src={headerPhotoUrl} 
                  alt="Profile" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => { if (!profilePhotoFailed && cachedPhotoUrl) setProfilePhotoFailed(true); }}
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
            <div
              data-profile-popover
              style={{
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
                  {headerPhotoUrl ? (
                    <img 
                      src={headerPhotoUrl} 
                      alt="Profile" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => { if (!profilePhotoFailed && cachedPhotoUrl) setProfilePhotoFailed(true); }}
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

                {onLogout && (
                  <button
                    onClick={() => {
                      setShowProfilePopover(false);
                      onLogout();
                    }}
                    className="header-logout-btn"
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  >
                    🚪 {t('nav.logout') || 'Logout'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ===== NOTIFICATION DETAIL BOX (welcome stays put, others follow their page) ===== */}
      {selectedNotification && (
        <div
          className="notification-detail-overlay"
          role="presentation"
          onClick={closeNotificationDetail}
        >
          <div
            className="notification-detail-box"
            role="dialog"
            aria-modal="true"
            aria-label={selectedNotification.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-detail-head">
              <span
                className="notification-detail-type"
                style={{ background: selectedType.bg, color: selectedType.color }}
              >
                <span aria-hidden="true">{selectedType.icon}</span>
                {selectedType.label}
              </span>
              <div className="notification-detail-title">{selectedNotification.title}</div>
              <button
                className="notification-detail-close"
                onClick={closeNotificationDetail}
                aria-label={t('header.close')}
                title={t('header.close')}
              >
                ×
              </button>
            </div>

            <div className="notification-detail-body">
              <p className="notification-detail-message">
                {selectedNotification.message || selectedNotification.title}
              </p>

              <dl className="notification-detail-meta">
                <div className="notification-detail-row">
                  <dt>{t('header.notification_status')}</dt>
                  <dd className={selectedNotification.read ? 'is-read' : 'is-unread'}>
                    {selectedNotification.read
                      ? t('header.notification_read')
                      : t('header.notification_unread')}
                  </dd>
                </div>

                <div className="notification-detail-row">
                  <dt>{t('header.notification_received')}</dt>
                  <dd>{new Date(selectedNotification.timestamp).toLocaleString()}</dd>
                </div>

                {timeAgo(selectedNotification.timestamp) && (
                  <div className="notification-detail-row">
                    <dt>{t('header.notification_when')}</dt>
                    <dd>{timeAgo(selectedNotification.timestamp)}</dd>
                  </div>
                )}

                {selectedPageTitle && (
                  <div className="notification-detail-row">
                    <dt>{t('header.notification_page')}</dt>
                    <dd>{selectedPageTitle}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="notification-detail-foot">
              <button className="notification-detail-ghost" onClick={closeNotificationDetail}>
                {t('header.close')}
              </button>
              {selectedTab && (
                <button
                  className="notification-detail-action"
                  onClick={() => {
                    setActiveTab?.(selectedTab);
                    closeNotificationDetail();
                  }}
                  style={{ background: selectedType.color }}
                >
                  {t('header.notification_go_to', { page: selectedPageTitle })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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