/**
 * Confirm Dialog Component
 * Confirmation dialogs with Yes/No
 * Hebrew: דיאלוג אישור
 */

import React from 'react';
import Modal from './Modal';
import { announce } from '../utils/accessibility';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'אישור',
  message,
  confirmText = 'אישור',
  cancelText = 'ביטול',
  confirmButtonStyle = 'primary',
  danger = false
}) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    if (onClose) {
      onClose();
    }
    announce('פעולה אושרה');
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
    announce('פעולה בוטלה');
  };

  const confirmStyles = danger
    ? styles.dangerButton
    : confirmButtonStyle === 'primary'
    ? styles.primaryButton
    : styles.secondaryButton;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="sm"
      ariaLabel={title}
    >
      <div style={styles.dialog}>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button
            style={styles.cancelButton}
            onClick={handleCancel}
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            style={confirmStyles}
            onClick={handleConfirm}
            aria-label={confirmText}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  dialog: {
    direction: 'rtl'
  },
  message: {
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#212121',
    marginBottom: '24px'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#FFFFFF',
    color: '#212121',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  primaryButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  secondaryButton: {
    padding: '10px 20px',
    backgroundColor: '#757575',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    '&:hover': {
      backgroundColor: '#616161'
    },
    '&:focus': {
      outline: '2px solid #757575',
      outlineOffset: '2px'
    }
  },
  dangerButton: {
    padding: '10px 20px',
    backgroundColor: '#f44336',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    '&:hover': {
      backgroundColor: '#D32F2F'
    },
    '&:focus': {
      outline: '2px solid #f44336',
      outlineOffset: '2px'
    }
  }
};
