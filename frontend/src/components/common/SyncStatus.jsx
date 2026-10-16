// SyncStatus.js - connection state only

import React, { useState, useEffect } from 'react';
import { checkRealInternet } from '../../services/database';

// Reports online/offline. The queued-item count is deliberately not shown: it
// grew with every unsent mutation, which read as unsynced data loss rather
// than "saved locally, waiting for the network".
const SyncStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const checkNetwork = async () => {
      setIsOnline(await checkRealInternet());
    };

    const handleOffline = () => setIsOnline(false);

    checkNetwork();

    window.addEventListener('online', checkNetwork);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkNetwork, 5000);

    return () => {
      window.removeEventListener('online', checkNetwork);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: isOnline ? '#0b7e4b' : '#dc2626',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '24px',
      fontSize: '13px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      maxWidth: '300px',
      transition: 'all 0.3s ease'
    }}>
      <span style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: isOnline ? '#4ade80' : '#f87171',
        animation: isOnline ? 'none' : 'pulse 1.5s ease-in-out infinite'
      }}></span>
      <span>{isOnline ? '✅ Online' : '📡 Offline'}</span>
    </div>
  );
};

export default SyncStatus;