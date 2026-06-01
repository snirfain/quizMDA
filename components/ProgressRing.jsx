/**
 * Animated SVG progress ring
 * Hebrew: טבעת התקדמות
 */

import React, { useId } from 'react';

export default function ProgressRing({
  value = 0,
  size = 88,
  strokeWidth = 8,
  label,
  sublabel,
  color = 'var(--color-primary)',
  trackColor = 'var(--color-border)',
}) {
  const id = useId();
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
      role="img"
      aria-label={label ? `${label}: ${clamped}%` : `${clamped}%`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.6s ease',
          }}
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-text)"
          fontSize={size * 0.22}
          fontWeight="700"
          transform={`rotate(90 ${center} ${center})`}
          style={{ fontFamily: 'var(--font-family)' }}
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      {label && (
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
          {label}
        </span>
      )}
      {sublabel && (
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          {sublabel}
        </span>
      )}
    </div>
  );
}
