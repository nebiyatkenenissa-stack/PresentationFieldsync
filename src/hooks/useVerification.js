// hooks/useVerification.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { db, checkRealInternet, syncQueue } from '../services/database';
import { uid } from '../utils/helpers';

const API_BASE_URL = 'http://localhost:5000/api';

const VERIFICATION_QUESTIONS = [
  {
    id: 'q1',
    question: 'What is your current location?',
    options: ['Office', 'Field', 'Home', 'Other']
  },
  {
    id: 'q2',
    question: 'How many citizens did you register today?',
    options: ['0-5', '6-10', '11-15', '16+']
  },
  {
    id: 'q3',
    question: 'What is your current task?',
    options: ['Field Visit', 'Report Writing', 'Data Entry', 'Meeting']
  },
  {
    id: 'q4',
    question: 'How many reports did you submit today?',
    options: ['0-2', '3-5', '6-8', '9+']
  },
  {
    id: 'q5',
    question: 'What is your estimated work completion?',
    options: ['0-25%', '26-50%', '51-75%', '76-100%']
  }
];

const sendVerificationToServer = async (record) => {
  const response = await fetch(`${API_BASE_URL}/verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }
  return response.json();
};

export function useVerification(officerId, officerName) {
  const [showPopup, setShowPopup] = useState(false);
  const [verificationScore, setVerificationScore] = useState(100);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [lastVerified, setLastVerified] = useState(null);

  const timerRef = useRef(null);
  const isMounted = useRef(true);
  const isPopupOpen = useRef(false);

  // ===== LOAD STATE =====
  useEffect(() => {
    if (!officerId) return;

    const loadData = async () => {
      try {
        const saved = localStorage.getItem(`verification_${officerId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setVerificationScore(parsed.score || 100);
          setVerificationHistory(parsed.history || []);
          setLastVerified(parsed.lastVerified || null);
        }
        if (db && db.verification_history) {
          const history = await db.verification_history
            .where('officerId')
            .equals(officerId)
            .toArray();
          if (history.length > 0) {
            setVerificationHistory(history);
          }
        }
      } catch (e) {
        console.error('Error loading verification data:', e);
      }
    };

    loadData();

    const handleUpdate = (event) => {
      if (event.detail?.officerId === officerId) {
        loadData();
      }
    };
    window.addEventListener('verification-update', handleUpdate);

    return () => {
      window.removeEventListener('verification-update', handleUpdate);
    };
  }, [officerId]);

  // ===== SAVE STATE =====
  const saveState = useCallback(async (score, history, lastVerifiedTime) => {
    if (!officerId || !isMounted.current) return;
    try {
      const state = {
        score,
        history: history.slice(0, 50),
        lastVerified: lastVerifiedTime
      };
      localStorage.setItem(`verification_${officerId}`, JSON.stringify(state));
      if (db && db.verification_history) {
        for (const entry of history) {
          await db.verification_history.put({
            ...entry,
            officerId: officerId,
            officerName: officerName
          });
        }
      }
      window.dispatchEvent(new CustomEvent('verification-update', {
        detail: { officerId, score, history }
      }));
    } catch (e) {
      console.error('Error saving verification state:', e);
    }
  }, [officerId, officerName]);

  // ===== TRUST SCORE CALCULATION =====
  const calculateTrustScore = useCallback((answers, responseTime) => {
    let score = 100;
    const penalties = [];
    if (responseTime > 30) {
      const penalty = Math.min(20, Math.floor((responseTime - 30) / 5) * 2);
      penalties.push(`Slow response: -${penalty}%`);
      score -= penalty;
    }
    const suspiciousPatterns = [
      { pattern: /0-5/i, penalty: 5 },
      { pattern: /field/i, penalty: 3 },
      { pattern: /0-25%/i, penalty: 5 }
    ];
    answers.forEach(answer => {
      suspiciousPatterns.forEach(({ pattern, penalty }) => {
        if (pattern.test(answer)) {
          penalties.push(`Suspicious answer: -${penalty}%`);
          score -= penalty;
        }
      });
    });
    const randomFactor = Math.floor(Math.random() * 5) - 2;
    if (randomFactor !== 0) {
      penalties.push(`Random variation: ${randomFactor > 0 ? '+' : ''}${randomFactor}%`);
      score += randomFactor;
    }
    score = Math.max(0, Math.min(100, score));
    return { score, penalties };
  }, []);

  // ===== GET RANDOM QUESTION =====
  const getRandomQuestion = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * VERIFICATION_QUESTIONS.length);
    return VERIFICATION_QUESTIONS[randomIndex];
  }, []);

  // ===== SHOW POPUP NOW (called after 5s initial delay or immediately when scheduling) =====
  const showPopupNow = useCallback(() => {
    if (isPopupOpen.current || !isMounted.current || !officerId) return;
    const question = getRandomQuestion();
    setCurrentQuestion({
      ...question,
      timestamp: Date.now()
    });
    setShowPopup(true);
    isPopupOpen.current = true;
    console.log(`🔔 Verification popup triggered for ${officerName}`);
  }, [officerId, officerName, getRandomQuestion]);

  // ===== SCHEDULE NEXT VERIFICATION (with optional delay) =====
  const scheduleNext = useCallback((delayMs = 5 * 60 * 1000) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isMounted.current || !officerId) return;

    timerRef.current = setTimeout(() => {
      // If popup is still open, don't trigger a new one, just reschedule
      if (isPopupOpen.current) {
        scheduleNext(30 * 1000); // check again in 30 seconds
        return;
      }
      if (isMounted.current && officerId) {
        showPopupNow();
      }
    }, delayMs);
  }, [officerId, showPopupNow]);

  // ===== HANDLE ANSWER =====
  const handleAnswer = useCallback(async (answerData) => {
    if (!currentQuestion || !officerId || !isMounted.current) return;

    const responseTime = (Date.now() - currentQuestion.timestamp) / 1000;
    const { score: trustScore, penalties } = calculateTrustScore([answerData.answer || answerData], responseTime);

    const historyEntry = {
      id: uid(),
      officerId: officerId,
      officerName: officerName,
      question: currentQuestion.question,
      answer: answerData.answer || answerData,
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
      score: trustScore,
      penalties: penalties,
      questionId: currentQuestion.id,
      success: trustScore >= 60,
      message: trustScore >= 60 ? '✅ Verification passed!' : '⚠️ Verification warning'
    };

    const updatedHistory = [historyEntry, ...verificationHistory].slice(0, 50);
    const updatedScore = Math.round((verificationScore + trustScore) / 2);
    const now = new Date().toISOString();

    setVerificationHistory(updatedHistory);
    setVerificationScore(updatedScore);
    setLastVerified(now);
    setShowPopup(false);
    setCurrentQuestion(null);
    isPopupOpen.current = false;

    await saveState(updatedScore, updatedHistory, now);

    // Sync to server
    const online = await checkRealInternet();
    if (online) {
      try {
        await sendVerificationToServer(historyEntry);
        console.log('✅ Verification synced to server');
      } catch (error) {
        console.error('Failed to sync verification:', error);
        syncQueue.add({
          type: 'verification',
          id: historyEntry.id,
          data: historyEntry
        });
      }
    } else {
      syncQueue.add({
        type: 'verification',
        id: historyEntry.id,
        data: historyEntry
      });
    }

    // Schedule next in exactly 5 minutes
    scheduleNext(5 * 60 * 1000);

    window.dispatchEvent(new CustomEvent('verification-update', {
      detail: { officerId, score: updatedScore, history: updatedHistory }
    }));
  }, [currentQuestion, officerId, officerName, verificationHistory, verificationScore, calculateTrustScore, saveState, scheduleNext]);

  // ===== HANDLE SKIP =====
  const handleClose = useCallback(async () => {
    if (!isMounted.current || !isPopupOpen.current) return;
    setShowPopup(false);
    setCurrentQuestion(null);
    isPopupOpen.current = false;

    const penalty = 5;
    const updatedScore = Math.max(0, verificationScore - penalty);
    setVerificationScore(updatedScore);
    const now = new Date().toISOString();

    await saveState(updatedScore, verificationHistory, lastVerified || now);

    // Schedule next in exactly 5 minutes
    scheduleNext(5 * 60 * 1000);
  }, [verificationScore, verificationHistory, lastVerified, saveState, scheduleNext]);

  // ===== INIT: show popup after 5s if not verified recently =====
  useEffect(() => {
    isMounted.current = true;
    isPopupOpen.current = false;
    if (!officerId) return;

    const shouldShow = !lastVerified ||
      (Date.now() - new Date(lastVerified).getTime()) > 5 * 60 * 1000;

    if (shouldShow) {
      // Show after 5 seconds to let the app fully load
      const initialTimer = setTimeout(() => {
        if (isMounted.current && officerId && !isPopupOpen.current) {
          showPopupNow();
        }
      }, 5000);
      return () => clearTimeout(initialTimer);
    } else {
      // Schedule next verification at the appropriate time
      const timeSinceLast = Date.now() - new Date(lastVerified).getTime();
      const timeToNext = Math.max(0, 5 * 60 * 1000 - timeSinceLast);
      scheduleNext(timeToNext);
    }

    return () => {
      isMounted.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [officerId, lastVerified, showPopupNow, scheduleNext]);

  return {
    showPopup,
    verificationScore,
    verificationHistory,
    currentQuestion,
    lastVerified,
    handleAnswer,
    handleClose
  };
}