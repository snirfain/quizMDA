/**
 * Error Boundary Component
 * Catches React component errors
 * Hebrew: גבול שגיאות
 */

import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <h2 style={styles.title}>אירעה שגיאה</h2>
          <p style={styles.message}>
            משהו השתבש. אנא רענן את הדף או פנה לתמיכה.
          </p>
          {this.props.showDetails && (
            <details style={styles.details}>
              <summary>פרטים טכניים</summary>
              <pre style={styles.errorText}>
                {this.state.error?.toString()}
              </pre>
            </details>
          )}
          <button
            style={styles.button}
            onClick={() => window.location.reload()}
          >
            רענן דף
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    padding: '40px',
    fontFamily: 'Arial, Helvetica, sans-serif'
  },
  title: {
    fontSize: '24px',
    color: '#f44336',
    marginBottom: '15px'
  },
  message: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '20px'
  },
  details: {
    marginBottom: '20px',
    fontSize: '14px'
  },
  errorText: {
    backgroundColor: '#f5f5f5',
    padding: '15px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
    direction: 'ltr',
    textAlign: 'left'
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer'
  }
};
