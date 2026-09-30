// components/common/Sidebar.jsx

import { useTranslation } from 'react-i18next';

function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user, 
  pendingSync, 
  onProfileClick
}) {
  const { t } = useTranslation();
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isOfficer = user?.role === 'field_officer';

  // Navigation items based on role
  const getNavItems = () => {
    const items = [
      { id: 'dashboard', label: '📊 ' + t('nav.dashboard') },
      { id: 'profile', label: '👤 ' + t('nav.profile') }
    ];

    // Field Officer
    if (isOfficer) {
      items.push(
        { id: 'register', label: '🆔 ' + t('nav.register') },
        { id: 'reports', label: '📋 ' + t('nav.reports') },
        { id: 'report_new', label: '📝 ' + t('nav.report_new') },
        { id: 'permissions', label: '📋 ' + t('nav.permissions') },
        { id: 'alerts', label: '✉️ ' + t('nav.messages') }
      );
      return items;
    }

    // Supervisor
    if (isSupervisor) {
      items.push(
        { id: 'tasks', label: '✅ ' + t('nav.tasks') },
        { id: 'permissions', label: '📋 ' + t('nav.permissions') },
        { id: 'supervisor_reports', label: '📑 ' + t('nav.supervisor_reports') },
        { id: 'team', label: '👥 ' + t('nav.team') },
        { id: 'reports', label: '📋 ' + t('nav.reports') },
        { id: 'screentime', label: '📱 ' + t('nav.screentime') },
        { id: 'verification', label: '🔍 ' + t('nav.verification') },
        { id: 'alerts', label: '✉️ ' + t('nav.messages') }
      );
      return items;
    }

    // Manager
    if (isManager) {
      items.push(
        { id: 'users', label: '👥 ' + t('nav.users') },
        { id: 'all_reports', label: '📚 ' + t('nav.all_reports') },
        { id: 'permissions', label: '📋 ' + t('nav.permissions') },
        { id: 'citizens', label: '🆔 ' + t('nav.citizens') },
        { id: 'analytics', label: '📈 ' + t('nav.analytics') },
        { id: 'audit', label: '📜 ' + t('nav.audit') },
        { id: 'alerts', label: '✉️ ' + t('nav.messages') }
      );
      return items;
    }

    return items;
  };

  const navItems = getNavItems();

  const handleNavClick = (id) => {
    if (id === 'profile') {
      if (onProfileClick) onProfileClick();
      else setActiveTab('profile');
      return;
    }
    setActiveTab(id);
  };

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
            onClick={() => handleNavClick(item.id)}
          >
            {item.label}
            {item.id === 'all_reports' && (
              <span className="nav-badge">📊</span>
            )}
            {item.id === 'screentime' && (
              <span className="nav-badge">📱</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
 
export default Sidebar;
