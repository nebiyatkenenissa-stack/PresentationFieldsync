// components/verification/VerificationPopup.jsx
// FIRST: 30 seconds → THEN: random 2–15 minutes (unpredictable)

import React, { useState, useEffect, useRef } from 'react';

function VerificationPopup({ officerId, officerName, onAnswer, onClose }) {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [question, setQuestion] = useState({
    question: 'What is your current location?',
    options: ['Office', 'Field', 'Home', 'Other']
  });
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(30); // first interval: 30s
  const [appearTime, setAppearTime] = useState(null);

  const verificationCountRef = useRef(0);
  const countdownRef = useRef(null);
  const popupTimeoutRef = useRef(null);
  const isAnsweredRef = useRef(false);

  // ============================================================
  // GET RANDOM INTERVAL (2–15 minutes)
  // ============================================================
  const getRandomIntervalSeconds = () => {
    const min = 2 * 60;  // 2 minutes
    const max = 15 * 60; // 15 minutes
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // ============================================================
  // CALCULATE NEXT INTERVAL
  // ============================================================
  const getNextIntervalSeconds = (count) => {
    if (count === 0) {
      return 30; // first popup after 30 seconds
    }
    return getRandomIntervalSeconds();
  };

  // ============================================================
  // START COUNTDOWN
  // ============================================================
  const startCountdown = () => {
    const totalSeconds = getNextIntervalSeconds(verificationCountRef.current);
    let remaining = totalSeconds;
    setCountdown(remaining);

    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        showPopup();
      }
    }, 1000);
  };

  // ============================================================
  // SHOW POPUP
  // ============================================================
  const showPopup = () => {
    setIsVisible(true);
    setAppearTime(Date.now());

    const questions = [
      { question: 'What is your current location?', options: ['Office', 'Field', 'Home', 'Other'] },
      { question: 'How many citizens did you register today?', options: ['0-5', '6-10', '11-15', '16+'] },
      { question: 'What is your current task?', options: ['Field Visit', 'Report Writing', 'Data Entry', 'Meeting'] },
      { question: 'How many reports did you submit today?', options: ['0-2', '3-5', '6-8', '9+'] },
      { question: 'What is your estimated work completion?', options: ['0-25%', '26-50%', '51-75%', '76-100%'] }
    ];
    const randomIndex = Math.floor(Math.random() * questions.length);
    setQuestion(questions[randomIndex]);
    setSelectedAnswer('');
    isAnsweredRef.current = false;

    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => {
      if (!isAnsweredRef.current && isVisible) {
        const responseTime = Math.round((Date.now() - appearTime) / 1000);
        const result = {
          success: false,
          question: question.question,
          answer: 'Timeout',
          responseTime: responseTime,
          officerId,
          officerName,
          message: '⏰ Verification timed out'
        };
        isAnsweredRef.current = true;
        setIsVisible(false);
        onAnswer(result);
        verificationCountRef.current += 1;
        startCountdown();
      }
    }, 60000);
  };

  // ============================================================
  // INITIAL SETUP
  // ============================================================
  useEffect(() => {
    startCountdown();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, []);

  // ============================================================
  // HANDLE SUBMIT
  // ============================================================
  const handleSubmit = () => {
    if (!selectedAnswer) {
      alert('Please select an answer');
      return;
    }
    if (isAnsweredRef.current) return;

    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);

    const responseTime = Math.round((Date.now() - appearTime) / 1000);
    const result = {
      success: true,
      question: question.question,
      answer: selectedAnswer,
      responseTime: responseTime,
      officerId,
      officerName,
      message: '✅ Verification passed!'
    };

    isAnsweredRef.current = true;
    setIsVisible(false);
    onAnswer(result);

    verificationCountRef.current += 1;
    startCountdown();
  };

  // ============================================================
  // HANDLE SKIP
  // ============================================================
  const handleSkip = () => {
    if (isAnsweredRef.current) return;

    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);

    const responseTime = Math.round((Date.now() - appearTime) / 1000);
    const result = {
      success: false,
      question: question.question,
      answer: 'Skipped',
      responseTime: responseTime,
      officerId,
      officerName,
      message: '⏰ Verification skipped'
    };

    isAnsweredRef.current = true;
    setIsVisible(false);
    onAnswer(result);

    verificationCountRef.current += 1;
    startCountdown();
  };

  // ============================================================
  // FORMAT COUNTDOWN (only the timer, no interval label)
  // ============================================================
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      {/* ===== COUNTDOWN INDICATOR (only timer) ===== */}
      <div className="verification-countdown-indicator">
        <span className="countdown-icon">🔍</span>
        <span className="countdown-label">Next verification in:</span>
        <span className="countdown-timer">{formatTime(countdown)}</span>
      </div>

      {/* ===== POPUP OVERLAY ===== */}
      {isVisible && (
        <div className="verification-popup-overlay">
          <div className="verification-popup">
            <div className="verification-popup-header">
              <div className="verification-popup-title">
                <span className="verification-icon">🔍</span>
                <span>Verification Required</span>
              </div>
              <div className="verification-badge">⚡ Random Check</div>
            </div>

            <div className="verification-popup-body">
              <p className="verification-officer">👤 {officerName}</p>
              <p className="verification-question">{question.question}</p>

              <div className="verification-options">
                {question.options.map((option, index) => (
                  <label key={index} className="verification-option">
                    <input
                      type="radio"
                      name="verification"
                      value={option}
                      checked={selectedAnswer === option}
                      onChange={() => setSelectedAnswer(option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="verification-popup-footer">
              <button className="verification-btn skip" onClick={handleSkip}>
                ⏭️ Skip
              </button>
              <button
                className="verification-btn submit"
                onClick={handleSubmit}
                disabled={!selectedAnswer}
                style={{
                  opacity: !selectedAnswer ? 0.5 : 1,
                  cursor: !selectedAnswer ? 'not-allowed' : 'pointer'
                }}
              >
                ✅ Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .verification-countdown-indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(30, 10, 74, 0.92);
          backdrop-filter: blur(8px);
          color: white;
          padding: 12px 18px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          z-index: 9998;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .countdown-icon { font-size: 18px; }
        .countdown-label { color: rgba(255, 255, 255, 0.7); font-weight: 400; }
        .countdown-timer {
          font-weight: 700;
          font-size: 18px;
          color: #c9a959;
          min-width: 60px;
          text-align: center;
        }
        @media (max-width: 640px) {
          .verification-countdown-indicator {
            bottom: 10px;
            right: 10px;
            padding: 8px 12px;
            font-size: 12px;
            gap: 6px;
            flex-wrap: wrap;
            justify-content: center;
          }
          .countdown-timer { font-size: 15px; min-width: 50px; }
          .countdown-label { font-size: 11px; }
        }

        .verification-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .verification-popup {
          background: white;
          border-radius: 16px;
          padding: 32px;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .verification-popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .verification-popup-title {
          font-size: 18px;
          font-weight: 700;
          color: #1a202c;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .verification-icon { font-size: 22px; }
        .verification-badge {
          font-size: 12px;
          font-weight: 600;
          color: #7c3aed;
          background: #ede9fe;
          padding: 4px 12px;
          border-radius: 20px;
        }
        .verification-popup-body { margin-bottom: 24px; }
        .verification-officer {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 12px;
        }
        .verification-question {
          font-size: 16px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 16px;
        }
        .verification-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .verification-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .verification-option:hover {
          border-color: #7c3aed;
          background: #f5f3ff;
        }
        .verification-option input[type="radio"] {
          width: 18px;
          height: 18px;
          accent-color: #7c3aed;
          cursor: pointer;
        }
        .verification-option span { font-size: 14px; color: #1a202c; }
        .verification-popup-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .verification-btn {
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        .verification-btn.skip {
          background: #f1f5f9;
          color: #64748b;
        }
        .verification-btn.skip:hover { background: #e2e8f0; }
        .verification-btn.submit {
          background: #7c3aed;
          color: white;
        }
        .verification-btn.submit:hover:not(:disabled) {
          background: #6d28d9;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }
        .verification-btn.submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }
        @media (max-width: 480px) {
          .verification-popup { padding: 20px; }
          .verification-popup-title { font-size: 16px; }
          .verification-question { font-size: 14px; }
        }
      `}</style>
    </>
  );
}

export default VerificationPopup;