/**
 * Auth Guard Component
 * Protects routes based on authentication and roles
 * Hebrew: שמירה על נתיבים
 */

import React, { useState, useEffect } from 'react';
import { getCurrentUser, isAuthenticated } from '../utils/auth';
import { canAccessRoute } from '../utils/router';
import { navigateTo } from '../utils/router';

export default function AuthGuard({ children, route, fallback = null }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuthorization();
  }, [route]);

  const checkAuthorization = async () => {
    setIsLoading(true);
    
    try {
      const authenticated = await isAuthenticated();
      const currentUser = await getCurrentUser();
      
      setUser(currentUser);
      
      if (route.public) {
        setIsAuthorized(true);
      } else if (!authenticated) {
        // Redirect to login
        navigateTo('/login');
        setIsAuthorized(false);
      } else {
        // Check role-based access
        const hasAccess = canAccessRoute(currentUser?.role, route);
        if (hasAccess) {
          setIsAuthorized(true);
        } else {
          // Redirect to unauthorized
          navigateTo('/unauthorized');
          setIsAuthorized(false);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthorized(false);
      navigateTo('/login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return fallback || <div style={styles.loading}>בודק הרשאות...</div>;
  }

  if (!isAuthorized) {
    return fallback || null;
  }

  return <>{children}</>;
}

const styles = {
  loading: {
    direction: 'rtl',
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  }
};
