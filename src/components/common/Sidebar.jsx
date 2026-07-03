import React from 'react';

function Sidebar({ activeTab, setActiveTab, user, pendingSync, onLogout }) {
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isOfficer = user?.role === 'field_officer';

  // Navigation items based on role
  const getNavItems = () => {
    const items = [{ id: 'dashboard', label: '📊 Dashboard' }];

    if (isOfficer) {
      items.push(
        { id: 'register', label: '🆔 Register' },
        { id: 'reports', label: '📋 Reports' },
        { id: 'report_new', label: '📝 New Report' },
        // ❌ Attendance REMOVED from Officer sidebar
        // ❌ Tasks REMOVED from Officer sidebar
        { id: 'leaves', label: '📅 Leaves' },
        { id: 'permissions', label: '📋 Permissions' }
      );
    }

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
    }

    if (isManager) {
      items.push(
        // User Management
        { id: 'users', label: '👤 Users' },
        
        // Attendance Management - Manager reviews all attendance
        { id: 'manager_attendance', label: '📋 Attendance Review' },
        
        // Reports Management
        { id: 'all_reports', label: '📋 All Reports' },
        
        // Task Management
        { id: 'tasks', label: '📋 Tasks' },
        
        // Leave Management
        { id: 'leaves', label: '📅 Leaves' },
        
        // Permission Management
        { id: 'permissions', label: '📋 Permissions' },
        
        // Screen Time Management - Manager monitors all officers
        { id: 'screentime', label: '📱 Screen Time' },
        
        // Citizens Database
        { id: 'citizens', label: '🆔 Citizens' },
        
        // Analytics
        { id: 'analytics', label: '📈 Analytics' },
        
        // Audit Log
        { id: 'audit', label: '📜 Audit' },
        
        // Alerts
        { id: 'alerts', label: '🔔 Alerts' }
      );
    }

    return items;
  };

  const navItems = getNavItems();

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
            {user?.role === 'manager' ? '👩‍💼' : user?.role === 'supervisor' ? '👨‍💼' : '👤'}
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