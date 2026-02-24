/**
 * Toast Notification Component
 * Toast notifications with auto-dismiss
 * Hebrew: התראות טוסט
 */

import React, { useState, useEffect } from 'react';
import { announce } from '../utils/accessibility';

let toastIdCounter = 0;
const toastListeners = [];

export function showToast(message, type = 'info', duration = 3000) {
  const id = ++toastIdCounter;
  const toast = { id, message, type, duration };
  
  toastListeners.forEach(listener => listener(toast));
  
  // Announce to screen reader
  announce(message, type === 'error' ? 'assertive' : 'polite');
  
  return id;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (toast) => {
      setToasts(prev => [...prev, toast]);
      
      // Auto-dismiss
      if (toast.duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, toast.duration);
      }
    };

    toastListeners.push(listener);

    return () => {
      const index = toastListeners.indexOf(listener);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  const handleDismiss = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={styles.container}
      role="region"
      aria-label="התראות"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => handleDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const typeStyles = {
    success: { backgroundColor: '#4CAF50', icon: '✓' },
    error: { backgroundColor: '#f44336', icon: '✗' },
    warning: { backgroundColor: '#ff9800', icon: '⚠' },
    info: { backgroundColor: '#CC0000', icon: 'ℹ' }
  };

  const style = typeStyles[toast.type] || typeStyles.info;

  return (
    <div
      style={{
        ...styles.toast,
        backgroundColor: style.backgroundColor
      }}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <span style={styles.icon} aria-hidden="true">
        {style.icon}
      </span>
      <span style={styles.message}>{toast.message}</span>
      <button
        style={styles.closeButton}
        onClick={onDismiss}
        aria-label="סגור התראה"
      >
        ✕
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '20px',
    left: '20px',
    zIndex: 1070,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '400px',
    direction: 'rtl'
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '4px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    color: '#FFFFFF',
    minWidth: '300px',
    animation: 'slideIn 0.3s ease'
  },
  icon: {
    fontSize: '18px',
    flexShrink: 0
  },
  message: {
    flex: 1,
    fontSize: '14px',
    lineHeight: 1.4
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0.8,
    '&:hover': {
      opacity: 1
    },
    '&:focus': {
      outline: '2px solid #FFFFFF',
      outlineOffset: '2px',
      borderRadius: '2px'
    }
  }
};

// Add animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent += `
    @keyframes slideIn {
      from {
        transform: translateX(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
