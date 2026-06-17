/**
 * Unified practice-answer scoring rules (client + server).
 * Hebrew: ניקוד תשובות בתרגול
 */

/** Maximum time (seconds) to earn points for a correct answer — 10 minutes. */
export const QUESTION_TIME_LIMIT_SECONDS = 10 * 60;

/** Points for a correct answer answered within the time limit. */
export const PRACTICE_CORRECT_POINTS = 1;

/** Points deducted for a wrong answer. */
export const PRACTICE_WRONG_POINTS = -2;

/** Bonus when a user's report is validated and the question is updated. */
export const REPORT_VALIDATED_BONUS = 5;

/**
 * Compute point delta for one practice answer.
 * @param {boolean} isCorrect
 * @param {number} timeSpentSeconds
 * @returns {number} delta (0 = no change)
 */
export function computePracticeAnswerPoints(isCorrect, timeSpentSeconds = 0) {
  const elapsed = Math.max(0, Number(timeSpentSeconds) || 0);

  if (!isCorrect) {
    return PRACTICE_WRONG_POINTS;
  }

  if (elapsed > QUESTION_TIME_LIMIT_SECONDS) {
    return 0;
  }

  return PRACTICE_CORRECT_POINTS;
}

export function formatQuestionTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
