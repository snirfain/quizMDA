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
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Strip markdown fences
  const clean = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Try extracting first JSON object/array
    const m = clean.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (m) {
      try { return JSON.parse(m[1]); } catch { /* fall through */ }
    }
    throw new Error(`לא ניתן לפענח תשובת AI: ${clean.slice(0, 120)}`);
  }
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

    // Build the MC sibling
    const mcQuestion = {
      ...question,
      question_type: 'single_choice',
      options: result.options,
      correct_answer: JSON.stringify(result.correct_answer),
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

    if (!result.correct_answer) {
      throw new Error(`ה-AI לא הצליח לזהות תשובה נכונה לשאלה: "${question.question_text?.slice(0, 60)}..."`);
    }

    const updatedQuestion = {
      ...question,
      correct_answer: JSON.stringify(result.correct_answer),
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
