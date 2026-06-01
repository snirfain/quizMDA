/**
 * Catalog & tag questions against the emergency-medicine book.
 * Hebrew: קטלוג ותיוג שאלות לפי הספר
 *
 * For each question that hasn't been catalogued against the book yet:
 *   1. Retrieve the most relevant book passages (server-side keyword retrieval).
 *   2. Ask the LLM to pick the best chapter (category) + sub-topic (sub_category)
 *      from the FIXED taxonomy, grounded in those passages.
 *   3. Persist category + sub_category and stamp `book_classified_at`.
 *
 * Questions whose content isn't found in the book are left unchanged (and NOT
 * stamped), so they get re-evaluated after more book content is added.
 */
import { callLlmWithFallback } from './llmClient';
import { classifyAgainstBook } from './bookContent';
import {
  QUESTION_CATEGORIES,
  getSubcategoriesForCategory,
  isValidCategory,
} from '../shared/questionBankMetadata.js';

const CATEGORY_VALUES = QUESTION_CATEGORIES.map((c) => c.value);

const SYSTEM_PROMPT =
  'אתה מקטלג שאלות של רפואת חירום טרום-אשפוזית לפי ספר הלימוד. ' +
  'עליך לבחור את הפרק (category) המתאים ביותר מתוך רשימה סגורה, ' +
  'ותת-נושא (sub_category) מתאים. בסס את הבחירה אך ורק על קטעי הספר שסופקו ועל תוכן השאלה. ' +
  'אם תוכן השאלה אינו מופיע בקטעים שסופקו, סמן found_in_book=false. ' +
  'החזר JSON תקין בלבד ללא markdown.';

function buildUserPrompt(question, candidates) {
  const optionLabels = Array.isArray(question.options)
    ? question.options.map((o) => (typeof o === 'string' ? o : o?.label || o?.value || '')).filter(Boolean)
    : [];

  // Candidate chapters (from retrieval) and their known sub-topics, plus snippets.
  const candCategories = [...new Set(candidates.map((c) => c.category).filter(Boolean))];
  const subsByCat = candCategories
    .map((cat) => `- ${cat}: ${getSubcategoriesForCategory(cat).join(' | ')}`)
    .join('\n');
  const snippets = candidates
    .map((c, i) => `קטע ${i + 1} [פרק: ${c.category}${c.sub_topic ? ` / ${c.sub_topic}` : ''}]:\n${c.snippet}`)
    .join('\n\n');

  return (
`רשימת הפרקים האפשריים (category) — בחר ערך אחד בדיוק מתוך הרשימה:
${CATEGORY_VALUES.map((c) => `- ${c}`).join('\n')}

תתי-נושאים מומלצים לפרקים הרלוונטיים (בחר sub_category מתוכם אם מתאים, אחרת נסח תת-נושא קצר ומדויק בעברית):
${subsByCat || '(אין)'}

קטעים מהספר שאוחזרו לפי תוכן השאלה:
${snippets || '(לא נמצאו קטעים)'}

שאלה לקטלוג:
${question.question_text}
${optionLabels.length ? `אפשרויות: ${optionLabels.join(' | ')}` : ''}

החזר JSON בפורמט הבא בלבד:
{"category":"<מתוך הרשימה>","sub_category":"<תת-נושא>","found_in_book":true,"confidence":0.0}`
  );
}

function parseJsonLoose(content) {
  const stripped = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  };
  let out = tryParse(stripped);
  if (out) return out;
  const m = stripped.match(/\{[\s\S]*\}/);
  if (m) out = tryParse(m[0]);
  return out || null;
}

async function runWithConcurrency(items, concurrency, worker, onEach) {
  const results = new Array(items.length);
  let idx = 0;
  let done = 0;
  async function run() {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { error: err };
      }
      done += 1;
      onEach?.(done, items.length);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, run);
  await Promise.all(workers);
  return results;
}

/**
 * @param {Object} entitiesApi - app entities (must expose Question_Bank)
 * @param {Object} [opts]
 * @param {boolean} [opts.force] - re-catalog questions even if already book-classified
 * @param {(p:{current:number,total:number,updated:number})=>void} [opts.onProgress]
 * @param {Function} [opts.onProviderEvent]
 * @returns {Promise<{updated:number, skipped:number, errors:number, notFound:number, totalProcessed:number, message?:string}>}
 */
export async function catalogQuestionsAgainstBook(entitiesApi, opts = {}) {
  const { force = false, onProgress, onProviderEvent } = opts;
  const Question_Bank = entitiesApi?.Question_Bank;
  if (!Question_Bank) throw new Error('חסר Question_Bank');

  const all = await Question_Bank.find({});
  const targets = force ? all : all.filter((q) => !q.book_classified_at);
  if (!targets.length) {
    return { updated: 0, skipped: all.length, errors: 0, notFound: 0, totalProcessed: 0, message: 'אין שאלות לקטלוג' };
  }

  let updated = 0;
  let errors = 0;
  let notFound = 0;

  await runWithConcurrency(
    targets,
    4,
    async (q) => {
      const retrieval = await classifyAgainstBook(q.question_text, 6);
      const candidates = Array.isArray(retrieval?.top_chunks) ? retrieval.top_chunks : [];
      if (!candidates.length) {
        notFound += 1;
        return;
      }

      const llm = await callLlmWithFallback(
        {
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: buildUserPrompt(q, candidates),
          temperature: 0.1,
          maxTokens: 400,
        },
        onProviderEvent
      );
      const parsed = parseJsonLoose(llm.content);
      if (!parsed) {
        errors += 1;
        return;
      }
      if (parsed.found_in_book === false) {
        notFound += 1;
        return;
      }

      const category = isValidCategory(parsed.category)
        ? String(parsed.category).trim()
        : candidates[0].category;
      if (!isValidCategory(category)) {
        errors += 1;
        return;
      }
      const knownSubs = getSubcategoriesForCategory(category);
      let subCategory = String(parsed.sub_category || '').trim();
      if (!subCategory) subCategory = candidates[0].sub_topic || knownSubs[0] || 'תת־נושא כללי';

      await Question_Bank.update(q.id, {
        category,
        sub_category: subCategory,
        book_classified_at: new Date().toISOString(),
      });
      updated += 1;
    },
    (current) => onProgress?.({ current, total: targets.length, updated })
  );

  return {
    updated,
    skipped: all.length - targets.length,
    errors,
    notFound,
    totalProcessed: targets.length,
  };
}
