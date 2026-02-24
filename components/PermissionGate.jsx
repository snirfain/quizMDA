/**
 * Permission Gate Component
 * Shows/hides content based on permissions
 * Hebrew: שער הרשאות
 */

import React from 'react';
import { hasPermission, canPerformAction, getUserPermissions } from '../utils/permissions';
import { getCurrentUser } from '../utils/auth';

export default function PermissionGate({ 
  children, 
  permission, 
  action, 
  resource, 
  isOwner = false,
  fallback = null,
  showError = false 
}) {
  const [hasAccess, setHasAccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    checkPermission();
  }, [permission, action, resource, isOwner]);

  const checkPermission = async () => {
    setIsLoading(true);
    
    try {
      const user = await getCurrentUser();
      const userRole = user?.role;
      const userId = user?.user_id;
      
      if (!userRole) {
        setHasAccess(false);
        return;
      }
      
      let access = false;
      
      if (permission) {
        access = hasPermission(userRole, permission, userId);
      } else if (action && resource) {
        access = canPerformAction(userRole, action, resource, isOwner, userId);
      }
      
      setHasAccess(access);
    } catch (error) {
      console.error('Permission check error:', error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!hasAccess) {
    if (showError) {
      return (
        <div style={styles.error} role="alert">
          אין לך הרשאה לגשת לתוכן זה
        </div>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}

const styles = {
  error: {
    direction: 'rtl',
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    margin: '20px 0'
  }
};
