/**
 * Unauthorized Page (403)
 * Hebrew: עמוד ללא הרשאה
 */

import React from 'react';
import { navigateTo } from '../utils/router';
import { getCurrentUser } from '../utils/auth';

export default function UnauthorizedPage() {
  const [userRole, setUserRole] = React.useState(null);

  React.useEffect(() => {
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    const user = await getCurrentUser();
    setUserRole(user?.role);
  };

  const getRoleMessage = () => {
    switch (userRole) {
      case 'trainee':
        return 'כמתאמן, אין לך גישה לעמוד זה.';
      case 'instructor':
        return 'כמדריך, אין לך גישה לעמוד זה.';
      default:
        return 'אין לך הרשאה לגשת לעמוד זה.';
    }
  };

  return (
    <div style={styles.container}>
        <div style={styles.content}>
          <h1 style={styles.errorCode}>403</h1>
          <h2 style={styles.title}>אין הרשאה</h2>
          <p style={styles.message}>
            {getRoleMessage()}
          </p>
          <p style={styles.helpText}>
            אם אתה חושב שזו שגיאה, אנא פנה למנהל המערכת.
          </p>
          <div style={styles.actions}>
            <button
              style={styles.button}
              onClick={() => {
                const redirectPath = {
                  trainee: '/practice',
                  instructor: '/instructor',
                  admin: '/manager'
                }[userRole] || '/practice';
                navigateTo(redirectPath);
              }}
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
    marginBottom: '12px',
    lineHeight: 1.6
  },
  helpText: {
    fontSize: '14px',
    color: '#9E9E9E',
    marginBottom: '32px'
  },
  actions: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center'
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
  }
};
