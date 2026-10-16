import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './ThemeContext';
import { Toaster } from 'react-hot-toast';
import './utils/i18n';
import './index.css';
import './App.css';

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const token = localStorage.getItem('fieldsync_token');
  const isApi = url.includes('/api') || url.includes('/uploads');
  if (token && isApi && !url.includes('/auth/login')) {
    init.headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
  }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { fontSize: '14px', borderRadius: '8px' },
          success: { duration: 2500 },
          error: { duration: 3500 }
        }}
      />
    </ThemeProvider>
  </React.StrictMode>
);
