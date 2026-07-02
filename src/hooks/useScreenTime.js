import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/database';
import { getToday, getCurrentTime, formatTime } from '../utils/helpers';

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
  }, [user]);

  const startScreenTime = useCallback(async () => {
    if (!user || isScreenTimeRunning || user.role !== 'field_officer') return;

    const today = getToday();
    const currentTime = getCurrentTime();

    const existingSession = await db.screen_time
      .where('employeeId')
      .equals(user.employeeId)
      .and(s => s.date === today && s.isLoggedIn === true)
      .first();

    if (existingSession) {
      setScreenTimeSessionId(existingSession.id);
      const elapsed = Date.now() - new Date(existingSession.sessionStart).getTime();
      const seconds = elapsed / 1000;
      setScreenTimeCounter(seconds);
      setScreenTimeDisplay(formatTime(seconds));
      setIsScreenTimeRunning(true);
      startTimeRef.current = Date.now() - elapsed;

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const newElapsed = (Date.now() - startTimeRef.current) / 1000;
          setScreenTimeCounter(newElapsed);
          setScreenTimeDisplay(formatTime(newElapsed));
          updateScreenTime(newElapsed);
        }
      }, 1000);
      return;
    }

    const sessionId = `session_${Date.now()}`;
    setScreenTimeSessionId(sessionId);

    await db.screen_time.add({
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
      totalScreenTime: 0
    });

    await db.status.where('employeeId').equals(user.employeeId).modify({
      status: 'online',
      lastActive: new Date().toISOString()
    });

    setScreenTimeCounter(0);
    setScreenTimeDisplay('00:00:00');
    setIsScreenTimeRunning(true);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setScreenTimeCounter(elapsed);
        setScreenTimeDisplay(formatTime(elapsed));
        updateScreenTime(elapsed);
      }
    }, 1000);
  }, [user, isScreenTimeRunning]);

  const updateScreenTime = async (elapsed) => {
    if (Math.floor(elapsed) % 5 === 0 && Math.floor(elapsed) > 0 && screenTimeSessionId) {
      const hours = elapsed / 3600;
      await db.screen_time.update(screenTimeSessionId, {
        screenTime: Math.round(hours * 10) / 10,
        totalScreenTime: elapsed,
        activeHours: Math.round(hours * 10) / 10
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
    const today = getToday();

    if (screenTimeSessionId) {
      await db.screen_time.update(screenTimeSessionId, {
        logoutTime: currentTime,
        sessionEnd: new Date().toISOString(),
        isLoggedIn: false,
        screenTime: Math.round(totalHours * 10) / 10,
        activeHours: Math.round(totalHours * 10) / 10,
        totalScreenTime: totalSeconds,
        screenTimeExceeded: totalHours > 8,
        verified: true,
        verifiedBy: 'system'
      });
    }

    await db.status.where('employeeId').equals(user.employeeId).modify({
      status: 'offline',
      lastActive: new Date().toISOString()
    });

    setIsScreenTimeRunning(false);
    startTimeRef.current = null;
    setScreenTimeSessionId(null);
    setScreenTimeCounter(0);
    setScreenTimeDisplay('00:00:00');
  }, [user, isScreenTimeRunning, screenTimeCounter, screenTimeSessionId]);

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
    stopScreenTime
  };
}