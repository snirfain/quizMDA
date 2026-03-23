/**
 * REST API for questions — sync to MongoDB so all devices see the same data.
 * GET /api/questions — list all questions
 * POST /api/questions — create one or more questions (body: object or array)
 */
import mongoose from 'mongoose';
import Question from '../models/Question.js';
import Transcript from '../models/Transcript.js';
import { matchQuestionToTranscripts, buildTranscriptTokenSets } from './transcriptApi.js';
import { isDbConnected, ensureDbConnection } from './db.js';
import { classifyQuestionToHierarchy } from '../shared/categories.js';

const NO_TRANSCRIPT_TAG = 'לא נמצא בתמלול';

/**
 * Build catalog updates for a question (transcript tag + hierarchy) without touching DB.
 * Returns a $set object (may be empty if nothing to update).
 */
function buildCatalogUpdates(doc, transcripts, transcriptNames, tokenSets) {
  const updates = {};
  const found = matchQuestionToTranscripts(doc.question_text, transcripts, tokenSets);
  const newTag = found || NO_TRANSCRIPT_TAG;
  const existing = Array.isArray(doc.tags) ? doc.tags : [];
  const withoutTranscript = existing.filter(t => t !== NO_TRANSCRIPT_TAG && !transcriptNames.has(t));
  updates.tags = [...withoutTranscript, newTag];

  const currentHierarchy = doc.hierarchy_id;
  const needsClassification = !currentHierarchy || currentHierarchy === 'unsorted' || currentHierarchy === 'h1';
  if (needsClassification) {
    const classified = classifyQuestionToHierarchy(doc.question_text);
    if (classified) updates.hierarchy_id = classified;
  }
  return updates;
}

/**
 * Auto-catalog a single question and persist to DB.
 */
async function autoCatalogQuestion(doc, transcripts, transcriptNames, tokenSets) {
  const updates = buildCatalogUpdates(doc, transcripts, transcriptNames, tokenSets);
  if (Object.keys(updates).length > 0) {
    await Question.findByIdAndUpdate(doc._id, { $set: updates });
  }
  return updates;
}

const DIFFICULTY_MAP = { קל: 3, בינוני: 5, קשה: 8 };
const VALID_STATUS = new Set(['active', 'draft', 'suspended', 'pending_review', 'rejected', 'needs_revision']);

/** Normalize payload from frontend (mock/localStorage) to MongoDB schema. */
function normalizeQuestionForDb(q) {
  // Difficulty is not set manually; it is computed after ≥50 attempts (see difficultyEngine).
  let difficulty_level = q.difficulty_level;
  if (typeof difficulty_level === 'string' && DIFFICULTY_MAP[difficulty_level] != null) {
    difficulty_level = DIFFICULTY_MAP[difficulty_level];
  } else if (typeof difficulty_level !== 'number' || difficulty_level < 1 || difficulty_level > 10) {
    difficulty_level = null; // unrated until enough attempts
  }
  const options = (Array.isArray(q.options) ? q.options : []).map((o) => ({
    value: o.value != null ? String(o.value) : '0',
    label: String(o.label ?? o.text ?? ''),
  }));
  const status = VALID_STATUS.has(q.status) ? q.status : 'active';
  return {
    hierarchy_id: q.hierarchy_id != null && q.hierarchy_id !== '' ? q.hierarchy_id : 'unsorted',
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

/** Build a $set object from only the fields that were actually sent. */
function normalizePartialUpdate(body) {
  const update = {};
  if (body.hierarchy_id !== undefined) update.hierarchy_id = body.hierarchy_id || 'unsorted';
  if (body.question_type !== undefined) update.question_type = body.question_type;
  if (body.question_text !== undefined) update.question_text = body.question_text;
  if (body.options !== undefined) update.options = (Array.isArray(body.options) ? body.options : []).map((o) => ({ value: o.value != null ? String(o.value) : '0', label: String(o.label ?? o.text ?? '') }));
  if (body.correct_answer !== undefined) update.correct_answer = body.correct_answer;
  if (body.explanation !== undefined) update.explanation = body.explanation;
  if (body.hint !== undefined) update.hint = body.hint;
  if (body.tags !== undefined) update.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.status !== undefined && VALID_STATUS.has(body.status)) update.status = body.status;
  if (body.difficulty_level !== undefined) {
    let d = body.difficulty_level;
    if (typeof d === 'string' && DIFFICULTY_MAP[d] != null) d = DIFFICULTY_MAP[d];
    else if (typeof d !== 'number' || d < 1 || d > 10) d = null;
    update.difficulty_level = d;
  }
  if (body.media_attachment !== undefined) update.media_attachment = body.media_attachment;
  if (body.media_bank_tag !== undefined) update.media_bank_tag = body.media_bank_tag;
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
    console.log('[api/questions] GET: skip=', skip, 'limit=', limit, 'count=', list.length);
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
    const transcripts = await Transcript.find({}).lean();
    const transcriptNames = new Set(transcripts.map(t => t.name));
    const tokenSets = buildTranscriptTokenSets(transcripts);
    const created = [];
    for (const q of items) {
      const data = normalizeQuestionForDb(q);
      const doc = await Question.create(data);
      await autoCatalogQuestion(doc, transcripts, transcriptNames, tokenSets);
      const updated = await Question.findById(doc._id).lean();
      created.push({ id: updated._id.toString(), ...updated });
    }
    console.log('[api/questions] POST: created=', created.length);
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

    // Re-catalog when question_text changes (full update)
    if (!isPartial) {
      const transcripts = await Transcript.find({}).lean();
      const transcriptNames = new Set(transcripts.map(t => t.name));
      const tokenSets = buildTranscriptTokenSets(transcripts);
      await autoCatalogQuestion(doc, transcripts, transcriptNames, tokenSets);
      const refreshed = await Question.findById(doc._id).lean();
      const { _id, ...rest } = refreshed;
      return res.json({ id: _id.toString(), ...rest });
    }

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

/**
 * Upsert-based sync: load all existing question_texts from DB into a Set,
 * then bulk-create only the ones that don't exist. Fast and regex-free.
 */
export async function syncQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const body = req.body;
    const items = Array.isArray(body) ? body : [body];
    console.log('[api/questions/sync] incoming:', items.length);

    const allExisting = await Question.find({}, { question_text: 1 }).lean();
    const existingTexts = new Set(
      allExisting.map(doc => (doc.question_text || '').trim().toLowerCase())
    );
    console.log('[api/questions/sync] existing texts in DB:', existingTexts.size);

    const toCreate = [];
    let skipped = 0;
    for (const q of items) {
      const text = (q.question_text || '').trim();
      if (!text) { skipped++; continue; }
      if (existingTexts.has(text.toLowerCase())) { skipped++; continue; }
      existingTexts.add(text.toLowerCase());
      toCreate.push(normalizeQuestionForDb(q));
    }

    let synced = 0;
    if (toCreate.length > 0) {
      const result = await Question.insertMany(toCreate, { ordered: false });
      synced = result.length;
      const transcripts = await Transcript.find({}).lean();
      const transcriptNames = new Set(transcripts.map(t => t.name));
      const tokenSets = buildTranscriptTokenSets(transcripts);
      const ops = [];
      for (const doc of result) {
        const catalogUpdates = buildCatalogUpdates(doc, transcripts, transcriptNames, tokenSets);
        if (Object.keys(catalogUpdates).length > 0) {
          ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: catalogUpdates } } });
        }
      }
      if (ops.length > 0) await Question.bulkWrite(ops, { ordered: false });
    }

    console.log('[api/questions/sync] synced:', synced, 'skipped:', skipped);
    res.status(201).json({ synced, skipped, total: items.length });
  } catch (err) {
    console.error('POST /api/questions/sync error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Bulk re-catalog all existing questions that are missing transcript tag or hierarchy.
 * POST /api/questions/recatalog
 */
export async function recatalogAllQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const transcripts = await Transcript.find({}).lean();
    const transcriptNames = new Set(transcripts.map(t => t.name));
    const tokenSets = buildTranscriptTokenSets(transcripts);
    const allQuestions = await Question.find({}).lean();
    let cataloged = 0, alreadyDone = 0, errors = 0;
    let transcriptMatched = 0, transcriptNotFound = 0, hierarchyClassified = 0;
    const ops = [];

    for (const doc of allQuestions) {
      try {
        const tags = Array.isArray(doc.tags) ? doc.tags : [];
        const hasTranscriptTag = tags.some(t => transcriptNames.has(t) || t === NO_TRANSCRIPT_TAG);
        const hasHierarchy = doc.hierarchy_id && doc.hierarchy_id !== 'unsorted' && doc.hierarchy_id !== 'h1';

        if (hasTranscriptTag && hasHierarchy) {
          alreadyDone++;
          continue;
        }

        const updates = {};

        if (!hasTranscriptTag) {
          const found = matchQuestionToTranscripts(doc.question_text, transcripts, tokenSets);
          const newTag = found || NO_TRANSCRIPT_TAG;
          const withoutTranscript = tags.filter(t => t !== NO_TRANSCRIPT_TAG && !transcriptNames.has(t));
          updates.tags = [...withoutTranscript, newTag];
          if (found) transcriptMatched++;
          else transcriptNotFound++;
        }

        if (!hasHierarchy) {
          const classified = classifyQuestionToHierarchy(doc.question_text);
          if (classified) {
            updates.hierarchy_id = classified;
            hierarchyClassified++;
          }
        }

        if (Object.keys(updates).length > 0) {
          ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: updates } } });
          cataloged++;
        } else {
          alreadyDone++;
        }
      } catch (e) {
        console.error('[recatalog] error on question', doc._id, e.message);
        errors++;
      }
    }

    if (ops.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < ops.length; i += BATCH) {
        await Question.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
      }
    }

    console.log(`[recatalog] total=${allQuestions.length} cataloged=${cataloged} transcriptMatched=${transcriptMatched} hierarchyClassified=${hierarchyClassified} alreadyDone=${alreadyDone} errors=${errors}`);
    res.json({ total: allQuestions.length, cataloged, transcriptMatched, transcriptNotFound, hierarchyClassified, alreadyDone, errors });
  } catch (err) {
    console.error('POST /api/questions/recatalog error:', err);
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
    if (toDelete.length > 0) {
      const result = await Question.deleteMany({ _id: { $in: toDelete } });
      removed = result.deletedCount || toDelete.length;
    }
    console.log('[api/questions] dedupe: removed=', removed);
    res.json({ removed, total: list.length });
  } catch (err) {
    console.error('POST /api/questions/dedupe error:', err);
    res.status(500).json({ error: err.message });
  }
}
