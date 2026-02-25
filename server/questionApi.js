/**
 * REST API for questions — sync to MongoDB so all devices see the same data.
 * GET /api/questions — list all questions
 * POST /api/questions — create one or more questions (body: object or array)
 */
import mongoose from 'mongoose';
import Question from '../models/Question.js';

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/** Try to connect once if not connected (helps after Render cold start). */
async function ensureDbConnection() {
  if (isDbConnected()) return true;
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    return isDbConnected();
  } catch (_) {
    return false;
  }
}

const DIFFICULTY_MAP = { קל: 3, בינוני: 5, קשה: 8 };
const VALID_STATUS = new Set(['active', 'draft', 'suspended', 'pending_review', 'rejected', 'needs_revision']);

/** Normalize payload from frontend (mock/localStorage) to MongoDB schema. */
function normalizeQuestionForDb(q) {
  let difficulty_level = q.difficulty_level;
  if (typeof difficulty_level === 'string' && DIFFICULTY_MAP[difficulty_level] != null) {
    difficulty_level = DIFFICULTY_MAP[difficulty_level];
  } else if (typeof difficulty_level !== 'number' || difficulty_level < 1 || difficulty_level > 10) {
    difficulty_level = 5;
  }
  const options = (Array.isArray(q.options) ? q.options : []).map((o) => ({
    value: o.value != null ? String(o.value) : '0',
    label: String(o.label ?? o.text ?? ''),
  }));
  const status = VALID_STATUS.has(q.status) ? q.status : 'active';
  return {
    hierarchy_id: q.hierarchy_id ?? null,
    question_type: q.question_type || 'single_choice',
    question_text: q.question_text ?? '',
    options,
    media_attachment: q.media_attachment ?? null,
    media_bank_tag: q.media_bank_tag ?? null,
    difficulty_level,
    correct_answer: q.correct_answer ?? null,
    explanation: q.explanation ?? null,
    hint: q.hint ?? null,
    tags: Array.isArray(q.tags) ? q.tags : [],
    status,
    total_attempts: typeof q.total_attempts === 'number' ? q.total_attempts : 0,
    total_success: typeof q.total_success === 'number' ? q.total_success : 0,
    success_rate: typeof q.success_rate === 'number' ? q.success_rate : 0,
  };
}

export async function getQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(200).json([]);
    }
    const list = await Question.find({}).sort({ createdAt: -1 }).lean();
    console.log('[api/questions] GET: count=', list.length);
    const withId = list.map((doc) => {
      const { _id, ...rest } = doc;
      return { id: _id.toString(), ...rest };
    });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(withId);
  } catch (err) {
    console.error('GET /api/questions error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function postQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const body = req.body;
    const items = Array.isArray(body) ? body : [body];
    console.log('[api/questions] POST: items=', items.length);
    const created = [];
    for (const q of items) {
      const data = normalizeQuestionForDb(q);
      const doc = await Question.create(data);
      created.push({ id: doc._id.toString(), ...doc.toObject() });
    }
    console.log('[api/questions] POST: created=', created.length);
    res.status(201).json(Array.isArray(body) ? created : created[0]);
  } catch (err) {
    console.error('POST /api/questions error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** Remove duplicate questions in DB by question_text (keep first, delete rest). */
export async function dedupeQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const list = await Question.find({}).sort({ createdAt: 1 }).lean();
    const seen = new Map();
    const toDelete = [];
    for (const doc of list) {
      const key = (doc.question_text || '').trim().replace(/\s+/g, ' ').slice(0, 500);
      if (!key) continue;
      if (seen.has(key)) {
        toDelete.push(doc._id);
      } else {
        seen.set(key, doc._id);
      }
    }
    let removed = 0;
    for (const id of toDelete) {
      await Question.findByIdAndDelete(id);
      removed++;
    }
    console.log('[api/questions] dedupe: removed=', removed);
    res.json({ removed, total: list.length });
  } catch (err) {
    console.error('POST /api/questions/dedupe error:', err);
    res.status(500).json({ error: err.message });
  }
}
