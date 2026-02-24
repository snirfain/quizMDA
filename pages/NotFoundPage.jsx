/**
 * 404 Not Found Page
 * Hebrew: עמוד לא נמצא
 */

import React from 'react';
import { navigateTo } from '../utils/router';

export default function NotFoundPage() {
  return (
    <div style={styles.container}>
        <div style={styles.content}>
          <h1 style={styles.errorCode}>404</h1>
          <h2 style={styles.title}>הדף לא נמצא</h2>
          <p style={styles.message}>
            הדף שחיפשת לא קיים או הועבר למיקום אחר.
          </p>
          <div style={styles.actions}>
            <button
              style={styles.button}
              onClick={() => navigateTo('/practice')}
              aria-label="עבור לדף הבית"
            >
              חזור לדף הבית
            </button>
            <button
              style={styles.buttonSecondary}
              onClick={() => window.history.back()}
              aria-label="חזור לדף הקודם"
            >
              חזור אחורה
            </button>
          </div>
        </div>
      </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 200px)',
    padding: '20px',
    direction: 'rtl'
  },
  content: {
    textAlign: 'center',
    maxWidth: '600px'
  },
  errorCode: {
    fontSize: '120px',
    fontWeight: 'bold',
    color: '#CC0000',
    marginBottom: '20px',
    lineHeight: 1
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#212121'
  },
  message: {
    fontSize: '16px',
    color: '#757575',
    marginBottom: '32px',
    lineHeight: 1.6
  },
  actions: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  buttonSecondary: {
    padding: '12px 24px',
    backgroundColor: '#FFFFFF',
    color: '#212121',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  }
};
