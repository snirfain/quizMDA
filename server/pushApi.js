/**
 * Web Push API — opt-in subscriptions, admin-scheduled broadcasts, and a
 * lightweight cron loop that delivers due pushes.
 * Hebrew: מערכת התראות פוש — מנויים (Opt-in), תזמון ושליחה אוטומטית.
 */
import webpush from 'web-push';
import mongoose from 'mongoose';
import PushSubscription from '../models/PushSubscription.js';
import ScheduledPush from '../models/ScheduledPush.js';
import User from '../models/User.js';
import { isDbConnected, ensureDbConnection } from './db.js';
import { getActor } from './authMiddleware.js';

// ── VAPID configuration ─────────────────────────────────────────────
let VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
let VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ||
  `mailto:${(process.env.ADMIN_EMAILS || 'admin@quizmda.app').split(',')[0].trim()}`;

let vapidReady = false;

function initVapid() {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    // Dev convenience: generate an ephemeral key pair so the feature works
    // locally. In production set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY so that
    // existing subscriptions remain valid across restarts.
    try {
      const keys = webpush.generateVAPIDKeys();
      VAPID_PUBLIC = keys.publicKey;
      VAPID_PRIVATE = keys.privateKey;
      console.warn(
        '⚠️ VAPID keys not set — generated an ephemeral pair (dev only). ' +
          'Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in the environment for production.',
      );
      console.warn('⚠️ מפתחות VAPID חסרים — נוצר זוג זמני (פיתוח בלבד). הגדר אותם בסביבה לפרודקשן.');
    } catch (err) {
      console.error('💥 Failed to generate VAPID keys:', err?.message || err);
      return false;
    }
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
    return true;
  } catch (err) {
    console.error('💥 setVapidDetails failed:', err?.message || err);
    return false;
  }
}

initVapid();

/** GET /api/notifications/vapid-public-key */
export async function getVapidPublicKey(_req, res) {
  if (!initVapid()) return res.status(503).json({ error: 'התראות פוש אינן מוגדרות בשרת' });
  res.json({ publicKey: VAPID_PUBLIC });
}

/**
 * POST /api/notifications/subscribe
 * Body: { subscription, opted_in }. Saves ONLY when opted_in === true.
 */
export async function subscribePush(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });

    const { subscription, opted_in } = req.body || {};
    if (opted_in !== true) {
      return res.status(400).json({ error: 'נדרש אישור אקטיבי לקבלת התראות (Opt-in)' });
    }
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'נתוני המנוי אינם תקינים' });
    }

    const actor = getActor(req);
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          user_id: actor.user_id || null,
          user_email: (actor.email || '').toLowerCase() || null,
          opted_in: true,
          user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Reflect opt-in on the user profile.
    if (actor.user_id || actor.email) {
      await User.findOneAndUpdate(
        actor.user_id ? { user_id: actor.user_id } : { email: (actor.email || '').toLowerCase() },
        { $set: { notifications_opt_in: true } },
      ).catch(() => {});
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/notifications/subscribe error:', err);
    res.status(500).json({ error: 'רישום ההתראות נכשל' });
  }
}

/** POST /api/notifications/unsubscribe — body: { endpoint } */
export async function unsubscribePush(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });
    const { endpoint } = req.body || {};
    if (endpoint) await PushSubscription.deleteOne({ endpoint });

    const actor = getActor(req);
    if (actor.user_id || actor.email) {
      await User.findOneAndUpdate(
        actor.user_id ? { user_id: actor.user_id } : { email: (actor.email || '').toLowerCase() },
        { $set: { notifications_opt_in: false } },
      ).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/notifications/unsubscribe error:', err);
    res.status(500).json({ error: 'ביטול ההתראות נכשל' });
  }
}

/** Deliver a payload to every opted-in subscription; prune stale endpoints. */
async function sendToAllSubscribers({ title, body, url }) {
  if (!initVapid()) return { sent: 0, failed: 0 };
  const subs = await PushSubscription.find({ opted_in: true }).lean();
  const payload = JSON.stringify({ title, body, url: url || '/' });

  let sent = 0;
  let failed = 0;
  const stale = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          payload,
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        // 404/410 → subscription expired or unsubscribed; remove it.
        if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.endpoint);
      }
    }),
  );

  if (stale.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: stale } }).catch(() => {});
  }
  return { sent, failed };
}

/** GET /api/notifications/scheduled — list scheduled pushes (admin). */
export async function listScheduledPush(_req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);
    const list = await ScheduledPush.find({}).sort({ send_at: -1 }).limit(200).lean();
    res.json(list.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest })));
  } catch (err) {
    console.error('GET /api/notifications/scheduled error:', err);
    res.status(500).json({ error: 'טעינת ההתראות המתוזמנות נכשלה' });
  }
}

/** POST /api/notifications/scheduled — schedule (or immediately queue) a push. */
export async function createScheduledPush(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });

    const actor = getActor(req);
    const { title, body, url, send_at } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'יש למלא כותרת' });
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'יש למלא תוכן התראה' });

    const when = send_at ? new Date(send_at) : new Date();
    if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'תאריך/שעה אינם תקינים' });

    const doc = await ScheduledPush.create({
      title: String(title).trim(),
      body: String(body).trim(),
      url: String(url || '/').trim() || '/',
      send_at: when,
      status: 'scheduled',
      created_by: actor.user_id || actor.email || null,
      created_by_name: actor.name || null,
    });

    // Fire due pushes promptly without waiting for the next cron tick.
    runDuePushes().catch(() => {});

    const { _id, ...rest } = doc.toObject();
    res.status(201).json({ id: _id.toString(), ...rest });
  } catch (err) {
    console.error('POST /api/notifications/scheduled error:', err);
    res.status(500).json({ error: 'תזמון ההתראה נכשל' });
  }
}

/** DELETE /api/notifications/scheduled/:id — cancel a not-yet-sent push. */
export async function deleteScheduledPush(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'מזהה שגוי' });
    const doc = await ScheduledPush.findById(id);
    if (!doc) return res.status(404).json({ error: 'ההתראה לא נמצאה' });
    if (doc.status === 'sent') return res.status(400).json({ error: 'לא ניתן לבטל התראה שכבר נשלחה' });
    await ScheduledPush.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/notifications/scheduled/:id error:', err);
    res.status(500).json({ error: 'מחיקת ההתראה נכשלה' });
  }
}

// ── Cron / due-push runner ──────────────────────────────────────────
let _running = false;

/** Send every scheduled push whose time has arrived. Safe to call concurrently. */
export async function runDuePushes() {
  if (_running) return;
  _running = true;
  try {
    if (!isDbConnected()) return;
    const due = await ScheduledPush.find({
      status: 'scheduled',
      send_at: { $lte: new Date() },
    }).limit(20);

    for (const push of due) {
      // Claim it first (optimistic) so parallel runners don't double-send.
      const claimed = await ScheduledPush.findOneAndUpdate(
        { _id: push._id, status: 'scheduled' },
        { $set: { status: 'sent', sent_at: new Date() } },
        { new: true },
      );
      if (!claimed) continue;
      try {
        const { sent, failed } = await sendToAllSubscribers({
          title: claimed.title,
          body: claimed.body,
          url: claimed.url,
        });
        await ScheduledPush.findByIdAndUpdate(claimed._id, {
          $set: { sent_count: sent, failed_count: failed, status: 'sent' },
        });
        console.log(`[push] נשלחה התראה "${claimed.title}" — הצליחו ${sent}, נכשלו ${failed}`);
      } catch (err) {
        await ScheduledPush.findByIdAndUpdate(claimed._id, {
          $set: { status: 'failed', error: err?.message || String(err) },
        });
        console.error('[push] שליחת התראה נכשלה:', err?.message || err);
      }
    }
  } catch (err) {
    console.error('[push] runDuePushes error:', err?.message || err);
  } finally {
    _running = false;
  }
}

/** Start the dual-minute cron loop. Called once from server boot. */
export function startPushCron() {
  const INTERVAL_MS = 60 * 1000;
  setInterval(() => {
    runDuePushes().catch(() => {});
  }, INTERVAL_MS);
  console.log('[push] מנגנון תזמון ההתראות פעיל (בדיקה כל דקה)');
}
