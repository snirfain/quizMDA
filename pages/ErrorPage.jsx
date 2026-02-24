/**
 * Error Page (500)
 * Hebrew: עמוד שגיאה
 */

import React from 'react';
import { navigateTo } from '../utils/router';

export default function ErrorPage({ error = null }) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div style={styles.container}>
        <div style={styles.content}>
          <h1 style={styles.errorCode}>500</h1>
          <h2 style={styles.title}>אירעה שגיאה</h2>
          <p style={styles.message}>
            משהו השתבש. אנא נסה שוב מאוחר יותר.
          </p>
          {error && (
            <details style={styles.details}>
              <summary style={styles.summary}>פרטים טכניים</summary>
              <pre style={styles.errorText}>
                {error.toString()}
              </pre>
            </details>
          )}
          <div style={styles.actions}>
            <button
              style={styles.button}
              onClick={handleReload}
              aria-label="רענן דף"
            >
              רענן דף
            </button>
            <button
              style={styles.buttonSecondary}
              onClick={() => navigateTo('/practice')}
              aria-label="חזור לדף הבית"
            >
              חזור לדף הבית
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
    color: '#f44336',
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
    marginBottom: '24px',
    lineHeight: 1.6
  },
  details: {
    marginBottom: '32px',
    textAlign: 'right',
    direction: 'ltr'
  },
  summary: {
    cursor: 'pointer',
    fontSize: '14px',
    color: '#CC0000',
    marginBottom: '8px',
    '&:hover': {
      textDecoration: 'underline'
    }
  },
  errorText: {
    backgroundColor: '#f5f5f5',
    padding: '16px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto',
    textAlign: 'left',
    direction: 'ltr',
    maxHeight: '200px'
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
