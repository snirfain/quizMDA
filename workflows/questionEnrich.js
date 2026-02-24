/**
 * Question Enrichment Workflow
 * Automatically enriches questions that are missing distractors or a correct answer.
 *
 * Case 1 — No distractors:
 *   → Send question text to OpenAI → receive 4 options (1 correct, 3 distractors)
 *   → Save as TWO separate entities: open_ended + multiple_choice
 *
 * Case 2 — Has distractors but correct answer unknown:
 *   → Send question + options to OpenAI → receive correct option index
 *   → Update question in-place (single entity)
 *
 * Hebrew: העשרת שאלות
 */

import { appConfig } from '../config/appConfig';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Parse a correct_answer value from whatever shape the stored data has. */
function parseCorrectAnswer(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Return true when the question has at least one answer option. */
function hasOptions(q) {
  const opts = q.options;
  return Array.isArray(opts) && opts.length > 0;
}

/**
 * Normalize correct_answer to { value: "<index>" } using existing options.
 * If the AI returned free text or wrong shape, try to match by option label/value.
 */
function normalizeCorrectAnswer(correctAnswer, options) {
  if (!correctAnswer || !Array.isArray(options) || options.length === 0) return null;
  const obj = parseCorrectAnswer(correctAnswer);
  if (!obj) return null;
  const raw = obj.value != null ? String(obj.value).trim() : (Array.isArray(obj.values) ? obj.values[0] : null);
  if (raw == null || raw === '') return null;
  const indexStr = String(raw);
  if (/^[0-9]+$/.test(indexStr)) {
    const idx = parseInt(indexStr, 10);
    if (idx >= 0 && idx < options.length) return { value: String(idx) };
    return { value: options[idx]?.value ?? indexStr };
  }
  const byValue = options.findIndex(o => (o.value != null && String(o.value) === indexStr) || (o.value == null && indexStr === ''));
  if (byValue !== -1) return { value: String(options[byValue].value ?? byValue) };
  const byLabel = options.findIndex(o => (o.label || o.text || '').includes(indexStr) || indexStr.includes((o.label || o.text || '')));
  if (byLabel !== -1) return { value: String(options[byLabel].value ?? byLabel) };
  return { value: indexStr };
}

/**
 * Return true when a correct_answer object carries a meaningful value
 * (i.e. it is not null / empty object / missing key).
 */
function hasCorrectAnswer(ca) {
  if (!ca) return false;
  const obj = parseCorrectAnswer(ca);
  if (!obj) return false;
  if (obj.value != null && String(obj.value).trim() !== '') return true;
  if (Array.isArray(obj.values) && obj.values.length > 0) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// Enrichment type detection
// ─────────────────────────────────────────────────────────────

export const ENRICH_NONE            = 'none';           // nothing to do
export const ENRICH_GENERATE        = 'generate';       // no distractors → generate + split into 2
export const ENRICH_IDENTIFY_ANSWER = 'identify_answer';// has options, no correct answer → identify

/**
 * Detect what enrichment a question needs.
 * @returns {string} one of the ENRICH_* constants
 */
export function detectEnrichmentType(question) {
  const opts     = hasOptions(question);
  const answered = hasCorrectAnswer(question.correct_answer);

  if (!opts) return ENRICH_GENERATE;           // open-ended or totally missing options
  if (!answered) return ENRICH_IDENTIFY_ANSWER; // has options but nobody marked the correct one
  return ENRICH_NONE;
}

// ─────────────────────────────────────────────────────────────
// OpenAI helper
// ─────────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt, userPrompt, apiKey) {
  const response = await fetch(appConfig.openai.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: appConfig.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Strip markdown fences
  let clean = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Fix unescaped quotes inside Hebrew text (e.g. נט"ן, אט"ן) that break JSON
    const fixedQuotes = fixHebrewQuotesInJson(clean);
    try { return JSON.parse(fixedQuotes); } catch { /* fall through */ }
    // Try extracting first JSON object (balanced braces)
    const firstObj = extractFirstJsonObject(fixedQuotes);
    if (firstObj) {
      try { return JSON.parse(firstObj); } catch { /* fall through */ }
    }
    // Try repairing truncated JSON (close open string, then missing closing brackets)
    const repaired = repairTruncatedJson(fixedQuotes);
    if (repaired) {
      try { return JSON.parse(repaired); } catch { /* fall through */ }
    }
    throw new Error(`לא ניתן לפענח תשובת AI: ${clean.slice(0, 120)}`);
  }
}

/**
 * Escape double-quotes that appear inside Hebrew abbreviations (e.g. נט"ן, אט"ן)
 * so that JSON.parse can succeed. Only affects " between Hebrew letters or before space.
 */
function fixHebrewQuotesInJson(str) {
  return str.replace(/([\u0590-\u05FF])"([\u0590-\u05FF\s])/g, '$1\\"$2');
}

/**
 * Extract the first complete JSON object from a string (handles nested braces).
 */
function extractFirstJsonObject(str) {
  const start = str.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  let quote = '';
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (!inString) {
      if (c === '"' || c === "'") { inString = true; quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
    } else if (c === quote) inString = false;
  }
  return null;
}

/**
 * Try to repair truncated JSON: close an open string (if any), then append missing closing brackets.
 */
function repairTruncatedJson(str) {
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  const stack = [];
  let inString = false;
  let escape = false;
  let quote = '';
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (!inString) {
      if (c === '"' || c === "'") { inString = true; quote = c; continue; }
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    } else if (c === quote) inString = false;
  }
  if (stack.length === 0) return null;
  let out = trimmed;
  if (inString) out += quote;
  if (out.slice(-1) === ',') out = out.slice(0, -1);
  return out + stack.reverse().join('');
}

// ─────────────────────────────────────────────────────────────
// Case 1 — Generate distractors
// ─────────────────────────────────────────────────────────────

/**
 * Ask OpenAI to produce 4 answer options (one correct + three plausible distractors)
 * for a given open-ended medical question.
 *
 * @returns {{ options: {value,label}[], correct_answer: {value}, explanation: string }}
 */
export async function generateDistractors(questionText, apiKey) {
  const systemPrompt = `אתה כותב שאלות בחינה רפואיות עבור מגן דוד אדום (מד"א).
תפקידך: לקבל שאלה פתוחה ולהפוך אותה לשאלה רב-ברירה עם 4 אפשרויות.
החזר JSON בלבד — ללא markdown, ללא הסברים.`;

  const userPrompt = `צור 4 אפשרויות תשובה לשאלה הרפואית הבאה.
אחת מהן צריכה להיות התשובה הנכונה והשלוש האחרות — מסיחים סבירים אך שגויים.

שאלה: ${questionText}

החזר בדיוק בפורמט הבא:
{
  "options": [
    {"value": "0", "label": "..."},
    {"value": "1", "label": "..."},
    {"value": "2", "label": "..."},
    {"value": "3", "label": "..."}
  ],
  "correct_answer": {"value": "N"},
  "explanation": "הסבר קצר מדוע התשובה נכונה"
}

כללים:
- "N" הוא האינדקס (0-3) של האפשרות הנכונה
- כל 4 האפשרויות יהיו בעברית, תמציתיות וענייניות
- המסיחים יהיו סבירים רפואית כדי לא להיות קלים מדי`;

  return callOpenAI(systemPrompt, userPrompt, apiKey);
}

// ─────────────────────────────────────────────────────────────
// Case 2 — Identify correct answer
// ─────────────────────────────────────────────────────────────

/**
 * Ask OpenAI to determine which of the existing options is the correct answer.
 *
 * @returns {{ correct_answer: {value}, explanation: string }}
 */
export async function identifyCorrectAnswer(questionText, options, apiKey) {
  const systemPrompt = `אתה מומחה בחינות רפואיות ל-מגן דוד אדום (מד"א).
תפקידך: לזהות את התשובה הנכונה מבין האפשרויות הנתונות.
החזר JSON בלבד — ללא markdown, ללא הסברים.`;

  const optsList = options
    .map(o => `${o.value}. ${o.label ?? o.text ?? o.value}`)
    .join('\n');

  const userPrompt = `שאלה:
${questionText}

אפשרויות:
${optsList}

זהה את התשובה הנכונה מבחינה רפואית והחזר:
{
  "correct_answer": {"value": "N"},
  "explanation": "הסבר קצר מדוע תשובה זו נכונה"
}

כאשר N הוא ה-value המדויק (כמחרוזת) של האפשרות הנכונה.`;

  return callOpenAI(systemPrompt, userPrompt, apiKey);
}

// ─────────────────────────────────────────────────────────────
// Fix question with AI (improve wording + distractors)
// ─────────────────────────────────────────────────────────────

/**
 * Send a single question to AI to fix wording and improve distractors.
 * Returns the suggested question: { question_text, options, correct_answer: { value }, explanation }.
 * @param {object} question — existing question (question_text, options or correct_answer with options)
 * @param {string} apiKey
 * @returns {Promise<{ question_text: string, options: {value,label}[], correct_answer: {value}, explanation: string }>}
 */
export async function fixQuestionWithAI(question, apiKey) {
  const systemPrompt = `אתה מומחה לכתיבת שאלות בחינה רפואיות עבור מגן דוד אדום (מד"א).
תפקידך: לתקן ולשפר שאלה קיימת — ניסוח ברור ותקני בעברית, מסיחים טובים (סבירים אך שגויים), תשובה נכונה אחת מסומנת.
החזר JSON בלבד — ללא markdown, ללא טקסט חופשי.`;

  let optsList = '';
  const parsed = parseCorrectAnswer(question.correct_answer);
  const opts = question.options || (parsed && parsed.options) || [];
  if (Array.isArray(opts) && opts.length > 0) {
    optsList = opts
      .map((o, i) => `${i}. ${(o.label ?? o.text ?? o.value ?? '').trim()}`)
      .join('\n');
  }

  const userPrompt = `שפר את השאלה הבאה ואת אפשרויות התשובה שלה.
שמור על אותה משמעות ותשובה נכונה; שפר ניסוח, דקדוק ובהירות; המסיחים יהיו סבירים רפואית אך שגויים.

שאלה נוכחית:
${question.question_text || ''}

אפשרויות נוכחיות:
${optsList || '(אין)'}

החזר בדיוק בפורמט הבא (עברית):
{
  "question_text": "טקסט השאלה המתוקן והמשפר",
  "options": [
    {"value": "0", "label": "..."},
    {"value": "1", "label": "..."},
    {"value": "2", "label": "..."},
    {"value": "3", "label": "..."}
  ],
  "correct_answer": {"value": "N"},
  "explanation": "הסבר קצר מדוע התשובה נכונה"
}

כללים: N הוא האינדקס (0,1,2,...) של התשובה הנכונה. אם יש פחות מ-4 אפשרויות — החזר את המספר שיש. כל האפשרויות בעברית.`;

  const raw = await callOpenAI(systemPrompt, userPrompt, apiKey);

  if (!raw.question_text || typeof raw.question_text !== 'string') {
    throw new Error('ה-AI לא החזיר טקסט שאלה תקין');
  }
  const options = Array.isArray(raw.options) && raw.options.length >= 2
    ? raw.options.map((o, i) => ({ value: String(o.value ?? i), label: String(o.label ?? o.text ?? o.value ?? '').trim() }))
    : [];
  const correctAnswer = normalizeCorrectAnswer(raw.correct_answer, options) || { value: '0' };
  return {
    question_text: raw.question_text.trim(),
    options,
    correct_answer: correctAnswer,
    explanation: typeof raw.explanation === 'string' ? raw.explanation.trim() : '',
  };
}

// ─────────────────────────────────────────────────────────────
// Main enrichment function
// ─────────────────────────────────────────────────────────────

/**
 * Enrich a single question.
 *
 * Returns an enrichment result object:
 * {
 *   type: ENRICH_NONE | ENRICH_GENERATE | ENRICH_IDENTIFY_ANSWER,
 *   question: <original question, possibly updated>,
 *   extraQuestion: <new MC question when type === ENRICH_GENERATE, else null>,
 *   explanation: <string>,
 * }
 */
export async function enrichQuestion(question, apiKey) {
  const type = detectEnrichmentType(question);

  if (type === ENRICH_NONE) {
    return { type, question, extraQuestion: null, explanation: null };
  }

  // ── Case 1: generate distractors ──────────────────────────
  if (type === ENRICH_GENERATE) {
    const result = await generateDistractors(question.question_text, apiKey);

    // Validate API response shape
    if (!Array.isArray(result.options) || result.options.length < 2) {
      throw new Error(`ה-AI החזיר מסיחים לא תקינים לשאלה: "${question.question_text?.slice(0, 60)}..."`);
    }

    const normalizedCa = normalizeCorrectAnswer(result.correct_answer, result.options) || result.correct_answer;
    // Build the MC sibling
    const mcQuestion = {
      ...question,
      question_type: 'single_choice',
      options: result.options,
      correct_answer: JSON.stringify(normalizedCa),
      explanation: result.explanation || question.explanation || '',
      // Mark provenance
      source_question_id: question.id || null,
      generated_by: 'enrichment_ai',
    };

    // Keep the original as open_ended (clean of options)
    const openQuestion = {
      ...question,
      question_type: 'open_ended',
      options: [],
      correct_answer: '{}',
      generated_by: 'enrichment_ai_source',
    };

    return {
      type,
      question: openQuestion,
      extraQuestion: mcQuestion,
      explanation: result.explanation || '',
    };
  }

  // ── Case 2: identify correct answer ───────────────────────
  if (type === ENRICH_IDENTIFY_ANSWER) {
    const result = await identifyCorrectAnswer(
      question.question_text,
      question.options,
      apiKey
    );

    const normalizedCa = normalizeCorrectAnswer(result.correct_answer, question.options);
    if (!normalizedCa) {
      throw new Error(`ה-AI לא הצליח לזהות תשובה נכונה לשאלה: "${question.question_text?.slice(0, 60)}..."`);
    }

    const updatedQuestion = {
      ...question,
      correct_answer: JSON.stringify(normalizedCa),
      explanation: result.explanation || question.explanation || '',
      generated_by: 'enrichment_ai',
    };

    return {
      type,
      question: updatedQuestion,
      extraQuestion: null,
      explanation: result.explanation || '',
    };
  }

  return { type: ENRICH_NONE, question, extraQuestion: null, explanation: null };
}

// ─────────────────────────────────────────────────────────────
// Batch enrichment
// ─────────────────────────────────────────────────────────────

/**
 * Enrich an array of questions.
 * Returns a flat array of questions ready to be saved (may be longer than input
 * when ENRICH_GENERATE splits a question into two).
 *
 * @param {object[]} questions
 * @param {{ onProgress?: Function, apiKey?: string }} options
 * @returns {Promise<{ questions: object[], enrichmentLog: object[] }>}
 */
export async function batchEnrichQuestions(questions, options = {}) {
  const apiKey = options.apiKey || appConfig.openai.getApiKey();
  if (!apiKey) throw new Error('מפתח OpenAI לא מוגדר. הגדר VITE_OPENAI_API_KEY בקובץ .env');

  const enriched = [];
  const log = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const enrichType = detectEnrichmentType(q);

    options.onProgress?.({
      current: i + 1,
      total: questions.length,
      enrichType,
      questionText: q.question_text?.slice(0, 50),
    });

    if (enrichType === ENRICH_NONE) {
      enriched.push(q);
      log.push({ index: i, type: ENRICH_NONE });
      continue;
    }

    try {
      const result = await enrichQuestion(q, apiKey);
      enriched.push(result.question);
      if (result.extraQuestion) enriched.push(result.extraQuestion);
      log.push({ index: i, type: result.type, explanation: result.explanation });
    } catch (err) {
      // On enrichment failure: keep original question as-is with a flag
      console.warn(`[enrichQuestion] שגיאה בשאלה ${i + 1}:`, err.message);
      enriched.push({ ...q, enrichment_error: err.message });
      log.push({ index: i, type: enrichType, error: err.message });
    }
  }

  return { questions: enriched, enrichmentLog: log };
}
