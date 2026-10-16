import React, { createContext, useState, useContext, useEffect } from 'react';
import { db, getApiBase } from '../services/database';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const loadSession = async () => {
      try {
        const authData = await db.auth.toArray();
        if (authData.length > 0) {
          const session = authData[0];
          const users = await db.users.toArray();
          const loggedInUser = users.find(u => u.id === session.userId);
          if (loggedInUser && loggedInUser.status === 'active') {
            setUser(loggedInUser);
            if (session.token) localStorage.setItem('fieldsync_token', session.token);
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (email, password) => {
    setLoginError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${getApiBase()}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            localStorage.setItem('fieldsync_token', data.token);
            await db.auth.put({ id: 'session', userId: data.user.id, token: data.token });
            setUser(data.user);
            return true;
          }
        }
        const data = await res.json().catch(() => ({}));
        setLoginError(data.error || 'Invalid email or password');
        return false;
      } catch (e) {
        clearTimeout(timeout);
        setLoginError('Server unreachable. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('An error occurred during login');
      return false;
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('fieldsync_token');
    await db.auth.delete('session');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};