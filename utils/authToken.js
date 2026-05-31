/**
 * Auth token storage — holds the Google ID token (credential) used to authenticate
 * API requests against the backend's verification middleware.
 * Hebrew: ניהול טוקן הזדהות
 */

const TOKEN_KEY = 'googleCredential';

export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn('Could not persist auth token:', e?.message);
  }
}

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

/** ASCII attribution tag (email or user_id) for audit headers. */
export function getCurrentUserTag() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.email || user?.user_id || null;
  } catch {
    return null;
  }
}
