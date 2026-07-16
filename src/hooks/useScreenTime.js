// hooks/useScreenTime.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { db, checkRealInternet, syncQueue } from '../services/database';
import { getToday, getCurrentTime, formatTime } from '../utils/helpers';

const API_BASE_URL = 'http://localhost:5000/api';

// Helper to send screen time record to server
const sendScreenTimeToServer = async (record) => {
  const response = await fetch(`${API_BASE_URL}/screen-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }
  return response.json();
};

export function useScreenTime(user) {
  const [screenTimeCounter, setScreenTimeCounter] = useState(0);
  const [screenTimeDisplay, setScreenTimeDisplay] = useState('00:00:00');
  const [isScreenTimeRunning, setIsScreenTimeRunning] = useState(false);
  const [screenTimeSessionId, setScreenTimeSessionId] = useState(null);

  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // AUTO-START when user logs in (for officers only)
  useEffect(() => {
    if (user && user.role === 'field_officer' && !isScreenTimeRunning) {
      startScreenTime();
    }
    return () => {
      if (isScreenTimeRunning) {
        stopScreenTime();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const startScreenTime = useCallback(async () => {
    if (!user || isScreenTimeRunning || user.role !== 'field_officer') return;

    const today = getToday();
    const currentTime = getCurrentTime();
    const online = await checkRealInternet();

    // 1. Check for any existing active session (should be closed, but just in case)
    const existingSession = await db.screen_time
      .where('employeeId')
      .equals(user.employeeId)
      .and(s => s.date === today && s.isLoggedIn === true)
      .first();

    // If there's an active session, force stop it to ensure clean state
    if (existingSession) {
      console.log('⚠️ Found active session, closing it before starting fresh');
      await db.screen_time.update(existingSession.id, {
        logoutTime: getCurrentTime(),
        sessionEnd: new Date().toISOString(),
        isLoggedIn: false,
        synced: false
      });
      // Also queue this update for sync later
      const updatedRecord = await db.screen_time.get(existingSession.id);
      if (updatedRecord) {
        syncQueue.add({
          type: 'screen_time',
          id: updatedRecord.id,
          data: updatedRecord
        });
      }
    }

    // 2. Create a brand new session with zero totals
    const sessionId = `session_${Date.now()}`;
    setScreenTimeSessionId(sessionId);

    const record = {
      id: sessionId,
      employeeId: user.employeeId,
      employeeName: user.name,
      date: today,
      loginTime: currentTime,
      logoutTime: null,
      activeHours: 0,
      idleTime: 0,
      screenTime: 0,
      trustScore: 70,
      supervisorId: user.supervisorId,
      verified: false,
      notes: '',
      verifiedBy: null,
      screenTimeLimit: 8,
      screenTimeWarnings: 0,
      screenTimeExceeded: false,
      isLoggedIn: true,
      sessionStart: new Date().toISOString(),
      sessionEnd: null,
      totalScreenTime: 0,           // <-- starts at zero
      synced: online ? true : false,
    };

    // Save to IndexedDB
    await db.screen_time.add(record);

    // Update live status
    await db.status.where('employeeId').equals(user.employeeId).modify({
      status: 'online',
      lastActive: new Date().toISOString()
    });

    // Push to server if online
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

    // Start UI timer
    setScreenTimeCounter(0);
    setScreenTimeDisplay('00:00:00');
    setIsScreenTimeRunning(true);
    startTimeRef.current = Date.now();

    // Clear any previous interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setScreenTimeCounter(elapsed);
        setScreenTimeDisplay(formatTime(elapsed));
        updateScreenTime(elapsed);
      }
    }, 1000);
  }, [user, isScreenTimeRunning]);

  // Periodic update of total time in IndexedDB (local only)
  const updateScreenTime = async (elapsed) => {
    if (Math.floor(elapsed) % 5 === 0 && Math.floor(elapsed) > 0 && screenTimeSessionId) {
      const hours = elapsed / 3600;
      await db.screen_time.update(screenTimeSessionId, {
        screenTime: Math.round(hours * 10) / 10,
        totalScreenTime: elapsed,
        activeHours: Math.round(hours * 10) / 10,
      });
    }
  };

  const stopScreenTime = useCallback(async () => {
    if (!user || !isScreenTimeRunning) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const totalSeconds = screenTimeCounter;
    const totalHours = totalSeconds / 3600;
    const currentTime = getCurrentTime();
    const online = await checkRealInternet();

    // Prepare final update
    const finalUpdate = {
      logoutTime: currentTime,
      sessionEnd: new Date().toISOString(),
      isLoggedIn: false,
      screenTime: Math.round(totalHours * 10) / 10,
      activeHours: Math.round(totalHours * 10) / 10,
      totalScreenTime: totalSeconds,
      screenTimeExceeded: totalHours > 8,
      verified: true,
      verifiedBy: 'system',
      synced: online ? true : false,
    };

    // Update IndexedDB
    if (screenTimeSessionId) {
      await db.screen_time.update(screenTimeSessionId, finalUpdate);
    }

    // Update status
    await db.status.where('employeeId').equals(user.employeeId).modify({
      status: 'offline',
      lastActive: new Date().toISOString()
    });

    // Fetch the full updated record
    const fullRecord = await db.screen_time.get(screenTimeSessionId);
    if (!fullRecord) {
      console.warn('No full record found, skipping sync');
      setIsScreenTimeRunning(false);
      startTimeRef.current = null;
      setScreenTimeSessionId(null);
      setScreenTimeCounter(0);
      setScreenTimeDisplay('00:00:00');
      return;
    }

    // Sync to server
    if (online) {
      try {
        await sendScreenTimeToServer(fullRecord);
        await db.screen_time.update(screenTimeSessionId, { synced: true });
        console.log('✅ Screen time final record synced to server');
      } catch (error) {
        console.error('Failed to sync screen time stop:', error);
        await db.screen_time.update(screenTimeSessionId, { synced: false });
        syncQueue.add({
          type: 'screen_time',
          id: screenTimeSessionId,
          data: fullRecord,
        });
        console.log('📦 Screen time final record queued for offline sync');
      }
    } else {
      syncQueue.add({
        type: 'screen_time',
        id: screenTimeSessionId,
        data: fullRecord,
      });
      console.log('📦 Screen time final record queued (offline)');
    }

    // Reset state
    setIsScreenTimeRunning(false);
    startTimeRef.current = null;
    setScreenTimeSessionId(null);
    setScreenTimeCounter(0);
    setScreenTimeDisplay('00:00:00');
  }, [user, isScreenTimeRunning, screenTimeCounter, screenTimeSessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    screenTimeDisplay,
    isScreenTimeRunning,
    screenTimeCounter,
    startScreenTime,
    stopScreenTime,
  };
}