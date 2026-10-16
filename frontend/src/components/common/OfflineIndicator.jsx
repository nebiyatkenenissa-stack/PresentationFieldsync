import React, { useState, useEffect } from 'react';
import { checkRealInternet } from '../../services/database';

// Shows whether the app can reach the server. The queued-item count is
// deliberately NOT shown: it counted everything that had not been flushed
// yet, which read as "N records lost" even though the records were already
// saved locally and synced on reconnect.
const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateStatus = async () => {
      setIsOnline(await checkRealInternet());
    };

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('sync-complete', updateStatus);
    window.addEventListener('force-sync', updateStatus);

    const interval = setInterval(updateStatus, 8000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('sync-complete', updateStatus);
      window.removeEventListener('force-sync', updateStatus);
      clearInterval(interval);
    };
  }, []);

  // Only surface the banner when the connection is actually down.
  if (isOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#dc2626',
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
      <span>📡</span>
      <span>Offline</span>
      <span style={{ fontSize: '11px', opacity: 0.7 }}>
        Data will sync when online
      </span>
    </div>
  );
};

export default OfflineIndicator;