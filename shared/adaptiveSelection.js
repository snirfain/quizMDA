/**
 * Pure helpers for adaptive question ordering & selection.
 *
 * These contain NO DOM/browser/config dependencies on purpose, so the shuffle
 * and the no-repeat-until-quota-exhausted selection logic can be unit-tested
 * under Node's built-in test runner, while the data access (IndexedDB / entities)
 * stays in workflows/adaptivePracticeEngine.js.
 *
 * Hebrew: לוגיקת ערבוב ובחירת שאלות לתרגול (ללא תלות בדפדפן).
 */

/**
 * Fisher-Yates shuffle. Returns a NEW array (does not mutate the input) so the
 * order inside each priority bucket varies every session, while the caller can
 * still rely on the original array elsewhere.
 *
 * @template T
 * @param {T[]} array
 * @param {() => number} [random] - injectable RNG (defaults to Math.random) for tests.
 * @returns {T[]}
 */
export function shuffle(array, random = Math.random) {
  const result = Array.isArray(array) ? array.slice() : [];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick the next question from an already-prioritized list, honoring the
 * per-session exclusion set (the "no-repeat-until-quota-exhausted" rule).
 *
 * Because `ordered` keeps the priority grouping (unseen → reinforcement →
 * review-due → mastered), a correctly-answered question is only ever returned
 * once everything not-yet-served in scope has been served. Only then do we
 * recycle, avoiding an immediate repeat of the most recently served question.
 *
 * @param {Array<{id:*}>} ordered
 * @param {Array<*>} exclude - ids already served this session (in order served).
 * @returns {object|null}
 */
export function pickNextQuestion(ordered, exclude = []) {
  if (!Array.isArray(ordered) || ordered.length === 0) return null;

  const excludeSet = new Set(exclude);
  const preferred = ordered.find((q) => !excludeSet.has(q.id));
  if (preferred) return preferred;

  // Whole in-scope pool already served this session → recycle without
  // immediately repeating the most recently served question.
  const lastServed = exclude[exclude.length - 1];
  return ordered.find((q) => q.id !== lastServed) || ordered[0];
}

/** Question types excluded from trainee practice / exams. */
export const TRAINEE_EXCLUDED_TYPES = new Set(['open_ended']);

export function isTraineePracticeQuestion(question) {
  return Boolean(question && !TRAINEE_EXCLUDED_TYPES.has(question.question_type));
}

export function filterTraineePracticeQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.filter(isTraineePracticeQuestion);
}
