/**
 * Transcript API – upload SRT, list transcripts, generate questions from transcript
 * Hebrew: API תמלילים
 */

import multer from 'multer';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Transcript from '../models/Transcript.js';
import { TRANSCRIPT_QUESTION_SYSTEM_PROMPT, buildTranscriptQuestionUserPrompt } from './transcriptQuestionPrompt.js';
import { isDbConnected, ensureDbConnection } from './db.js';

const memoryStorage = multer.memoryStorage();
const MAX_FILES = 200;
export const uploadTranscriptMiddleware = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname && file.originalname.toLowerCase().endsWith('.srt');
    if (ok) cb(null, true);
    else cb(new Error('רק קבצי SRT נתמכים'), false);
  },
}).array('file', MAX_FILES);

/**
 * Decode filename that may have been received as Latin-1 but is actually UTF-8 (e.g. Hebrew).
 */
function decodeUtf8Filename(raw) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    if (decoded && /[\u0590-\u05FF]/.test(decoded)) return decoded;
  } catch (_) {}
  return raw;
}
/**
 * Parse SRT buffer to plain text (strip timestamps, join lines)
 */
function parseSrtToText(buffer) {
  if (!buffer || !buffer.length) return '';
  const str = buffer.toString('utf8');
  const lines = str.split(/\r?\n/);
  const textLines = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (/^\d+$/.test(line)) {
      i++;
      if (i < lines.length && /^\d{2}:\d{2}:\d{2}/.test(lines[i])) {
        i++;
      }
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }
      i++;
    } else {
      i++;
    }
  }
  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}


function escapeRegex(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listTranscripts(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(200).json([]);
    }
    const search = (req.query.search || req.query.q || '').trim();
    const query = {};
    if (search) {
      const re = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: re }, { fullText: re }];
    }
    const list = await Transcript.find(query, { name: 1, originalFilename: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean();
    const withCounts = list.map((t) => ({
      _id: t._id,
      name: t.name,
      originalFilename: t.originalFilename,
      createdAt: t.createdAt,
      questionCount: 0,
    }));
    res.set('Cache-Control', 'no-store');
    res.json(withCounts);
  } catch (err) {
    console.error('GET /api/transcripts error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getTranscript(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { id } = req.params;
    const doc = await Transcript.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'תמליל לא נמצא' });
    res.set('Cache-Control', 'no-store');
    res.json({ _id: doc._id, name: doc.name, fullText: doc.fullText || '', originalFilename: doc.originalFilename, createdAt: doc.createdAt });
  } catch (err) {
    console.error('GET /api/transcripts/:id error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function updateTranscript(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { id } = req.params;
    const { name, fullText } = req.body || {};
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof fullText === 'string') update.fullText = fullText;
    const doc = await Transcript.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: 'תמליל לא נמצא' });
    res.json({ _id: doc._id, name: doc.name, fullText: doc.fullText, originalFilename: doc.originalFilename, createdAt: doc.createdAt });
  } catch (err) {
    console.error('PUT /api/transcripts/:id error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteTranscript(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { id } = req.params;
    const doc = await Transcript.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'תמליל לא נמצא' });
    res.json({ deleted: true, id });
  } catch (err) {
    console.error('DELETE /api/transcripts/:id error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function uploadTranscript(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'לא נבחרו קבצים להעלאה' });
    }
    let filenames = [];
    if (req.body && typeof req.body.filenames === 'string') {
      try {
        filenames = JSON.parse(req.body.filenames);
        if (!Array.isArray(filenames)) filenames = [];
      } catch (_) {}
    } else if (req.body && typeof req.body.filename === 'string') {
      filenames = [req.body.filename];
    }
    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || !file.buffer) continue;
      const fullText = parseSrtToText(file.buffer);
      const rawFromMulter = (file.originalname || '').trim();
      const fromBody = filenames[i] != null && String(filenames[i]).trim() ? String(filenames[i]).trim() : '';
      const originalFilename = fromBody || decodeUtf8Filename(rawFromMulter);
      const name = originalFilename.replace(/\.srt$/i, '').trim() || `תמליל ${Date.now()}_${i}`;
      const doc = await Transcript.create({ name, fullText, originalFilename });
      created.push({ id: doc._id.toString(), name, originalFilename, createdAt: doc.createdAt });
    }
    console.log('[api/transcripts] uploaded:', created.length, 'files');
    res.status(201).json(created.length === 1 ? created[0] : { uploaded: created.length, items: created });
  } catch (err) {
    console.error('POST /api/transcripts/upload error:', err);
    res.status(500).json({ error: err.message });
  }
}

const NO_TRANSCRIPT_TAG = 'לא נמצא בתמלול';

// Hebrew stop words to skip during token matching
const STOP_WORDS = new Set([
  'של', 'את', 'על', 'עם', 'לא', 'או', 'אם', 'גם', 'כל', 'הם', 'היא', 'הוא',
  'זה', 'זו', 'מה', 'כי', 'אל', 'בו', 'לו', 'עד', 'רק', 'כן', 'אך', 'בין',
  'כמו', 'לפי', 'אחרי', 'לפני', 'כאשר', 'מתוך', 'ביותר', 'שלו', 'שלה',
  'מהו', 'מהי', 'מהם', 'מהן', 'כיצד', 'באיזה', 'which',
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'not',
]);

// Hebrew prefix letters: ב, כ, ל, מ, ה, ו, ש
const HE_PREFIX_RE = /^[בכלמהוש]/;

/**
 * Strip common Hebrew prefixes to produce a stem.
 * Returns an array: [original, stem] (or just [original] if no prefix).
 */
function hebrewStems(word) {
  const stems = [word];
  if (word.length >= 3 && HE_PREFIX_RE.test(word)) {
    stems.push(word.slice(1));
    // Two-letter prefixes: מה, של, בה, לה, וה, שה, כש
    if (word.length >= 4 && /^(מה|של|בה|לה|וה|שה|כש)/.test(word)) {
      stems.push(word.slice(2));
    }
  }
  return stems;
}

/**
 * Extract meaningful tokens from text (words 2+ chars, no stop words).
 * For each word, also produces Hebrew prefix-stripped stems.
 */
function extractTokens(text) {
  if (!text || typeof text !== 'string') return [];
  const words = text
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  const tokens = new Set();
  for (const w of words) {
    for (const stem of hebrewStems(w)) {
      if (stem.length >= 2) tokens.add(stem);
    }
  }
  return [...tokens];
}

/**
 * Pre-build a token set from a transcript's fullText for fast lookup.
 */
function buildTranscriptTokenSet(fullText) {
  if (!fullText) return new Set();
  return new Set(extractTokens(fullText));
}

const MIN_MATCH_RATIO = 0.35;
const MIN_MATCHED_TOKENS = 2;

/**
 * Find which transcript (if any) best matches the question text.
 * Uses token overlap: extracts significant words from the question and checks
 * how many appear in each transcript. Returns the best transcript name or null.
 */
export function matchQuestionToTranscripts(questionText, transcripts, _tokenSets) {
  const questionTokens = extractTokens(questionText);
  if (questionTokens.length < 2) return null;

  let bestName = null;
  let bestRatio = 0;

  for (let i = 0; i < transcripts.length; i++) {
    const t = transcripts[i];
    const tokenSet = _tokenSets ? _tokenSets[i] : buildTranscriptTokenSet(t.fullText);
    if (tokenSet.size === 0) continue;

    let matched = 0;
    for (const token of questionTokens) {
      if (tokenSet.has(token)) matched++;
    }

    const ratio = matched / questionTokens.length;
    if (ratio > bestRatio && matched >= MIN_MATCHED_TOKENS) {
      bestRatio = ratio;
      bestName = t.name;
    }
  }

  return bestRatio >= MIN_MATCH_RATIO ? bestName : null;
}

/**
 * Pre-build token sets for all transcripts (call once, reuse for many questions).
 */
export function buildTranscriptTokenSets(transcripts) {
  return transcripts.map(t => buildTranscriptTokenSet(t.fullText));
}

/**
 * Run matching for all questions and update their tags. Removes previous transcript tag / NO_TRANSCRIPT_TAG and sets the new one.
 */
export async function matchAllQuestions(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const Question = (await import('../models/Question.js')).default;
    const total = await Question.countDocuments({});
    res.json({
      updated: 0,
      total,
      message: 'Question tags were removed from the schema; match-all is a no-op.',
    });
  } catch (err) {
    console.error('POST /api/transcripts/match-all error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ── Transcript spelling correction via OpenAI ───────────────────────────────

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SPELLING_SYSTEM_PROMPT = `אתה עורך לשוני מקצועי בעברית.
תפקידך: לתקן שגיאות כתיב, שגיאות הקלדה ושגיאות דקדוק בטקסט שתקבל.

כללים:
1. תקן רק שגיאות כתיב ודקדוק. אל תשנה את המשמעות, הסגנון או המבנה.
2. שמור על כל שורות חדשות, רווחים ופורמט מקורי.
3. אל תוסיף ואל תמחק תוכן.
4. אם יש מונחים מקצועיים (רפואה, הצלה וכו') - ודא שהם כתובים נכון.
5. החזר את הטקסט המתוקן בלבד, בלי הסברים.`;

const SPELLING_CHUNK_SIZE = 3000;

async function fixSpellingChunk(text, apiKey) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SPELLING_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || text;
}

function splitIntoChunks(text, maxLen) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf(' ', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

const spellingJobs = new Map();

/**
 * POST /api/transcripts/fix-spelling
 * Starts an async job that corrects spelling in all transcripts (or specific IDs).
 */
export function startFixSpelling(req, res) {
  const { transcriptIds } = req.body || {};
  const jobId = crypto.randomUUID();
  const job = { id: jobId, status: 'pending', params: { transcriptIds }, progress: { done: 0, total: 0 } };
  spellingJobs.set(jobId, job);
  runSpellingJob(job);
  res.json({ jobId });
}

async function runSpellingJob(job) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      job.status = 'error'; job.error = 'Database not connected'; return;
    }
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      job.status = 'error'; job.error = 'OPENAI_API_KEY לא מוגדר'; return;
    }

    const { transcriptIds } = job.params;
    const query = Array.isArray(transcriptIds) && transcriptIds.length > 0
      ? { _id: { $in: transcriptIds } } : {};
    const transcripts = await Transcript.find(query).lean();

    if (transcripts.length === 0) {
      job.status = 'error'; job.error = 'לא נמצאו תמלולים'; return;
    }

    job.progress.total = transcripts.length;
    let fixed = 0;

    for (const t of transcripts) {
      if (!t.fullText || t.fullText.trim().length < 10) {
        job.progress.done++;
        continue;
      }
      try {
        const chunks = splitIntoChunks(t.fullText, SPELLING_CHUNK_SIZE);
        const correctedChunks = [];
        for (const chunk of chunks) {
          const corrected = await fixSpellingChunk(chunk, apiKey);
          correctedChunks.push(corrected);
        }
        const correctedText = correctedChunks.join('');
        if (correctedText !== t.fullText) {
          await Transcript.findByIdAndUpdate(t._id, { fullText: correctedText });
          fixed++;
        }
      } catch (e) {
        console.error(`[fix-spelling] error on transcript ${t.name}:`, e.message);
      }
      job.progress.done++;
    }

    job.status = 'done';
    job.result = { total: transcripts.length, fixed };
    console.log(`[fix-spelling] done: ${fixed}/${transcripts.length} transcripts corrected`);
  } catch (err) {
    console.error('[fix-spelling] fatal error:', err);
    job.status = 'error';
    job.error = err.message;
  }
}

/**
 * GET /api/transcripts/fix-spelling/status/:jobId
 */
export function getFixSpellingStatus(req, res) {
  const { jobId } = req.params;
  const job = spellingJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (job.status === 'pending') {
    return res.json({ status: 'pending', progress: job.progress });
  }
  if (job.status === 'done') {
    const result = job.result;
    spellingJobs.delete(jobId);
    return res.json({ status: 'done', ...result });
  }
  const error = job.error;
  spellingJobs.delete(jobId);
  return res.json({ status: 'error', error });
}

// ── Async question generation with in-memory job store ──────────────────────

const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

function parseQuestionsJsonFromAI(content) {
  if (!content || typeof content !== 'string') return [];
  const stripped = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return [];
  }
}

async function normalizeGeneratedQuestion(q) {
  const { QUESTION_CATEGORIES, getSubcategoriesForCategory } = await import('../shared/questionBankMetadata.js');
  const cat = QUESTION_CATEGORIES[0]?.value ?? '';
  const options = (Array.isArray(q.options) ? q.options : []).map((o, i) => ({
    value: String(o?.value ?? i),
    label: String(o?.label ?? o?.text ?? ''),
  }));
  let correct_answer = q.correct_answer;
  if (typeof correct_answer === 'string') {
    try {
      correct_answer = JSON.parse(correct_answer);
    } catch (_) {
      correct_answer = { value: '0' };
    }
  }
  if (!correct_answer || typeof correct_answer !== 'object') correct_answer = { value: '0' };
  const subs = getSubcategoriesForCategory(cat);
  return {
    question_text: String(q.question_text ?? '').trim(),
    question_type: ['single_choice', 'multi_choice', 'true_false', 'open_ended'].includes(q.question_type) ? q.question_type : 'single_choice',
    options,
    correct_answer,
    explanation: q.explanation ? String(q.explanation).trim() : null,
    category: cat,
    sub_category: subs[0] || 'תת־נושא א',
    thinking_level: 'Knowledge',
    training_level: 'A',
    has_media: false,
    status: 'draft',
  };
}

/**
 * Background worker: runs the actual OpenAI call for a job.
 * Updates the job object in-place so the status endpoint can return results.
 */
async function runGenerationJob(job) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      await new Promise((r) => setTimeout(r, 5000));
      await ensureDbConnection();
    }
    if (!isDbConnected()) {
      job.status = 'error';
      job.error = 'Database not connected';
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      job.status = 'error';
      job.error = 'OPENAI_API_KEY לא מוגדר בסביבת השרת';
      return;
    }
    const { transcriptId, transcriptName, transcriptIds, count, excludeQuestionTexts: excludeFromBody } = job.params;

    let transcripts = [];
    if (Array.isArray(transcriptIds) && transcriptIds.length > 0) {
      transcripts = await Transcript.find({ _id: { $in: transcriptIds } }).sort({ createdAt: 1 }).lean();
    } else if (transcriptId) {
      const one = await Transcript.findById(transcriptId).lean();
      if (one) transcripts = [one];
    } else if (transcriptName) {
      const one = await Transcript.findOne({ name: transcriptName }).lean();
      if (one) transcripts = [one];
    }
    if (transcripts.length === 0) {
      job.status = 'error';
      job.error = 'לא נמצאו תמלילים';
      return;
    }

    const combinedText = transcripts
      .map((t) => (t.fullText || '').trim())
      .filter(Boolean)
      .join('\n\n---\n\n');
    if (!combinedText) {
      job.status = 'error';
      job.error = 'התמלילים ריקים';
      return;
    }

    const MAX_TRANSCRIPT_CHARS = 12000;
    const truncatedText = combinedText.length > MAX_TRANSCRIPT_CHARS
      ? combinedText.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[...קוצר מסיבות אורך...]'
      : combinedText;

    const transcriptNames = [...new Set(transcripts.map((t) => t.name).filter(Boolean))];
    const Question = (await import('../models/Question.js')).default;
    const existing = await Question.find({}).select('question_text').limit(8000).lean();
    const fromDb = [...new Set(existing.map((q) => (q.question_text || '').trim()).filter(Boolean))];
    const excludeList = Array.isArray(excludeFromBody) ? excludeFromBody.map((t) => String(t || '').trim()).filter(Boolean) : [];
    const existingTexts = [...new Set([...fromDb, ...excludeList])];
    const userPrompt = buildTranscriptQuestionUserPrompt(truncatedText, count, existingTexts);

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: TRANSCRIPT_QUESTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('OpenAI error:', response.status, errText.slice(0, 300));
      job.status = 'error';
      job.error = 'שגיאה מ-OpenAI: ' + (errText.slice(0, 200) || response.statusText);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const raw = parseQuestionsJsonFromAI(content);
    const questions = [];
    for (const q of raw) {
      const normalized = await normalizeGeneratedQuestion(q);
      questions.push(normalized);
    }
    const filteredQuestions = questions.filter((q) => q.question_text);

    const transcriptNameLabel = transcriptNames.length === 1 ? transcriptNames[0] : transcriptNames.join(', ');
    console.log('[generate-questions job]', job.id, transcriptNameLabel, 'requested', count, 'got', filteredQuestions.length);

    job.status = 'done';
    job.result = { questions: filteredQuestions, transcriptName: transcriptNameLabel, transcriptNames };
  } catch (err) {
    console.error('[generate-questions job error]', job.id, err);
    job.status = 'error';
    job.error = err.message || 'שגיאה בלתי צפויה';
  }
}

/**
 * POST /api/transcripts/generate-questions
 * Returns { jobId } immediately. The actual generation runs in background.
 * Client polls GET /api/transcripts/generate-questions/status/:jobId for results.
 */
export function generateQuestionsFromTranscript(req, res) {
  try {
    cleanupOldJobs();

    const body = req.body || {};
    const { transcriptId, transcriptName, transcriptIds, count: requestedCount, excludeQuestionTexts } = body;
    const count = Math.min(Math.max(1, parseInt(requestedCount, 10) || 10), 100);

    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      status: 'pending',
      createdAt: Date.now(),
      params: { transcriptId, transcriptName, transcriptIds, count, excludeQuestionTexts },
      result: null,
      error: null,
    };
    jobs.set(jobId, job);

    // Fire and forget — runs in background, not blocking the HTTP response
    runGenerationJob(job);

    res.json({ jobId });
  } catch (err) {
    console.error('POST /api/transcripts/generate-questions error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/transcripts/generate-questions/status/:jobId
 * Returns the job status: { status: "pending" | "done" | "error", questions?, error? }
 */
export function getGenerateQuestionsStatus(req, res) {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ status: 'error', error: 'Job not found (may have expired)' });
  }
  if (job.status === 'pending') {
    return res.json({ status: 'pending' });
  }
  if (job.status === 'done') {
    const result = job.result;
    jobs.delete(jobId);
    return res.json({ status: 'done', ...result });
  }
  // error
  const error = job.error;
  jobs.delete(jobId);
  return res.json({ status: 'error', error });
}
