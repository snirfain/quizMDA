/**
 * Chapter → Questions generator
 * Hebrew: מחולל שאלות מתוך פרק ספר
 *
 * Takes a chapter of free text plus a per-spec request (how many questions of
 * each difficulty / thinking-level / type) and asks OpenAI to produce relevant
 * questions grounded ONLY in the supplied chapter text.
 *
 * Generation runs one LLM call per spec row so each call focuses on a single
 * (type, training_level, thinking_level) combination and an exact count — this
 * dramatically improves adherence to the requested distribution.
 *
 * The intermediate objects returned by `generateQuestionsFromChapter` are
 * UI-friendly. Use `toCanonicalQuestionPayload` to convert a reviewed item into
 * the exact shape the Question Editor saves (so rendering + grading match the
 * rest of the system).
 */

import { callLlmWithFallback } from './llmClient';
import {
  THINKING_LEVELS,
  TRAINING_LEVELS,
  QUESTION_TYPES_UI,
} from '../shared/questionBankMetadata';

// ── Label / guidance lookups ──────────────────────────────────

const THINKING_LABEL = Object.fromEntries(THINKING_LEVELS.map((t) => [t.value, t.label]));
const TRAINING_LABEL = Object.fromEntries(TRAINING_LEVELS.map((t) => [t.value, t.label]));
const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES_UI.map((t) => [t.value, t.label]));

const THINKING_GUIDANCE = {
  Knowledge: 'שליפת עובדות וזכירה ישירה של מידע מהפרק.',
  Understanding: 'הסבר, פרשנות והשוואה של מושגים מהפרק במילים שונות.',
  Application: 'יישום הידע בתרחיש קליני / שטח מציאותי.',
  Synthesis: 'שילוב כמה פיסות מידע וקבלת החלטה מורכבת או הסקת מסקנה.',
};

// Question types this generator supports (rolling_case has its own generator).
export const GENERATOR_QUESTION_TYPES = QUESTION_TYPES_UI.filter((t) =>
  ['single_choice', 'multi_choice', 'true_false', 'open_ended'].includes(t.value)
);

// Max questions requested per LLM call. Large counts are split into several
// calls ("chunks") and aggregated so we can reliably reach any requested total.
const BATCH_SIZE = 12;

// Hard ceiling per spec row to keep cost/latency sane.
export const MAX_PER_ROW = 100;

// ── Robust JSON parsing (mirrors questionImport's salvage logic) ──

function parseQuestionsJson(content) {
  const stripped = (content || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const tryParse = (s) => {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.questions)) return parsed.questions;
    } catch (_) {}
    return null;
  };

  let out = tryParse(stripped);
  if (out) return out;

  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) return [];
  const raw = match[0];

  out = tryParse(raw);
  if (out) return out;

  // Progressive scan — salvage completed objects before a truncation point.
  let depth = 0, inStr = false, esc = false, lastGood = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (inStr) { if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') { depth--; if (depth === 0) lastGood = i + 1; }
  }
  if (lastGood > 1) {
    out = tryParse(raw.slice(0, lastGood));
    if (out) return out;
  }
  return [];
}

// ── Prompt building ───────────────────────────────────────────

const SYSTEM_PROMPT =
  `אתה מומחה לכתיבת שאלות הערכה רפואיות בעברית עבור פאראמדיקים וחובשים של מד"א. ` +
  `אתה כותב שאלות איכותיות, מדויקות וברורות, המבוססות אך ורק על תוכן הפרק שסופק. ` +
  `אסור להמציא עובדות שאינן מופיעות בפרק. החזר JSON תקין בלבד, ללא טקסט נוסף וללא markdown.`;

function buildUserPrompt({ chapterText, spec, category, subCategory, count, avoidList }) {
  const typeLabel = TYPE_LABEL[spec.question_type] || spec.question_type;
  const thinkingLabel = THINKING_LABEL[spec.thinking_level] || spec.thinking_level;
  const trainingLabel = TRAINING_LABEL[spec.training_level] || spec.training_level;
  const guidance = THINKING_GUIDANCE[spec.thinking_level] || '';
  const n = count ?? spec.count;

  const avoidBlock =
    avoidList && avoidList.length
      ? `\nכבר נוצרו השאלות הבאות — אל תחזור עליהן וצור שאלות חדשות ושונות לחלוטין:\n${avoidList
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n')}\n`
      : '';

  const typeRules = {
    single_choice:
      '- צור בדיוק 4 אפשרויות תשובה. correct_indices חייב להכיל אינדקס אחד בלבד. ' +
      'המסיחים (האפשרויות השגויות) צריכים להיות סבירים ולא טריוויאליים.',
    multi_choice:
      '- צור 4–5 אפשרויות תשובה. correct_indices חייב להכיל 2 אינדקסים או יותר. ' +
      'ודא שיש לפחות אפשרות שגויה אחת.',
    true_false:
      '- options חייב להיות בדיוק ["נכון","לא נכון"]. correct_indices = [0] אם ההיגד נכון, ' +
      'או [1] אם ההיגד שגוי. נסח את question_text כהיגד חד-משמעי שניתן לקבוע אם הוא נכון או שגוי.',
    open_ended:
      '- options = [] ו-correct_indices = []. הוסף שדה "model_answer" עם תשובת מופת קצרה ומדויקת.',
  };

  return (
`צור בדיוק ${n} שאלות מסוג "${typeLabel}".
רמת הכשרה: ${trainingLabel}.
רמת חשיבה (טקסונומיית בלום): ${thinkingLabel} — ${guidance}
נושא: ${category}${subCategory ? ` / ${subCategory}` : ''}.

הסתמך אך ורק על תוכן הפרק הבא (אל תמציא מידע שאינו מופיע בו):
<<<תוכן הפרק
${chapterText}
תוכן הפרק>>>
${avoidBlock}
פורמט פלט — JSON בלבד:
{"questions":[{"question_text":"...","options":["...","..."],"correct_indices":[0],"explanation":"...","model_answer":""}]}

חוקים לפי סוג השאלה:
${typeRules[spec.question_type] || ''}

דרישות כלליות:
- correct_indices הם אינדקסים מבוססי-אפס המתייחסים למערך options.
- אל תכלול מספור בתחילת question_text.
- explanation: הסבר רפואי קצר ומדויק לכל שאלה, מבוסס על הפרק.
- כתוב בעברית תקנית וברורה.
- כל השאלות חייבות להיות ייחודיות וללא חזרות.
- החזר בדיוק ${n} שאלות במערך questions.`
  );
}

// ── Dedup helper (normalises text for comparison) ─────────────

function normaliseText(t) {
  return (t || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 120)
    .toLowerCase();
}

// ── Map a raw LLM question into a UI-friendly intermediate ─────

let _genId = 0;
function nextId() {
  _genId += 1;
  return `gen_${Date.now()}_${_genId}`;
}

function normalizeGenerated(raw, spec) {
  const questionText = String(raw?.question_text || '').replace(/^\d{1,3}\s*[.):\-]\s*/, '').trim();
  if (!questionText) return null;

  const explanation = String(raw?.explanation || '').trim();

  if (spec.question_type === 'open_ended') {
    return {
      id: nextId(),
      include: true,
      question_type: 'open_ended',
      training_level: spec.training_level,
      thinking_level: spec.thinking_level,
      question_text: questionText,
      options: [],
      model_answer: String(raw?.model_answer || '').trim(),
      explanation,
    };
  }

  let labels = Array.isArray(raw?.options) ? raw.options.map((o) => String(o ?? '').trim()) : [];
  if (spec.question_type === 'true_false') {
    labels = ['נכון', 'לא נכון'];
  }
  labels = labels.filter((l) => l.length > 0);
  if (labels.length < 2) return null;

  let correctIdx = Array.isArray(raw?.correct_indices)
    ? raw.correct_indices.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n < labels.length)
    : [];
  // Deduplicate
  correctIdx = [...new Set(correctIdx)];

  if (spec.question_type === 'multi_choice') {
    if (correctIdx.length < 2) {
      // Salvage: ensure at least the first marked (or index 0) is correct.
      if (correctIdx.length === 0) correctIdx = [0];
    }
  } else {
    // single_choice / true_false — exactly one
    correctIdx = correctIdx.length ? [correctIdx[0]] : [0];
  }

  const correctSet = new Set(correctIdx);
  const options = labels.map((label, idx) => ({ label, isCorrect: correctSet.has(idx) }));

  return {
    id: nextId(),
    include: true,
    question_type: spec.question_type,
    training_level: spec.training_level,
    thinking_level: spec.thinking_level,
    question_text: questionText,
    options,
    explanation,
  };
}

// ── Public: generate ──────────────────────────────────────────

/**
 * Generate questions from a chapter for each requested spec row.
 *
 * @param {Object} args
 * @param {string} args.chapterText
 * @param {Array<{count:number, training_level:string, thinking_level:string, question_type:string}>} args.specs
 * @param {string} args.category
 * @param {string} [args.subCategory]
 * @param {(p:{stage:string, current:number, total:number, spec?:object, produced?:number})=>void} [args.onProgress]
 * @param {Function} [args.onProviderEvent]
 * @returns {Promise<{ questions: Array, warnings: string[] }>}
 */
export async function generateQuestionsFromChapter({
  chapterText,
  specs,
  category,
  subCategory,
  onProgress,
  onProviderEvent,
}) {
  const text = String(chapterText || '').trim();
  if (text.length < 40) {
    throw new Error('תוכן הפרק קצר מדי — הדביקו טקסט מהותי כדי לייצר שאלות.');
  }
  const cleanSpecs = (specs || []).filter((s) => s && s.count > 0);
  if (!cleanSpecs.length) {
    throw new Error('הגדירו לפחות שורת בקשה אחת (כמות + סוג + רמות).');
  }

  const allQuestions = [];
  const warnings = [];

  for (let i = 0; i < cleanSpecs.length; i++) {
    const spec = cleanSpecs[i];
    const typeLabel = TYPE_LABEL[spec.question_type] || spec.question_type;
    const target = spec.count;

    onProgress?.({ stage: 'spec', current: i + 1, total: cleanSpecs.length, spec, collected: 0, target });

    const collected = [];
    const seen = new Set();
    // Allow generous top-up attempts beyond the minimum number of batches so we
    // can recover from duplicates / short responses and still hit the target.
    const minBatches = Math.ceil(target / BATCH_SIZE);
    const maxAttempts = minBatches * 3 + 6;
    let attempts = 0;
    let emptyRounds = 0; // consecutive rounds that added nothing new

    while (collected.length < target && attempts < maxAttempts) {
      attempts += 1;
      const need = Math.min(BATCH_SIZE, target - collected.length);
      // Send the most recent already-created stems so the model keeps
      // producing genuinely new questions instead of repeating itself.
      const avoidList = collected.slice(-60).map((q) => q.question_text);
      // Escalate temperature on dry rounds to push the model off repetition.
      const temperature = Math.min(0.9, 0.5 + emptyRounds * 0.2);

      const userPrompt = buildUserPrompt({
        chapterText: text,
        spec,
        category,
        subCategory,
        count: need,
        avoidList,
      });

      let content;
      try {
        const res = await callLlmWithFallback(
          { systemPrompt: SYSTEM_PROMPT, userPrompt, temperature, maxTokens: 9000 },
          onProviderEvent
        );
        content = res.content;
      } catch (err) {
        warnings.push(`שורה ${i + 1} (${typeLabel}): ${err.message}`);
        break;
      }

      const parsed = parseQuestionsJson(content)
        .map((q) => normalizeGenerated(q, spec))
        .filter(Boolean);

      let added = 0;
      for (const q of parsed) {
        if (collected.length >= target) break;
        const key = normaliseText(q.question_text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        collected.push(q);
        added += 1;
      }

      onProgress?.({
        stage: 'batch',
        current: i + 1,
        total: cleanSpecs.length,
        spec,
        collected: collected.length,
        target,
      });

      // A single unproductive round (parse hiccup or all-duplicates) may be
      // transient — only give up after several consecutive dry rounds.
      if (added === 0) {
        emptyRounds += 1;
        if (emptyRounds >= 3) break;
      } else {
        emptyRounds = 0;
      }
    }

    if (collected.length < target) {
      warnings.push(
        `שורה ${i + 1} (${typeLabel}): נוצרו ${collected.length} מתוך ${target} — ` +
          `כנראה שאין בפרק מספיק תוכן ייחודי ל-${target} שאלות שונות מסוג זה. ` +
          `נסו פרק ארוך/עשיר יותר, פצלו לרמות חשיבה/סוגים נוספים, או בקשו פחות.`
      );
    }
    allQuestions.push(...collected.slice(0, target));
    onProgress?.({
      stage: 'spec-done',
      current: i + 1,
      total: cleanSpecs.length,
      spec,
      produced: Math.min(collected.length, target),
      target,
    });
  }

  if (!allQuestions.length) {
    throw new Error(
      'לא הופקו שאלות. בדקו שמפתח OpenAI מוגדר ושתוכן הפרק רלוונטי.' +
        (warnings.length ? ` (${warnings.join(' | ')})` : '')
    );
  }

  return { questions: allQuestions, warnings };
}

// ── Public: convert reviewed item → canonical save payload ─────

/**
 * Build the exact payload shape the Question Editor saves, so generated
 * questions render and grade identically to hand-authored ones.
 *
 * @param {Object} genQ - intermediate object from generateQuestionsFromChapter
 * @param {Object} meta - { category, subCategory, status, medicalLevels }
 */
export function toCanonicalQuestionPayload(genQ, meta = {}) {
  const {
    category = '',
    subCategory = '',
    status = 'under_review',
    medicalLevels = [],
  } = meta;

  const common = {
    question_text: genQ.question_text,
    question_type: genQ.question_type,
    category,
    sub_category: subCategory,
    thinking_level: genQ.thinking_level,
    training_level: genQ.training_level,
    medical_levels: Array.isArray(medicalLevels) ? medicalLevels : [],
    explanation: genQ.explanation || '',
    hint: '',
    status,
    media_attachment: null,
    media_bank_tag: null,
    case_name: '',
    rolling_case: null,
  };

  if (genQ.question_type === 'open_ended') {
    return {
      ...common,
      options: undefined,
      correct_answer: genQ.model_answer || '',
    };
  }

  const preparedOptions = genQ.options.map((o) => ({ text: o.label, isCorrect: !!o.isCorrect }));
  const optionsForCorrect = genQ.options.map((o, idx) => ({ value: String(idx), label: o.label }));

  if (genQ.question_type === 'multi_choice') {
    const values = genQ.options.map((o, idx) => (o.isCorrect ? String(idx) : null)).filter((v) => v !== null);
    return {
      ...common,
      options: JSON.stringify(preparedOptions),
      correct_answer: JSON.stringify({ values, options: optionsForCorrect }),
    };
  }

  // single_choice / true_false
  const correctIdx = genQ.options.findIndex((o) => o.isCorrect);
  return {
    ...common,
    options: JSON.stringify(preparedOptions),
    correct_answer: JSON.stringify({ value: String(correctIdx < 0 ? 0 : correctIdx), options: optionsForCorrect }),
  };
}
