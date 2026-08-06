// components/common/Sidebar.jsx

import React from 'react';

function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user, 
  pendingSync, 
  onLogout
}) {
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isOfficer = user?.role === 'field_officer';

  // Navigation items based on role
  const getNavItems = () => {
    const items = [{ id: 'dashboard', label: '📊 Dashboard' }];

    // Field Officer
    if (isOfficer) {
      items.push(
        { id: 'register', label: '🆔 Register' },
        { id: 'reports', label: '📋 Reports' },
        { id: 'report_new', label: '📝 New Report' },
        { id: 'leaves', label: '📅 Leaves' },
        { id: 'permissions', label: '📋 Permissions' }
      );
      return items;
    }

    // Supervisor
    if (isSupervisor) {
      items.push(
        { id: 'attendance', label: '📋 Attendance' },
        { id: 'tasks', label: '📋 Tasks' },
        { id: 'leaves', label: '📅 Leaves' },
        { id: 'permissions', label: '📋 Permissions' },
        { id: 'supervisor_reports', label: '📋 Supervisor Reports' },
        { id: 'team', label: '👥 Team' },
        { id: 'reports', label: '📋 Reports' },
        { id: 'screentime', label: '📱 Screen Time' }
      );
      return items;
    }

    // Manager
    if (isManager) {
      items.push(
        { id: 'users', label: '👤 Users' },
        { id: 'manager_attendance', label: '📋 Attendance Review' },
        { id: 'all_reports', label: '📋 All Reports' },
        { id: 'tasks', label: '📋 Tasks' },
        { id: 'leaves', label: '📅 Leaves' },
        { id: 'permissions', label: '📋 Permissions' },
        { id: 'screentime', label: '📱 Screen Time' },
        { id: 'citizens', label: '🆔 Citizens' },
        { id: 'analytics', label: '📈 Analytics' },
        { id: 'audit', label: '📜 Audit' },
        { id: 'alerts', label: '🔔 Alerts' },
        { id: 'verification', label: '🔍 Verification' }
      );
      return items;
    }

    return items;
  };

  const navItems = getNavItems();

  // Helper to get fallback avatar based on role
  const getDefaultAvatar = () => {
    if (isManager) return '👤';      // or 👔 for manager
    if (isSupervisor) return '👨‍💼';
    if (isOfficer) return '👤';
    return '👤';
  };

  // Determine the avatar source
  const avatarSrc = user?.profilePhoto 
    ? `http://localhost:5000${user.profilePhoto}` 
    : null;

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon-small">📡</div>
        <span>FieldSync</span>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
            {item.id === 'reports' && pendingSync > 0 && (
              <span className="nav-badge">{pendingSync}</span>
            )}
            {item.id === 'manager_attendance' && (
              <span className="nav-badge">📋</span>
            )}
            {item.id === 'all_reports' && (
              <span className="nav-badge">📊</span>
            )}
            {item.id === 'screentime' && (
              <span className="nav-badge">📱</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">
            {avatarSrc ? (
              <img 
                src={avatarSrc} 
                alt="Profile" 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
            ) : (
              // Fallback: role-based emoji
              <span style={{ fontSize: '24px' }}>{getDefaultAvatar()}</span>
            )}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout}>🚪 Logout</button>
      </div>
    </div>
  );
}
 
export default Sidebar;