/**
 * Google Sign-In Component
 * Hebrew: התחברות עם Google
 */

import React, { useEffect, useCallback } from 'react';
import { loginWithGoogle } from '../workflows/googleAuth';
import { showToast } from './Toast';
import { appConfig } from '../config/appConfig';

export default function GoogleSignIn({ onSuccess, onError }) {
  const getGoogleClientId = useCallback(() => {
    // Try to get from Vite environment variable
    // In Vite, import.meta.env is available at build time
    try {
      // @ts-ignore - Vite provides import.meta.env
      const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (envId) return envId;
    } catch (e) {
      // Ignore if import.meta is not available
    }
    
    // Fallback: get from config
    if (appConfig?.google?.clientId) {
      return appConfig.google.clientId;
    }
    
    // Default fallback
    return '177431900868-95hpv33cfkhtsu0d7p2u8p74ejb6j5e2.apps.googleusercontent.com';
  }, []);

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      const result = await loginWithGoogle(response.credential);
      if (result.success) {
        if (onSuccess) {
          onSuccess(result.user);
        }
        showToast('התחברת בהצלחה!', 'success');
      } else {
        throw new Error(result.error || 'שגיאה בהתחברות');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      if (onError) {
        onError(error.message || 'שגיאה בהתחברות עם Google');
      } else {
        showToast(error.message || 'שגיאה בהתחברות עם Google', 'error');
      }
    }
  }, [onSuccess, onError]);

  const initializeGoogleSignIn = useCallback(() => {
    if (window.google && window.google.accounts) {
      const clientId = getGoogleClientId();
      
      if (!clientId) {
        console.warn('Google Client ID not configured');
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        // Render button
        const buttonElement = document.getElementById('google-signin-button');
        if (buttonElement && !buttonElement.hasChildNodes()) {
          window.google.accounts.id.renderButton(
            buttonElement,
            {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              locale: 'he',
              width: 300
            }
          );
        }
      } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
        if (onError) {
          onError('שגיאה באתחול Google Sign-In');
        }
      }
    }
  }, [getGoogleClientId, handleCredentialResponse, onError]);

  useEffect(() => {
    // Check if Google script is already loaded (from index.html)
    if (window.google && window.google.accounts) {
      initializeGoogleSignIn();
    } else {
      // Wait for script to load
      const checkInterval = setInterval(() => {
        if (window.google && window.google.accounts) {
          clearInterval(checkInterval);
          initializeGoogleSignIn();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google || !window.google.accounts) {
          console.error('Google Sign-In script failed to load');
          if (onError) {
            onError('שגיאה בטעינת Google Sign-In');
          }
        }
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [initializeGoogleSignIn, onError]);

  return (
    <div style={styles.container}>
      <div id="google-signin-button" style={styles.buttonContainer}></div>
      {!getGoogleClientId() && (
        <div style={styles.warning}>
          ⚠️ Google Client ID לא מוגדר. אנא הגדר VITE_GOOGLE_CLIENT_ID ב-.env
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    width: '100%'
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%'
  },
  warning: {
    padding: '10px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#856404',
    textAlign: 'center',
    direction: 'rtl'
  }
};
