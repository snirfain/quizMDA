/**
 * Adaptive Practice Engine
 * Prioritizes mistakes and new material for trainees
 * Hebrew: מנוע תרגול אדפטיבי
 */

import { entities } from '../config/appConfig';

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

  const answeredQuestionIds = new Set(userActivity.map((log) => log.question_id));

  const incorrectQuestionIds = new Set(
    userActivity.filter((log) => log.is_correct === false).map((log) => log.question_id)
  );

  const lastAttemptDates = new Map();
  for (const activity of userActivity) {
    if (activity.is_correct) {
      const questionId = activity.question_id;
      const attemptDate = activity.last_attempt_date ? new Date(activity.last_attempt_date) : new Date(activity.timestamp);

      if (!lastAttemptDates.has(questionId) || attemptDate > lastAttemptDates.get(questionId)) {
        lastAttemptDates.set(questionId, attemptDate);
      }
    }
  }

  const priority1_mistakes = [];
  const priority2_new = [];
  const priority2_5_review_due = [];
  const priority3_review = [];

  for (const question of activeQuestions) {
    const questionId = question.id;

    if (incorrectQuestionIds.has(questionId)) {
      priority1_mistakes.push(question);
    } else if (!answeredQuestionIds.has(questionId)) {
      priority2_new.push(question);
    } else {
      const lastAttemptDate = lastAttemptDates.get(questionId);
      if (lastAttemptDate && isReviewDue(lastAttemptDate)) {
        priority2_5_review_due.push(question);
      } else {
        priority3_review.push(question);
      }
    }
  }

  let adaptiveQuestions = [...priority1_mistakes, ...priority2_new, ...priority2_5_review_due, ...priority3_review];

  if (excludeQuestionId) {
    adaptiveQuestions = adaptiveQuestions.filter((q) => q.id !== excludeQuestionId);
  }

  return {
    questions: adaptiveQuestions,
    stats: {
      mistakes: priority1_mistakes.length,
      new: priority2_new.length,
      reviewDue: priority2_5_review_due.length,
      review: priority3_review.length,
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

export async function getNextPracticeQuestion(userId, hierarchyFilters = {}, tagFilters = [], excludeQuestionId = null) {
  try {
    const result = await getAdaptiveQuestions(userId, hierarchyFilters, tagFilters, excludeQuestionId);

    if (result.questions && result.questions.length > 0) {
      return result.questions[0];
    }

    return DEMO_QUESTION;
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
