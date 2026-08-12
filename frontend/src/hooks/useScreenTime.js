// hooks/useScreenTime.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { db, checkRealInternet, syncQueue, getApiBase } from '../services/database';
import { getToday, getCurrentTime, formatTime } from '../utils/helpers';

const API_BASE_URL = getApiBase();

// Helper to send screen time record to server (timeout so it never hangs)
const sendScreenTimeToServer = async (record) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE_URL}/screen-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

// Convert a stored sessionStart value to a valid epoch ms (or null)
const parseSessionStart = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const MAX_SECONDS = 24 * 60 * 60;

// Module-level lock so the async auto-start (which can fire twice in React
// StrictMode dev) never creates two sessions for the same officer.
let startingLock = false;

export function useScreenTime(user) {
  const [screenTimeCounter, setScreenTimeCounter] = useState(0);
  const [screenTimeDisplay, setScreenTimeDisplay] = useState('00:00:00');
  const [isScreenTimeRunning, setIsScreenTimeRunning] = useState(false);
  const [isIdle, setIsIdle] = useState(false);

  const intervalRef = useRef(null);
  // Ticks since the session started – used to periodically sync to the server.
  const periodicTickRef = useRef(0);
  // Active session: { id, sessionStart (epoch ms), idleSeconds }
  const sessionRef = useRef(null);
  // Epoch ms when the current "idle" (hidden tab / lost focus) period began
  const idleStartRef = useRef(null);

  // ===== PERSIST CURRENT TOTALS TO INDEXEDDB =====
  // Uses a ref (not state) so the running interval never reads stale values.
  const persistElapsed = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    const now = Date.now();
    const elapsed = Math.min(Math.max(0, (now - session.sessionStart) / 1000), MAX_SECONDS);
    const idle = session.idleSeconds +
      (idleStartRef.current !== null ? (now - idleStartRef.current) / 1000 : 0);
    const totalSeconds = Math.round(elapsed);
    const totalHours = totalSeconds / 3600;

    try {
      await db.screen_time.update(session.id, {
        screenTime: Math.round(totalHours * 10) / 10,
        activeHours: Math.round(totalHours * 10) / 10,
        idleTime: Math.round(idle),
        totalScreenTime: totalSeconds,
      });
    } catch (e) {
      // Record may have been removed – ignore
    }
  }, []);

  // ===== PUSH CURRENT SESSION TO SERVER =====
  // The running totals are pushed periodically (and on page hide) so the
  // server always has the latest screen time even if this device's
  // IndexedDB is ever cleared by the browser.
  const syncSessionToServer = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    const online = await checkRealInternet();
    if (!online) return;
    const fullRecord = await db.screen_time.get(session.id);
    if (!fullRecord) return;
    try {
      await sendScreenTimeToServer(fullRecord);
      await db.screen_time.update(session.id, { synced: true });
    } catch (error) {
      // Best effort – the final stop sync will retry if needed.
      console.warn('⚠️ Periodic screen time sync failed:', error);
    }
  }, []);

  // ===== UI TICK =====
  const tick = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const elapsed = Math.min(Math.max(0, (Date.now() - session.sessionStart) / 1000), MAX_SECONDS);
    setScreenTimeCounter(elapsed);
    setScreenTimeDisplay(formatTime(elapsed));
  }, []);

  // ===== IDLE TRACKING =====
  // Switching to another tab/window is stored as idle time, but the total
  // (exact real time since login) keeps counting no matter what.
  const beginIdle = useCallback(() => {
    if (idleStartRef.current !== null) return;
    idleStartRef.current = Date.now();
    setIsIdle(true);
  }, []);

  const endIdle = useCallback(() => {
    if (idleStartRef.current === null) return;
    const session = sessionRef.current;
    if (session) {
      session.idleSeconds += (Date.now() - idleStartRef.current) / 1000;
    }
    idleStartRef.current = null;
    setIsIdle(false);
    persistElapsed();
  }, [persistElapsed]);

  // ===== STOP INTERVAL =====
  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ===== START / RESUME SESSION =====
  const startScreenTime = useCallback(async () => {
    if (!user || sessionRef.current || startingLock || user.role !== 'field_officer') return;
    startingLock = true;

    try {
      const today = getToday();
      const online = await checkRealInternet();

      // 1. Close any stale active sessions from previous days (they held 0 totals)
      const stale = await db.screen_time
        .where('employeeId')
        .equals(user.employeeId)
        .and(s => s.isLoggedIn === true && s.date !== today)
        .toArray();

      for (const st of stale) {
        const start = parseSessionStart(st.sessionStart) || Date.now();
        const total = Math.round(Math.min(Math.max(0, (Date.now() - start) / 1000), MAX_SECONDS));
        await db.screen_time.update(st.id, {
          logoutTime: getCurrentTime(),
          sessionEnd: new Date().toISOString(),
          isLoggedIn: false,
          totalScreenTime: total,
          screenTime: Math.round((total / 3600) * 10) / 10,
          activeHours: Math.round((total / 3600) * 10) / 10,
          synced: false,
        });
        const fullStale = await db.screen_time.get(st.id);
        if (fullStale) {
          syncQueue.add({ type: 'screen_time', id: st.id, data: fullStale });
        }
      }

      // 2. Resume today's active session if one exists (exact time is kept)
      const existing = await db.screen_time
        .where('employeeId')
        .equals(user.employeeId)
        .and(s => s.date === today && s.isLoggedIn === true)
        .first();

      let sessionId;
      let baseStart;
      let idleBase = 0;

      if (existing) {
        sessionId = existing.id;
        baseStart = parseSessionStart(existing.sessionStart) || Date.now();
        idleBase = existing.idleTime || 0;
      } else {
        sessionId = `session_${Date.now()}`;
        baseStart = Date.now();

        const record = {
          id: sessionId,
          employeeId: user.employeeId,
          employeeName: user.name,
          date: today,
          loginTime: getCurrentTime(),
          logoutTime: null,
          activeHours: 0,
          idleTime: 0,
          screenTime: 0,
          trustScore: 70,
          supervisorId: user.supervisorId,
          verified: false,
          notes: '',
          verifiedBy: null,
          isLoggedIn: true,
          sessionStart: new Date(baseStart).toISOString(),
          sessionEnd: null,
          totalScreenTime: 0,
          synced: online ? true : false,
        };

        await db.screen_time.add(record);

        // Push start to server if online
        if (online) {
          try {
            await sendScreenTimeToServer(record);
            await db.screen_time.update(sessionId, { synced: true });
            console.log('✅ Screen time start synced to server');
          } catch (error) {
            console.error('Failed to sync screen time start:', error);
            await db.screen_time.update(sessionId, { synced: false });
            syncQueue.add({ type: 'screen_time', id: sessionId, data: record });
          }
        } else {
          syncQueue.add({ type: 'screen_time', id: sessionId, data: record });
        }
      }

      sessionRef.current = {
        id: sessionId,
        sessionStart: baseStart,
        idleSeconds: idleBase,
      };

      // Mark officer online
      await db.status.where('employeeId').equals(user.employeeId).modify({
        status: 'online',
        lastActive: new Date().toISOString()
      });

      // Start UI timer
      setIsScreenTimeRunning(true);
      setIsIdle(false);
      idleStartRef.current = null;

      stopInterval();
      tick();
      persistElapsed();
      periodicTickRef.current = 0;

      intervalRef.current = setInterval(() => {
        tick();
        persistElapsed();
        periodicTickRef.current += 1;
        if (periodicTickRef.current % 60 === 0) {
          syncSessionToServer();
        }
      }, 1000);
    } finally {
      startingLock = false;
    }
  }, [user, tick, persistElapsed, stopInterval, syncSessionToServer]);

  // ===== STOP SESSION =====
  const stopScreenTime = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    stopInterval();

    const now = Date.now();
    if (idleStartRef.current !== null) {
      session.idleSeconds += (now - idleStartRef.current) / 1000;
      idleStartRef.current = null;
    }
    setIsIdle(false);

    const totalSeconds = Math.min(Math.max(0, (now - session.sessionStart) / 1000), MAX_SECONDS);
    const totalHours = totalSeconds / 3600;
    const currentTime = getCurrentTime();
    const online = await checkRealInternet();

    // Prepare final update with the exact real elapsed time
    const finalUpdate = {
      logoutTime: currentTime,
      sessionEnd: new Date().toISOString(),
      isLoggedIn: false,
      screenTime: Math.round(totalHours * 10) / 10,
      activeHours: Math.round(totalHours * 10) / 10,
      idleTime: Math.round(session.idleSeconds),
      totalScreenTime: Math.round(totalSeconds),
      verified: true,
      verifiedBy: 'system',
      synced: online ? true : false,
    };

    // Update IndexedDB
    await db.screen_time.update(session.id, finalUpdate);

    // Update status
    await db.status.where('employeeId').equals(user.employeeId).modify({
      status: 'offline',
      lastActive: new Date().toISOString()
    });

    // Fetch the full updated record
    const fullRecord = await db.screen_time.get(session.id);
    if (!fullRecord) {
      console.warn('No full record found, skipping sync');
      sessionRef.current = null;
      setIsScreenTimeRunning(false);
      setScreenTimeCounter(0);
      setScreenTimeDisplay('00:00:00');
      return;
    }

    // Sync to server
    if (online) {
      try {
        await sendScreenTimeToServer(fullRecord);
        await db.screen_time.update(session.id, { synced: true });
        console.log('✅ Screen time final record synced to server');
      } catch (error) {
        console.error('Failed to sync screen time stop:', error);
        await db.screen_time.update(session.id, { synced: false });
        syncQueue.add({ type: 'screen_time', id: session.id, data: fullRecord });
        console.log('📦 Screen time final record queued for offline sync');
      }
    } else {
      syncQueue.add({ type: 'screen_time', id: session.id, data: fullRecord });
      console.log('📦 Screen time final record queued (offline)');
    }

    // Reset state
    sessionRef.current = null;
    setIsScreenTimeRunning(false);
    setScreenTimeCounter(0);
    setScreenTimeDisplay('00:00:00');
  }, [user, stopInterval]);

  // ===== IDLE EVENTS (tab hidden / window blurred) =====
  // The total time is NEVER paused – hidden time is just recorded as idle.
  useEffect(() => {
    if (!user || user.role !== 'field_officer') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        beginIdle();
      } else {
        endIdle();
      }
    };

    const handleBlur = () => beginIdle();
    const handleFocus = () => endIdle();

    const handlePageHide = () => {
      if (idleStartRef.current !== null) endIdle();
      persistElapsed();
      syncSessionToServer();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [user, beginIdle, endIdle, persistElapsed, syncSessionToServer]);

  // ===== AUTO-START when user logs in (for officers only) =====
  useEffect(() => {
    if (user && user.role === 'field_officer' && !sessionRef.current) {
      startScreenTime();
    }
  }, [user, startScreenTime]);

  // ===== CLEANUP INTERVAL ON UNMOUNT =====
  // The session stays open in the DB so it can be resumed after refresh/re-login.
  useEffect(() => {
    return () => {
      stopInterval();
    };
  }, [stopInterval]);

  return {
    screenTimeDisplay,
    isScreenTimeRunning,
    isIdle,
    screenTimeCounter,
    startScreenTime,
    stopScreenTime,
  };
}
