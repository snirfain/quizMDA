/**
 * Question statistics after each answer (Activity_Log).
 * After ≥50 attempts, if success rate < 50%, status → under_review (when currently active).
 *
 * Hebrew: סטטיסטיקות שאלה
 */

import { entities } from '../config/appConfig';

export const MIN_ATTEMPTS_FOR_RATING = 50;

export const DIFFICULTY_EASY = 'קל';
export const DIFFICULTY_MEDIUM = 'בינוני';
export const DIFFICULTY_HARD = 'קשה';
export const DIFFICULTY_UNRATED = null;
export const DIFFICULTY_LEVELS = [DIFFICULTY_EASY, DIFFICULTY_MEDIUM, DIFFICULTY_HARD];

/**
 * @returns {number|null} success rate 0–100, or null if no attempts
 */
export function computeSuccessRate(totalAttempts, totalSuccess) {
  if (!totalAttempts) return null;
  return Math.round((totalSuccess / totalAttempts) * 100 * 10) / 10;
}

/**
 * Legacy: difficulty labels no longer stored on questions (UI may still import this).
 * @returns {null}
 */
export function computeDifficulty(_totalAttempts, _totalSuccess) {
  return DIFFICULTY_UNRATED;
}

/** @deprecated difficulty removed; kept for older imports */
export function shouldSuspend(totalAttempts, totalSuccess) {
  if (!totalAttempts || totalAttempts < MIN_ATTEMPTS_FOR_RATING) return false;
  const rate = (totalSuccess / totalAttempts) * 100;
  return rate < 50;
}

export function needsUnderReview(totalAttempts, totalSuccess) {
  if (!totalAttempts || totalAttempts < MIN_ATTEMPTS_FOR_RATING) return false;
  const rate = (totalSuccess / totalAttempts) * 100;
  return rate < 50;
}

/**
 * Recalculate totals from Activity_Log and update question stats (and optionally status).
 *
 * @param {string} questionId
 */
export async function recalculateDifficulty(questionId) {
  const question = await entities.Question_Bank.findOne({ id: questionId });
  if (!question) {
    return {
      questionId,
      totalAttempts: 0,
      totalSuccess: 0,
      successRate: 0,
      difficulty: null,
      suspended: false,
      underReview: false,
      previousDifficulty: null,
    };
  }

  const allAttempts = await entities.Activity_Log.find({ question_id: questionId });
  const totalAttempts = allAttempts.length;
  const totalSuccess = allAttempts.filter((l) => l.is_correct === true).length;
  const successRate = computeSuccessRate(totalAttempts, totalSuccess) ?? 0;

  const updatePayload = {
    total_attempts: totalAttempts,
    total_success: totalSuccess,
    success_rate: successRate,
  };

  const promoteReview =
    needsUnderReview(totalAttempts, totalSuccess) && question.status === 'active';

  if (promoteReview) {
    updatePayload.status = 'under_review';
    console.info(
      `[questionStats] שאלה ${questionId} → בבדיקה — ${successRate}% הצלחה מתוך ${totalAttempts} ניסיונות`
    );
  }

  await entities.Question_Bank.update(questionId, updatePayload);

  return {
    questionId,
    totalAttempts,
    totalSuccess,
    successRate,
    difficulty: null,
    suspended: promoteReview,
    underReview: promoteReview,
    previousDifficulty: null,
  };
}

/** @deprecated */
export function getDifficultyDisplay(difficulty) {
  switch (difficulty) {
    case DIFFICULTY_EASY:
      return { label: 'קל', color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' };
    case DIFFICULTY_MEDIUM:
      return { label: 'בינוני', color: '#E65100', bg: '#FFF3E0', border: '#FFCC80' };
    case DIFFICULTY_HARD:
      return { label: 'קשה', color: '#C62828', bg: '#FFEBEE', border: '#EF9A9A' };
    default:
      return { label: 'לא מדורג', color: '#757575', bg: '#F5F5F5', border: '#E0E0E0' };
  }
}

/** @deprecated */
export function getDifficultyBadgeStyle(difficulty) {
  const d = getDifficultyDisplay(difficulty);
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    color: d.color,
    background: d.bg,
    border: `1px solid ${d.border}`,
  };
}
