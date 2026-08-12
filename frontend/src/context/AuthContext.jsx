import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../services/database';

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
      const users = await db.users.toArray();
      const foundUser = users.find(u => u.email === email && u.password === password && u.status === 'active');
      if (foundUser) {
        setUser(foundUser);
        await db.auth.put({ id: 'session', userId: foundUser.id });
        return true;
      }
      setLoginError('Invalid email or password');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('An error occurred during login');
      return false;
    }
  };

  const logout = async () => {
    setUser(null);
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