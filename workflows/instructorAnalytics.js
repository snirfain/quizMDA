/**
 * Instructor Analytics
 * Analytics and statistics dashboard for instructors
 * Hebrew: אנליטיקה למדריך
 */

import { entities } from '../config/appConfig';

async function questionsForCategoryFilters(category_name, topic_name) {
  let questions = await entities.Question_Bank.find({ status: 'active' });
  if (category_name) {
    const needle = String(category_name);
    questions = questions.filter((q) => (q.category || '').includes(needle));
  }
  if (topic_name) {
    const needle = String(topic_name);
    questions = questions.filter((q) => (q.sub_category || '').includes(needle));
  }
  return questions;
}

export async function getClassPerformance(filters = {}) {
  const { startDate, endDate, category_name, topic_name } = filters;

  const activityFilter = {};
  if (startDate) activityFilter.timestamp = { $gte: startDate };
  if (endDate) {
    activityFilter.timestamp = activityFilter.timestamp || {};
    activityFilter.timestamp.$lte = endDate;
  }

  let allActivity = await entities.Activity_Log.find(activityFilter);

  if (category_name || topic_name) {
    const questions = await questionsForCategoryFilters(category_name, topic_name);
    const questionIds = new Set(questions.map((q) => q.id));
    allActivity = allActivity.filter((a) => questionIds.has(a.question_id));
  }

  const totalAttempts = allActivity.length;
  const totalCorrect = allActivity.filter((a) => a.is_correct === true).length;
  const overallSuccessRate = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

  const uniqueUsers = new Set(allActivity.map((a) => a.user_id)).size;

  const activitiesWithTime = allActivity.filter((a) => a.time_spent && a.time_spent > 0);
  const avgTimeSpent =
    activitiesWithTime.length > 0
      ? activitiesWithTime.reduce((sum, a) => sum + a.time_spent, 0) / activitiesWithTime.length
      : 0;

  return {
    totalAttempts,
    totalCorrect,
    overallSuccessRate,
    uniqueUsers,
    avgTimeSpent: Math.round(avgTimeSpent),
    totalQuestions: new Set(allActivity.map((a) => a.question_id)).size,
  };
}

export async function getQuestionDifficultyAnalysis(filters = {}) {
  const { category_name, topic_name } = filters;
  const questions = await questionsForCategoryFilters(category_name, topic_name);

  const difficultyStats = {};

  for (const question of questions) {
    const difficulty = question.training_level || '—';
    if (!difficultyStats[difficulty]) {
      difficultyStats[difficulty] = {
        difficulty,
        totalQuestions: 0,
        totalAttempts: 0,
        totalSuccess: 0,
        avgSuccessRate: 0,
        problematicQuestions: [],
      };
    }

    difficultyStats[difficulty].totalQuestions++;
    difficultyStats[difficulty].totalAttempts += question.total_attempts || 0;
    difficultyStats[difficulty].totalSuccess += question.total_success || 0;

    if (question.total_attempts >= 10 && question.success_rate < 60) {
      difficultyStats[difficulty].problematicQuestions.push({
        id: question.id,
        text: (question.question_text || '').substring(0, 100) + '...',
        successRate: question.success_rate,
        attempts: question.total_attempts,
      });
    }
  }

  Object.keys(difficultyStats).forEach((d) => {
    const stats = difficultyStats[d];
    stats.avgSuccessRate = stats.totalAttempts > 0 ? (stats.totalSuccess / stats.totalAttempts) * 100 : 0;
  });

  return Object.values(difficultyStats).sort((a, b) => String(a.difficulty).localeCompare(String(b.difficulty)));
}

export async function getTopicPerformanceChart(filters = {}) {
  const { startDate, endDate } = filters;

  const questions = await entities.Question_Bank.find({ status: 'active' });
  const categories = [...new Set(questions.map((q) => q.category).filter(Boolean))];

  const topicStats = [];

  for (const cat of categories) {
    const qs = questions.filter((q) => q.category === cat);
    const questionIds = qs.map((q) => q.id);

    const activityFilter = { question_id: { $in: questionIds } };
    if (startDate) activityFilter.timestamp = { $gte: startDate };
    if (endDate) {
      activityFilter.timestamp = activityFilter.timestamp || {};
      activityFilter.timestamp.$lte = endDate;
    }

    const activity = await entities.Activity_Log.find(activityFilter);

    const attempts = activity.length;
    const correct = activity.filter((a) => a.is_correct === true).length;
    const successRate = attempts > 0 ? (correct / attempts) * 100 : 0;

    topicStats.push({
      category: cat,
      topic: qs[0]?.sub_category || '',
      attempts,
      correct,
      successRate,
      questionsCount: qs.length,
    });
  }

  return topicStats.sort((a, b) => b.attempts - a.attempts);
}

export async function getTraineeProgressOverview(filters = {}) {
  const { category_name, topic_name } = filters;

  const trainees = await entities.Users.find({
    role: 'trainee',
  });

  const filteredQuestions = await questionsForCategoryFilters(category_name, topic_name);
  const allowedIds =
    category_name || topic_name ? new Set(filteredQuestions.map((q) => q.id)) : null;

  const traineeStats = [];

  for (const trainee of trainees) {
    let activityFilter = { user_id: trainee.user_id };

    const activity = await entities.Activity_Log.find(activityFilter);
    const scoped = allowedIds
      ? activity.filter((a) => allowedIds.has(a.question_id))
      : activity;

    const attempts = scoped.length;
    const correct = scoped.filter((a) => a.is_correct === true).length;
    const successRate = attempts > 0 ? (correct / attempts) * 100 : 0;

    const questionsAnswered = new Set(scoped.map((a) => a.question_id)).size;

    const lastActivity =
      scoped.length > 0
        ? scoped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].timestamp
        : null;

    traineeStats.push({
      userId: trainee.user_id,
      name: trainee.full_name,
      attempts,
      correct,
      successRate,
      questionsAnswered,
      lastActivity,
      points: trainee.points || 0,
      streak: trainee.current_streak || 0,
    });
  }

  return traineeStats.sort((a, b) => b.attempts - a.attempts);
}

export async function getProblematicQuestions(threshold = 60, minAttempts = 10) {
  const questions = await entities.Question_Bank.find(
    {
      status: 'active',
      total_attempts: { $gte: minAttempts },
      success_rate: { $lt: threshold },
    },
    {
      sort: { success_rate: 1 },
    }
  );

  return questions.map((question) => ({
    ...question,
    hierarchy: question.category
      ? { category: question.category, topic: question.sub_category }
      : null,
  }));
}
