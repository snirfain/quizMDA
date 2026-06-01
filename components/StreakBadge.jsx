/**
 * Daily practice streak badge
 * Hebrew: תג רצף יומי
 */

import React from 'react';
import Icon from './Icon';

export default function StreakBadge({ days = 0, size = 'md' }) {
  const isActive = days > 0;
  const pad = size === 'lg' ? '12px 20px' : '8px 14px';
  const fontSize = size === 'lg' ? 'var(--font-size-lg)' : 'var(--font-size-base)';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: pad,
        borderRadius: 'var(--radius-full)',
        background: isActive
          ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
          : 'var(--color-bg-hover)',
        border: `1px solid ${isActive ? '#ffb74d' : 'var(--color-border)'}`,
        color: isActive ? '#e65100' : 'var(--color-text-muted)',
        fontWeight: 700,
        fontSize,
      }}
      role="status"
      aria-label={`רצף תרגול: ${days} ימים`}
    >
      <Icon name="flame" size={size === 'lg' ? 24 : 20} />
      <span>{days}</span>
      <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>ימי רצף</span>
    </div>
  );
}
