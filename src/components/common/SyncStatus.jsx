// SyncStatus.js - Updated with real network check

import React, { useState, useEffect } from 'react';
import { syncQueue } from '../../services/database';

// ===== REAL NETWORK CHECK =====
const checkRealInternet = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('https://cdn.jsdelivr.net/npm/axios/package.json', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

const SyncStatus = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updatePending = () => {
      setPendingCount(syncQueue.count());
    };

    const checkNetwork = async () => {
      const online = await checkRealInternet();
      if (online !== isOnline) {
        setIsOnline(online);
      }
      updatePending();
    };

    const handleOnline = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      updatePending();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updatePending();
    };

    // Initial check
    checkNetwork();
    updatePending();

    // Listen for events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-complete', updatePending);
    window.addEventListener('sync-queue-updated', updatePending);

    // Check network every 5 seconds
    const interval = setInterval(checkNetwork, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-complete', updatePending);
      window.removeEventListener('sync-queue-updated', updatePending);
      clearInterval(interval);
    };
  }, [isOnline]);

  if (pendingCount === 0 && isOnline) return null;

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
      {isOnline ? (
        <>
          {pendingCount > 0 ? (
            <span>🔄 Syncing... ({pendingCount} pending)</span>
          ) : (
            <span>✅ Online - All synced</span>
          )}
        </>
      ) : (
        <span>📡 Offline - {pendingCount} items pending sync</span>
      )}
    </div>
  );
};

export default SyncStatus;