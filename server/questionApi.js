/**
 * REST API for questions — sync to MongoDB so all devices see the same data.
 * GET /api/questions — list all questions
 * POST /api/questions — create one or more questions (body: object or array)
 */
import mongoose from 'mongoose';
import Question from '../models/Question.js';
import { isDbConnected, ensureDbConnection } from './db.js';
import {
  QUESTION_CATEGORIES,
  computeHasMedia,
  normalizeLegacyStatus,
  isValidCategory,
  isValidThinkingLevel,
  isValidTrainingLevel,
  getSubcategoriesForCategory,
} from '../shared/questionBankMetadata.js';

const VALID_STATUS = new Set(['active', 'under_review', 'draft']);

const FIRST_CAT = QUESTION_CATEGORIES[0].value;

function normalizeOptions(raw) {
  let arr = raw;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }
  return (Array.isArray(arr) ? arr : []).map((o, idx) => ({
    value: o != null && o.value != null ? String(o.value) : String(idx),
    label: String(o?.label ?? o?.text ?? ''),
  }));
}

/** Normalize payload from frontend (mock/localStorage) to MongoDB schema. */
export function normalizeQuestionForDb(q) {
  const options = normalizeOptions(q.options);
  const category =
    q.category && typeof q.category === 'string' && isValidCategory(q.category.trim())
      ? q.category.trim()
      : FIRST_CAT;
  const subs = getSubcategoriesForCategory(category);
  const sub_category =
    typeof q.sub_category === 'string' && q.sub_category.trim()
      ? q.sub_category.trim()
      : subs[0];
  const thinking_level = isValidThinkingLevel(q.thinking_level) ? q.thinking_level : 'Knowledge';
  const training_level = isValidTrainingLevel(q.training_level) ? q.training_level : 'A';
  const statusRaw = normalizeLegacyStatus(q.status);
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'draft';

  const media_attachment = q.media_attachment ?? null;
  const has_media = computeHasMedia(media_attachment);

  return {
    category,
    sub_category,
    thinking_level,
    training_level,
    has_media,
    question_type: ['single_choice', 'multi_choice', 'true_false', 'open_ended'].includes(q.question_type)
      ? q.question_type
      : 'single_choice',
    question_text: q.question_text ?? '',
    options,
    media_attachment,
    correct_answer: q.correct_answer ?? null,
    explanation: q.explanation ?? null,
    hint: q.hint ?? null,
    status,
    total_attempts: typeof q.total_attempts === 'number' ? q.total_attempts : 0,
    total_success: typeof q.total_success === 'number' ? q.total_success : 0,
    success_rate: typeof q.success_rate === 'number' ? q.success_rate : 0,
  };
}

/** Build a $set object from only the fields that were actually sent. */
function normalizePartialUpdate(body) {
  const update = {};
  if (body.category !== undefined) {
    const c = typeof body.category === 'string' ? body.category.trim() : '';
    update.category = isValidCategory(c) ? c : FIRST_CAT;
  }
  if (body.sub_category !== undefined) {
    update.sub_category = typeof body.sub_category === 'string' ? body.sub_category.trim() : '';
  }
  if (body.thinking_level !== undefined && isValidThinkingLevel(body.thinking_level)) {
    update.thinking_level = body.thinking_level;
  }
  if (body.training_level !== undefined && isValidTrainingLevel(body.training_level)) {
    update.training_level = body.training_level;
  }
  if (body.question_type !== undefined) update.question_type = body.question_type;
  if (body.question_text !== undefined) update.question_text = body.question_text;
  if (body.options !== undefined) update.options = normalizeOptions(body.options);
  if (body.correct_answer !== undefined) update.correct_answer = body.correct_answer;
  if (body.explanation !== undefined) update.explanation = body.explanation;
  if (body.hint !== undefined) update.hint = body.hint;
  if (body.status !== undefined) {
    const s = normalizeLegacyStatus(body.status);
    if (VALID_STATUS.has(s)) update.status = s;
  }
  if (body.media_attachment !== undefined) {
    update.media_attachment = body.media_attachment;
    update.has_media = computeHasMedia(body.media_attachment);
  }
  if (body.total_attempts !== undefined) update.total_attempts = body.total_attempts;
  if (body.total_success !== undefined) update.total_success = body.total_success;
  if (body.success_rate !== undefined) update.success_rate = body.success_rate;
  return update;
}

export async function getQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(200).json([]);
    }
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 100000));
    const list = await Question.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
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
    const created = [];
    for (const q of items) {
      const data = normalizeQuestionForDb(q);
      const doc = await Question.create(data);
      const updated = await Question.findById(doc._id).lean();
      created.push({ id: updated._id.toString(), ...updated });
    }
    res.status(201).json(Array.isArray(body) ? created : created[0]);
  } catch (err) {
    console.error('POST /api/questions error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function updateQuestion(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const body = req.body || {};
    const isPartial = !body.question_text;
    const data = isPartial ? normalizePartialUpdate(body) : normalizeQuestionForDb(body);
    const doc = await Question.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: false }).lean();
    if (!doc) return res.status(404).json({ error: 'Question not found' });

    const { _id, ...rest } = doc;
    res.json({ id: _id.toString(), ...rest });
  } catch (err) {
    console.error('PUT /api/questions/:id error:', err);
    const isValidation = err.name === 'ValidationError';
    res.status(isValidation ? 400 : 500).json({ error: err.message || 'Update failed' });
  }
}

export async function deleteQuestion(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const doc = await Question.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Question not found' });
    res.json({ success: true, id });
  } catch (err) {
    console.error('DELETE /api/questions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function syncQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const body = req.body;
    const items = Array.isArray(body) ? body : [body];

    const allExisting = await Question.find({}, { question_text: 1 }).lean();
    const existingTexts = new Set(allExisting.map((doc) => (doc.question_text || '').trim().toLowerCase()));

    const toCreate = [];
    let skipped = 0;
    for (const q of items) {
      const text = (q.question_text || '').trim();
      if (!text) {
        skipped++;
        continue;
      }
      if (existingTexts.has(text.toLowerCase())) {
        skipped++;
        continue;
      }
      existingTexts.add(text.toLowerCase());
      toCreate.push(normalizeQuestionForDb(q));
    }

    let synced = 0;
    if (toCreate.length > 0) {
      const result = await Question.insertMany(toCreate, { ordered: false });
      synced = result.length;
    }

    res.status(201).json({ synced, skipped, total: items.length });
  } catch (err) {
    console.error('POST /api/questions/sync error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function recatalogAllQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const total = await Question.countDocuments({});
    res.json({
      total,
      cataloged: 0,
      message: 'Tags and hierarchy were removed from the question schema; recatalog is a no-op.',
    });
  } catch (err) {
    console.error('POST /api/questions/recatalog error:', err);
    res.status(500).json({ error: err.message });
  }
}

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
    if (toDelete.length > 0) {
      const result = await Question.deleteMany({ _id: { $in: toDelete } });
      removed = result.deletedCount || toDelete.length;
    }
    res.json({ removed, total: list.length });
  } catch (err) {
    console.error('POST /api/questions/dedupe error:', err);
    res.status(500).json({ error: err.message });
  }
}
