/**
 * Modal Component
 * Reusable modal with focus trap
 * Hebrew: חלון מודאלי
 */

import React, { useEffect, useRef } from 'react';
import { trapFocus, saveFocus, restoreFocus } from '../utils/focusManagement';
import { closeOnEscape } from '../utils/keyboardNavigation';
import { announce } from '../utils/accessibility';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  ariaLabel = null
}) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Save current focus
      previousFocusRef.current = document.activeElement;
      saveFocus();

      // Trap focus
      let cleanup = null;
      if (modalRef.current) {
        cleanup = trapFocus(modalRef.current);
      }

      // Announce modal opening
      announce(`${title || 'חלון מודאלי'} נפתח`, 'polite');

      // Close on Escape
      const escapeCleanup = closeOnEscape(() => {
        if (onClose) onClose();
      });

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      return () => {
        if (cleanup) cleanup();
        escapeCleanup();
        document.body.style.overflow = '';
        restoreFocus();
      };
    }
  }, [isOpen, title, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: { maxWidth: '400px' },
    md: { maxWidth: '600px' },
    lg: { maxWidth: '800px' },
    xl: { maxWidth: '1000px' },
    full: { maxWidth: '95%', maxHeight: '95%' }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div
      style={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-label={ariaLabel || title}
    >
      <div
        ref={modalRef}
        style={{
          ...styles.modal,
          ...sizeStyles[size]
        }}
        role="document"
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div style={styles.header}>
            {title && (
              <h2 id="modal-title" style={styles.title}>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                style={styles.closeButton}
                onClick={onClose}
                aria-label="סגור חלון"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: '20px',
    direction: 'rtl'
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#212121'
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#757575',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    lineHeight: 1,
    '&:hover': {
      backgroundColor: '#f5f5f5',
      color: '#212121'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  content: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1
  }
};
