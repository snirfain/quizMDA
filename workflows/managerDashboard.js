/**
 * Manager Dashboard
 * View and manage questions in "under review" (low success rate)
 * Hebrew: לוח בקרה למנהל
 */

import { entities } from '../config/appConfig';

export async function getSuspendedQuestions(filters = {}) {
  const { category_name, topic_name, min_attempts = 0, max_success_rate = 49 } = filters;

  let list = await entities.Question_Bank.find({
    status: 'under_review',
    total_attempts: { $gte: min_attempts },
  });

  list = list.filter((q) => (q.success_rate ?? 0) <= max_success_rate);

  if (category_name) {
    const needle = String(category_name);
    list = list.filter((q) => (q.category || '').includes(needle));
  }
  if (topic_name) {
    const needle = String(topic_name);
    list = list.filter((q) => (q.sub_category || '').includes(needle));
  }

  list.sort((a, b) => (a.success_rate ?? 0) - (b.success_rate ?? 0));

  const enrichedQuestions = await Promise.all(
    list.map(async (question) => {
      const recentLogs = await entities.Activity_Log.find(
        { question_id: question.id },
        {
          sort: { timestamp: -1 },
          limit: 10,
        }
      );

      return {
        ...question,
        recent_attempts: recentLogs.length,
        last_attempt: recentLogs.length > 0 ? recentLogs[0].timestamp : null,
      };
    })
  );

  return {
    questions: enrichedQuestions,
    total: enrichedQuestions.length,
    stats: {
      avg_success_rate:
        enrichedQuestions.length > 0
          ? enrichedQuestions.reduce((sum, q) => sum + (q.success_rate || 0), 0) / enrichedQuestions.length
          : 0,
      avg_attempts:
        enrichedQuestions.length > 0
          ? enrichedQuestions.reduce((sum, q) => sum + q.total_attempts, 0) / enrichedQuestions.length
          : 0,
    },
  };
}

export async function reactivateQuestion(questionId, reason = '') {
  const question = await entities.Question_Bank.findOne({ id: questionId });

  if (!question) {
    throw new Error('Question not found');
  }

  if (question.status !== 'under_review') {
    throw new Error('Question is not under review');
  }

  await entities.Question_Bank.update(questionId, {
    status: 'active',
  });

  console.log(`Question ${questionId} reactivated. Reason: ${reason}`);

  return {
    success: true,
    question: await entities.Question_Bank.findOne({ id: questionId }),
  };
}

export async function bulkReactivateQuestions(questionIds, reason = '') {
  const results = [];

  for (const questionId of questionIds) {
    try {
      const result = await reactivateQuestion(questionId, reason);
      results.push({ questionId, success: true, ...result });
    } catch (error) {
      results.push({ questionId, success: false, error: error.message });
    }
  }

  return {
    total: questionIds.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

export async function getSuspensionStats() {
  const allQuestions = await entities.Question_Bank.find({});

  const stats = {
    total: allQuestions.length,
    active: allQuestions.filter((q) => q.status === 'active').length,
    under_review: allQuestions.filter((q) => q.status === 'under_review').length,
    draft: allQuestions.filter((q) => q.status === 'draft').length,
    suspended_by_type: {},
    avg_success_rate_suspended: 0,
  };

  const underReview = allQuestions.filter((q) => q.status === 'under_review');

  if (underReview.length > 0) {
    stats.avg_success_rate_suspended =
      underReview.reduce((sum, q) => sum + (q.success_rate || 0), 0) / underReview.length;

    underReview.forEach((q) => {
      stats.suspended_by_type[q.question_type] =
        (stats.suspended_by_type[q.question_type] || 0) + 1;
    });
  }

  return stats;
}
