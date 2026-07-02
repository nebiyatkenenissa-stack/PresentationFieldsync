import React from 'react';

function NotificationBell({ notifications, unreadCount, onToggle, onMarkRead, onMarkAllRead, isOpen }) {
  return (
    <div className="notification-container">
      <button 
        className="notification-btn" 
        onClick={onToggle}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>
      
      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span>Notifications ({unreadCount} unread)</span>
            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>
          
          <div className="notification-dropdown-body">
            {notifications.length === 0 && (
              <div className="notification-empty">No notifications</div>
            )}
            
            {notifications.slice(0, 15).map(n => (
              <div 
                key={n.id} 
                className={`notification-item ${n.type} ${!n.read ? 'unread' : ''}`}
                onClick={() => onMarkRead(n.id)}
              >
                <div className="notification-message">{n.title}</div>
                <div className="notification-detail">{n.message}</div>
                <div className="notification-time">
                  {new Date(n.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;