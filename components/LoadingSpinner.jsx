/**
 * Loading Spinner Component
 * Various loading states
 * Hebrew: ספינר טעינה
 */

import React from 'react';

export default function LoadingSpinner({ size = 'md', fullScreen = false, message = 'טוען...' }) {
  const sizeStyles = {
    sm: { width: '20px', height: '20px', borderWidth: '2px' },
    md: { width: '40px', height: '40px', borderWidth: '3px' },
    lg: { width: '60px', height: '60px', borderWidth: '4px' }
  };

  const spinnerStyle = {
    ...styles.spinner,
    ...sizeStyles[size]
  };

  if (fullScreen) {
    return (
      <div style={styles.fullScreen} role="status" aria-live="polite" aria-label={message}>
        <div style={spinnerStyle} aria-hidden="true" />
        <p style={styles.message}>{message}</p>
      </div>
    );
  }

  return (
    <div style={styles.container} role="status" aria-live="polite" aria-label={message}>
      <div style={spinnerStyle} aria-hidden="true" />
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
}

export function SkeletonLoader({ width = '100%', height = '20px', style = {} }) {
  return (
    <div
      style={{
        ...styles.skeleton,
        width,
        height,
        ...style
      }}
      aria-hidden="true"
    />
  );
}

export function ProgressBar({ value = 0, max = 100, label = '' }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div style={styles.progressContainer} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label || `התקדמות: ${percentage}%`}>
      {label && <div style={styles.progressLabel}>{label}</div>}
      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${percentage}%`
          }}
        />
      </div>
      <div style={styles.progressText}>{Math.round(percentage)}%</div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '12px'
  },
  fullScreen: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 9999,
    gap: '20px'
  },
  spinner: {
    border: '3px solid #f3f3f3',
    borderTop: '3px solid #CC0000',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  message: {
    margin: 0,
    fontSize: '14px',
    color: '#757575',
    textAlign: 'center'
  },
  skeleton: {
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  progressContainer: {
    width: '100%'
  },
  progressLabel: {
    fontSize: '14px',
    marginBottom: '8px',
    color: '#212121'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#CC0000',
    transition: 'width 0.3s ease',
    borderRadius: '4px'
  },
  progressText: {
    fontSize: '12px',
    marginTop: '4px',
    color: '#757575',
    textAlign: 'center'
  }
};

// Add keyframes (would be in CSS in production)
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
}
