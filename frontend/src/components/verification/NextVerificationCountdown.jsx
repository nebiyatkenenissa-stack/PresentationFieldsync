// components/verification/NextVerificationCountdown.jsx
// Fixed chip shown to field officers between verifications. It counts down
// to the next scheduled verification (target = epoch ms from the hook).

import React, { useState, useEffect } from 'react';

function NextVerificationCountdown({ target }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, (target || 0) - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const timeLabel = totalSeconds > 0
    ? `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : '00:00';

  if (totalSeconds <= 0) return null;

  return (
    <div className="verification-countdown-indicator">
      <span className="countdown-icon">🔍</span>
      <span className="countdown-label">Next verification in:</span>
      <span className="countdown-timer">{timeLabel}</span>

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
          font-variant-numeric: tabular-nums;
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
      `}</style>
    </div>
  );
}

export default NextVerificationCountdown;
