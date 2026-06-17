/**
 * Persist question ids the user reported so they are not served again in practice.
 * Hebrew: שאלות שדווחו עליהן
 */

const STORAGE_KEY = 'quizMDA_reportedQuestionIds';

export function getReportedQuestionIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markQuestionReported(questionId) {
  if (!questionId || typeof window === 'undefined') return;
  const id = String(questionId);
  const set = getReportedQuestionIds();
  if (set.has(id)) return;
  set.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (err) {
    console.warn('[reportedQuestions] שמירה מקומית נכשלה:', err?.message || err);
  }
}
