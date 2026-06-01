/**
 * REST API for questions — sync to MongoDB so all devices see the same data.
 * GET /api/questions — list all questions
 * POST /api/questions — create one or more questions (body: object or array)
 */
import mongoose from 'mongoose';
import Question from '../models/Question.js';
import QuestionVersion from '../models/QuestionVersion.js';
import ProtocolChunk from '../models/ProtocolChunk.js';
import { getActor } from './authMiddleware.js';
import { isDbConnected, ensureDbConnection } from './db.js';
import {
  QUESTION_CATEGORIES,
  normalizeQuestionMediaPayload,
  computeQuestionHasMedia,
  computeHasMedia,
  normalizeLegacyStatus,
  isValidCategory,
  isValidThinkingLevel,
  isValidTrainingLevel,
  isValidMedicalLevel,
  getSubcategoriesForCategory,
} from '../shared/questionBankMetadata.js';
import { validateRollingCaseStructure } from '../workflows/rollingCaseEngine.js';
import {
  buildProtocolContextBlock,
  extractQuestionSignals,
  fitChunksToTokenBudget,
} from '../shared/protocolContext.js';

const VALID_STATUS = new Set(['active', 'under_review', 'draft']);
const VALID_THINKING_LEVELS = ['Knowledge', 'Understanding', 'Application', 'Synthesis'];
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const FIRST_CAT = QUESTION_CATEGORIES[0].value;

function scoreProtocolChunk(chunk, signals, normalizedQuestion) {
  let score = 0;
  const text = String(chunk.chunk_text || '').toLowerCase();
  if (signals.drugs.some((d) => String(chunk.drug_name || '').toLowerCase() === d.toLowerCase())) score += 8;
  if (signals.protocols.some((p) => String(chunk.protocol_name || '').toLowerCase().includes(String(p).toLowerCase()))) score += 4;
  for (const token of signals.doseTokens) if (text.includes(String(token).toLowerCase())) score += 2;
  const words = normalizedQuestion.split(/\s+/).filter((w) => w.length >= 3).slice(0, 24);
  for (const w of words) if (text.includes(w)) score += 0.15;
  score += (chunk.priority || 0) * 0.4;
  return score;
}

async function getProtocolContextForQuestionServer(questionText, tokenBudget = 2800, topK = 4) {
  const text = String(questionText || '').trim();
  if (!text) return { contextBlock: '', noProtocolMatch: true };
  const activeVersions = await ProtocolChunk.distinct('version', { is_active_version: true });
  const filter = activeVersions.length ? { version: { $in: activeVersions } } : {};
  const candidates = await ProtocolChunk.find(filter).limit(220).lean();
  const signals = extractQuestionSignals(text);
  const scored = candidates
    .map((c) => ({ ...c, score: scoreProtocolChunk(c, signals, signals.normalizedText) }))
    .filter((x) => x.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(6, topK * 3));
  const fitted = fitChunksToTokenBudget(scored, tokenBudget).slice(0, topK);
  return {
    contextBlock: buildProtocolContextBlock(fitted),
    noProtocolMatch: fitted.length === 0,
  };
}

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
  const medical_levels = Array.isArray(q.medical_levels)
    ? q.medical_levels.map((x) => String(x)).filter((x) => isValidMedicalLevel(x))
    : [];
  const statusRaw = normalizeLegacyStatus(q.status);
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'draft';

  const mediaNorm = normalizeQuestionMediaPayload(q);

  const questionType = ['single_choice', 'multi_choice', 'true_false', 'open_ended', 'rolling_case'].includes(q.question_type)
    ? q.question_type
    : 'single_choice';
  const rolling_case = questionType === 'rolling_case' ? (q.rolling_case && typeof q.rolling_case === 'object' ? q.rolling_case : null) : null;
  if (questionType === 'rolling_case' && rolling_case) {
    const errs = validateRollingCaseStructure(rolling_case);
    if (errs.length > 0) throw new Error(`Invalid rolling_case: ${errs.join(' | ')}`);
  }

  return {
    category,
    sub_category,
    thinking_level,
    training_level,
    medical_levels,
    case_name: typeof q.case_name === 'string' ? q.case_name.trim() : '',
    has_media: mediaNorm.has_media,
    question_type: questionType,
    question_text: q.question_text ?? '',
    options,
    media_attachment: mediaNorm.media_attachment,
    media_bank_tag: mediaNorm.media_bank_tag,
    correct_answer: q.correct_answer ?? null,
    explanation: q.explanation ?? null,
    hint: q.hint ?? null,
    rolling_case,
    suspended_due_to_branch: typeof q.suspended_due_to_branch === 'string' ? q.suspended_due_to_branch : '',
    status,
    total_attempts: typeof q.total_attempts === 'number' ? q.total_attempts : 0,
    total_success: typeof q.total_success === 'number' ? q.total_success : 0,
    success_rate: typeof q.success_rate === 'number' ? q.success_rate : 0,
    book_classified_at: typeof q.book_classified_at === 'string' ? q.book_classified_at : '',
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
  if (body.medical_levels !== undefined) {
    update.medical_levels = Array.isArray(body.medical_levels)
      ? body.medical_levels.map((x) => String(x)).filter((x) => isValidMedicalLevel(x))
      : [];
  }
  if (body.question_type !== undefined) update.question_type = body.question_type;
  if (body.case_name !== undefined) update.case_name = typeof body.case_name === 'string' ? body.case_name.trim() : '';
  if (body.question_text !== undefined) update.question_text = body.question_text;
  if (body.options !== undefined) update.options = normalizeOptions(body.options);
  if (body.correct_answer !== undefined) update.correct_answer = body.correct_answer;
  if (body.explanation !== undefined) update.explanation = body.explanation;
  if (body.hint !== undefined) update.hint = body.hint;
  if (body.rolling_case !== undefined) {
    if (body.rolling_case && typeof body.rolling_case === 'object') {
      const errs = validateRollingCaseStructure(body.rolling_case);
      if (errs.length > 0) throw new Error(`Invalid rolling_case: ${errs.join(' | ')}`);
      update.rolling_case = body.rolling_case;
    } else {
      update.rolling_case = null;
    }
  }
  if (body.suspended_due_to_branch !== undefined) {
    update.suspended_due_to_branch = typeof body.suspended_due_to_branch === 'string' ? body.suspended_due_to_branch : '';
  }
  if (body.status !== undefined) {
    const s = normalizeLegacyStatus(body.status);
    if (VALID_STATUS.has(s)) update.status = s;
  }
  if (body.media_attachment !== undefined) {
    update.media_attachment = body.media_attachment;
    if (computeHasMedia(body.media_attachment)) update.media_bank_tag = null;
  }
  if (body.media_bank_tag !== undefined) {
    const tm = typeof body.media_bank_tag === 'string' ? body.media_bank_tag.trim() : '';
    update.media_bank_tag = tm || null;
    if (tm) update.media_attachment = null;
  }
  if (body.total_attempts !== undefined) update.total_attempts = body.total_attempts;
  if (body.total_success !== undefined) update.total_success = body.total_success;
  if (body.success_rate !== undefined) update.success_rate = body.success_rate;
  if (body.book_classified_at !== undefined) {
    update.book_classified_at = typeof body.book_classified_at === 'string' ? body.book_classified_at : '';
  }
  return update;
}

export async function getQuestions(req, res) {
  try {
    await ensureDbConnection();
    const connected = isDbConnected();
    res.set('X-QuizMDA-Db-Connected', connected ? '1' : '0');
    if (!connected) {
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
    let data = isPartial ? normalizePartialUpdate(body) : normalizeQuestionForDb(body);

    // Snapshot the question BEFORE the update for the version history.
    const current = await Question.findById(id).lean();
    if (!current) return res.status(404).json({ error: 'Question not found' });

    if (isPartial) {
      const merged = { ...current, ...data };
      data.has_media = computeQuestionHasMedia({
        media_attachment: merged.media_attachment,
        media_bank_tag: merged.media_bank_tag,
      });
    }

    await saveQuestionVersion(id, current, data, req);

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

/**
 * Persist a snapshot of the question's PRE-update state to the question_versions
 * collection. Never blocks the update on failure (logs and continues), but any
 * error is surfaced to the console for observability.
 */
async function saveQuestionVersion(questionId, previousDoc, incomingData, req) {
  try {
    if (!previousDoc) return;
    const { _id, __v, createdAt, updatedAt, ...snapshot } = previousDoc;

    // Best-effort diff of which fields are being changed.
    const changedFields = [];
    for (const key of Object.keys(incomingData || {})) {
      const before = JSON.stringify(previousDoc[key] ?? null);
      const after = JSON.stringify(incomingData[key] ?? null);
      if (before !== after) changedFields.push(key);
    }

    const lastVersion = await QuestionVersion.findOne({ question_id: String(questionId) })
      .sort({ version_number: -1 })
      .select('version_number')
      .lean();
    const nextVersion = (lastVersion?.version_number || 0) + 1;

    const actor = getActor(req);
    await QuestionVersion.create({
      question_id: String(questionId),
      version_number: nextVersion,
      question_data: snapshot,
      changed_fields: changedFields,
      changed_by: actor,
      changed_at: new Date(),
    });
  } catch (err) {
    console.error('[question-versions] failed to snapshot question', questionId, err.message);
  }
}

/**
 * GET /api/questions/:id/versions
 * Returns the version history of a question (newest first).
 */
export async function listQuestionVersions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'מזהה שאלה אינו תקין' });
    }
    const versions = await QuestionVersion.find({ question_id: String(id) })
      .sort({ version_number: -1 })
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json(versions);
  } catch (err) {
    console.error('GET /api/questions/:id/versions error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/media/merge-tags
 * Merge several media_bank_tag values into a single new tag across all questions.
 * Body: { oldTags: string[], newTagName: string }
 */
export async function mergeMediaTags(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    }
    const { oldTags, newTagName } = req.body || {};
    if (!Array.isArray(oldTags) || oldTags.length === 0) {
      return res.status(400).json({ error: 'יש לספק רשימת תגים לאיחוד (oldTags)' });
    }
    const newTag = String(newTagName || '').trim();
    if (!newTag) {
      return res.status(400).json({ error: 'יש לספק שם תג חדש (newTagName)' });
    }
    const cleanOld = [...new Set(oldTags.map((t) => String(t || '').trim()).filter(Boolean))];
    if (cleanOld.length === 0) {
      return res.status(400).json({ error: 'רשימת התגים לאיחוד ריקה' });
    }

    const result = await Question.updateMany(
      { media_bank_tag: { $in: cleanOld } },
      { $set: { media_bank_tag: newTag } },
    );
    const matched = result.matchedCount ?? result.n ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    console.log(`[media/merge-tags] ${cleanOld.join(', ')} → "${newTag}" | matched ${matched}, modified ${modified}`);
    res.json({ success: true, newTag, mergedTags: cleanOld, matched, modified });
  } catch (err) {
    console.error('POST /api/media/merge-tags error:', err);
    res.status(500).json({ error: err.message });
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

function classifyThinkingLevelHeuristic(text = '') {
  const t = String(text || '').trim();
  if (!t) return 'Knowledge';
  if (/(הסבר|מדוע|למה|מנגנון|משמעות)/.test(t)) return 'Understanding';
  if (/(מה תעשה|טיפול|בחירה|ניהול|שלב הבא|החלטה)/.test(t)) return 'Application';
  if (/(השווה|ניתוח|תכנית|בנה|סדר עדיפויות|אינטגרציה)/.test(t)) return 'Synthesis';
  return 'Knowledge';
}

async function classifyThinkingLevelWithAi(questionText, apiKey) {
  const systemPrompt =
    'אתה מסווג שאלה רפואית לרמת חשיבה אחת בלבד: Knowledge, Understanding, Application, Synthesis. החזר JSON בלבד: {"thinking_level":"..."}';
  const ctx = await getProtocolContextForQuestionServer(questionText).catch(() => ({ contextBlock: '', noProtocolMatch: true }));
  const userPrompt = `סווג את השאלה לרמת החשיבה המתאימה ביותר:\n\n${questionText}\n\n${ctx.contextBlock || 'אין הקשר פרוטוקולי תואם שנשלף.'}`;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 120,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const level = parsed?.thinking_level;
  return VALID_THINKING_LEVELS.includes(level) ? level : null;
}

/** POST /api/questions/:id/classify-thinking-level */
export async function classifyThinkingLevel(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const doc = await Question.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'Question not found' });

    const text = String(doc.question_text || '').trim();
    if (!text) return res.status(400).json({ error: 'Question text is empty' });

    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    let thinking_level = null;
    let source = 'heuristic';
    if (apiKey) {
      try {
        thinking_level = await classifyThinkingLevelWithAi(text, apiKey);
        if (thinking_level) source = 'ai';
      } catch (err) {
        console.warn('AI thinking-level classification failed, fallback heuristic:', err?.message);
      }
    }
    if (!thinking_level) thinking_level = classifyThinkingLevelHeuristic(text);

    const updated = await Question.findByIdAndUpdate(
      id,
      { $set: { thinking_level } },
      { new: true }
    ).lean();
    return res.json({
      id: updated._id.toString(),
      thinking_level: updated.thinking_level,
      source,
    });
  } catch (err) {
    console.error('POST /api/questions/:id/classify-thinking-level error:', err);
    return res.status(500).json({ error: err.message });
  }
}
