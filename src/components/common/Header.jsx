import React, { useState, useMemo } from 'react';
import { db } from '../../services/database';

function Header({ 
  user, 
  isOnline, 
  syncing, 
  pendingSync, 
  screenTimeDisplay, 
  activeTab,
  notifications,
  setNotifications,
  markNotificationRead,
  markAllNotificationsRead
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Get user notifications
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
      // Fallback
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
      // Fallback
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

  return (
    <header className="main-header" style={{
      background: 'white',
      padding: '16px 32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #e5e7eb',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      <div className="header-left">
        <h1 style={{fontSize: '20px', fontWeight: '600', margin: 0}}>{getTitle()}</h1>
      </div>

      <div className="header-right" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
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
              fontSize: '24px',
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
                fontSize: '11px',
                fontWeight: '700',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              width: '380px',
              maxHeight: '460px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              zIndex: 1000,
              marginTop: '8px'
            }}>
              <div style={{
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: '600'
              }}>
                <span>Notifications ({unreadCount} unread)</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{
                maxHeight: '380px',
                overflowY: 'auto'
              }}>
                {userNotifications.length === 0 && (
                  <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}>
                    No notifications
                  </div>
                )}
                {userNotifications.slice(0, 15).map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => handleMarkRead(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      background: !n.read ? '#eff6ff' : 'white',
                      borderLeft: !n.read ? '3px solid #2563eb' : 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = !n.read ? '#eff6ff' : 'white'}
                  >
                    <div style={{fontWeight: '500', fontSize: '14px'}}>{n.title}</div>
                    <div style={{fontSize: '13px', color: '#64748b', marginTop: '2px'}}>{n.message}</div>
                    <div style={{fontSize: '11px', color: '#9ca3af', marginTop: '4px'}}>
                      {new Date(n.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Online Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#64748b'
        }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            display: 'inline-block',
            background: isOnline ? '#0b7e4b' : '#b45309'
          }}></span>
          <span>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
        </div>

        {/* Syncing */}
        {syncing && (
          <div style={{
            color: '#2563eb',
            fontSize: '14px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>🔄 Syncing...</div>
        )}

        {/* Pending Sync */}
        {pendingSync > 0 && (
          <span style={{
            padding: '4px 12px',
            borderRadius: '20px',
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            background: isOnline ? '#0b7e4b' : '#b45309'
          }}>
            {isOnline ? '🔄' : '⏳'} {pendingSync} pending
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
      </div>
    </header>
  );
}

export default Header;