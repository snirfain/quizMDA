/**
 * REST API for the ECG review pipeline.
 * Trainees submit an ECG image + their interpretation + tags; instructors review.
 * Hebrew: צינור בדיקת אקג — הגשה, תור אישורים ומשוב רפואי.
 */
import mongoose from 'mongoose';
import EcgSubmission from '../models/EcgSubmission.js';
import { isDbConnected, ensureDbConnection } from './db.js';
import { getActor } from './authMiddleware.js';

function toClient(doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

/** Normalize a free-form tags payload into a clean unique string array. */
function cleanTags(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const t of raw) {
    const s = String(t || '').trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out.slice(0, 30);
}

/** POST /api/ecg-submissions — trainee submits an interpretation for review. */
export async function createEcgSubmission(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });

    const actor = getActor(req);
    const { image_url, user_interpretation, tags } = req.body || {};

    if (!image_url || typeof image_url !== 'string') {
      return res.status(400).json({ error: 'חסרה תמונת אקג (image_url)' });
    }
    if (!user_interpretation || !String(user_interpretation).trim()) {
      return res.status(400).json({ error: 'יש למלא את שדה "הפיענוח שלי"' });
    }

    const user_id = actor.user_id || req.body?.user_id || actor.email || 'anonymous';

    const doc = await EcgSubmission.create({
      user_id,
      user_name: actor.name || req.body?.user_name || '',
      image_url: String(image_url).trim(),
      user_interpretation: String(user_interpretation).trim(),
      tags: cleanTags(tags),
      status: 'pending',
    });

    res.status(201).json(toClient(doc.toObject()));
  } catch (err) {
    console.error('POST /api/ecg-submissions error:', err);
    res.status(500).json({ error: 'שמירת הגשת האקג נכשלה' });
  }
}

/** GET /api/ecg-submissions?status=pending — instructor review queue. */
export async function listEcgSubmissions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);

    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};
    const list = await EcgSubmission.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json(list.map(toClient));
  } catch (err) {
    console.error('GET /api/ecg-submissions error:', err);
    res.status(500).json({ error: 'טעינת תור האקג נכשלה' });
  }
}

/** GET /api/ecg-submissions/mine — the signed-in trainee's own submissions. */
export async function listMyEcgSubmissions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);

    const actor = getActor(req);
    const userId = actor.user_id || req.query.user_id || actor.email;
    if (!userId) return res.status(200).json([]);

    const list = await EcgSubmission.find({ user_id: userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(list.map(toClient));
  } catch (err) {
    console.error('GET /api/ecg-submissions/mine error:', err);
    res.status(500).json({ error: 'טעינת ההגשות שלך נכשלה' });
  }
}

/** GET /api/ecg-submissions/tags — distinct tags for the multi-select suggestions. */
export async function listEcgTags(_req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);
    const tags = await EcgSubmission.distinct('tags');
    res.json((tags || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'he')));
  } catch (err) {
    console.error('GET /api/ecg-submissions/tags error:', err);
    res.status(500).json({ error: 'טעינת התגים נכשלה' });
  }
}

/** PUT /api/ecg-submissions/:id/review — instructor approves/rejects + feedback. */
export async function reviewEcgSubmission(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'מזהה הגשה שגוי' });
    }

    const { status, reviewer_notes, tags } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'הסטטוס חייב להיות "approved" או "rejected"' });
    }

    const submission = await EcgSubmission.findById(id);
    if (!submission) return res.status(404).json({ error: 'ההגשה לא נמצאה' });

    const actor = getActor(req);
    submission.status = status;
    submission.reviewer_notes = String(reviewer_notes || '').trim();
    if (Array.isArray(tags)) submission.tags = cleanTags(tags);
    submission.reviewer_id = actor.user_id || actor.email || null;
    submission.reviewer_name = actor.name || null;
    submission.reviewed_at = new Date();
    await submission.save();

    res.json(toClient(submission.toObject()));
  } catch (err) {
    console.error('PUT /api/ecg-submissions/:id/review error:', err);
    res.status(500).json({ error: 'עדכון בדיקת האקג נכשל' });
  }
}
