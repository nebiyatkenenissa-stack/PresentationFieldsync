import React, { useState } from 'react';

function Login({ onLogin, loginError, isOnline }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    onLogin(email, password);
  };

  return (
    <div className="login-page-full">
      <div className="login-left-full">
        <div className="login-brand-full">
          <div className="brand-icon-full">
            <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#1e3a5f"/>
              <path d="M24 14L14 20V28L24 34L34 28V20L24 14Z" stroke="white" strokeWidth="2"/>
              <path d="M24 14V24L34 28" stroke="white" strokeWidth="2"/>
              <path d="M24 24L14 28" stroke="white" strokeWidth="2"/>
              <circle cx="24" cy="24" r="2" fill="white"/>
            </svg>
          </div>
          <h1>FieldSync</h1>
          <p className="tagline-full">Offline Report Management System</p>
          <p className="subtagline-full">National ID Registration • Field Operations • Real-time Sync</p>
        </div>
        <div className="login-features-full">
          <div className="feature-item-full">
            <span className="feature-icon-full">📡</span>
            <div><h4>Offline First</h4><p>Work in remote areas without internet</p></div>
          </div>
          <div className="feature-item-full">
            <span className="feature-icon-full">🆔</span>
            <div><h4>National ID Registration</h4><p>Register citizens for National ID</p></div>
          </div>
          <div className="feature-item-full">
            <span className="feature-icon-full">📊</span>
            <div><h4>Offline Reports</h4><p>Submit reports offline, sync when online</p></div>
          </div>
        </div>
      </div>

      <div className="login-right-full">
        <div className="login-card-full">
          <h2>Welcome Back</h2>
          <p className="login-subtitle-full">Login to continue</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group-full">
              <label>Email</label>
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ opacity: 1, visibility: 'visible' }}
              />
            </div>
            <div className="form-group-full">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="Enter your password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{ opacity: 1, visibility: 'visible' }}
              />
            </div>
            {(loginError || error) && <div className="login-error-full">{loginError || error}</div>}
            <button 
              type="submit" 
              className="btn-submit-full"
              style={{
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1e3a5f',
                color: 'white',
                padding: '12px 32px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                width: '100%',
                marginTop: '8px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#2a4a7a'}
              onMouseLeave={(e) => e.target.style.background = '#1e3a5f'}
            >
              Login
            </button>
          </form>

          <div className="demo-credentials-full">
            <p>👥 Demo Accounts:</p>
            <div className="cred-grid-full">
              <div className="cred-role-full">
                <span className="role-badge-full manager">👩‍💼 Manager</span>
                <span>abebe@fieldsync.com / manager123</span>
                <small>Full control - all features</small>
              </div>
              <div className="cred-role-full">
                <span className="role-badge-full supervisor">👨‍💼 Supervisor</span>
                <span>birhan@fieldsync.com / super123</span>
                <small>Team management, attendance</small>
              </div>
              <div className="cred-role-full">
                <span className="role-badge-full officer">👤 Field Officer</span>
                <span>meseret@fieldsync.com / officer123</span>
                <small>Citizen registration, reports, tasks</small>
              </div>
            </div>
          </div>

          <div className="login-status-full">
            <span className={`status-dot-full ${isOnline ? 'online' : 'offline'}`}></span>
            {isOnline ? '🟢 Online' : '🔴 Offline'} Mode
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;