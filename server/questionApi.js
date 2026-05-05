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
  normalizeQuestionMediaPayload,
  computeQuestionHasMedia,
  computeHasMedia,
  normalizeLegacyStatus,
  isValidCategory,
  isValidThinkingLevel,
  isValidTrainingLevel,
  getSubcategoriesForCategory,
} from '../shared/questionBankMetadata.js';

const VALID_STATUS = new Set(['active', 'under_review', 'draft']);
const VALID_THINKING_LEVELS = ['Knowledge', 'Understanding', 'Application', 'Synthesis'];
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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
  // #region agent log
  fetch('http://127.0.0.1:7348/ingest/e2bebe2c-443b-45ce-b67f-21266df27271',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b92899'},body:JSON.stringify({sessionId:'b92899',runId:'post-fix',hypothesisId:'H9',location:'server/questionApi.js:normalizeQuestionForDb',message:'Server normalized category/sub_category',data:{inputCategory:q?.category??null,inputSubCategory:q?.sub_category??null,normalizedCategory:category,normalizedSubCategory:sub_category,inputSubType:typeof q?.sub_category},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const thinking_level = isValidThinkingLevel(q.thinking_level) ? q.thinking_level : 'Knowledge';
  const training_level = isValidTrainingLevel(q.training_level) ? q.training_level : 'A';
  const statusRaw = normalizeLegacyStatus(q.status);
  const status = VALID_STATUS.has(statusRaw) ? statusRaw : 'draft';

  const mediaNorm = normalizeQuestionMediaPayload(q);

  return {
    category,
    sub_category,
    thinking_level,
    training_level,
    has_media: mediaNorm.has_media,
    question_type: ['single_choice', 'multi_choice', 'true_false', 'open_ended'].includes(q.question_type)
      ? q.question_type
      : 'single_choice',
    question_text: q.question_text ?? '',
    options,
    media_attachment: mediaNorm.media_attachment,
    media_bank_tag: mediaNorm.media_bank_tag,
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
  return update;
}

export async function getQuestions(req, res) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7348/ingest/e2bebe2c-443b-45ce-b67f-21266df27271',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b92899'},body:JSON.stringify({sessionId:'b92899',runId:'pre-fix',hypothesisId:'H1',location:'server/questionApi.js:getQuestions:start',message:'GET /api/questions start',data:{query:req.query||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7348/ingest/e2bebe2c-443b-45ce-b67f-21266df27271',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b92899'},body:JSON.stringify({sessionId:'b92899',runId:'pre-fix',hypothesisId:'H1',location:'server/questionApi.js:getQuestions:catch',message:'GET /api/questions failed',data:{name:err?.name,message:err?.message,stack:String(err?.stack||'').slice(0,600)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7348/ingest/e2bebe2c-443b-45ce-b67f-21266df27271',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b92899'},body:JSON.stringify({sessionId:'b92899',runId:'pre-fix',hypothesisId:'H2',location:'server/questionApi.js:updateQuestion:invalidId',message:'PUT invalid question id',data:{id:id||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const body = req.body || {};
    const isPartial = !body.question_text;
    let data = isPartial ? normalizePartialUpdate(body) : normalizeQuestionForDb(body);
    if (isPartial) {
      const current = await Question.findById(id).lean();
      if (!current) return res.status(404).json({ error: 'Question not found' });
      const merged = { ...current, ...data };
      data.has_media = computeQuestionHasMedia({
        media_attachment: merged.media_attachment,
        media_bank_tag: merged.media_bank_tag,
      });
    }
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
      // #region agent log
      fetch('http://127.0.0.1:7348/ingest/e2bebe2c-443b-45ce-b67f-21266df27271',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b92899'},body:JSON.stringify({sessionId:'b92899',runId:'pre-fix',hypothesisId:'H2',location:'server/questionApi.js:deleteQuestion:invalidId',message:'DELETE invalid question id',data:{id:id||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
  const userPrompt = `סווג את השאלה לרמת החשיבה המתאימה ביותר:\n\n${questionText}`;

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
