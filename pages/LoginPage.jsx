/**
 * Login Page
 * User authentication
 * Hebrew: עמוד התחברות
 */

import React, { useState } from 'react';
import { login, setCurrentUser } from '../utils/auth';
import { navigateTo } from '../utils/router';
import { getCurrentUser } from '../utils/auth';
import FormField from '../components/FormField';
import LoadingSpinner from '../components/LoadingSpinner';
import { announceError } from '../utils/accessibility';
import GoogleSignIn from '../components/GoogleSignIn';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    // Check if already logged in
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    const user = await getCurrentUser();
    if (user) {
      // Redirect based on role
      const redirectPath = {
        trainee: '/practice',
        instructor: '/instructor',
        admin: '/manager'
      }[user.role] || '/practice';
      
      navigateTo(redirectPath);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(userId, password);
      
      if (result.success) {
        setCurrentUser(result.user);
        
        // Notify App.jsx and NavigationBar to update state
        window.dispatchEvent(new CustomEvent('userUpdated', { 
          detail: result.user
        }));
        window.dispatchEvent(new CustomEvent('userLogin', { 
          detail: result.user
        }));
        
        // Redirect based on role
        const redirectPath = {
          trainee: '/practice',
          instructor: '/instructor',
          admin: '/manager'
        }[result.user.role] || '/practice';
        
        navigateTo(redirectPath);
      } else {
        setError(result.error || 'שגיאה בהתחברות');
        announceError('שגיאה בהתחברות');
      }
    } catch (err) {
      setError('שגיאה בהתחברות. אנא נסה שוב.');
      announceError('שגיאה בהתחברות');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logoBlock}>
            <span style={styles.logoStar} aria-hidden="true">✡</span>
            <div>
              <div style={styles.logoTitle}>מד"א</div>
              <div style={styles.logoSub}>מגן דוד אדום</div>
            </div>
          </div>
          <h1 style={styles.title}>התחברות למערכת</h1>
          <p style={styles.subtitle}>מערכת למידה ותרגול</p>

          <form onSubmit={handleSubmit} style={styles.form} noValidate>
            {error && (
              <div style={styles.error} role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            <FormField
              label="תעודת זהות מד&quot;א"
              name="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              autoFocus
              error={error && !userId ? 'נדרש למלא תעודת זהות' : null}
              aria-label="תעודת זהות מד א"
            />

            <FormField
              label="סיסמה"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              error={error && !password ? 'נדרש למלא סיסמה' : null}
              aria-label="סיסמה"
            />

            <div style={styles.options}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={styles.checkbox}
                  aria-label="זכור אותי"
                />
                <span>זכור אותי</span>
              </label>
            </div>

            <button
              type="submit"
              style={styles.submitButton}
              disabled={isLoading || !userId || !password}
              aria-label="התחבר"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'התחבר'}
            </button>
          </form>

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>או התחבר עם</span>
            <div style={styles.dividerLine} />
          </div>

          <GoogleSignIn
            onSuccess={(user) => {
              setCurrentUser(user);
              
              // Notify App.jsx and NavigationBar to update state
              window.dispatchEvent(new CustomEvent('userUpdated', { 
                detail: user
              }));
              window.dispatchEvent(new CustomEvent('userLogin', { 
                detail: user
              }));
              
              const redirectPath = {
                trainee: '/practice',
                instructor: '/instructor',
                admin: '/manager'
              }[user.role] || '/practice';
              navigateTo(redirectPath);
            }}
            onError={(error) => {
              setError(error);
              announceError(error);
            }}
          />

          <div style={styles.footer}>
            <a href="/help" style={styles.link} aria-label="עזרה">
              צריך עזרה?
            </a>
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
    minHeight: '100vh',
    padding: '20px',
    direction: 'rtl',
    background: 'linear-gradient(160deg, #f6f6f6 0%, #ffe5e5 100%)',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '44px 40px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid #ECECEC',
  },
  logoBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  logoStar: {
    fontSize: '42px',
    color: '#CC0000',
    lineHeight: 1,
  },
  logoTitle: {
    fontSize: '28px',
    fontWeight: 900,
    color: '#CC0000',
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: '12px',
    color: '#888888',
    lineHeight: 1.3,
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '4px',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888888',
    textAlign: 'center',
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  error: {
    padding: '12px 14px',
    backgroundColor: '#FFF0F0',
    color: '#CC0000',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #F5C2C2',
  },
  options: {
    display: 'flex',
    alignItems: 'center',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#4A4A4A',
  },
  checkbox: {
    margin: 0,
    accentColor: '#CC0000',
    width: '16px',
    height: '16px',
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
    boxShadow: '0 3px 10px rgba(204,0,0,0.28)',
    transition: 'background 0.15s, box-shadow 0.15s',
  },
  divider: {
    margin: '22px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  dividerText: {
    color: '#BBBBBB',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#E8E8E8',
  },
  footer: {
    marginTop: '22px',
    textAlign: 'center',
  },
  link: {
    color: '#CC0000',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
  }
};
