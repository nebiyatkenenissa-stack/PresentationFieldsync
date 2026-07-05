import React, { useState, useEffect } from 'react';
import { syncQueue } from '../../services/database';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingDetails, setPendingDetails] = useState({});

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      const count = syncQueue.count();
      setPendingCount(count);
      
      const items = syncQueue.getAll();
      const details = {};
      items.forEach(item => {
        const labels = {
          'citizen': 'Citizens',
          'report': 'Reports',
          'leave_request': 'Leave Requests',
          'permission_request': 'Permission Requests',
          'attendance': 'Attendance',
          'task': 'Tasks',
          'leave_update': 'Leave Updates',
          'permission_update': 'Permission Updates',
          'supervisor_report': 'Supervisor Reports'
        };
        const label = labels[item.type] || item.type;
        details[label] = (details[label] || 0) + 1;
      });
      setPendingDetails(details);
    };

    updateStatus();
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('sync-complete', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('sync-complete', updateStatus);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  const detailStrings = Object.entries(pendingDetails)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: isOnline ? '#0b7e4b' : '#dc2626',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideUp 0.3s ease-out',
      maxWidth: '90%',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }}>
      <span>{isOnline ? '🔄' : '📡'}</span>
      <span>
        {isOnline 
          ? `Syncing... (${pendingCount} pending)` 
          : `Offline - ${pendingCount} items pending`}
      </span>
      {pendingCount > 0 && detailStrings && (
        <span style={{
          fontSize: '11px',
          opacity: 0.8,
          background: 'rgba(255,255,255,0.15)',
          padding: '2px 10px',
          borderRadius: '12px'
        }}>
          {detailStrings}
        </span>
      )}
      {!isOnline && (
        <span style={{ fontSize: '11px', opacity: 0.7 }}>
          Data will sync when online
        </span>
      )}
    </div>
  );
};

export default OfflineIndicator;