/**
 * Transcript API – upload SRT, list transcripts, generate questions from transcript
 * Hebrew: API תמלילים
 */

import multer from 'multer';
import mongoose from 'mongoose';
import Transcript from '../models/Transcript.js';
import { TRANSCRIPT_QUESTION_SYSTEM_PROMPT, buildTranscriptQuestionUserPrompt } from './transcriptQuestionPrompt.js';

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

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

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
    const Question = (await import('../models/Question.js')).default;
    const tagCounts = await Question.aggregate([{ $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }]);
    const countByTag = Object.fromEntries((tagCounts || []).map((t) => [t._id, t.count]));
    const withCounts = list.map((t) => ({
      _id: t._id,
      name: t.name,
      originalFilename: t.originalFilename,
      createdAt: t.createdAt,
      questionCount: countByTag[t.name] || 0,
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

/**
 * Normalize text for matching: trim, collapse spaces, optional lowercase
 */
function normalizeForMatch(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ').slice(0, 2000);
}

/**
 * Find which transcript (if any) contains the question text. Returns transcript name or null.
 */
export async function matchQuestionToTranscripts(questionText, transcripts) {
  const normalized = normalizeForMatch(questionText);
  if (!normalized) return null;
  for (const t of transcripts) {
    const full = (t.fullText || '').replace(/\s+/g, ' ');
    if (full.length > 0 && full.includes(normalized)) return t.name;
  }
  return null;
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
    const transcripts = await Transcript.find({}).lean();
    const transcriptNames = new Set(transcripts.map(t => t.name));
    const questions = await Question.find({}).lean();
    let updated = 0;
    for (const q of questions) {
      const text = q.question_text || '';
      const found = await matchQuestionToTranscripts(text, transcripts);
      const newTag = found || NO_TRANSCRIPT_TAG;
      const existingTags = Array.isArray(q.tags) ? q.tags : [];
      const withoutTranscriptTags = existingTags.filter(
        t => t !== NO_TRANSCRIPT_TAG && !transcriptNames.has(t)
      );
      const newTags = [...withoutTranscriptTags, newTag];
      if (JSON.stringify([...existingTags].sort()) !== JSON.stringify([...newTags].sort())) {
        await Question.findByIdAndUpdate(q._id, { tags: newTags });
        updated++;
      }
    }
    console.log('[api/transcripts/match-all] updated', updated, 'of', questions.length);
    res.json({ updated, total: questions.length });
  } catch (err) {
    console.error('POST /api/transcripts/match-all error:', err);
    res.status(500).json({ error: err.message });
  }
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

function normalizeGeneratedQuestion(q, transcriptName) {
  const options = (Array.isArray(q.options) ? q.options : []).map((o, i) => ({
    value: String(o?.value ?? i),
    label: String(o?.label ?? o?.text ?? ''),
  }));
  const tags = Array.isArray(q.tags) ? [...q.tags] : [];
  if (transcriptName && !tags.includes(transcriptName)) tags.push(transcriptName);
  let correct_answer = q.correct_answer;
  if (typeof correct_answer === 'string') {
    try {
      correct_answer = JSON.parse(correct_answer);
    } catch (_) {
      correct_answer = { value: '0' };
    }
  }
  if (!correct_answer || typeof correct_answer !== 'object') correct_answer = { value: '0' };
  return {
    question_text: String(q.question_text ?? '').trim(),
    question_type: ['single_choice', 'multi_choice', 'true_false', 'open_ended', 'ordering'].includes(q.question_type) ? q.question_type : 'single_choice',
    options,
    correct_answer,
    explanation: q.explanation ? String(q.explanation).trim() : null,
    hierarchy_id: q.hierarchy_id ?? null,
    tags,
    status: 'draft',
  };
}

/**
 * POST /api/transcripts/generate-questions
 * Body: { transcriptId?: string, transcriptName?: string, count: number }
 * Loads transcript, existing questions tagged with it, builds prompt, calls OpenAI, returns normalized questions (with transcript tag).
 */
export async function generateQuestionsFromTranscript(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY לא מוגדר בסביבת השרת' });
    }
    const { transcriptId, transcriptName, count: requestedCount } = req.body || {};
    const count = Math.min(Math.max(1, parseInt(requestedCount, 10) || 10), 50);
    let transcript;
    if (transcriptId) {
      transcript = await Transcript.findById(transcriptId).lean();
    } else if (transcriptName) {
      transcript = await Transcript.findOne({ name: transcriptName }).lean();
    } else {
      return res.status(400).json({ error: 'נדרש transcriptId או transcriptName' });
    }
    if (!transcript || !transcript.fullText) {
      return res.status(404).json({ error: 'תמליל לא נמצא או ריק' });
    }
    const Question = (await import('../models/Question.js')).default;
    const existing = await Question.find({ tags: transcript.name }).select('question_text').lean();
    const existingTexts = existing.map(q => (q.question_text || '').trim()).filter(Boolean);
    const userPrompt = buildTranscriptQuestionUserPrompt(transcript.fullText, count, existingTexts);
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
      const err = await response.text();
      console.error('OpenAI error:', response.status, err.slice(0, 300));
      return res.status(502).json({ error: 'שגיאה מקריאת OpenAI: ' + (err.slice(0, 200) || response.statusText) });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const raw = parseQuestionsJsonFromAI(content);
    const questions = raw.map(q => normalizeGeneratedQuestion(q, transcript.name)).filter(q => q.question_text);
    console.log('[api/transcripts/generate-questions]', transcript.name, 'requested', count, 'got', questions.length);
    res.json({ questions, transcriptName: transcript.name });
  } catch (err) {
    console.error('POST /api/transcripts/generate-questions error:', err);
    res.status(500).json({ error: err.message });
  }
}
