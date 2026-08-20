// services/database.js – FULL WITH VERIFICATION AND SUPERVISOR REPORTS SYNC
// FIX: Schema version 4 – verification_history has 'synced' index

import Dexie from 'dexie';
import { SAMPLE_USERS } from '../utils/constants';
import { uid, getToday } from '../utils/helpers';

import { getServerBase } from '../utils/helpers';
const API_URL = `${getServerBase()}/api`;

// Legacy demo reports used old compass regions (North/South/East/West).
// They must never re-enter the local DB, so we filter them on every pull
// and purge any that already exist locally.
export const OLD_REGION_NAMES = ['North', 'South', 'East', 'West'];

export const isLegacyReport = (r) => {
  const region = (r && (r.region || r.officerRegion || '')) || '';
  return OLD_REGION_NAMES.includes(region);
};

export const cleanupLegacyReports = async () => {
  let removed = 0;
  const reports = await db.reports.toArray();
  for (const r of reports) {
    if (isLegacyReport(r)) { await db.reports.delete(r.id); removed++; }
  }
  if (removed) console.log(`🧹 Cleaned ${removed} legacy daily reports from local DB`);
  return removed;
};

// ============================================================
// DELETED-REPORT TOMBSTONES
// When a manager deletes a report locally, we remember its id so
// the next server pull does NOT bring it back.
// ============================================================
const DELETED_REPORT_KEY = 'fieldsync_deleted_report_ids';
const DELETED_SUPERVISOR_REPORT_KEY = 'fieldsync_deleted_supervisor_report_ids';

export const getDeletedReportIds = (isSupervisor) => {
  const key = isSupervisor ? DELETED_SUPERVISOR_REPORT_KEY : DELETED_REPORT_KEY;
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
};

export const markReportsDeleted = (ids, isSupervisor) => {
  const key = isSupervisor ? DELETED_SUPERVISOR_REPORT_KEY : DELETED_REPORT_KEY;
  const set = getDeletedReportIds(isSupervisor);
  (ids || []).forEach(id => { if (id) set.add(id); });
  localStorage.setItem(key, JSON.stringify([...set]));
};

// ============================================================
// DELETED SCREEN-TIME TOMBSTONES
// When a supervisor/manager deletes screen time records locally,
// we remember their ids so the next server pull does NOT bring
// them back on this device.
// ============================================================
const DELETED_SCREEN_TIME_KEY = 'fieldsync_deleted_screen_time_ids';

export const getDeletedScreenTimeIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_SCREEN_TIME_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

export const markScreenTimeDeleted = (ids) => {
  const set = getDeletedScreenTimeIds();
  (ids || []).forEach(id => { if (id) set.add(id); });
  localStorage.setItem(DELETED_SCREEN_TIME_KEY, JSON.stringify([...set]));
};

// Resolve the API base from the page host so the app also works when opened
// from another device on the same network (e.g. a phone), not only localhost.
export const getApiBase = () => {
  try {
    if (typeof window === 'undefined' || !window.location) return API_URL;
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return API_URL;
    }
    return `http://${hostname}:5000/api`;
  } catch (e) {
    return API_URL;
  }
};

// ============================================================
// Create Dexie database with corrected schema (version 4)
// ============================================================
const db = new Dexie('FieldSyncDB');

// Version 4 – verification_history now includes 'synced' index
db.version(4).stores({
  users: 'id, employeeId, email, role, region, status, pin',
  reports: 'id, reportId, employeeId, region, reportDate, synced',
  attendance: 'id, employeeId, date, status, region, synced',
  citizens: 'id, nationalId, firstName, lastName, region, phone, synced',
  audit: 'id, userId, action, timestamp',
  supervisor_reports: 'id, supervisorId, officerId, reportDate, synced',
  screen_time: 'id, employeeId, date, trustScore',
  notifications: 'id, userId, read, timestamp',
  status: 'id, employeeId, status, lastActive',
  tasks: 'id, employeeId, status, deadline, priority, synced',
  leaves: 'id, employeeId, status, startDate, endDate, synced',
  alerts: 'id, targetEmployeeId, targetAll, read, timestamp',
  auth: 'id',
  permissions: 'id, employeeId, status, startDate, endDate, synced',
  gps_locations: 'id, employeeId, date, timestamp, synced, latitude, longitude',
  check_ins: 'id, employeeId, date, type, checkInId, synced, timestamp',
  // FIX: verification_history now includes 'synced' as an index
  verification_history: 'id, officerId, timestamp, questionId, success, synced',
  kiosk_sessions: 'id, officerId, startTime, endTime, status, synced'
});

export { db };

// ============================================================
// OFFLINE SYNC QUEUE
// ============================================================
export const syncQueue = {
  pending: [],
  
  load: () => {
    try {
      const saved = localStorage.getItem('offlineSyncQueue');
      if (saved) {
        syncQueue.pending = JSON.parse(saved);
        console.log(`📥 Loaded ${syncQueue.pending.length} pending items from queue`);
      }
    } catch (e) {
      console.error('Error loading sync queue:', e);
      syncQueue.pending = [];
    }
  },
  
  save: () => {
    try {
      localStorage.setItem('offlineSyncQueue', JSON.stringify(syncQueue.pending));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sync-queue-updated'));
      }
    } catch (e) {
      console.error('Error saving sync queue:', e);
    }
  },
  
  add: (item) => {
    const exists = syncQueue.pending.some(q => q.id === item.id && q.type === item.type);
    if (exists) {
      console.log(`⚠️ Item ${item.id} already in queue`);
      return;
    }
    
    syncQueue.pending.push({
      ...item,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      maxRetries: 5
    });
    syncQueue.save();
    console.log(`📥 Added to sync queue: ${item.type} - ${item.id} (Total: ${syncQueue.pending.length})`);
  },
  
  getAll: () => {
    return syncQueue.pending;
  },

  // Items that have been waiting to sync for 7+ days (business rule: reports
  // and citizens must reach the server within one week).
  overdue: () => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return syncQueue.pending.filter(item => {
      const queuedAt = item.queuedAt ? new Date(item.queuedAt).getTime() : null;
      return queuedAt && (now - queuedAt) >= WEEK_MS;
    });
  },
  
  remove: (id) => {
    // Remove by id, but also drop legacy items that were queued without an id
    // (e.g. user_delete / user_status_update keyed only under data.userId).
    // Without this those items could never be cleared and would show as
    // "pending" forever.
    syncQueue.pending = syncQueue.pending.filter(item => {
      if (item.id === id) return false;
      if ((item.id === undefined || item.id === null) && item.data?.userId === id) return false;
      return true;
    });
    syncQueue.save();
    console.log(`✅ Removed from sync queue: ${id} (Remaining: ${syncQueue.pending.length})`);
  },
  
  clear: () => {
    syncQueue.pending = [];
    syncQueue.save();
    console.log('🗑️ Sync queue cleared');
  },
  
  count: () => {
    return syncQueue.pending.length;
  }
};

syncQueue.load();

// ============================================================
// NETWORK CHECK
// ============================================================

let _networkOnline = true;

// Public endpoints used to probe REAL internet connectivity. We probe these
// with mode 'no-cors' so the request succeeds (opaque response) whenever the
// device is actually connected to the internet, independent of the FieldSync
// API server. If none of them respond, the device is offline.
const REAL_INTERNET_ENDPOINTS = [
  'https://clients3.google.com/generate_204',
  'https://www.cloudflare.com/cdn-cgi/trace',
  'https://www.gstatic.com/generate_204'
];

export const checkRealInternet = async () => {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    _networkOnline = false;
    return false;
  }

  for (const url of REAL_INTERNET_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
        mode: 'no-cors'
      });
      clearTimeout(timeoutId);
      // With mode 'no-cors' a resolved fetch (even an opaque response) proves
      // the device reached the internet. status === 0 covers opaque responses.
      if (response.type === 'opaque' || response.ok || response.status === 0) {
        _networkOnline = true;
        return true;
      }
    } catch (e) {
      // No connectivity for this endpoint – try the next one.
    }
  }

  _networkOnline = false;
  return false;
};

export const isDevToolsOffline = () => {
  if (!navigator.onLine) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    return false;
  }
  return false;
};

export const getNetworkStatus = () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  const isOnline = _networkOnline && navigator.onLine;
  
  if (!isOnline) {
    return {
      type: 'devtools-offline',
      label: !navigator.onLine ? 'Offline' : 'DevTools Offline',
      speed: 0,
      isSlow: false,
      rtt: 0,
      browserOnline: navigator.onLine,
      devtoolsOffline: true
    };
  }
  
  let networkType = 'unknown';
  let isSlow = false;
  let speed = 0;
  let rtt = 0;
  let label = 'Unknown';
  
  if (connection) {
    const types = {
      'slow-2g': { label: '2G', isSlow: true },
      '2g': { label: '2G', isSlow: true },
      '3g': { label: '3G', isSlow: true },
      '4g': { label: '4G', isSlow: false },
      '5g': { label: '5G', isSlow: false }
    };
    
    const effectiveType = connection.effectiveType || 'unknown';
    const info = types[effectiveType] || { label: 'Unknown', isSlow: false };
    
    networkType = effectiveType;
    label = info.label;
    isSlow = info.isSlow;
    speed = connection.downlink || 0;
    rtt = connection.rtt || 0;
  }
  
  return {
    type: networkType,
    label: label,
    speed: speed,
    isSlow: isSlow,
    rtt: rtt,
    browserOnline: true,
    devtoolsOffline: false
  };
};

export const isSlowConnection = () => {
  const info = getNetworkStatus();
  return info.isSlow || info.type === 'slow-2g' || info.type === '2g' || info.type === '3g';
};

export const isOnline = async () => {
  return await checkRealInternet();
};

// ============================================================
// CLEAR STUCK SYNC ITEMS (updated with verification_history)
// ============================================================
export const clearStuckSyncItems = async () => {
  try {
    console.log('🧹 Clearing stuck sync operations...');
    
    const storesToCheck = [
      'reports', 'attendance', 'citizens', 'tasks', 
      'leaves', 'permissions', 'supervisor_reports', 'verification_history'
    ];
    
    const stuckThreshold = Date.now() - 60000;
    let clearedCount = 0;
    
    for (const storeName of storesToCheck) {
      try {
        const store = db[storeName];
        if (!store) continue;
        
        // This now works because 'synced' is indexed on verification_history
        const items = await store
          .where('synced')
          .equals('syncing')
          .toArray();
        
        for (const item of items) {
          if (!item.lastSyncAttempt || item.lastSyncAttempt < stuckThreshold) {
            await store.update(item.id, {
              synced: false,
              syncError: 'Stuck sync cleared automatically',
              lastSyncAttempt: Date.now()
            });
            clearedCount++;
            console.log(`✅ Cleared stuck sync for ${storeName} ${item.id}`);
          }
        }
      } catch (error) {
        console.error(`Error checking ${storeName}:`, error);
      }
    }
    
    const pending = syncQueue.getAll();
    let queueCleared = 0;

    for (const item of pending) {
      // Reports and citizens are critical data and must never be dropped from
      // the queue — they are retried until they sync.
      const isCritical = item.type === 'report' || item.type === 'citizen';
      if (!isCritical && item.attempts >= item.maxRetries) {
        syncQueue.remove(item.id);
        queueCleared++;
        console.log(`✅ Removed stuck queue item: ${item.type} - ${item.id}`);
      }
    }
    
    console.log(`✅ Cleared ${clearedCount} stuck store items and ${queueCleared} stuck queue items`);
    
    return { clearedStore: clearedCount, clearedQueue: queueCleared };
    
  } catch (error) {
    console.error('Error clearing stuck sync items:', error);
    return { clearedStore: 0, clearedQueue: 0 };
  }
};

// ============================================================
// CLEAR STUCK CITIZENS (field officer cleanup)
// Citizens that can never reach the server are removed from the
// local store and the sync queue so they stop showing as stuck:
//  - records stuck at 'syncing' for over a minute,
//  - queue items that failed past the retry limit,
//  - citizens queued for 7+ days (documented one-week business rule),
//  - orphaned queue items whose local record no longer exists.
// ============================================================
export const clearStuckCitizens = async () => {
  const result = { queue: 0, store: 0 };
  try {
    // 1) Remove citizens stuck mid-sync ('syncing' for > 60s)
    const syncingCutoff = Date.now() - 60000;
    const syncing = await db.citizens.where('synced').equals('syncing').toArray();
    for (const c of syncing) {
      if (!c.lastSyncAttempt || c.lastSyncAttempt < syncingCutoff) {
        await db.citizens.delete(c.id);
        result.store++;
      }
    }

    // 2) Drop citizen queue items that can never sync
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const item of syncQueue.getAll()) {
      if (item.type !== 'citizen') continue;
      const queuedAt = item.queuedAt ? new Date(item.queuedAt).getTime() : now;
      const tooOld = (now - queuedAt) >= WEEK_MS;
      const tooMany = (item.attempts || 0) >= item.maxRetries;
      const local = await db.citizens.get(item.id);
      const orphan = !local;
      if (tooOld || tooMany || orphan) {
        if (local && local.synced === false) {
          await db.citizens.delete(item.id);
          result.store++;
        }
        syncQueue.remove(item.id);
        result.queue++;
      }
    }

    // 3) Purge citizens that failed permanently (kept locally with syncError
    // but no longer in the sync queue). These were rejected / never synced and
    // can never reach the server, so they only keep the "needs attention"
    // warning alive. Citizens waiting offline (no syncError) are untouched.
    const queuedIds = new Set(
      syncQueue.getAll().filter(q => q.type === 'citizen').map(q => q.id)
    );
    const allCitizens = await db.citizens.toArray();
    for (const c of allCitizens) {
      if (c.synced === false && c.syncError && !queuedIds.has(c.id)) {
        await db.citizens.delete(c.id);
        result.store++;
      }
    }

    if (result.queue + result.store > 0) {
      console.log(`🧹 Cleared ${result.store} stuck citizen records and ${result.queue} stuck queue items`);
    }
    return result;
  } catch (error) {
    console.error('Error clearing stuck citizens:', error);
    return { queue: 0, store: 0 };
  }
};

// ============================================================
// PROCESS SYNC QUEUE (REAL API CALLS)
// ============================================================
export const processSyncQueue = async (isOnline) => {
  if (!isOnline) {
    console.log('📡 Offline - Cannot process sync queue');
    return { synced: 0, failed: 0, pending: syncQueue.count() };
  }

  const pending = syncQueue.getAll();
  if (pending.length === 0) {
    console.log('✅ No pending items to sync');
    return { synced: 0, failed: 0, pending: 0 };
  }

  console.log(`📤 Processing ${pending.length} sync queue items...`);
  
  let synced = 0;
  let failed = 0;
  const MAX_RETRIES = 3;

  for (const item of pending) {
    try {
      // Store map – includes all types including 'verification'
      const storeMap = {
        'citizen': 'citizens',
        'report': 'reports',
        'attendance': 'attendance',
        'task': 'tasks',
        'leave_request': 'leaves',
        'leave': 'leaves',
        'leave_update': 'leaves',
        'permission_request': 'permissions',
        'permission': 'permissions',
        'permission_update': 'permissions',
        'supervisor_report': 'supervisor_reports',
        'user': 'users',
        'user_update': 'users',
        'user_status_update': 'users',
        'user_delete': 'users',
        'alert': 'alerts',
        'alert_read': 'alerts',
        'screen_time': 'screen_time',
        'screen_time_update': 'screen_time',
        'screen_time_delete': null,
        'verification_delete': null,
        'audit': 'audit',
        'verification': 'verification_history',
        'gps_location': 'gps_locations',
        'check_in': 'check_ins',
        'check_out': 'check_ins',
        'kiosk_session': 'kiosk_sessions'
      };
      
      const store = storeMap[item.type];
      const isServerDelete = item.type === 'screen_time_delete' || item.type === 'verification_delete';

      if (isServerDelete) {
        // The local record is already gone – just ask the server to delete it.
        const recordId = item.id !== undefined && item.id !== null ? item.id : item.data?.id;
        console.log(`🔄 Deleting screen time on server: ${recordId}`);
        const response = await fetch(`${getApiBase()}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: item.type, data: item.data })
        });
        if (response.ok) {
          syncQueue.remove(recordId);
          synced++;
          console.log(`✅ Deleted screen time on server: ${recordId}`);
        } else {
          const error = await response.json();
          throw new Error(error.error || `API returned ${response.status}`);
        }
      } else if (store && db[store]) {
        // Resolve the local record id for types that store it under data.*
        const recordId = (item.id !== undefined && item.id !== null)
          ? item.id
          : (item.data?.userId || item.data?.taskId || item.data?.leaveId || item.data?.permissionId || item.data?.alertId || item.data?.id);

        // Skip the local DB update for deletes – the record is already gone
        const isDelete = item.type === 'user_delete';

        if (!isDelete) {
          // Mark as syncing
          await db[store].update(recordId, {
            synced: 'syncing',
            lastSyncAttempt: Date.now()
          });
        }
        
        console.log(`🔄 Syncing to PostgreSQL: ${item.type} - ${recordId}`);
        
        // Send to /api/sync
        const response = await fetch(`${getApiBase()}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: item.type, data: item.data })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (!isDelete) {
            // Mark as fully synced
            await db[store].update(recordId, {
              synced: true,
              syncedAt: new Date().toISOString(),
              serverId: result.data?.id || `server-${Date.now()}`,
              pending: false
            });
          }

          // If verification, also update localStorage to keep sync
          if (item.type === 'verification' && typeof window !== 'undefined') {
            const officerId = item.data.officerId;
            if (officerId) {
              const saved = localStorage.getItem(`verification_${officerId}`);
              if (saved) {
                try {
                  const parsed = JSON.parse(saved);
                  if (parsed.history) {
                    parsed.history = parsed.history.map(h =>
                      h.id === item.id ? { ...h, synced: true } : h
                    );
                    localStorage.setItem(`verification_${officerId}`, JSON.stringify(parsed));
                  }
                } catch (e) {
                  console.warn('Could not update localStorage verification history', e);
                }
              }
            }
          }
          
          syncQueue.remove(recordId);
          synced++;
          console.log(`✅ Synced to PostgreSQL: ${item.type} - ${recordId}`);

          // An offline-saved report has now reached the server – notify the
          // supervisor/manager so the message appears at the same time as the
          // report does (internet is back).
          if (item.type === 'report' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('report-synced', { detail: { report: item.data } }));
          }
        } else {
          const error = await response.json();
          throw new Error(error.error || `API returned ${response.status}`);
        }
        
      } else {
        // If store not found, just remove from queue to avoid infinite loop
        syncQueue.remove(item.id);
        synced++;
      }
    } catch (error) {
      console.error(`❌ Failed to sync: ${item.type} - ${item.id}`, error.message);
      item.attempts = (item.attempts || 0) + 1;
      
      // Update the item in IndexedDB to reflect the failure
      const storeMap = {
        'citizen': 'citizens',
        'report': 'reports',
        'attendance': 'attendance',
        'task': 'tasks',
        'leave_request': 'leaves',
        'leave': 'leaves',
        'leave_update': 'leaves',
        'permission_request': 'permissions',
        'permission': 'permissions',
        'permission_update': 'permissions',
        'supervisor_report': 'supervisor_reports',
        'user': 'users',
        'user_update': 'users',
        'user_status_update': 'users',
        'user_delete': 'users',
        'alert': 'alerts',
        'alert_read': 'alerts',
        'screen_time': 'screen_time',
        'screen_time_update': 'screen_time',
        'screen_time_delete': null,
        'verification_delete': null,
        'audit': 'audit',
        'verification': 'verification_history',
        'gps_location': 'gps_locations',
        'check_in': 'check_ins',
        'check_out': 'check_ins',
        'kiosk_session': 'kiosk_sessions'
      };
      
      const store = storeMap[item.type];
      const recordId = (item.id !== undefined && item.id !== null)
        ? item.id
        : (item.data?.userId || item.data?.taskId || item.data?.leaveId || item.data?.permissionId || item.data?.alertId || item.data?.id);
      if (store && db[store]) {
        const isDelete = item.type === 'user_delete';
        if (!isDelete) {
          await db[store].update(recordId, {
            synced: false,
            syncError: error.message,
            lastSyncAttempt: Date.now()
          });
        }
      }
      
      if (item.attempts > MAX_RETRIES) {
        // Stop retrying automatically after the retry limit. The local record
        // is KEPT (synced: false, still visible as "pending") so no data is
        // lost — the officer can retry manually with the sync button. Without
        // this, a permanently failing record (e.g. rejected by the server)
        // stays in the queue forever, firing 'sync-queue-updated' every few
        // seconds and keeping pages in a perpetual reload/sync loop.
        console.warn(`⚠️ Max attempts (${MAX_RETRIES}) reached for ${item.type} - ${item.id}, pausing auto-retry`);
        syncQueue.remove(recordId);
        failed++;
      } else {
        // Update the item in the queue for retry
        const index = syncQueue.pending.findIndex(q => q.id === item.id);
        if (index !== -1) {
          syncQueue.pending[index] = item;
          syncQueue.save();
        }
        failed++;
      }
    }
  }

  syncQueue.save();
  
  // Only announce a completed sync when at least one item was actually synced.
  // A permanently failing (e.g. "stuck") record would otherwise fire
  // 'sync-complete' every retry and cause pages to reload in a loop.
  if (typeof window !== 'undefined' && synced > 0) {
    window.dispatchEvent(new Event('sync-complete'));
  }
  
  return {
    synced,
    failed,
    pending: syncQueue.count()
  };
};

// ============================================================
// SYNC ENGINE
// ============================================================
export const syncPendingData = async (isOnline) => {
  if (!isOnline) {
    console.log('📡 Offline - Sync paused');
    return { synced: 0, failed: 0, pending: syncQueue.count() };
  }
  
  return await processSyncQueue(isOnline);
};

// ============================================================
// AUTO-SYNC
// ============================================================
if (typeof window !== 'undefined') {
  let isSyncing = false;
  
  const checkAndSync = async () => {
    const online = await checkRealInternet();
    _networkOnline = online;
    
    if (online && !isSyncing) {
      const count = syncQueue.count();
      if (count > 0) {
        console.log(`🔄 Auto-syncing ${count} items to PostgreSQL...`);
        isSyncing = true;
        try {
          await processSyncQueue(true);
        } catch (error) {
          console.error('Sync error:', error);
        } finally {
          isSyncing = false;
        }
      }
    }
  };

  window.addEventListener('online', () => {
    console.log('🔄 Browser online event');
    setTimeout(checkAndSync, 1000);
  });

  window.addEventListener('offline', () => {
    console.log('🔴 Browser offline event');
    _networkOnline = false;
  });

  const interval = setInterval(checkAndSync, 2000);
  
  setTimeout(checkAndSync, 1000);
  
  window.addEventListener('force-sync', checkAndSync);
  
  setInterval(async () => {
    const online = await checkRealInternet();
    if (online) {
      await clearStuckSyncItems();
    }
  }, 30000);

  window.addEventListener('beforeunload', () => {
    if (interval) {
      clearInterval(interval);
    }
  });
}

// ============================================================
// PULL SCREEN TIME FROM SERVER
// ============================================================
export const pullScreenTimeFromServer = async (employeeId = null) => {
  const online = await checkRealInternet();
  if (!online) {
    console.log('📡 Offline – skipping screen time pull');
    return;
  }

  try {
    const url = employeeId
      ? `${getApiBase()}/screen-time/employee/${employeeId}`
      : `${getApiBase()}/screen-time`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const serverRecords = await response.json();
    console.log(`📥 Pulled ${serverRecords.length} screen time records from server`);
    const deletedIds = getDeletedScreenTimeIds();

    for (const record of serverRecords) {
      if (deletedIds.has(record.id)) continue;

      const localRecord = {
        id: record.id,
        employeeId: record.employee_id,
        employeeName: record.employee_name,
        // The Postgres DATE column returns a full ISO timestamp (e.g.
        // "2026-08-12T07:00:00.000Z"). Normalize it to "YYYY-MM-DD" so it
        // matches the local records and the date filter on the screen time page.
        date: String(record.date || '').slice(0, 10),
        loginTime: record.login_time,
        logoutTime: record.logout_time,
        totalScreenTime: record.total_screen_time,
        idleTime: record.idle_time || 0,
        sessionStart: record.session_start || null,
        screenTimeLimit: record.screen_time_limit,
        trustScore: record.trust_score,
        isLoggedIn: record.is_logged_in,
        verified: record.verified,
        verifiedBy: record.verified_by,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        synced: true,
      };

      const existing = await db.screen_time.get(record.id);
      if (!existing || existing.updatedAt !== localRecord.updatedAt) {
        await db.screen_time.put(localRecord);
        console.log(`🔄 Updated screen time record for ${localRecord.employeeName}`);
      }
    }
    console.log('✅ Screen time pull completed');
  } catch (error) {
    console.error('❌ Pull screen time failed:', error);
  }
};

// ============================================================
// DELETE SCREEN TIME RECORDS (local + server)
// Deletes from IndexedDB on this device and best-effort from the
// server. If the server cannot be reached the delete is queued so
// it is retried once the device is back online.
// ============================================================
export const deleteScreenTimeRecords = async (records) => {
  const results = [];
  const online = await checkRealInternet();

  for (const record of records || []) {
    if (!record || !record.id) continue;
    try {
      if (online) {
        try {
          await fetch(`${getApiBase()}/screen-time/${record.id}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('⚠️ Server delete failed, queuing for retry', e);
          syncQueue.add({ type: 'screen_time_delete', id: record.id, data: { id: record.id } });
        }
      } else {
        syncQueue.add({ type: 'screen_time_delete', id: record.id, data: { id: record.id } });
      }
      await db.screen_time.delete(record.id);
      results.push({ id: record.id, ok: true });
      console.log(`🗑️ Deleted screen time record ${record.id}`);
    } catch (error) {
      console.error('❌ Failed to delete screen time record', record.id, error);
      results.push({ id: record.id, ok: false });
    }
  }

  if (results.length > 0) {
    markScreenTimeDeleted(results.filter(r => r.ok).map(r => r.id));
  }
  return results;
};

// ============================================================
// PULL AUDIT LOGS FROM SERVER
// ============================================================
export const pullAuditLogsFromServer = async () => {
  const online = await checkRealInternet();
  if (!online) {
    console.log('📡 Offline – skipping audit pull');
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/audit`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const serverLogs = await response.json();
    console.log(`📥 Pulled ${serverLogs.length} audit logs from server`);

    for (const log of serverLogs) {
      const localLog = {
        id: log.id,
        userId: log.user_id,
        userName: log.user_name,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp,
        ip: log.ip,
      };
      const existing = await db.audit.get(log.id);
      if (!existing) {
        await db.audit.add(localLog);
        console.log(`🔄 Added audit log: ${log.action} by ${log.user_name}`);
      }
    }
    console.log('✅ Audit pull completed');
  } catch (error) {
    console.error('❌ Pull audit logs failed:', error);
  }
};

// ============================================================
// PULL ALERTS FROM SERVER
// ============================================================
export const pullAlertsFromServer = async () => {
  const online = await checkRealInternet();
  if (!online) {
    console.log('📡 Offline – skipping alerts pull');
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/alerts`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const serverAlerts = await response.json();
    console.log(`📥 Pulled ${serverAlerts.length} alerts from server`);

    for (const alert of serverAlerts) {
      const existing = await db.alerts.get(alert.id);
      if (existing && existing.timestamp === alert.timestamp) continue;

      const localAlert = {
        id: alert.id,
        title: alert.title,
        message: alert.message,
        priority: alert.priority,
        type: alert.type,
        timestamp: alert.timestamp,
        // If this device already marked the alert read but that change is still
        // queued for sync, keep the local read state instead of reverting it.
        read: existing?.read === true && existing?.synced === false ? true : alert.read,
        targetAll: alert.target_all,
        targetEmployeeId: alert.target_employee_id,
        sentBy: alert.sent_by,
        sentByName: alert.sent_by_name,
        sentByRole: alert.sent_by_role || null,
        targetUsers: Array.isArray(alert.target_users) ? alert.target_users : [],
        synced: true,
        pending: false
      };
      await db.alerts.put(localAlert);
      console.log(`🔄 Updated alert: ${alert.title}`);
    }
    console.log('✅ Alerts pull completed');
  } catch (error) {
    console.error('❌ Pull alerts failed:', error);
  }
};

// ============================================================
// PULL VERIFICATION FROM SERVER (updated to use string ID)
// ============================================================
export const pullVerificationFromServer = async () => {
  const online = await checkRealInternet();
  if (!online) {
    console.log('📡 Offline – skipping verification pull');
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/verification`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const serverRecords = await response.json();
    console.log(`📥 Pulled ${serverRecords.length} verification records from server`);

    for (const record of serverRecords) {
      const localRecord = {
        id: record.id,
        officerId: record.officer_id,
        officerName: record.officer_name,
        question: record.question,
        answer: record.answer,
        success: record.success,
        score: record.score,
        responseTime: record.response_time,
        timestamp: record.timestamp,
        message: record.message,
        penalties: record.penalties || [],
        synced: true
      };
      const existing = await db.verification_history.get(record.id);
      if (!existing || existing.timestamp !== record.timestamp) {
        await db.verification_history.put(localRecord);
        console.log(`🔄 Added/updated verification record for ${record.officer_name}`);
      }
    }
    console.log('✅ Verification pull completed');
  } catch (error) {
    console.error('❌ Pull verification failed:', error);
  }
};

// ============================================================
// PULL SUPERVISOR REPORTS FROM SERVER
// ============================================================
export const pullSupervisorReportsFromServer = async () => {
  const online = await checkRealInternet();
  if (!online) {
    console.log('📡 Offline – skipping supervisor reports pull');
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/supervisor-reports`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const serverReports = await response.json();
    console.log(`📥 Pulled ${serverReports.length} supervisor reports from server`);
    const deletedIds = getDeletedReportIds(true);

    for (const report of serverReports) {
      if (deletedIds.has(report.id)) continue;

      const localReport = {
        id: report.id,
        supervisorId: report.supervisor_id,
        supervisorName: report.supervisor_name,
        officerId: report.officer_id,
        officerName: report.officer_name,
        officerRegion: report.officer_region,
        reportDate: report.report_date,
        performance: report.performance,
        attendance: report.attendance,
        quality: report.quality,
        punctuality: report.punctuality,
        teamwork: report.teamwork,
        communication: report.communication,
        comments: report.comments,
        recommendations: report.recommendations,
        overallRating: report.overall_rating,
        verificationCount: report.verification_count || 0,
        verificationPassed: report.verification_passed || 0,
        verificationScore: report.verification_score || 0,
        verificationPenalties: report.verification_penalties || 0,
        verificationNotes: report.verification_notes || '',
        screenTimeMinutes: report.screen_time_minutes || 0,
        screenTimeIdleMinutes: report.screen_time_idle_minutes || 0,
        screenTimeTrustScore: report.screen_time_trust_score || 0,
        status: report.status,
        submittedAt: report.submitted_at,
        region: report.region,
        type: report.type,
        synced: true
      };
      const existing = await db.supervisor_reports.get(report.id);
      if (!existing || existing.submittedAt !== localReport.submittedAt) {
        await db.supervisor_reports.put(localReport);
        console.log(`🔄 Updated supervisor report for ${report.supervisor_name}`);
      }
    }
    console.log('✅ Supervisor reports pull completed');
  } catch (error) {
    console.error('❌ Pull supervisor reports failed:', error);
  }
};

// ============================================================
// PULL REGULAR REPORTS FROM SERVER (for manager/supervisor views)
// ============================================================
export const pullReportsFromServer = async () => {
  const online = await checkRealInternet();
  if (!online) {
    console.log('📡 Offline – skipping reports pull');
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/reports`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const serverReports = await response.json();
    console.log(`📥 Pulled ${serverReports.length} reports from server`);
    const deletedIds = getDeletedReportIds(false);

    for (const report of serverReports) {
      if (isLegacyReport(report)) continue;
      if (deletedIds.has(report.report_id)) continue;

      const base = {
        reportId: report.report_id,
        employeeId: report.employee_id,
        employeeName: report.employee_name,
        supervisorId: report.supervisor_id,
        // The Postgres DATE column returns a full ISO timestamp (e.g.
        // "2026-08-12T00:00:00.000Z"). Normalize it to "YYYY-MM-DD" so it
        // matches the locally created reports and the date filters/counts
        // ("Today's reports", trends, etc.) across the app.
        reportDate: String(report.report_date || '').slice(0, 10),
        region: report.region,
        siteName: report.site_name,
        registrations: report.registrations,
        registrationEfficiency: report.registration_efficiency,
        operationalStatus: report.operational_status,
        attendance: report.attendance,
        workHours: report.work_hours,
        activities: report.activities,
        equipmentStatus: report.equipment_status,
        materialsUsed: report.materials_used,
        teamMembers: report.team_members,
        weatherConditions: report.weather_conditions,
        communityFeedback: report.community_feedback,
        challenges: report.challenges,
        issues: report.issues,
        comments: report.comments,
        submittedAt: report.submitted_at,
        latitude: report.latitude || null,
        longitude: report.longitude || null,
        gpsAccuracy: report.gps_accuracy || null,
        gpsCapturedAt: report.gps_captured_at || null,
        synced: true,
        reviewed: report.reviewed || false,
        reviewedBy: report.reviewed_by || null
      };
      // Match on reportId so a locally-created report that already synced
      // is updated instead of duplicated under the server's uuid.
      const existing = await db.reports.where('reportId').equals(report.report_id).first();
      if (existing) {
        await db.reports.update(existing.id, base);
      } else {
        await db.reports.put({ id: report.id, ...base });
      }
    }
    console.log('✅ Reports pull completed');
  } catch (error) {
    console.error('❌ Pull reports failed:', error);
  }
};

// ============================================================
// PULL CITIZENS FROM SERVER (for manager/supervisor views)
// ============================================================
export const pullCitizensFromServer = async () => {
  const online = await checkRealInternet();
  if (!online) {
    console.log('📡 Offline – skipping citizens pull');
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/citizens`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const serverCitizens = await response.json();
    console.log(`📥 Pulled ${serverCitizens.length} citizens from server`);

    for (const citizen of serverCitizens) {
      const base = {
        nationalId: citizen.national_id,
        firstName: citizen.first_name,
        lastName: citizen.last_name,
        grandfatherName: citizen.grandfather_name || '',
        dateOfBirth: citizen.date_of_birth,
        gender: citizen.gender,
        phone: citizen.phone,
        email: citizen.email || '',
        address: citizen.address || '',
        region: citizen.region || '',
        district: citizen.district || '',
        village: citizen.village || '',
        occupation: citizen.occupation || '',
        maritalStatus: citizen.marital_status || '',
        idType: citizen.id_type || 'National ID',
        idNumber: citizen.id_number || null,
        biometrics: citizen.biometrics || false,
        photo: citizen.photo || '',
        registrationDate: citizen.registration_date || citizen.created_at,
        registeredBy: citizen.registered_by || null,
        registeredByName: citizen.registered_by_name || null,
        latitude: citizen.latitude || null,
        longitude: citizen.longitude || null,
        gpsAccuracy: citizen.gps_accuracy || null,
        gpsCapturedAt: citizen.gps_captured_at || null,
        status: citizen.status || 'active',
        createdAt: citizen.created_at || citizen.registration_date,
        synced: true
      };
      const existing = await db.citizens.where('nationalId').equals(citizen.national_id).first();
      if (existing) {
        await db.citizens.update(existing.id, base);
      } else {
        await db.citizens.put({ id: citizen.id, ...base });
      }
    }
    console.log('✅ Citizens pull completed');
  } catch (error) {
    console.error('❌ Pull citizens failed:', error);
  }
};

// ============================================================
// INITIALIZE DATA (unchanged, but ensures verification_history has synced)
// ============================================================
export const initializeAllData = async () => {
  try {
    const userCount = await db.users.count();
    if (userCount > 0) {
      console.log('✅ Data already exists, skipping initialization');
      return;
    }

    console.log('📦 Initializing data...');
    const today = getToday();

    const usersWithPin = SAMPLE_USERS.map(u => ({
      ...u,
      pin: u.role === 'field_officer' ? '1234' : null
    }));

    await db.users.bulkAdd(usersWithPin);

    const fieldOfficers = usersWithPin.filter(u => u.role === 'field_officer');
    
    const attendance = fieldOfficers.map(o => ({
      id: uid(),
      employeeId: o.employeeId,
      employeeName: o.name,
      date: today,
      status: 'present',
      checkIn: '08:00',
      checkOut: '17:00',
      workHours: 8,
      region: o.region,
      supervisorId: o.supervisorId,
      notes: '',
      approved: true,
      updatedBy: 'system',
      overtime: 0,
      submittedToManager: true,
      synced: true
    }));
    await db.attendance.bulkAdd(attendance);

    const officers = usersWithPin.filter(u => u.role === 'field_officer' || u.role === 'supervisor');
    const status = officers.map(o => ({
      id: uid(),
      userId: o.id,
      employeeId: o.employeeId,
      employeeName: o.name,
      status: 'online',
      lastActive: new Date().toISOString(),
      currentTask: '',
      productivityScore: Math.floor(70 + Math.random() * 30),
      tasksCompleted: Math.floor(Math.random() * 5),
      tasksInProgress: Math.floor(Math.random() * 3),
      efficiency: Math.floor(65 + Math.random() * 35)
    }));
    await db.status.bulkAdd(status);

    const screenTime = fieldOfficers.map(o => ({
      id: uid(),
      employeeId: o.employeeId,
      employeeName: o.name,
      date: today,
      loginTime: '08:00',
      logoutTime: '17:00',
      activeHours: 8,
      idleTime: 0,
      screenTime: 8,
      trustScore: Math.floor(70 + Math.random() * 30),
      supervisorId: o.supervisorId,
      verified: true,
      notes: '',
      verifiedBy: 'system',
      screenTimeLimit: 8,
      screenTimeWarnings: 0,
      screenTimeExceeded: false,
      isLoggedIn: false,
      sessionStart: null,
      sessionEnd: null,
      totalScreenTime: 28800,
      synced: true
    }));
    await db.screen_time.bulkAdd(screenTime);

    const notifications = usersWithPin.map(u => ({
      id: uid(),
      userId: u.id,
      title: '👋 Welcome!',
      message: `Welcome to FieldSync ${u.name}!`,
      type: 'success',
      read: false,
      timestamp: new Date().toISOString(),
      link: '/dashboard'
    }));
    await db.notifications.bulkAdd(notifications);

    const leaves = [
      { id: uid(), employeeId: 'FO001', employeeName: 'Meseret Alemu', startDate: '2024-02-15', endDate: '2024-02-17', reason: 'Family event', type: 'annual', status: 'pending', createdAt: new Date().toISOString(), approvedBy: null, approvedAt: null, synced: true },
      { id: uid(), employeeId: 'FO004', employeeName: 'Meles Zenebe', startDate: '2024-02-20', endDate: '2024-02-22', reason: 'Sick', type: 'sick', status: 'pending', createdAt: new Date().toISOString(), approvedBy: null, approvedAt: null, synced: true }
    ];
    await db.leaves.bulkAdd(leaves);

    const citizens = [
      { id: uid(), nationalId: 'ETH2026-00001', firstName: 'Abebe', lastName: 'Kebede', dateOfBirth: '1990-01-01', gender: 'Male', phone: '+251-911-000001', email: 'abebe@test.com', address: 'Addis Ababa', region: 'Amhara > West Gojjam > Merawi > Kebele 01', district: 'Merawi', village: 'Kebele 01', occupation: 'Teacher', maritalStatus: 'Married', registrationDate: new Date().toISOString(), registeredBy: 'FO001', registeredByName: 'Meseret Alemu', idType: 'National ID', idNumber: 'ETH2026-00001', biometrics: false, status: 'active', synced: true },
      { id: uid(), nationalId: 'ETH2026-00002', firstName: 'Sahle', lastName: 'Work', dateOfBirth: '1985-06-15', gender: 'Female', phone: '+251-911-000002', email: 'sahle@test.com', address: 'Addis Ababa', region: 'Amhara > West Gojjam > Mecha > Kebele 02', district: 'Mecha', village: 'Kebele 02', occupation: 'Nurse', maritalStatus: 'Single', registrationDate: new Date().toISOString(), registeredBy: 'FO004', registeredByName: 'Meles Zenebe', idType: 'National ID', idNumber: 'ETH2026-00002', biometrics: false, status: 'active', synced: true },
      { id: uid(), nationalId: 'ETH2026-00003', firstName: 'Kidan', lastName: 'Tesema', dateOfBirth: '1992-03-20', gender: 'Male', phone: '+251-911-000003', email: 'kidan@test.com', address: 'Addis Ababa', region: 'Oromia > East Shewa > Adama > Kebele 03', district: 'Adama', village: 'Kebele 03', occupation: 'Engineer', maritalStatus: 'Single', registrationDate: new Date().toISOString(), registeredBy: 'FO007', registeredByName: 'Fikre Gebreegziabher', idType: 'National ID', idNumber: 'ETH2026-00003', biometrics: false, status: 'active', synced: true }
    ];
    await db.citizens.bulkAdd(citizens);

    const supervisorReports = [{
      id: uid(),
      supervisorId: 's1',
      supervisorName: 'Birhan Gebreegziabher',
      officerId: 'o1',
      officerName: 'Meseret Alemu',
      officerRegion: '',
      reportDate: today,
      performance: 'good',
      attendance: 'good',
      quality: 'good',
      punctuality: 'good',
      teamwork: 'good',
      communication: 'good',
      comments: 'Good performance',
      recommendations: 'Keep it up',
      overallRating: 4,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      region: '',
      type: 'officer_report',
      synced: true
    }];
    await db.supervisor_reports.bulkAdd(supervisorReports);

    const audit = [
      { id: uid(), userId: 'MGR001', userName: 'Abebe Bekele', action: 'LOGIN', details: 'User logged in', timestamp: new Date().toISOString(), ip: '127.0.0.1' },
      { id: uid(), userId: 'FO001', userName: 'Meseret Alemu', action: 'SUBMIT_REPORT', details: 'Report submitted', timestamp: new Date().toISOString(), ip: '127.0.0.1' }
    ];
    await db.audit.bulkAdd(audit);

    const alerts = [{
      id: uid(),
      title: 'Emergency Meeting',
      message: 'All officers must attend emergency meeting at 2pm today',
      priority: 'high',
      type: 'emergency',
      timestamp: new Date().toISOString(),
      read: false,
      targetAll: true,
      targetEmployeeId: null,
      sentBy: 'MGR001',
      sentByName: 'Abebe Bekele'
    }];
    await db.alerts.bulkAdd(alerts);

    const permissions = [{
      id: uid(),
      employeeId: 'FO001',
      employeeName: 'Meseret Alemu',
      permissionType: 'Work Permission',
      startDate: '2024-02-25',
      endDate: '2024-02-25',
      reason: 'Medical appointment',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      synced: true
    }];
    await db.permissions.bulkAdd(permissions);

    // Initialize verification_history with synced records
    const verificationHistory = fieldOfficers.map(o => ({
      id: uid(),
      officerId: o.id,
      officerName: o.name,
      question: 'What is your current location?',
      answer: 'Field',
      timestamp: new Date().toISOString(),
      responseTime: Math.floor(5 + Math.random() * 15),
      score: Math.floor(70 + Math.random() * 30),
      penalties: [],
      questionId: 'q1',
      success: true,
      message: '✅ Verification passed!',
      synced: true
    }));
    await db.verification_history.bulkAdd(verificationHistory);

    console.log('✅ Data initialization complete!');
    console.log('📧 Login with your credentials:');
    console.log('   Manager: abebe@fieldsync.com / manager123');
    console.log('   Supervisor: birhan@fieldsync.com / super123');
    console.log('   Officer: meseret@fieldsync.com / officer123');
    console.log('   Officer PIN: 1234');
  } catch (error) {
    console.error('Error initializing data:', error);
  }
};