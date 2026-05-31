/**
 * Server-side authentication & authorization middleware.
 *
 * Verifies Google OAuth ID tokens (RS256) using Google's published JWKS, with
 * Node's built-in `crypto` only — no external libraries. Authorization is derived
 * from the role stored in MongoDB (models/User.js) and/or the admin allow-list.
 *
 * Enforcement:
 *   - AUTH_ENFORCE=true   → always enforce (reject unauthenticated/unauthorized)
 *   - AUTH_ENFORCE=false  → never enforce (best-effort identity only; for local dev)
 *   - unset               → enforce in production (NODE_ENV==='production' or RENDER set)
 *
 * Express 5: all middleware are async and either respond explicitly or call next();
 * rejected promises propagate to the global error handler.
 *
 * Hebrew: כל הודעות השגיאה המוחזרות ללקוח בעברית, בכיווניות RTL.
 */
import crypto from 'crypto';
import User from '../models/User.js';
import { isDbConnected, ensureDbConnection } from './db.js';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const ROLE_LEVEL = {
  admin: 5,
  manager: 4,
  school_staff: 3,
  instructor: 2,
  trainee: 1,
};

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || 'snir@snir-ai.com';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function getClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
}

/** Whether auth is enforced (vs. best-effort) in the current environment. */
export function isAuthEnforced() {
  const flag = (process.env.AUTH_ENFORCE || '').toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV === 'production' || !!process.env.RENDER;
}

// ─────────────────────────────────────────────────────────────
// JWKS cache + RS256 verification (built-in crypto only)
// ─────────────────────────────────────────────────────────────

let jwksCache = { keys: new Map(), fetchedAt: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchGoogleJwks(force = false) {
  const now = Date.now();
  if (!force && jwksCache.keys.size > 0 && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(GOOGLE_CERTS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`לא ניתן להוריד מפתחות אימות מ-Google (${res.status})`);
  const data = await res.json();
  const keys = new Map();
  for (const jwk of data.keys || []) {
    if (jwk.kid) keys.set(jwk.kid, jwk);
  }
  jwksCache = { keys, fetchedAt: now };
  return keys;
}

function base64UrlDecode(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function decodeJson(segment) {
  return JSON.parse(base64UrlDecode(segment).toString('utf8'));
}

/**
 * Verify a Google ID token: signature (RS256 via JWKS), issuer, audience, expiry.
 * Throws on any failure. Returns the decoded payload on success.
 */
export async function verifyGoogleIdToken(token) {
  if (!token || typeof token !== 'string') throw new Error('טוקן ריק');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('מבנה טוקן שגוי');

  const [headerSeg, payloadSeg, signatureSeg] = parts;
  let header;
  try {
    header = decodeJson(headerSeg);
  } catch {
    throw new Error('כותרת הטוקן אינה תקינה');
  }
  if (header.alg !== 'RS256') throw new Error(`אלגוריתם חתימה לא נתמך: ${header.alg}`);
  if (!header.kid) throw new Error('חסר מזהה מפתח (kid) בטוקן');

  // Resolve the signing key (refetch JWKS once if the kid rotated).
  let keys = await fetchGoogleJwks(false);
  let jwk = keys.get(header.kid);
  if (!jwk) {
    keys = await fetchGoogleJwks(true);
    jwk = keys.get(header.kid);
  }
  if (!jwk) throw new Error('מפתח החתימה של הטוקן לא נמצא אצל Google');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const signature = base64UrlDecode(signatureSeg);
  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(signingInput),
    publicKey,
    signature,
  );
  if (!verified) throw new Error('חתימת הטוקן אינה תקפה');

  let payload;
  try {
    payload = decodeJson(payloadSeg);
  } catch {
    throw new Error('גוף הטוקן אינו תקין');
  }

  // Standard claim validation.
  if (!VALID_ISSUERS.has(payload.iss)) throw new Error('מנפיק הטוקן (iss) אינו Google');
  const clientId = getClientId();
  if (clientId && payload.aud !== clientId) throw new Error('קהל היעד של הטוקן (aud) אינו תואם');
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) throw new Error('תוקף הטוקן פג');
  if (payload.nbf && payload.nbf > nowSec + 60) throw new Error('הטוקן עדיין אינו בתוקף');
  if (!payload.email) throw new Error('הטוקן אינו כולל כתובת אימייל');

  return payload;
}

// ─────────────────────────────────────────────────────────────
// App session tokens (HS256) — long-lived, server-issued
// ─────────────────────────────────────────────────────────────
//
// Google ID tokens expire after ~1 hour and are only available at sign-in.
// To keep users logged in, we exchange a verified Google credential for our own
// signed session token (default 30 days) which the client sends on every request.

const APP_TOKEN_ISS = 'quizmda';
const APP_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

function getAppSecret() {
  return (
    process.env.JWT_SECRET ||
    (process.env.CLOUDINARY_API_SECRET ? `quizmda:${process.env.CLOUDINARY_API_SECRET}` : '') ||
    'quizmda-dev-secret-change-me'
  );
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Sign a long-lived app session token (HS256, built-in crypto). */
export function signAppToken(payload, expiresInSec = APP_TOKEN_TTL_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, iss: APP_TOKEN_ISS, iat: now, exp: now + expiresInSec }),
  );
  const data = `${header}.${body}`;
  const sig = base64UrlEncode(crypto.createHmac('sha256', getAppSecret()).update(data).digest());
  return `${data}.${sig}`;
}

/** Verify an app session token. Throws on any failure; returns the payload. */
export function verifyAppToken(token) {
  if (!token || typeof token !== 'string') throw new Error('טוקן ריק');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('מבנה טוקן שגוי');
  const [headerSeg, payloadSeg, signatureSeg] = parts;

  let header;
  try {
    header = JSON.parse(base64UrlDecode(headerSeg).toString('utf8'));
  } catch {
    throw new Error('כותרת הטוקן אינה תקינה');
  }
  if (header.alg !== 'HS256') throw new Error(`אלגוריתם חתימה לא נתמך: ${header.alg}`);

  const expected = base64UrlEncode(
    crypto.createHmac('sha256', getAppSecret()).update(`${headerSeg}.${payloadSeg}`).digest(),
  );
  const a = Buffer.from(signatureSeg);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('חתימת הטוקן אינה תקפה');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadSeg).toString('utf8'));
  } catch {
    throw new Error('גוף הטוקן אינו תקין');
  }
  if (payload.iss !== APP_TOKEN_ISS) throw new Error('מנפיק הטוקן אינו תקין');
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) throw new Error('תוקף הטוקן פג');
  if (!payload.email) throw new Error('הטוקן אינו כולל כתובת אימייל');
  return payload;
}

/**
 * POST /api/auth/session (public)
 * Body: { credential } — a Google ID token.
 * Verifies it and returns a long-lived app session token: { token, user, email }.
 */
export async function createSession(req, res) {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'חסר credential של Google' });

    let gp;
    try {
      gp = await verifyGoogleIdToken(credential);
    } catch (err) {
      return res.status(401).json({ error: `אימות Google נכשל: ${err.message}` });
    }

    const email = (gp.email || '').toLowerCase();
    const user = await lookupDbUser(email, gp.sub);
    const token = signAppToken({ sub: gp.sub, email, name: gp.name || user?.full_name || '' });
    res.json({ token, user: user || null, email });
  } catch (err) {
    console.error('POST /api/auth/session error:', err);
    res.status(500).json({ error: 'יצירת סשן נכשלה' });
  }
}

// ─────────────────────────────────────────────────────────────
// Identity resolution
// ─────────────────────────────────────────────────────────────

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/** Soft attribution tag (email/user_id) sent by the client for audit purposes. */
function getUserTag(req) {
  const raw = req.headers?.['x-quizmda-user'];
  if (!raw || typeof raw !== 'string') return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function lookupDbUser(email, sub) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return null;
    return await User.findOne({
      $or: [{ email: (email || '').toLowerCase() }, { google_id: sub }],
    }).lean();
  } catch (err) {
    console.error('[auth] DB user lookup failed:', err.message);
    return null;
  }
}

function effectiveRoleFor(auth, user) {
  const email = (auth?.email || user?.email || '').toLowerCase();
  if (email && getAdminEmails().includes(email)) return 'admin';
  return user?.role || 'trainee';
}

/**
 * Verify the request's bearer token and resolve the DB user.
 * @returns {{ auth?, user?, error?, status? }}
 */
async function authenticate(req) {
  const token = getBearerToken(req);
  if (!token) return { error: 'נדרשת הזדהות — חסר טוקן', status: 401 };
  let payload = null;
  // Prefer our own session token; fall back to a raw Google ID token.
  try {
    payload = verifyAppToken(token);
  } catch {
    payload = null;
  }
  if (!payload) {
    try {
      payload = await verifyGoogleIdToken(token);
    } catch (err) {
      return { error: `הזדהות נכשלה: ${err.message}`, status: 401 };
    }
  }
  const auth = {
    email: (payload.email || '').toLowerCase(),
    sub: payload.sub,
    name: payload.name || '',
    email_verified: !!payload.email_verified,
  };
  const user = await lookupDbUser(auth.email, auth.sub);
  return { auth, user };
}

/** Best-effort identity attachment (never rejects) — used when enforcement is off. */
async function attachIdentityBestEffort(req) {
  const token = getBearerToken(req);
  if (token) {
    try {
      let payload = null;
      try {
        payload = verifyAppToken(token);
      } catch {
        payload = await verifyGoogleIdToken(token);
      }
      req.auth = {
        email: (payload.email || '').toLowerCase(),
        sub: payload.sub,
        name: payload.name || '',
        email_verified: !!payload.email_verified,
      };
      req.user = await lookupDbUser(req.auth.email, req.auth.sub);
    } catch {
      // ignore in best-effort mode
    }
  }
  if (!req.auth) {
    const tag = getUserTag(req);
    if (tag) req.auth = { email: tag.includes('@') ? tag.toLowerCase() : '', tag };
  }
  req.effectiveRole = effectiveRoleFor(req.auth, req.user);
}

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

/** Require a valid authenticated user (any role). */
export async function requireAuth(req, res, next) {
  try {
    if (!isAuthEnforced()) {
      await attachIdentityBestEffort(req);
      return next();
    }
    const result = await authenticate(req);
    if (result.error) return res.status(result.status).json({ error: result.error });
    req.auth = result.auth;
    req.user = result.user;
    req.effectiveRole = effectiveRoleFor(result.auth, result.user);
    next();
  } catch (err) {
    console.error('[auth] requireAuth error:', err);
    res.status(500).json({ error: 'שגיאת אימות בשרת' });
  }
}

/**
 * Require a minimum role level. Admin allow-list always passes.
 * @param {'trainee'|'instructor'|'school_staff'|'manager'|'admin'} minRoleName
 */
export function requireRole(minRoleName) {
  const minLevel = ROLE_LEVEL[minRoleName] || 99;
  return async function roleGuard(req, res, next) {
    try {
      if (!isAuthEnforced()) {
        await attachIdentityBestEffort(req);
        return next();
      }
      const result = await authenticate(req);
      if (result.error) return res.status(result.status).json({ error: result.error });
      req.auth = result.auth;
      req.user = result.user;
      const effectiveRole = effectiveRoleFor(result.auth, result.user);
      req.effectiveRole = effectiveRole;
      const level = ROLE_LEVEL[effectiveRole] || 0;
      if (level < minLevel) {
        return res.status(403).json({
          error: `אין לך הרשאה לבצע פעולה זו (נדרשת רמת "${minRoleName}" ומעלה)`,
        });
      }
      next();
    } catch (err) {
      console.error('[auth] requireRole error:', err);
      res.status(500).json({ error: 'שגיאת הרשאה בשרת' });
    }
  };
}

/** Resolve the identity of the actor performing a request, for audit logging. */
export function getActor(req) {
  const user = req.user;
  const auth = req.auth;
  return {
    user_id: user?.user_id || null,
    email: (user?.email || auth?.email || '').toLowerCase() || null,
    name: user?.full_name || auth?.name || null,
    role: req.effectiveRole || user?.role || null,
  };
}
