/**
 * Pure helpers for the resilient question-bank sync.
 *
 * These contain NO DOM/browser dependencies on purpose, so the retry/guard
 * logic can be unit-tested under Node's built-in test runner while the rest of
 * the sync (IndexedDB, fetch, auth token) lives in mockEntities.js.
 *
 * Hebrew: לוגיקת ניסיונות חוזרים לסנכרון בנק השאלות (ללא תלות בדפדפן).
 */

/** מספר ניסיונות מרבי לסנכרון לפני ויתור (כשאין עדיין cache מקומי אמיתי). */
export const SYNC_MAX_ATTEMPTS = 5;
/** השהיה בסיסית (ms) לפני ניסיון חוזר — גדלה אקספוננציאלית. */
export const SYNC_BASE_BACKOFF_MS = 1500;
/** תקרת ההשהיה (ms) בין ניסיונות. */
export const SYNC_MAX_BACKOFF_MS = 12000;
/** זמן המתנה מרבי (ms) לטוקן ההזדהות אחרי התחברות, לפני הניסיון הראשון. */
export const SYNC_TOKEN_WAIT_MS = 8000;
/** מרווח בדיקת קיום הטוקן (ms) בזמן ההמתנה. */
export const SYNC_TOKEN_POLL_MS = 200;

/**
 * Decide whether the sync wrapper should attempt another pass.
 *
 * The core fix: a brand-new client (empty IndexedDB) must keep trying until it
 * actually receives real questions from the server, instead of giving up after a
 * single transient failure (cold server / DB warm-up / momentary network) and
 * leaving the user with only the 2 seed questions.
 *
 * @param {{fetched?:number, reason?:string}|null} result
 *        The last result returned by syncQuestionsFromServer().
 * @param {boolean} hasCache
 *        Whether a real (server-synced) question cache already exists locally.
 * @returns {boolean} true if another sync attempt should be made.
 */
export function shouldRetrySync(result, hasCache) {
  // Got real questions back → fully done, no retry.
  if (result && typeof result.fetched === 'number' && result.fetched > 0) return false;
  // Server explicitly rejected the token → a fresh login is required; retrying
  // the same (missing/expired) token is pointless and would just spam 401s.
  if (result && result.reason === 'unauthorized') return false;
  // We already have a real cache locally → the transient no-op is harmless.
  if (hasCache) return false;
  // No cache yet and we didn't get real questions → transient; try again.
  return true;
}

/**
 * Exponential backoff (ms) for a given 1-based attempt number, capped at `max`.
 * @param {number} attempt 1-based attempt index
 * @param {number} [base]
 * @param {number} [max]
 * @returns {number}
 */
export function backoffDelay(attempt, base = SYNC_BASE_BACKOFF_MS, max = SYNC_MAX_BACKOFF_MS) {
  const n = Math.max(1, attempt | 0);
  return Math.min(max, base * 2 ** (n - 1));
}
