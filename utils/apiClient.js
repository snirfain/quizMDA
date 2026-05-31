/**
 * Global fetch interceptor — automatically attaches the auth token and an audit
 * user tag to all same-origin /api requests, so existing fetch calls across the
 * app are authenticated without per-call changes.
 *
 * Also provides a Token Expiration Guard (secureSubmit) that prevents losing a
 * student's exam to a 401 by backing up the answers and prompting a Google
 * re-authentication before the token actually expires.
 * Hebrew: שכבת תקשורת API
 */
import { getAuthToken, getCurrentUserTag } from './authToken';

/** localStorage key holding the emergency backup of an in-progress exam. */
export const EXAM_EMERGENCY_BACKUP_KEY = 'exam_emergency_backup';
/** Global browser event fired when the token is critically close to expiring. */
export const TOKEN_CRITICAL_EVENT = 'auth-token-critical-expired';

/**
 * Internal helper — natively decodes a JWT payload using atob().
 * Returns the parsed payload object, or null if the token is missing/malformed.
 */
function parseJwt(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json);
  } catch (err) {
    console.warn('parseJwt: token פגום או ריק —', err?.message);
    return null;
  }
}

/**
 * True when the stored token is missing, malformed, or set to expire within the
 * next `bufferMinutes`. Fails safe (returns true) so we force re-auth rather than
 * risk a silent 401 that loses data.
 */
export function isTokenExpiringSoon(bufferMinutes = 5) {
  try {
    const token = getAuthToken();
    if (!token) return true;
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return true;
    const expMs = payload.exp * 1000;
    const bufferMs = Math.max(0, bufferMinutes) * 60 * 1000;
    return Date.now() >= expMs - bufferMs;
  } catch (err) {
    console.warn('isTokenExpiringSoon: כשל בבדיקת תוקף הטוקן —', err?.message);
    return true;
  }
}

/** Persist an emergency snapshot of the exam state so nothing is lost. */
function saveEmergencyBackup(fallbackState) {
  try {
    if (typeof window === 'undefined') return;
    const payload = {
      savedAt: new Date().toISOString(),
      state: fallbackState ?? null,
    };
    localStorage.setItem(EXAM_EMERGENCY_BACKUP_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('saveEmergencyBackup: כשל בשמירת גיבוי חירום —', err?.message);
  }
}

/** Notify the UI to show a blocking re-auth modal. */
function dispatchTokenCritical() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TOKEN_CRITICAL_EVENT));
    }
  } catch (err) {
    console.warn('dispatchTokenCritical: כשל בשליחת אירוע —', err?.message);
  }
}

/**
 * Securely submit sensitive data (e.g. exam submission) to the server.
 *
 * Before sending, it verifies the auth token is not about to expire. If it is,
 * the answers are backed up to localStorage and a global
 * `auth-token-critical-expired` event is fired so the UI can request a fresh
 * Google sign-in — preventing exam loss due to 401 errors.
 *
 * @param {string} endpoint        API endpoint (e.g. '/api/exam/submit')
 * @param {object} data            Payload to POST
 * @param {*}      fallbackState   The student's current state to back up on failure
 * @returns {Promise<object>}      Parsed server response on success
 * @throws  {Error}                Hebrew error message on expiry / network / server failure
 */
export async function secureSubmit(endpoint, data, fallbackState) {
  // 1) Proactive guard — never send with an (almost) expired token.
  if (isTokenExpiringSoon()) {
    saveEmergencyBackup(fallbackState);
    dispatchTokenCritical();
    throw new Error('פג תוקף ההזדהות — הנתונים נשמרו מקומית. יש להתחבר מחדש מול Google כדי להגיש.');
  }

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? {}),
    });
  } catch (err) {
    // Network failure — back up so nothing is lost.
    saveEmergencyBackup(fallbackState);
    throw new Error('שגיאת תקשורת בשליחת הנתונים. הנתונים נשמרו מקומית, נסה שוב.');
  }

  // 2) Reactive guard — token rejected mid-flight.
  if (res.status === 401 || res.status === 403) {
    saveEmergencyBackup(fallbackState);
    dispatchTokenCritical();
    throw new Error('ההזדהות פגה במהלך השליחה — הנתונים נשמרו מקומית. יש להתחבר מחדש כדי להגיש.');
  }

  if (!res.ok) {
    saveEmergencyBackup(fallbackState);
    let msg = 'שמירת הנתונים בשרת נכשלה. הנתונים נשמרו מקומית.';
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(msg);
  }

  // Success — clear any stale emergency backup.
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(EXAM_EMERGENCY_BACKUP_KEY);
  } catch {
    /* ignore */
  }

  try {
    return await res.json();
  } catch {
    return { ok: true };
  }
}

function isApiUrl(url) {
  if (typeof url !== 'string') return false;
  if (url.startsWith('/api')) return true;
  if (typeof window !== 'undefined' && url.startsWith(window.location.origin + '/api')) return true;
  return false;
}

export function installApiInterceptor() {
  if (typeof window === 'undefined' || window.__quizMDA_fetchPatched) return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (isApiUrl(url)) {
        const baseHeaders =
          init.headers || (typeof input !== 'string' ? input?.headers : undefined) || {};
        const headers = new Headers(baseHeaders);

        const token = getAuthToken();
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        const tag = getCurrentUserTag();
        if (tag && !headers.has('X-QuizMDA-User')) {
          // encodeURIComponent keeps the header ASCII-safe.
          headers.set('X-QuizMDA-User', encodeURIComponent(tag));
        }
        init = { ...init, headers };
      }
    } catch (_) {
      // Never block a request because of interceptor failure.
    }
    return originalFetch(input, init);
  };

  window.__quizMDA_fetchPatched = true;
}
