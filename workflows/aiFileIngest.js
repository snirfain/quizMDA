/**
 * AI File Ingestion
 * Hebrew: קליטת קובץ שאלות באמצעות בינה מלאכותית
 *
 * Ingests question files where each row is a question + a single "answers" cell
 * containing options separated by " || " and the correct one(s) tagged
 * "(Correct)". Example:
 *   question_text | answers
 *   "מהו ...?"    | "תשובה א (Correct) || תשובה ב || תשובה ג"
 *
 * Pipeline (everything we built for the chapter generator, applied to ingest):
 *   1. Parse the file structurally (xlsx OR csv — even if mislabeled).
 *   2. Derive each question's type/options/correct answer deterministically.
 *   3. AI pass (batched): fix spelling / merged words, classify
 *      category + sub_category + thinking_level, and add an explanation —
 *      WITHOUT changing meaning or which option is correct.
 *   4. Shuffle option order so the correct answer's position is random.
 *
 * Training level + medical levels + status are applied from the UI (they are
 * program metadata, not inferable from a single question), and can be set per
 * ingestion.
 */

import * as XLSX from 'xlsx';
import { callLlmWithFallback } from './llmClient';
import {
  QUESTION_CATEGORIES,
  THINKING_LEVEL_VALUES,
  THINKING_LEVELS,
  getSubcategoriesForCategory,
  isValidCategory,
} from '../shared/questionBankMetadata.js';

const CORRECT_RE = /\(\s*correct\s*\)/i;     // "(Correct)" marker
const SEP_RE = /\s*\|\|\s*/;                  // " || " option separator
const CATEGORY_VALUES = QUESTION_CATEGORIES.map((c) => c.value);
const FIRST_CATEGORY = CATEGORY_VALUES[0] || '';
const THINKING_LABEL = Object.fromEntries(THINKING_LEVELS.map((t) => [t.value, t.label]));

// ── File parsing ──────────────────────────────────────────────

/**
 * Read an uploaded file into rows. Handles real .xlsx/.xls and .csv, and also
 * .csv files that are actually xlsx (sniffed via the ZIP "PK" magic bytes).
 * @returns {Promise<{ records: Array<{question_text:string, answers:string}>, sheetName:string }>}
 */
export async function parseIngestFile(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf.slice(0, 4));
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK" → xlsx
  const name = (file.name || '').toLowerCase();

  let wb;
  if (isZip || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    wb = XLSX.read(buf, { type: 'array' });
  } else {
    const text = new TextDecoder('utf-8').decode(buf);
    wb = XLSX.read(text, { type: 'string' }); // robust CSV parsing (quotes, etc.)
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  if (!grid.length) return { records: [], sheetName };

  // Locate columns by header name; fall back to first two columns.
  const header = grid[0].map((h) => String(h || '').trim().toLowerCase());
  let qIdx = header.findIndex((h) => h === 'question_text' || h === 'question' || h === 'שאלה');
  let aIdx = header.findIndex((h) => h === 'answers' || h === 'answer' || h === 'תשובות');
  let startRow = 1;
  if (qIdx === -1 || aIdx === -1) {
    qIdx = 0;
    aIdx = 1;
    // If the first row doesn't look like a header, include it as data.
    const looksLikeHeader = /question|answer|שאל|תשוב/i.test(header.join(' '));
    if (!looksLikeHeader) startRow = 0;
  }

  const records = [];
  for (let i = startRow; i < grid.length; i++) {
    const row = grid[i] || [];
    const question_text = String(row[qIdx] ?? '').trim();
    const answers = String(row[aIdx] ?? '').trim();
    if (!question_text || !answers) continue;
    records.push({ question_text, answers });
  }
  return { records, sheetName };
}

// ── Deterministic structural parse ────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Source cells often contain HTML entities (&quot; &amp; …) and CR/LF artifacts.
const HTML_ENTITIES = {
  '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

function cleanText(s) {
  return String(s ?? '')
    .replace(/&quot;|&amp;|&lt;|&gt;|&#39;|&apos;|&nbsp;/g, (m) => HTML_ENTITIES[m] || m)
    .replace(/\r\n?|\n/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Turn raw {question_text, answers} records into typed questions with options
 * and the correct answer identified — no AI involved yet.
 * @returns {{ questions: Array, skipped: number }}
 */
export function buildRawQuestions(records) {
  const questions = [];
  let skipped = 0;

  for (const rec of records) {
    const parts = rec.answers.split(SEP_RE).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) { skipped += 1; continue; }

    const labels = [];
    const correctIndices = [];
    parts.forEach((part) => {
      const isCorrect = CORRECT_RE.test(part);
      const label = cleanText(part.replace(CORRECT_RE, ''));
      if (!label) return;
      const idx = labels.length;
      labels.push(label);
      if (isCorrect) correctIndices.push(idx);
    });

    if (labels.length < 2 || correctIndices.length === 0) { skipped += 1; continue; }

    questions.push({
      question_text: cleanText(rec.question_text),
      labels,                 // plain strings, original order
      correctIndices,         // indices into labels
      question_type: correctIndices.length > 1 ? 'multi_choice' : 'single_choice',
    });
  }

  return { questions, skipped };
}

// ── AI tagging + correction ───────────────────────────────────

const TAG_SYSTEM_PROMPT =
  `אתה עורך תוכן רפואי בעברית עבור מד"א. עבור כל שאלה שתקבל:\n` +
  `1. תקן שגיאות כתיב, מילים מודבקות, רווחים ופיסוק ב-question_text וב-options — בלי לשנות את המשמעות הרפואית ובלי לשנות איזו אפשרות נכונה.\n` +
  `2. שמור בדיוק על אותו מספר אפשרויות ועל אותו סדר אפשרויות (רק תיקון טקסט, ללא הוספה/הסרה/שינוי סדר).\n` +
  `3. סווג את הנושא (category) — בחר ערך אחד בדיוק מתוך הרשימה שתסופק.\n` +
  `4. קבע תת-נושא (sub_category) קצר ורלוונטי בעברית.\n` +
  `5. קבע רמת חשיבה (thinking_level) מתוך הערכים שיסופקו.\n` +
  `6. הוסף explanation — הסבר רפואי קצר ומדויק לתשובה הנכונה.\n` +
  `החזר JSON תקין בלבד, ללא markdown.`;

function buildTagUserPrompt(batch) {
  const items = batch.map((q, i) => ({
    idx: i,
    is_multi: q.question_type === 'multi_choice',
    question_text: q.question_text,
    options: q.labels,
  }));

  return (
`רשימת נושאים אפשריים (category) — בחר ערך אחד בדיוק מתוך הרשימה:
${CATEGORY_VALUES.map((c) => `- ${c}`).join('\n')}

ערכי רמת חשיבה אפשריים (thinking_level): ${THINKING_LEVEL_VALUES.join(', ')}.

עבד על השאלות הבאות (מערך JSON). שמור על אותו idx ועל אותו מספר/סדר אפשרויות:
${JSON.stringify(items, null, 0)}

החזר JSON בפורמט הבא בלבד:
{"questions":[{"idx":0,"question_text":"...","options":["...","..."],"category":"<מתוך הרשימה>","sub_category":"...","thinking_level":"<אחד מהערכים>","explanation":"..."}]}`
  );
}

function parseJsonLoose(content) {
  const stripped = (content || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const tryParse = (s) => {
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p;
      if (Array.isArray(p?.questions)) return p.questions;
    } catch (_) {}
    return null;
  };
  let out = tryParse(stripped);
  if (out) return out;
  const m = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (m) {
    out = tryParse(m[0]);
    if (out) return out;
  }
  return [];
}

let _genId = 0;
function nextId() {
  _genId += 1;
  return `ing_${Date.now()}_${_genId}`;
}

/**
 * Build the intermediate question shape (same as the chapter generator's, so it
 * can be saved via toCanonicalQuestionPayload) from a raw question + AI tags.
 * Options are stored as [{label, isCorrect}] and shuffled for random position.
 */
function assembleQuestion(raw, ai, defaults) {
  // Use AI-corrected labels only when count matches (preserves correctness map).
  let labels = raw.labels;
  if (ai && Array.isArray(ai.options) && ai.options.length === raw.labels.length) {
    labels = ai.options.map((o, i) => String(o ?? raw.labels[i]).trim() || raw.labels[i]);
  }
  const questionText = (ai && String(ai.question_text || '').trim()) || raw.question_text;

  const category = ai && isValidCategory(ai.category) ? ai.category : (defaults.category || FIRST_CATEGORY);
  const knownSubs = getSubcategoriesForCategory(category);
  let subCategory = (ai && String(ai.sub_category || '').trim()) || '';
  if (!subCategory) subCategory = knownSubs[0] || 'תת־נושא כללי';
  const thinkingLevel =
    ai && THINKING_LEVEL_VALUES.includes(ai.thinking_level) ? ai.thinking_level : 'Knowledge';

  // Attach correctness to corrected labels (same positions), then shuffle so the
  // correct answer's position is random (source data often lists it first).
  const correctSet = new Set(raw.correctIndices);
  let options = labels.map((label, idx) => ({ label, isCorrect: correctSet.has(idx) }));
  options = shuffle(options);

  return {
    id: nextId(),
    include: true,
    question_type: raw.question_type,
    question_text: questionText,
    options,
    thinking_level: thinkingLevel,
    training_level: defaults.training_level || 'A',
    category,
    sub_category: subCategory,
    explanation: (ai && String(ai.explanation || '').trim()) || '',
    _aiTagged: true,
  };
}

/** Simple concurrency runner that preserves order. */
async function runWithConcurrency(tasks, concurrency, onEach) {
  const results = new Array(tasks.length);
  let idx = 0;
  let done = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        results[i] = { error: err };
      }
      done += 1;
      onEach?.(done, tasks.length);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

const TAG_BATCH_SIZE = 20;

/**
 * AI-correct and tag raw questions. Returns import-format questions.
 *
 * @param {Array} rawQuestions - output of buildRawQuestions().questions
 * @param {Object} opts
 * @param {Object} opts.defaults - { training_level, medical_levels, status, category }
 * @param {(done:number,total:number)=>void} [opts.onProgress] - batch progress
 * @param {Function} [opts.onProviderEvent]
 * @returns {Promise<{ questions: Array, warnings: string[] }>}
 */
export async function tagAndCorrectQuestions(rawQuestions, opts = {}) {
  const { defaults = {}, onProgress, onProviderEvent } = opts;
  if (!rawQuestions.length) return { questions: [], warnings: [] };

  const batches = [];
  for (let i = 0; i < rawQuestions.length; i += TAG_BATCH_SIZE) {
    batches.push(rawQuestions.slice(i, i + TAG_BATCH_SIZE));
  }

  const warnings = [];
  const tasks = batches.map((batch) => async () => {
    try {
      const res = await callLlmWithFallback(
        {
          systemPrompt: TAG_SYSTEM_PROMPT,
          userPrompt: buildTagUserPrompt(batch),
          temperature: 0.1,
          maxTokens: 12000,
        },
        onProviderEvent
      );
      const parsed = parseJsonLoose(res.content);
      const byIdx = new Map();
      for (const item of parsed) {
        if (item && Number.isInteger(item.idx)) byIdx.set(item.idx, item);
      }
      return batch.map((raw, i) => assembleQuestion(raw, byIdx.get(i), defaults));
    } catch (err) {
      // On AI failure for a batch, fall back to structural-only questions so
      // ingestion never loses content (still shuffled, with default tags).
      warnings.push(err.message || String(err));
      return batch.map((raw) => assembleQuestion(raw, null, defaults));
    }
  });

  const results = await runWithConcurrency(tasks, 4, (done, total) => onProgress?.(done, total));
  const questions = results.flat().filter(Boolean);
  return { questions, warnings };
}

export { THINKING_LABEL };
