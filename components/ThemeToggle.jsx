/**
 * Theme toggle — light / dark / system
 * Hebrew: החלפת ערכת נושא
 */

import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { getThemePreference, setThemePreference, resolveTheme } from '../utils/theme';

export default function ThemeToggle({ compact = false }) {
  const [preference, setPreference] = useState('system');
  const [resolved, setResolved] = useState('light');

  useEffect(() => {
    setPreference(getThemePreference());
    setResolved(resolveTheme());
    const onTheme = (e) => {
      setPreference(e.detail?.preference ?? getThemePreference());
      setResolved(e.detail?.resolved ?? resolveTheme());
    };
    window.addEventListener('themeChanged', onTheme);
    return () => window.removeEventListener('themeChanged', onTheme);
  }, []);

  const cycle = () => {
    const order = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setThemePreference(next);
    setPreference(next);
    setResolved(resolveTheme(next));
  };

  const label =
    preference === 'system'
      ? `מערכת (${resolved === 'dark' ? 'כהה' : 'בהיר'})`
      : preference === 'dark'
        ? 'מצב כהה'
        : 'מצב בהיר';

  if (compact) {
    return (
      <button
        type="button"
        className="theme-toggle-compact"
        onClick={cycle}
        aria-label={`ערכת נושא: ${label}`}
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.12)',
          border: 'none',
          color: 'inherit',
          padding: 'var(--space-2)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
      >
        <Icon name={resolved === 'dark' ? 'moon' : 'sun'} size={20} />
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label style={{ fontWeight: 600, color: 'var(--color-text)' }}>ערכת נושא</label>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {[
          { id: 'light', label: 'בהיר', icon: 'sun' },
          { id: 'dark', label: 'כהה', icon: 'moon' },
          { id: 'system', label: 'מערכת', icon: 'settings' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`btn ${preference === opt.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setThemePreference(opt.id);
              setPreference(opt.id);
              setResolved(resolveTheme(opt.id));
            }}
            aria-pressed={preference === opt.id}
          >
            <Icon name={opt.icon} size={18} />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
