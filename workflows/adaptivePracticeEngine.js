/**
 * Adaptive Practice Engine
 * Prioritizes mistakes and new material for trainees
 * Hebrew: מנוע תרגול אדפטיבי
 */

import { entities } from '../config/appConfig';
import { shuffle, pickNextQuestion } from '../shared/adaptiveSelection.js';

export { shuffle, pickNextQuestion };

async function getLastAttemptDate(userId, questionId) {
  const lastAttempt = await entities.Activity_Log.find(
    {
      user_id: userId,
      question_id: questionId,
    },
    {
      sort: { timestamp: -1 },
      limit: 1,
    }
  );

  if (lastAttempt.length > 0 && lastAttempt[0].last_attempt_date) {
    return new Date(lastAttempt[0].last_attempt_date);
  }

  if (lastAttempt.length > 0) {
    return new Date(lastAttempt[0].timestamp);
  }

  return null;
}

function isReviewDue(lastAttemptDate) {
  if (!lastAttemptDate) return false;

  const daysSince = (Date.now() - lastAttemptDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 7;
}

export async function calculateAdaptiveDifficulty(userId, baseDifficulty) {
  const userActivity = await entities.Activity_Log.find({
    user_id: userId,
  });

  if (userActivity.length === 0) {
    return baseDifficulty;
  }

  const totalAttempts = userActivity.length;
  const totalCorrect = userActivity.filter((a) => a.is_correct === true).length;
  const successRate = totalCorrect / totalAttempts;

  if (successRate > 0.9) {
    return Math.min(10, baseDifficulty + 1);
  } else if (successRate < 0.5) {
    return Math.max(1, baseDifficulty - 1);
  }

  return baseDifficulty;
}

export async function getAdaptiveQuestions(userId, hierarchyFilters = {}, tagFilters = [], excludeQuestionId = null) {
  if (typeof window !== 'undefined' && window.__quizMDA_syncPromise) {
    await window.__quizMDA_syncPromise;
  }

  const { category_name, topic_name } = hierarchyFilters;

  let activeQuestions = await entities.Question_Bank.find({ status: 'active' });

  if (category_name) {
    const needle = String(category_name);
    activeQuestions = activeQuestions.filter(
      (q) =>
        (q.category && q.category.includes(needle)) ||
        (q.sub_category && q.sub_category.includes(needle))
    );
  }
  if (topic_name) {
    const needle = String(topic_name);
    activeQuestions = activeQuestions.filter((q) => q.sub_category && q.sub_category.includes(needle));
  }

  if (tagFilters && tagFilters.length > 0) {
    activeQuestions = activeQuestions.filter((q) => tagFilters.some((tag) => (q.category || '').includes(tag)));
  }

  const userActivity = await entities.Activity_Log.find({
    user_id: userId,
  });

  // A question is considered "answered" if there is any log for it, and
  // "mastered" (answered correctly) if at least one log has is_correct === true.
  // Mastered questions must NOT be served again until the whole in-scope pool
  // has been mastered — only then does the pool recycle.
  const answeredQuestionIds = new Set();
  const correctQuestionIds = new Set();

  // Most recent successful attempt per question — used for spaced-repetition
  // review of already-mastered questions.
  const lastCorrectDates = new Map();

  for (const activity of userActivity) {
    const questionId = activity.question_id;
    if (questionId == null) continue;

    answeredQuestionIds.add(questionId);

    if (activity.is_correct === true) {
      correctQuestionIds.add(questionId);
      const attemptDate = activity.last_attempt_date
        ? new Date(activity.last_attempt_date)
        : new Date(activity.timestamp);
      if (!lastCorrectDates.has(questionId) || attemptDate > lastCorrectDates.get(questionId)) {
        lastCorrectDates.set(questionId, attemptDate);
      }
    }
  }

  // Selection priority (per product requirement):
  //   1. unseen           — never answered
  //   2. reinforcement    — answered but never correct (needs another attempt)
  //   3. masteredReviewDue— answered correctly but due for spaced review (>7d)
  //   4. mastered         — answered correctly recently (only as a last resort)
  const unseen = [];
  const reinforcement = [];
  const masteredReviewDue = [];
  const mastered = [];

  for (const question of activeQuestions) {
    const questionId = question.id;

    if (!answeredQuestionIds.has(questionId)) {
      unseen.push(question);
    } else if (!correctQuestionIds.has(questionId)) {
      reinforcement.push(question);
    } else {
      const lastDate = lastCorrectDates.get(questionId);
      if (lastDate && isReviewDue(lastDate)) {
        masteredReviewDue.push(question);
      } else {
        mastered.push(question);
      }
    }
  }

  // Shuffle WITHIN each priority bucket so the order varies on every entry,
  // while the bucket ordering itself (and therefore the no-repeat-until-quota
  // rule) is preserved: correctly-answered questions still only appear after the
  // unseen/reinforcement pool is exhausted.
  let adaptiveQuestions = [
    ...shuffle(unseen),
    ...shuffle(reinforcement),
    ...shuffle(masteredReviewDue),
    ...shuffle(mastered),
  ];

  if (excludeQuestionId) {
    adaptiveQuestions = adaptiveQuestions.filter((q) => q.id !== excludeQuestionId);
  }

  return {
    questions: adaptiveQuestions,
    // Questions still owed before the pool is "exhausted" and may recycle.
    unmasteredCount: unseen.length + reinforcement.length,
    stats: {
      mistakes: reinforcement.length,
      new: unseen.length,
      reviewDue: masteredReviewDue.length,
      review: mastered.length,
      total: adaptiveQuestions.length,
    },
  };
}

const DEMO_QUESTION = {
  id: 'q-demo',
  category: '28. מבוא ובסיס',
  sub_category: 'תת־נושא א',
  thinking_level: 'Knowledge',
  training_level: 'A',
  question_type: 'single_choice',
  question_text: 'מהו מספר הלחיצות המומלץ בהחייאה?',
  correct_answer: JSON.stringify({
    value: '1',
    options: [
      { value: '0', label: '15' },
      { value: '1', label: '30' },
      { value: '2', label: '50' },
    ],
  }),
  status: 'active',
  hint: 'זה מספר זוגי',
  explanation: 'מספר הלחיצות המומלץ הוא 30 לפני 2 נשימות',
};

/**
 * Pick the next practice question for a user.
 *
 * @param {string} userId
 * @param {Object} hierarchyFilters
 * @param {Array}  tagFilters
 * @param {Array<string>|string|null} excludeIds - question ids already served
 *        this session (the engine avoids them until the in-scope pool is
 *        exhausted, at which point it recycles without immediately repeating
 *        the most recently served question).
 */
export async function getNextPracticeQuestion(userId, hierarchyFilters = {}, tagFilters = [], excludeIds = []) {
  try {
    const exclude = Array.isArray(excludeIds)
      ? excludeIds.filter((id) => id != null)
      : (excludeIds != null ? [excludeIds] : []);

    const result = await getAdaptiveQuestions(userId, hierarchyFilters, tagFilters);
    const ordered = result.questions || [];
    if (ordered.length === 0) {
      return DEMO_QUESTION;
    }

    return pickNextQuestion(ordered, exclude) || DEMO_QUESTION;
  } catch (error) {
    console.error('Error getting next question:', error);
    return DEMO_QUESTION;
  }
}

export async function getPracticeSession(userId, count = 10, hierarchyFilters = {}, tagFilters = []) {
  const result = await getAdaptiveQuestions(userId, hierarchyFilters, tagFilters);
  const questions = (result.questions || []).slice(0, count);
  return { questions, stats: result.stats };
}
