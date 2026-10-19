// components/notifications/NotificationPage.js
// Full notification center for every role. Notifications are grouped by the
// "task" they belong to (tasks, reports, leaves, permissions, citizens,
// verification, messages, account, system) so each user only sees what is
// relevant to their work, plus unread/read/all divisions.

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const TYPE_META = {
  info:    { icon: 'ℹ️', bg: '#dbeafe', color: '#1e40af' },
  success: { icon: '✅', bg: '#d1fae5', color: '#065f37' },
  warning: { icon: '⚠️', bg: '#fef3c7', color: '#92400e' },
  error:   { icon: '🔴', bg: '#fee2e2', color: '#991b1b' }
};

// Map the notification `link` back to the feature (task) it belongs to.
const TASK_META = {
  tasks:              { label: 'Tasks',        icon: '✅' },
  reports:            { label: 'Reports',      icon: '📋' },
  all_reports:        { label: 'Reports',      icon: '📚' },
  supervisor_reports: { label: 'Reports',      icon: '📑' },
  leaves:             { label: 'Leaves',       icon: '📅' },
  permissions:        { label: 'Permissions',  icon: '📋' },
  citizens:           { label: 'Citizens',     icon: '🆔' },
  verification:       { label: 'Verification', icon: '🔍' },
  alerts:             { label: 'Messages',     icon: '✉️' },
  messages:           { label: 'Messages',     icon: '✉️' },
  users:              { label: 'Users',        icon: '👥' },
  profile:            { label: 'Account',      icon: '👤' },
  dashboard:          { label: 'Dashboard',    icon: '📊' },
  system:             { label: 'System',       icon: '⚙️' }
};

const TASK_ORDER = [
  'tasks', 'reports', 'leaves', 'permissions', 'citizens',
  'verification', 'alerts', 'users', 'profile', 'dashboard', 'system'
];

const getTaskKey = (n) => {
  const raw = String(n?.link || '/dashboard').replace(/^\//, '').split('?')[0];
  return TASK_META[raw] ? raw : 'system';
};

function NotificationPage({
  notifications,
  user,
  markNotificationRead,
  markAllNotificationsRead,
  setActiveTab
}) {
  const { t } = useTranslation();
  // Division: all | unread | read
  const [division, setDivision] = useState('all');
  // Task filter: all | <taskKey>
  const [taskFilter, setTaskFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const myNotifications = useMemo(() => {
    if (!user) return [];
    return (notifications || [])
      .filter(n => n && n.userId === user.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [notifications, user]);

  const byTask = useMemo(() => {
    const map = {};
    for (const n of myNotifications) {
      const key = getTaskKey(n);
      if (!map[key]) map[key] = [];
      map[key].push(n);
    }
    return map;
  }, [myNotifications]);

  const unreadCount = myNotifications.filter(n => !n.read).length;
  const readCount = myNotifications.filter(n => n.read).length;

  const taskKeys = useMemo(
    () => TASK_ORDER.filter(k => byTask[k] && byTask[k].length > 0),
    [byTask]
  );

  const displayed = useMemo(() => {
    let list = taskFilter === 'all' ? myNotifications : (byTask[taskFilter] || []);
    if (division === 'unread') list = list.filter(n => !n.read);
    if (division === 'read') list = list.filter(n => n.read);
    return list;
  }, [myNotifications, byTask, taskFilter, division]);

  const tabBtn = (id, label, activeBg, count) => (
    <button
      key={id}
      onClick={() => setDivision(id)}
      style={{
        padding: '8px 16px',
        border: 'none',
        background: division === id ? activeBg : '#f3f4f6',
        color: division === id ? 'white' : '#374151',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: division === id ? '600' : '400',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px'
      }}
    >
      {label} ({count})
    </button>
  );

  const handleOpen = (n) => {
    if (!n.read && markNotificationRead) markNotificationRead(n.id);
    setSelected(n);
  };

  const handleNavigate = (n) => {
    if (!setActiveTab) return;
    const raw = String(n?.link || '/dashboard').replace(/^\//, '').split('?')[0];
    setActiveTab(TASK_META[raw] ? raw : 'dashboard');
  };

  const handleMarkAllRead = async () => {
    if (!markAllNotificationsRead) return;
    await markAllNotificationsRead();
    toast.success(t('notifications.marked_all_read', { defaultValue: 'All notifications marked as read' }));
  };

  const typeMeta = (n) => TYPE_META[n?.type] || TYPE_META.info;

  return (
    <div className="notification-page" style={{ padding: '20px' }}>
      {/* ===== HERO HEADER ===== */}
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>
            {t('notifications.title', { defaultValue: 'Notifications' })}
          </h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '560px' }}>
            {t('notifications.subtitle', { defaultValue: 'Everything that needs your attention, grouped by your tasks.' })}
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
            {t('notifications.total', { defaultValue: 'Total' })}: {myNotifications.length}
          </span>
          <span style={{
            background: 'rgba(248,113,113,0.25)',
            border: '1px solid rgba(252,165,165,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {t('notifications.unread', { defaultValue: 'Unread' })}: {unreadCount}
          </span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                background: 'rgba(96,165,250,0.25)',
                border: '1px solid rgba(147,197,253,0.5)',
                color: 'white',
                padding: '7px 14px',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              {t('notifications.mark_all_read', { defaultValue: 'Mark all read' })}
            </button>
          )}
        </div>
      </div>

      {/* ===== DIVISION TABS ===== */}
      <div style={{
        background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '16px 20px', marginBottom: '16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {tabBtn('all', t('notifications.tab_all', { defaultValue: 'All' }), '#1e3a5f', myNotifications.length)}
          {tabBtn('unread', t('notifications.tab_unread', { defaultValue: 'Unread' }), '#d97706', unreadCount)}
          {tabBtn('read', t('notifications.tab_read', { defaultValue: 'Read' }), '#0b7e4b', readCount)}
        </div>
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          {t('notifications.showing', { defaultValue: 'Showing' })} {displayed.length} {t('notifications.items', { defaultValue: 'items' })}
        </span>
      </div>

      {/* ===== TASK FILTER CHIPS ===== */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px',
        padding: '0 4px'
      }}>
        <button
          onClick={() => setTaskFilter('all')}
          style={{
            padding: '6px 14px', border: 'none', borderRadius: '20px', cursor: 'pointer',
            fontSize: '12px', fontWeight: '600',
            background: taskFilter === 'all' ? '#1e3a5f' : '#e2e8f0',
            color: taskFilter === 'all' ? 'white' : '#374151'
          }}
        >
          {t('notifications.all_tasks', { defaultValue: 'All tasks' })}
        </button>
        {taskKeys.map(key => (
          <button
            key={key}
            onClick={() => setTaskFilter(key)}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '20px', cursor: 'pointer',
              fontSize: '12px', fontWeight: '600',
              background: taskFilter === key ? '#2563eb' : '#e2e8f0',
              color: taskFilter === key ? 'white' : '#374151',
              display: 'inline-flex', alignItems: 'center', gap: '4px'
            }}
          >
            {TASK_META[key].icon} {TASK_META[key].label} ({byTask[key].length})
          </button>
        ))}
      </div>

      {/* ===== NOTIFICATION LIST ===== */}
      <div style={{
        background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '20px'
      }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔔</div>
            <div>{t('notifications.empty', { defaultValue: 'No notifications here yet.' })}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayed.map(n => {
              const tm = typeMeta(n);
              const tk = TASK_META[getTaskKey(n)];
              return (
                <div
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '14px 16px', cursor: 'pointer',
                    background: !n.read ? '#f0f7ff' : '#f8fafc',
                    border: !n.read ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', background: tm.bg, flexShrink: 0
                  }}>
                    {tm.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', fontSize: '15px' }}>{n.title}</span>
                      {!n.read && (
                        <span style={{
                          background: '#2563eb', color: 'white',
                          padding: '1px 8px', borderRadius: '12px',
                          fontSize: '10px', fontWeight: '600'
                        }}>
                          {t('notifications.new_badge', { defaultValue: 'NEW' })}
                        </span>
                      )}
                      <span style={{
                        padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600',
                        background: tm.bg, color: tm.color
                      }}>
                        {tk.icon} {tk.label}
                      </span>
                    </div>
                    <div style={{ color: '#374151', fontSize: '14px', marginTop: '2px' }}>{n.message}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(n.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNavigate(n); }}
                    title={t('notifications.open_task', { defaultValue: 'Open related page' })}
                    style={{
                      background: '#1e3a5f', color: 'white', border: 'none',
                      padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: '500', flexShrink: 0
                    }}
                  >
                    {t('notifications.open', { defaultValue: 'Open' })}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== DETAIL MODAL ===== */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px',
            maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 22px', borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600' }}>
                {typeMeta(selected).icon} {selected.title}
              </h3>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'transparent', border: 'none', fontSize: '20px',
                  cursor: 'pointer', color: '#64748b', lineHeight: 1
                }}
              >✕</button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {t('notifications.message', { defaultValue: 'Message' })}
                </div>
                <div style={{
                  fontSize: '14px', color: '#1f2937', background: '#f8fafc',
                  border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selected.message}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {t('notifications.task', { defaultValue: 'Task' })}
                </div>
                <span style={{
                  padding: '3px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
                  background: typeMeta(selected).bg, color: typeMeta(selected).color
                }}>
                  {TASK_META[getTaskKey(selected)].icon} {TASK_META[getTaskKey(selected)].label}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {t('notifications.date_time', { defaultValue: 'Date & time' })}
                </div>
                <div style={{ fontSize: '14px', color: '#1f2937' }}>
                  {new Date(selected.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{
              padding: '12px 22px', borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'flex-end', gap: '10px'
            }}>
              <button
                onClick={() => { handleNavigate(selected); setSelected(null); }}
                style={{
                  padding: '7px 16px', background: '#1e3a5f', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '500'
                }}
              >
                {t('notifications.go_to_task', { defaultValue: 'Go to task' })}
              </button>
              <button
                onClick={() => setSelected(null)}
                style={{
                  padding: '7px 16px', background: '#e5e7eb', color: '#374151',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '500'
                }}
              >
                {t('notifications.close', { defaultValue: 'Close' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationPage;
