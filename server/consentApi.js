/**
 * REST API for recording GDPR / Terms-of-Service consent on the user profile.
 * Hebrew: תיעוד הסכמת קוקיז ותנאי שימוש בפרופיל המשתמש.
 */
import User from '../models/User.js';
import { isDbConnected, ensureDbConnection } from './db.js';
import { getActor } from './authMiddleware.js';

/** POST /api/users/consent — body: { tos_accepted, cookies_accepted } */
export async function recordConsent(req, res) {
  try {
    await ensureDbConnection();
    // We still acknowledge success even without a DB so the client can persist
    // locally; the official DB record is best-effort.
    const actor = getActor(req);
    const { tos_accepted, cookies_accepted } = req.body || {};

    if (tos_accepted !== true || cookies_accepted !== true) {
      return res.status(400).json({ error: 'יש לאשר את שני התנאים' });
    }

    if (!isDbConnected()) {
      return res.status(200).json({ ok: true, persisted: false });
    }

    const email = (actor.email || '').toLowerCase();
    const query = actor.user_id
      ? { user_id: actor.user_id }
      : email
        ? { email }
        : null;

    if (!query) return res.status(200).json({ ok: true, persisted: false });

    await User.findOneAndUpdate(query, {
      $set: {
        tos_accepted: true,
        cookies_accepted: true,
        consent_at: new Date(),
      },
    });

    res.json({ ok: true, persisted: true });
  } catch (err) {
    console.error('POST /api/users/consent error:', err);
    res.status(500).json({ error: 'שמירת ההסכמה נכשלה' });
  }
}
