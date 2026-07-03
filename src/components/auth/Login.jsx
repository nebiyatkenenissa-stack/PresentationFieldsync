import React, { useState, useEffect } from 'react';

function Login({ onLogin, loginError, isOnline }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    onLogin(email, password);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-page-full">
      {/* Background Animated Elements */}
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
                <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor: '#1e3a5f'}}/>
                  <stop offset="100%" style={{stopColor: '#4fc3f7'}}/>
                </linearGradient>
                <filter id="glow">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.3"/>
                </filter>
              </defs>
              <rect width="48" height="48" rx="14" fill="url(#brandGrad)" filter="url(#glow)"/>
              <g className="brand-animated-icon">
                <path d="M24 14L14 20V28L24 34L34 28V20L24 14Z" stroke="white" strokeWidth="2" className="brand-path"/>
                <path d="M24 14V24L34 28" stroke="white" strokeWidth="2" className="brand-path-delay"/>
                <path d="M24 24L14 28" stroke="white" strokeWidth="2" className="brand-path-delay-2"/>
                <circle cx="24" cy="24" r="3" fill="white" className="brand-pulse"/>
              </g>
            </svg>
          </div>
          <h1 className="brand-title">FieldSync</h1>
          <p className="tagline-full">Offline Report Management System</p>
          <p className="subtagline-full">National ID Registration • Field Operations • Real-time Sync</p>
        </div>

        <div className="login-features-full">
          <div className="feature-item-full feature-1">
            <span className="feature-icon-full">📡</span>
            <div>
              <h4>Offline First</h4>
              <p>Work in remote areas without internet</p>
            </div>
          </div>
          <div className="feature-item-full feature-2">
            <span className="feature-icon-full">🆔</span>
            <div>
              <h4>National ID Registration</h4>
              <p>Register citizens for National ID</p>
            </div>
          </div>
          <div className="feature-item-full feature-3">
            <span className="feature-icon-full">📊</span>
            <div>
              <h4>Offline Reports</h4>
              <p>Submit reports offline, sync when online</p>
            </div>
          </div>
        </div>

        <div className="login-footer-full">
          <p>© 2026 FieldSync. All rights reserved.</p>
        </div>
      </div>

      <div className={`login-right-full ${isLoaded ? 'fade-in-right' : ''}`}>
        <div className="login-card-full">
          <div className="login-card-header">
            <h2>Welcome Back</h2>
            <p className="login-subtitle-full">Login to continue</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="form-group-full">
              <label>Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"/>
                    <path d="M22 6L12 13L2 6"/>
                  </svg>
                </span>
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                  required 
                  className="formal-input"
                  style={{ 
                    opacity: 1, 
                    visibility: 'visible',
                    width: '100%',
                    padding: '12px 16px 12px 44px',
                    fontSize: '15px',
                    border: isEmailFocused ? '1.5px solid #1e3a5f' : '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    transition: 'border-color 0.3s, box-shadow 0.3s',
                    outline: 'none',
                    background: isEmailFocused ? '#ffffff' : '#fafbfc',
                    boxShadow: isEmailFocused ? '0 0 0 4px rgba(30, 58, 95, 0.08)' : 'none'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group-full">
              <label>Password</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </span>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Enter your password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  required 
                  className="formal-input"
                  style={{ 
                    opacity: 1, 
                    visibility: 'visible',
                    width: '100%',
                    padding: '12px 16px 12px 44px',
                    fontSize: '15px',
                    border: isPasswordFocused ? '1.5px solid #1e3a5f' : '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    transition: 'border-color 0.3s, box-shadow 0.3s',
                    outline: 'none',
                    background: isPasswordFocused ? '#ffffff' : '#fafbfc',
                    boxShadow: isPasswordFocused ? '0 0 0 4px rgba(30, 58, 95, 0.08)' : 'none'
                  }}
                />
                {/* Eye Button - ALWAYS VISIBLE */}
                <button 
                  type="button"
                  className="input-eye-btn"
                  onClick={togglePasswordVisibility}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#1e3a5f'}
                  onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                      <line x1="2" y1="2" x2="22" y2="22"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {(loginError || error) && (
              <div className="login-error-full" style={{
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '16px',
                padding: '10px 14px',
                background: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                animation: 'shake 0.5s ease'
              }}>
                {loginError || error}
              </div>
            )}

            <button 
              type="submit" 
              className="btn-submit-full"
              style={{
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: '#1e3a5f',
                color: 'white',
                padding: '14px 32px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                width: '100%',
                marginTop: '4px',
                transition: 'all 0.3s ease',
                letterSpacing: '0.5px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#15324f';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 25px rgba(30, 58, 95, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#1e3a5f';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              Login
            </button>
          </form>

          <div className="login-status-full">
            <span className={`status-dot-full ${isOnline ? 'online' : 'offline'}`}></span>
            {isOnline ? 'Online Mode' : 'Offline Mode'}
            <span className="status-text">
              {isOnline ? 'All features available' : 'Offline mode active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;