// components/common/Sidebar.jsx

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user, 
  onProfileClick,
  isOpen,
  onClose,
  onToggle
}) {
  const { t } = useTranslation();
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isOfficer = user?.role === 'field_officer';

  // Navigation items based on role. Icon and label are kept separate so the
  // collapsed rail can show only the icon.
  const getNavItems = () => {
    const items = [
      { id: 'dashboard', icon: '📊', label: t('nav.dashboard') },
      { id: 'notifications', icon: '🔔', label: t('nav.notifications', { defaultValue: 'Notifications' }) },
      { id: 'profile', icon: '👤', label: t('nav.profile') }
    ];

    // Field Officer
    if (isOfficer) {
      items.push(
        { id: 'register', icon: '🆔', label: t('nav.register') },
        { id: 'reports', icon: '📋', label: t('nav.reports') },
        { id: 'report_new', icon: '📝', label: t('nav.report_new') },
        { id: 'leaves', icon: '📅', label: t('nav.leaves') },
        { id: 'permissions', icon: '📋', label: t('nav.permissions') },
        { id: 'alerts', icon: '✉️', label: t('nav.messages') }
      );
      return items;
    }

    // Supervisor
    if (isSupervisor) {
      items.push(
        { id: 'tasks', icon: '✅', label: t('nav.tasks') },
        { id: 'leaves', icon: '📅', label: t('nav.leaves') },
        { id: 'permissions', icon: '📋', label: t('nav.permissions') },
        { id: 'supervisor_reports', icon: '📑', label: t('nav.supervisor_reports') },
        { id: 'team', icon: '👥', label: t('nav.team') },
        { id: 'reports', icon: '📋', label: t('nav.reports') },
        { id: 'screentime', icon: '📱', label: t('nav.screentime') },
        { id: 'verification', icon: '🔍', label: t('nav.verification') },
        { id: 'alerts', icon: '✉️', label: t('nav.messages') }
      );
      return items;
    }

    if (isManager) {
      items.push(
        { id: 'users', icon: '👥', label: t('nav.users') },
        { id: 'all_reports', icon: '📚', label: t('nav.all_reports') },
        { id: 'leaves', icon: '📅', label: t('nav.leaves') },
        { id: 'permissions', icon: '📋', label: t('nav.permissions') },
        { id: 'citizens', icon: '🆔', label: t('nav.citizens') },
        { id: 'analytics', icon: '📈', label: t('nav.analytics') },
        { id: 'audit', icon: '📜', label: t('nav.audit') },
        { id: 'alerts', icon: '✉️', label: t('nav.messages') }
      );
      return items;
    }

    return items;
  };

  const navItems = getNavItems();

  // The sidebar is a docked panel above 768px and an overlay drawer below it.
  // Only the drawer should dismiss itself on Escape or after a navigation.
  const isOverlay = () => window.matchMedia('(max-width: 768px)').matches;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isOverlay()) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleNavClick = (id) => {
    if (id === 'profile') {
      if (onProfileClick) onProfileClick();
      else setActiveTab('profile');
    } else {
      setActiveTab(id);
    }
    if (isOverlay()) onClose();
  };

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div id="app-sidebar" className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon-small">📡</div>
          <span className="brand-wordmark">FieldSync</span>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle || onClose}
            aria-label="Toggle navigation"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
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
    </>
  );
}
 
export default Sidebar;
