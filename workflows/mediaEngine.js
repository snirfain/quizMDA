/**
 * Media Engine
 *
 * Handles all logic for the Media Bank:
 *   • Picking a random active media item for a given tag
 *   • Recalculating per-media statistics after an answer
 *   • Auto-suspending poor-performing media items
 *   • Helpers for display (difficulty badge, status labels)
 *
 * Same quality thresholds as the question difficulty engine:
 *   ≥ 95%   → קל
 *   80–94%  → בינוני
 *   70–79%  → קשה
 *   < 70%   → auto-suspend (after MIN_ATTEMPTS)
 *   < MIN_ATTEMPTS → unrated
 */

import { entities } from '../config/appConfig';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const MEDIA_MIN_ATTEMPTS   = 50;   // Attempts needed before rating
export const MEDIA_SUSPEND_BELOW  = 70;   // Success rate below which item is suspended
export const MEDIA_STATUS_ACTIVE  = 'active';
export const MEDIA_STATUS_SUSPENDED = 'suspended';
export const MEDIA_STATUS_PENDING   = 'pending_review';

// Difficulty labels (mirrors difficultyEngine.js)
export const MEDIA_DIFFICULTY_EASY   = 'קל';
export const MEDIA_DIFFICULTY_MEDIUM = 'בינוני';
export const MEDIA_DIFFICULTY_HARD   = 'קשה';
export const MEDIA_DIFFICULTY_UNRATED = 'לא מדורג';

// ─────────────────────────────────────────────────────────────
// Core: pick random media
// ─────────────────────────────────────────────────────────────

/**
 * Pick one random active media item whose tag matches the given tag.
 *
 * @param {string} tag  — must match Media_Bank.tag
 * @returns {Promise<object|null>}  Media_Bank item, or null if none available
 */
export async function pickRandomMedia(tag) {
  if (!tag) return null;
  const items = await entities.Media_Bank.find({ tag, status: MEDIA_STATUS_ACTIVE });
  if (!items || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// ─────────────────────────────────────────────────────────────
// Stats & suspension
// ─────────────────────────────────────────────────────────────

/**
 * Recompute stats for one media item by scanning Activity_Log entries
 * that reference this media_id.
 *
 * Updates Media_Bank with: total_attempts, total_success, success_rate, difficulty_level.
 * Also calls checkAndSuspendMedia.
 *
 * @param {string} mediaId
 * @returns {Promise<{difficulty: string, successRate: number, totalAttempts: number, suspended: boolean}>}
 */
export async function recalcMediaStats(mediaId) {
  if (!mediaId) return null;

  const logs = await entities.Activity_Log.find({ media_id: mediaId });
  const totalAttempts = logs.length;
  const totalSuccess  = logs.filter(l => l.is_correct === true).length;
  const successRate   = totalAttempts > 0
    ? Math.round((totalSuccess / totalAttempts) * 100)
    : 0;

  const difficulty = computeMediaDifficulty(totalAttempts, totalSuccess);
  const needsSuspension = shouldSuspendMedia(totalAttempts, totalSuccess);

  const updatePayload = {
    total_attempts: totalAttempts,
    total_success:  totalSuccess,
    success_rate:   successRate,
    difficulty_level: difficulty,
  };

  const item = await entities.Media_Bank.findOne({ id: mediaId });
  if (item && needsSuspension && item.status === MEDIA_STATUS_ACTIVE) {
    updatePayload.status         = MEDIA_STATUS_SUSPENDED;
    updatePayload.suspended_reason = `אחוז הצלחה ירד ל-${successRate}% (סף: ${MEDIA_SUSPEND_BELOW}%)`;
    updatePayload.suspended_at   = new Date().toISOString();
    console.info(`[mediaEngine] פריט מדיה ${mediaId} הושעה — ${successRate}% הצלחה`);
  }

  await entities.Media_Bank.update(mediaId, updatePayload);

  return { difficulty, successRate, totalAttempts, suspended: needsSuspension };
}

/**
 * Check whether a media item should be suspended based on its current stats.
 * Criteria: ≥ MIN_ATTEMPTS and success_rate < MEDIA_SUSPEND_BELOW
 */
export function shouldSuspendMedia(totalAttempts, totalSuccess) {
  if (totalAttempts < MEDIA_MIN_ATTEMPTS) return false;
  const rate = (totalSuccess / totalAttempts) * 100;
  return rate < MEDIA_SUSPEND_BELOW;
}

/**
 * Calculate difficulty label from raw attempt counts.
 * Returns MEDIA_DIFFICULTY_UNRATED when not enough attempts.
 */
export function computeMediaDifficulty(totalAttempts, totalSuccess) {
  if (totalAttempts < MEDIA_MIN_ATTEMPTS) return MEDIA_DIFFICULTY_UNRATED;
  const rate = (totalSuccess / totalAttempts) * 100;
  if (rate >= 95) return MEDIA_DIFFICULTY_EASY;
  if (rate >= 80) return MEDIA_DIFFICULTY_MEDIUM;
  if (rate >= 70) return MEDIA_DIFFICULTY_HARD;
  return MEDIA_DIFFICULTY_UNRATED;  // Will be suspended
}

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────

/**
 * Return display config for a media difficulty/status badge.
 * Matches the style convention of difficultyEngine.getDifficultyDisplay().
 */
export function getMediaDifficultyDisplay(difficulty) {
  switch (difficulty) {
    case MEDIA_DIFFICULTY_EASY:
      return { label: 'קל',       color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' };
    case MEDIA_DIFFICULTY_MEDIUM:
      return { label: 'בינוני',   color: '#F57F17', bg: '#FFF8E1', border: '#FFE082' };
    case MEDIA_DIFFICULTY_HARD:
      return { label: 'קשה',      color: '#C62828', bg: '#FFEBEE', border: '#EF9A9A' };
    default:
      return { label: 'לא מדורג', color: '#78909C', bg: '#ECEFF1', border: '#B0BEC5' };
  }
}

export function getMediaStatusDisplay(status) {
  switch (status) {
    case MEDIA_STATUS_ACTIVE:
      return { label: 'פעיל',         color: '#2E7D32', bg: '#E8F5E9' };
    case MEDIA_STATUS_SUSPENDED:
      return { label: 'מושעה',        color: '#C62828', bg: '#FFEBEE' };
    case MEDIA_STATUS_PENDING:
      return { label: 'ממתין לבדיקה', color: '#F57F17', bg: '#FFF8E1' };
    default:
      return { label: status,          color: '#555',    bg: '#f5f5f5' };
  }
}

/**
 * Return a human-readable label for the media type.
 */
export function getMediaTypeLabel(type) {
  switch (type) {
    case 'image': return '🖼️ תמונה';
    case 'video': return '🎥 וידאו';
    case 'audio': return '🔊 אודיו';
    default:      return type;
  }
}
