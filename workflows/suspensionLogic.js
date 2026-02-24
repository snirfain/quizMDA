/**
 * Suspension & Difficulty Hook
 * Called every time an answer is recorded in Activity_Log.
 *
 * Delegates all difficulty / suspension logic to difficultyEngine.js.
 *
 * Hebrew: לוגיקת השעיה + עדכון קושי
 */

import { entities } from '../config/appConfig';
import { recalculateDifficulty } from './difficultyEngine';
import { recalcMediaStats } from './mediaEngine';

/**
 * Recalculate statistics, assign difficulty label, and auto-suspend if needed.
 * This is a thin wrapper kept for backward-compatibility with existing callers.
 *
 * @param {string} questionId
 * @returns {Promise<{ suspended: boolean, successRate: number, totalAttempts: number, difficulty: string|null }>}
 */
export async function checkAndSuspendQuestion(questionId) {
  const result = await recalculateDifficulty(questionId);
  return {
    suspended:     result.suspended,
    successRate:   result.successRate,
    totalAttempts: result.totalAttempts,
    difficulty:    result.difficulty,
  };
}

/**
 * Hook: Called after Activity_Log entry is created.
 * Triggers difficulty recalculation + gamification rewards.
 */
export async function onActivityLogCreated(logData) {
  const { question_id, user_id } = logData;

  // Trigger difficulty recalculation (also updates total_attempts / success_rate)
  if (question_id) {
    try {
      await recalculateDifficulty(question_id);
    } catch (err) {
      console.error('[suspensionLogic] שגיאה בחישוב קושי:', err);
    }
  }

  // Trigger per-media stats recalculation when a media item was shown
  const { media_id } = logData;
  if (media_id) {
    try {
      await recalcMediaStats(media_id);
    } catch (err) {
      console.error('[suspensionLogic] שגיאה בחישוב סטטיסטיקות מדיה:', err);
    }
  }

  // Update last_attempt_date for this user-question combination
  if (question_id && user_id) {
    const now = new Date();
    const previousLogs = await entities.Activity_Log.find({
      user_id,
      question_id,
    });
    for (const log of previousLogs) {
      if (!log.last_attempt_date || new Date(log.last_attempt_date) < now) {
        await entities.Activity_Log.update(log.log_id, { last_attempt_date: now });
      }
    }
  }

  // Gamification — award points and check achievements
  if (user_id) {
    try {
      const { checkAchievements } = await import('./gamification');
      const timeSpent = logData.time_spent || 0;
      const isCorrect = logData.is_correct || false;

      if (isCorrect) {
        const user = await entities.Users.findOne({ user_id });
        if (user) {
          await entities.Users.update(user_id, {
            points: (user.points || 0) + 10,
          });
        }
      }

      await checkAchievements(user_id, {
        type:      'answer',
        timeSpent,
        isCorrect,
      });
    } catch (error) {
      console.error('[suspensionLogic] שגיאה בגיימיפיקציה:', error);
    }
  }

  return logData;
}
