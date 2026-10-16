import React, { useState, useEffect } from 'react';
import { getApiBase } from '../../services/database';

const inputStyle = (focused) => ({
  opacity: 1,
  visibility: 'visible',
  width: '100%',
  padding: '12px 16px 12px 44px',
  fontSize: '15px',
  border: focused ? '1.5px solid #1e3a5f' : '1.5px solid #e2e8f0',
  borderRadius: '10px',
  transition: 'border-color 0.3s, box-shadow 0.3s',
  outline: 'none',
  background: focused ? '#ffffff' : '#fafbfc',
  boxShadow: focused ? '0 0 0 4px rgba(30, 58, 95, 0.08)' : 'none',
});

const buttonStyle = (loading) => ({
  opacity: loading ? 0.7 : 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  background: '#1e3a5f',
  color: 'white',
  padding: '14px 32px',
  border: 'none',
  borderRadius: '8px',
  cursor: loading ? 'wait' : 'pointer',
  fontSize: '16px',
  fontWeight: '600',
  width: '100%',
  marginTop: '4px',
  transition: 'all 0.3s ease',
});

const linkStyle = {
  background: 'none',
  border: 'none',
  color: '#1e3a5f',
  fontSize: '14px',
  cursor: 'pointer',
  textDecoration: 'underline',
};

function Spinner() {
  return (
    <span style={{
      width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite'
    }}></span>
  );
}

function ForgotPassword({ onBack, onLoginSuccess }) {
  const [step, setStep] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    if (typeof window !== 'undefined' && window.location.hash === '#forgot-password') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const post = async (path, body) => {
    const res = await fetch(`${getApiBase()}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }
    return data;
  };

  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const data = await post('forgot-password', { email: email.trim() });
      setStatus(data.message || 'A verification code has been sent to your email.');
      setCode('');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('verify-reset-code', { email: email.trim(), code: code.trim() });
      setResetToken(data.resetToken);
      setStatus('');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await post('reset-password', { resetToken, newPassword });
      setStep(4);
    } catch (err) {
      setError(err.message || 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = {
    1: ['Reset your password', 'Enter your account email and we will send you a verification code.'],
    2: ['Enter verification code', `We sent a 6-digit code to ${email}.`],
    3: ['Set a new password', 'Choose a new password for your account.'],
    4: ['Password updated', 'Your password has been changed. You can now log in with it.'],
  }[step];

  return (
    <div className="login-page-full">
      <div className="login-bg-animation">
        <div className="float-circle c1"></div>
        <div className="float-circle c2"></div>
        <div className="float-circle c3"></div>
        <div className="float-circle c4"></div>
      </div>

      <div className={`login-left-full ${isLoaded ? 'fade-in-left' : ''}`}>
        <div className="login-brand-full">
          <div className="brand-icon-full">
            <svg width="80" height="80" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="brandGradForgot" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#1e3a5f' }} />
                  <stop offset="100%" style={{ stopColor: '#4fc3f7' }} />
                </linearGradient>
                <filter id="glowForgot">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.3" />
                </filter>
              </defs>
              <rect width="48" height="48" rx="14" fill="url(#brandGradForgot)" filter="url(#glowForgot)" />
              <g className="brand-animated-icon">
                <path d="M24 14L14 20V28L24 34L34 28V20L24 14Z" stroke="white" strokeWidth="2" className="brand-path" />
                <path d="M24 14V24L34 28" stroke="white" strokeWidth="2" className="brand-path-delay" />
                <path d="M24 24L14 28" stroke="white" strokeWidth="2" className="brand-path-delay-2" />
                <circle cx="24" cy="24" r="3" fill="white" className="brand-pulse" />
              </g>
            </svg>
          </div>
          <h1 className="brand-title">FieldSync</h1>
          <p className="tagline-full">Account recovery</p>
          <p className="subtagline-full">Verify your email, set a new password and sign back in.</p>
        </div>

        <div className="login-footer-full">
          <p>© 2026 FieldSync.</p>
        </div>
      </div>

      <div className={`login-right-full ${isLoaded ? 'fade-in-right' : ''}`}>
        <div className="login-card-full">
          <div className="login-card-header">
            <button
              type="button"
              onClick={step === 1 || step === 4 ? onBack : () => { setError(''); setStep(step - 1); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '4px 0',
                marginBottom: '12px',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => (e.target.style.color = '#1e3a5f')}
              onMouseLeave={(e) => (e.target.style.color = '#64748b')}
            >
              ← {step === 4 ? 'Back to Login' : 'Back'}
            </button>
            <h2>{stepTitle[0]}</h2>
            <p className="login-subtitle-full">{stepTitle[1]}</p>
          </div>

          {step === 1 && (
            <form onSubmit={handleSendCode}>
              <div className="form-group-full">
                <label>Email</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" />
                      <path d="M22 6L12 13L2 6" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                    autoFocus
                    className="formal-input"
                    style={inputStyle(emailFocused)}
                  />
                </div>
              </div>

              {error && (
                <div style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', animation: 'shake 0.5s ease' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-submit-full" style={buttonStyle(loading)}>
                {loading ? <><Spinner /> Sending code...</> : 'Send verification code'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button type="button" onClick={onBack} style={linkStyle}>Back to Login</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyCode}>
              <div className="form-group-full">
                <label>Verification code</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    onFocus={() => setCodeFocused(true)}
                    onBlur={() => setCodeFocused(false)}
                    required
                    autoFocus
                    className="formal-input"
                    style={{ ...inputStyle(codeFocused), letterSpacing: '8px', textAlign: 'center', fontWeight: '600' }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', animation: 'shake 0.5s ease' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || code.length !== 6} className="btn-submit-full" style={buttonStyle(loading || code.length !== 6)}>
                {loading ? <><Spinner /> Verifying...</> : 'Verify code'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button type="button" onClick={handleSendCode} disabled={loading} style={{ ...linkStyle, opacity: loading ? 0.6 : 1 }}>
                  Resend code
                </button>
                <button type="button" onClick={onBack} style={linkStyle}>Back to Login</button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSetPassword}>
              <div className="form-group-full">
                <label>New password</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onFocus={() => setPwdFocused(true)}
                    onBlur={() => setPwdFocused(false)}
                    required
                    autoFocus
                    className="formal-input"
                    style={inputStyle(pwdFocused)}
                  />
                </div>
              </div>

              <div className="form-group-full">
                <label>Confirm new password</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                  <input
                    type="password"
                    placeholder="Repeat the new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                    required
                    className="formal-input"
                    style={inputStyle(confirmFocused)}
                  />
                </div>
              </div>

              {error && (
                <div style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', animation: 'shake 0.5s ease' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-submit-full" style={buttonStyle(loading)}>
                {loading ? <><Spinner /> Saving...</> : 'Save new password'}
              </button>
            </form>
          )}

          {step === 4 && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', color: '#16a34a',
                fontSize: '15px', marginBottom: '20px', padding: '12px 14px',
                background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0',
              }}>
                <span style={{ fontSize: '20px' }}>✓</span>
                Your password has been reset successfully.
              </div>
              <button type="button" onClick={onLoginSuccess} className="btn-submit-full" style={buttonStyle(false)}>
                Continue to Login
              </button>
            </div>
          )}

          <div className="login-status-full">
            <span className="status-dot-full online"></span>
            FieldSync Account Recovery
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
