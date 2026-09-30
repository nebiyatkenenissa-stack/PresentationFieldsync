import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './ThemeContext';
import { Toaster } from 'react-hot-toast';
import './utils/i18n';
import './index.css';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: '14px', borderRadius: '8px' },
          success: { duration: 2500 },
          error: { duration: 3500 }
        }}
      />
    </ThemeProvider>
  </React.StrictMode>
);
