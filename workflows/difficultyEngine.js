/**
 * Difficulty Engine
 * Automatic difficulty classification based on success rate statistics.
 *
 * Scale:
 *   קל      — 95–100 % correct
 *   בינוני  —  80–94 % correct
 *   קשה     —  70–79 % correct
 *   < 70%   — question suspended, pending admin review
 *
 * Rating is only assigned after MIN_ATTEMPTS answers.
 * Before that threshold the question is considered "unrated".
 *
 * Hebrew: מנוע דרגות קושי
 */

import { entities } from '../config/appConfig';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Minimum number of answers required before assigning a difficulty rating. */
export const MIN_ATTEMPTS_FOR_RATING = 50;

/** Difficulty labels used throughout the system. */
export const DIFFICULTY_EASY   = 'קל';
export const DIFFICULTY_MEDIUM = 'בינוני';
export const DIFFICULTY_HARD   = 'קשה';
export const DIFFICULTY_UNRATED = null;   // not enough data yet

/** All rated difficulty values as an ordered array (easy → hard). */
export const DIFFICULTY_LEVELS = [DIFFICULTY_EASY, DIFFICULTY_MEDIUM, DIFFICULTY_HARD];

// ─────────────────────────────────────────────────────────────
// Core computation
// ─────────────────────────────────────────────────────────────

/**
 * Compute the difficulty label from raw statistics.
 *
 * @param {number} totalAttempts — total times the question was answered
 * @param {number} totalSuccess  — total correct answers
 * @returns {string|null} difficulty label, or null when unrated
 */
export function computeDifficulty(totalAttempts, totalSuccess) {
  if (!totalAttempts || totalAttempts < MIN_ATTEMPTS_FOR_RATING) {
    return DIFFICULTY_UNRATED;
  }

  const rate = (totalSuccess / totalAttempts) * 100;

  if (rate >= 95) return DIFFICULTY_EASY;
  if (rate >= 80) return DIFFICULTY_MEDIUM;
  if (rate >= 70) return DIFFICULTY_HARD;

  // Below 70% → suspension territory; difficulty label is irrelevant
  return DIFFICULTY_UNRATED;
}

/**
 * Return the success-rate percentage (0–100), or null if no attempts.
 */
export function computeSuccessRate(totalAttempts, totalSuccess) {
  if (!totalAttempts) return null;
  return Math.round((totalSuccess / totalAttempts) * 100 * 10) / 10; // 1 decimal
}

/**
 * Whether a question should be suspended.
 * Suspension is triggered when:
 *   • total attempts ≥ MIN_ATTEMPTS_FOR_RATING (50), AND
 *   • success rate < 70 %
 */
export function shouldSuspend(totalAttempts, totalSuccess) {
  if (!totalAttempts || totalAttempts < MIN_ATTEMPTS_FOR_RATING) return false;
  const rate = (totalSuccess / totalAttempts) * 100;
  return rate < 70;
}

// ─────────────────────────────────────────────────────────────
// Persist difficulty update
// ─────────────────────────────────────────────────────────────

/**
 * Recalculate a question's difficulty (and possibly suspend it) after a new
 * answer has been recorded.
 *
 * This is the main entry-point called from the activity-log hook.
 *
 * @param {string} questionId
 * @returns {Promise<{
 *   questionId: string,
 *   totalAttempts: number,
 *   totalSuccess: number,
 *   successRate: number,
 *   difficulty: string|null,
 *   suspended: boolean,
 *   previousDifficulty: string|null,
 * }>}
 */
export async function recalculateDifficulty(questionId) {
  // 1. Fetch question
  const question = await entities.Question_Bank.findOne({ id: questionId });
  if (!question) {
    // Demo/fallback question (e.g. q1) may not exist in DB — skip recalc
    return {
      questionId,
      totalAttempts: 0,
      totalSuccess: 0,
      successRate: 0,
      difficulty: null,
      suspended: false,
      previousDifficulty: null
    };
  }

  // 2. Recalculate stats from Activity_Log (source of truth)
  const allAttempts = await entities.Activity_Log.find({ question_id: questionId });
  const totalAttempts = allAttempts.length;
  const totalSuccess  = allAttempts.filter(l => l.is_correct === true).length;
  const successRate   = computeSuccessRate(totalAttempts, totalSuccess) ?? 0;

  // 3. Compute new difficulty
  const newDifficulty = computeDifficulty(totalAttempts, totalSuccess);
  const previousDifficulty = question.difficulty_level ?? null;

  // 4. Determine suspension
  const needsSuspension = shouldSuspend(totalAttempts, totalSuccess);

  // 5. Build update payload
  const updatePayload = {
    total_attempts: totalAttempts,
    total_success:  totalSuccess,
    success_rate:   successRate,
    difficulty_level: newDifficulty,
  };

  if (needsSuspension && question.status === 'active') {
    updatePayload.status = 'suspended';
    updatePayload.suspended_reason = 'auto_low_success_rate';
    updatePayload.suspended_at     = new Date().toISOString();
    console.info(
      `[difficultyEngine] שאלה ${questionId} הושעתה אוטומטית — ` +
      `${successRate}% מענה נכון מתוך ${totalAttempts} ניסיונות`
    );
  }

  // 6. Persist
  await entities.Question_Bank.update(questionId, updatePayload);

  return {
    questionId,
    totalAttempts,
    totalSuccess,
    successRate,
    difficulty: newDifficulty,
    suspended:  needsSuspension,
    previousDifficulty,
  };
}

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────

/**
 * Return display config for a difficulty label.
 * Suitable for inline styles / badge rendering.
 */
export function getDifficultyDisplay(difficulty) {
  switch (difficulty) {
    case DIFFICULTY_EASY:   return { label: 'קל',      color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' };
    case DIFFICULTY_MEDIUM: return { label: 'בינוני',  color: '#E65100', bg: '#FFF3E0', border: '#FFCC80' };
    case DIFFICULTY_HARD:   return { label: 'קשה',     color: '#C62828', bg: '#FFEBEE', border: '#EF9A9A' };
    default:                return { label: 'לא מדורג', color: '#757575', bg: '#F5F5F5', border: '#E0E0E0' };
  }
}

/**
 * Render a difficulty badge as a React-compatible style object + label string.
 * Use alongside getDifficultyDisplay.
 */
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
