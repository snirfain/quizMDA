/**
 * Google Authentication Workflow
 * Hebrew: אימות Google
 */

import { entities } from '../config/appConfig';
import { setCurrentUser } from '../utils/auth';

/**
 * Verify Google ID token and login/create user
 */
export async function loginWithGoogle(credential) {
  try {
    // Verify the credential with Google
    const googleUser = await verifyGoogleToken(credential);
    
    if (!googleUser) {
      return {
        success: false,
        error: 'אימות Google נכשל'
      };
    }

    // Check if user exists in our system
    // Try multiple ways to find user
    let user = null;
    
    if (entities.Users && typeof entities.Users.findOne === 'function') {
      user = await entities.Users.findOne({
        email: googleUser.email
      });
    } else if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Users) {
      user = await window.mockEntities.Users.findOne({
        email: googleUser.email
      });
    }

    if (!user) {
      // Create new user from Google account
      user = await createUserFromGoogle(googleUser);
    } else {
      // Update existing user with Google info
      user = await updateUserFromGoogle(user, googleUser);
    }

    // Set user session
    setCurrentUser(user);

    return {
      success: true,
      user: user
    };
  } catch (error) {
    console.error('Google login error:', error);
    return {
      success: false,
      error: error.message || 'שגיאה בהתחברות עם Google'
    };
  }
}

/**
 * Verify Google ID token
 * In production, this should be done on the backend
 * For now, we'll decode the JWT and verify it locally
 */
async function verifyGoogleToken(credential) {
  try {
    // Decode JWT token (without verification for client-side)
    // In production, send this to your backend for verification
    const parts = credential.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decode base64url
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    
    // Basic validation
    if (!payload.email || !payload.name) {
      throw new Error('Missing user information');
    }

    // Check token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified || false
    };
  } catch (error) {
    console.error('Token verification error:', error);
    throw error; // Don't return mock user, let the error propagate
  }
}

/**
 * Create new user from Google account
 */
async function createUserFromGoogle(googleUser) {
  // Generate user_id from email or use Google ID
  const userId = googleUser.email.split('@')[0] || `google_${googleUser.googleId}`;
  
  const { appConfig } = await import('../config/appConfig');
  const adminEmails = (appConfig?.adminEmails ?? ['snir@snir-ai.com']).map(e => e.toLowerCase());
  const isAdmin = adminEmails.includes((googleUser.email || '').toLowerCase());
  
  // Check if Users.create exists
  if (!entities.Users || typeof entities.Users.create !== 'function') {
    console.error('entities.Users.create is not available');
    // Fallback: create user object directly
    const newUser = {
      user_id: userId,
      full_name: googleUser.name,
      email: googleUser.email,
      role: isAdmin ? 'admin' : 'trainee',
      auth_provider: 'google',
      google_id: googleUser.googleId,
      profile_picture: googleUser.picture,
      email_verified: googleUser.emailVerified,
      points: 0,
      current_streak: 0,
      longest_streak: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Try to add to mock data if available
    if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Users) {
      try {
        const created = await window.mockEntities.Users.create(newUser);
        return created;
      } catch (e) {
        console.warn('Failed to create user in mockEntities, using fallback:', e);
      }
    }
    
    return newUser;
  }
  
  const newUser = await entities.Users.create({
    user_id: userId,
    full_name: googleUser.name,
    email: googleUser.email,
    role: isAdmin ? 'admin' : 'trainee', // Admin for specific emails, otherwise trainee
    auth_provider: 'google',
    google_id: googleUser.googleId,
    profile_picture: googleUser.picture,
    email_verified: googleUser.emailVerified,
    points: 0,
    current_streak: 0,
    longest_streak: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return newUser;
}

/**
 * Update existing user with Google info
 */
async function updateUserFromGoogle(user, googleUser) {
  const { appConfig } = await import('../config/appConfig');
  const adminEmails = (appConfig?.adminEmails ?? ['snir@snir-ai.com']).map(e => e.toLowerCase());
  const isAdmin = adminEmails.includes((googleUser.email || user.email || '').toLowerCase());
  
  // Check if Users.update exists
  if (!entities.Users || typeof entities.Users.update !== 'function') {
    // Fallback: return updated user object
    const updatedUser = {
      ...user,
      full_name: googleUser.name || user.full_name,
      email: googleUser.email || user.email,
      role: isAdmin ? 'admin' : (user.role || 'trainee'), // Update role if admin email
      auth_provider: 'google',
      google_id: googleUser.googleId,
      profile_picture: googleUser.picture || user.profile_picture,
      email_verified: googleUser.emailVerified || user.email_verified,
      last_login: new Date(),
      updatedAt: new Date()
    };
    
    // Try to update in mock data if available
    if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Users) {
      try {
        const updated = await window.mockEntities.Users.update(user.user_id, updatedUser);
        return updated || updatedUser;
      } catch (e) {
        console.warn('Failed to update user in mockEntities, using fallback:', e);
      }
    }
    
    return updatedUser;
  }
  
  const updatedUser = await entities.Users.update(user.user_id, {
    full_name: googleUser.name || user.full_name,
    email: googleUser.email || user.email,
    role: isAdmin ? 'admin' : (user.role || 'trainee'), // Update role if admin email
    auth_provider: 'google',
    google_id: googleUser.googleId,
    profile_picture: googleUser.picture || user.profile_picture,
    email_verified: googleUser.emailVerified || user.email_verified,
    last_login: new Date()
  });

  return updatedUser || user;
}

/**
 * Get Google OAuth URL (alternative method)
 */
export function getGoogleOAuthUrl() {
  const clientId = getGoogleClientId();
  const redirectUri = encodeURIComponent(window.location.origin + '/auth/google/callback');
  const scope = encodeURIComponent('openid email profile');
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
}

function getGoogleClientId() {
  // Try to get from Vite environment variable
  try {
    // @ts-ignore - Vite provides import.meta.env
    const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (envId) return envId;
  } catch (e) {
    // Ignore if import.meta is not available
  }
  
  // Fallback: get from config
  try {
    const { appConfig } = require('../config/appConfig');
    if (appConfig?.google?.clientId) {
      return appConfig.google.clientId;
    }
  } catch (e) {
    // Ignore
  }
  
  // Default fallback
  return '177431900868-95hpv33cfkhtsu0d7p2u8p74ejb6j5e2.apps.googleusercontent.com';
}
