/**
 * Authentication & Session Management
 * Hebrew: אימות וניהול סשן
 */

import { entities, appConfig } from '../config/appConfig';
import { setCustomPermissions } from './permissions';

const ADMIN_EMAILS = (appConfig && appConfig.adminEmails) ? appConfig.adminEmails.map(e => e.toLowerCase()) : ['snir@snir-ai.com'];

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    // In Base44, this would use the auth API
    // For now, return from localStorage or session
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        return JSON.parse(userStr);
      }
      // רק לבדיקה לוקאלית: דילוג על התחברות — מחזיר מנהל מדומה (לא משנה את זרימת ההתחברות הרגילה)
      if (import.meta.env?.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const localDevAdmin = {
          user_id: 'local-dev-admin',
          full_name: 'מנהל (בדיקה לוקאלית)',
          email: 'snir@snir-ai.com',
          role: 'admin',
          auth_provider: 'local-dev',
          custom_permissions: [],
        };
        return localDevAdmin;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Set current user
 */
export function setCurrentUser(user) {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.removeItem('userLoggedOut');
      try {
        setCustomPermissions(user.user_id, user.custom_permissions || []);
      } catch (e) {
        console.warn('Could not sync custom permissions', e);
      }
    } else {
      localStorage.removeItem('currentUser');
    }
  }
}

/**
 * Login user
 */
export async function login(userId, password) {
  try {
    // In Base44, this would call the auth API
    // For now, fetch user from Users entity
    if (!entities || !entities.Users) {
      // Fallback for demo - create a mock user
      const mockUser = {
        user_id: userId || '12345',
        full_name: 'יוסי כהן',
        role: 'trainee',
        points: 150,
        current_streak: 5,
        longest_streak: 10
      };
      setCurrentUser(mockUser);
      return {
        success: true,
        user: mockUser
      };
    }
    
    let user = await entities.Users.findOne({ user_id: userId });

    // Login by email (e.g. snir@snir-ai.com)
    if (!user && typeof userId === 'string' && userId.includes('@')) {
      user = await entities.Users.findOne({ email: userId });
    }

    // Demo mode: if user not found, create a temporary instructor session
    if (!user) {
      user = {
        user_id: userId,
        full_name: userId,
        email: `${userId}@demo.mda`,
        role: 'instructor',
        auth_provider: 'mda',
        points: 0,
        current_streak: 0,
        longest_streak: 0,
      };
    }

    // Ensure admin emails always get admin role
    if (user && user.email && ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      user = { ...user, role: 'admin' };
    }

    setCurrentUser(user);

    return {
      success: true,
      user: user
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Logout user
 */
export function logout() {
  setCurrentUser(null);
  if (typeof window !== 'undefined') {
    localStorage.setItem('userLoggedOut', 'true');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionToken');
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get user role
 */
export async function getUserRole() {
  const user = await getCurrentUser();
  return user ? user.role : null;
}

/**
 * Check session validity
 */
export async function checkSession() {
  const user = await getCurrentUser();
  
  if (!user) {
    return false;
  }
  
  // Check session expiry (if implemented)
  const sessionExpiry = localStorage.getItem('sessionExpiry');
  if (sessionExpiry && new Date(sessionExpiry) < new Date()) {
    logout();
    return false;
  }
  
  return true;
}

/**
 * Refresh session
 */
export async function refreshSession() {
  const user = await getCurrentUser();
  if (user) {
    // Extend session expiry
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 2); // 2 hours
    localStorage.setItem('sessionExpiry', expiry.toISOString());
    return true;
  }
  return false;
}
