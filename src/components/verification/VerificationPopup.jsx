// components/verification/VerificationPopup.jsx
import React, { useState, useEffect } from 'react';

function VerificationPopup({ officerId, officerName, onAnswer, onClose }) {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [timer, setTimer] = useState(30);
  const [question, setQuestion] = useState({
    question: 'What is your current location?',
    options: ['Office', 'Field', 'Home', 'Other']
  });

  useEffect(() => {
    // Generate random question
    const questions = [
      {
        question: 'What is your current location?',
        options: ['Office', 'Field', 'Home', 'Other']
      },
      {
        question: 'How many citizens did you register today?',
        options: ['0-5', '6-10', '11-15', '16+']
      },
      {
        question: 'What is your current task?',
        options: ['Field Visit', 'Report Writing', 'Data Entry', 'Meeting']
      },
      {
        question: 'How many reports did you submit today?',
        options: ['0-2', '3-5', '6-8', '9+']
      },
      {
        question: 'What is your estimated work completion?',
        options: ['0-25%', '26-50%', '51-75%', '76-100%']
      }
    ];

    const randomIndex = Math.floor(Math.random() * questions.length);
    setQuestion(questions[randomIndex]);

    // Countdown timer (display only, no auto-close)
    const countdown = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []); // Empty dependency: runs once on mount

  const handleSubmit = () => {
    if (!selectedAnswer) {
      alert('Please select an answer');
      return;
    }

    const result = {
      success: true,
      question: question.question,
      answer: selectedAnswer,
      responseTime: 30 - timer,
      officerId,
      officerName,
      message: '✅ Verification passed!'
    };

    onAnswer(result);
  };

  const handleSkip = () => {
    const result = {
      success: false,
      question: question.question,
      answer: 'Skipped',
      responseTime: 30 - timer,
      officerId,
      officerName,
      message: '⏰ Verification skipped'
    };
    onAnswer(result);
  };

  return (
    <div className="verification-popup-overlay">
      <div className="verification-popup">
        <div className="verification-popup-header">
          <div className="verification-popup-title">
            <span className="verification-icon">🔍</span>
            <span>Verification Required</span>
          </div>
          <div className="verification-timer">
            ⏱️ {timer}s
          </div>
        </div>

        <div className="verification-popup-body">
          <p className="verification-officer">
            👤 {officerName}
          </p>
          <p className="verification-question">
            {question.question}
          </p>

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

      <style>{`
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
        }

        .verification-popup {
          background: white;
          border-radius: 16px;
          padding: 32px;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateY(-30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
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

        .verification-icon {
          font-size: 22px;
        }

        .verification-timer {
          font-size: 18px;
          font-weight: 700;
          color: #dc2626;
          background: #fee2e2;
          padding: 4px 12px;
          border-radius: 20px;
        }

        .verification-popup-body {
          margin-bottom: 24px;
        }

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
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .verification-option input[type="radio"] {
          width: 18px;
          height: 18px;
          accent-color: #3b82f6;
          cursor: pointer;
        }

        .verification-option span {
          font-size: 14px;
          color: #1a202c;
        }

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

        .verification-btn.skip:hover {
          background: #e2e8f0;
        }

        .verification-btn.submit {
          background: #3b82f6;
          color: white;
        }

        .verification-btn.submit:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        @media (max-width: 480px) {
          .verification-popup {
            padding: 20px;
          }
          .verification-popup-title {
            font-size: 16px;
          }
          .verification-timer {
            font-size: 14px;
          }
          .verification-question {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}

export default VerificationPopup;