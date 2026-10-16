import React from 'react';
import { useTheme } from '../../ThemeContext';
import { SunIcon, MoonIcon } from './Icons';

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
        background: isDark ? 'var(--fs-surface-2)' : '#f1f5f9',
        border: isDark ? '1px solid var(--fs-border)' : '1px solid #e2e8f0',
        color: isDark ? 'var(--fs-ink)' : '#334155',
        borderRadius: '999px',
        cursor: 'pointer',
        padding: '8px',
        width: '34px',
        height: '34px',
        lineHeight: 1,
        transition: 'all 0.25s ease'
      }}
    >
      {isDark ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}

export default ThemeToggle;
