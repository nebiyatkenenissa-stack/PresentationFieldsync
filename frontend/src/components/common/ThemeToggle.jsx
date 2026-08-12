import React from 'react';
import { useTheme } from '../../ThemeContext';

function ThemeToggle({ className = '', label }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={label || 'Toggle dark / light mode'}
      title={label || 'Toggle dark / light mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        background: isDark ? '#2b3856' : '#f1f5f9',
        border: isDark ? '1px solid #3b4a6b' : '1px solid #e2e8f0',
        color: isDark ? '#e2b64e' : '#7a5a00',
        borderRadius: '999px',
        cursor: 'pointer',
        padding: '8px 14px',
        fontSize: '16px',
        lineHeight: 1,
        transition: 'all 0.25s ease'
      }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

export default ThemeToggle;
