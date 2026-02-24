/**
 * Manager Dashboard
 * View and manage suspended questions
 * Hebrew: לוח בקרה למנהל
 */

import { entities } from '../config/appConfig';

/**
 * Get all suspended questions with details
 */
export async function getSuspendedQuestions(filters = {}) {
  const {
    category_name,
    topic_name,
    min_attempts = 0,
    max_success_rate = 70
  } = filters;

  // Build hierarchy filter if needed
  let hierarchyIds = null;
  if (category_name || topic_name) {
    const hierarchyQuery = {};
    if (category_name) hierarchyQuery.category_name = category_name;
    if (topic_name) hierarchyQuery.topic_name = topic_name;
    
    const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
    hierarchyIds = hierarchies.map(h => h.id);
  }

  // Build question query
  const questionQuery = {
    status: 'suspended',
    total_attempts: { $gte: min_attempts },
    success_rate: { $lte: max_success_rate }
  };

  if (hierarchyIds) {
    questionQuery.hierarchy_id = { $in: hierarchyIds };
  }

  const suspendedQuestions = await entities.Question_Bank.find(questionQuery, {
    sort: { success_rate: 1, total_attempts: -1 }
  });

  // Enrich with hierarchy information
  const enrichedQuestions = await Promise.all(
    suspendedQuestions.map(async (question) => {
      const hierarchy = await entities.Content_Hierarchy.findOne({
        id: question.hierarchy_id
      });

      // Get recent activity logs for this question
      const recentLogs = await entities.Activity_Log.find({
        question_id: question.id
      }, {
        sort: { timestamp: -1 },
        limit: 10
      });

      return {
        ...question,
        hierarchy: hierarchy,
        recent_attempts: recentLogs.length,
        last_attempt: recentLogs.length > 0 ? recentLogs[0].timestamp : null
      };
    })
  );

  return {
    questions: enrichedQuestions,
    total: enrichedQuestions.length,
    stats: {
      avg_success_rate: enrichedQuestions.length > 0
        ? enrichedQuestions.reduce((sum, q) => sum + q.success_rate, 0) / enrichedQuestions.length
        : 0,
      avg_attempts: enrichedQuestions.length > 0
        ? enrichedQuestions.reduce((sum, q) => sum + q.total_attempts, 0) / enrichedQuestions.length
        : 0
    }
  };
}

/**
 * Reactivate a suspended question
 */
export async function reactivateQuestion(questionId, reason = '') {
  const question = await entities.Question_Bank.findOne({ id: questionId });

  if (!question) {
    throw new Error('Question not found');
  }

  if (question.status !== 'suspended') {
    throw new Error('Question is not suspended');
  }

  // Reactivate the question
  await entities.Question_Bank.update(questionId, {
    status: 'active'
  });

  // Log the reactivation (could add to an audit log)
  console.log(`Question ${questionId} reactivated. Reason: ${reason}`);

  return {
    success: true,
    question: await entities.Question_Bank.findOne({ id: questionId })
  };
}

/**
 * Bulk reactivate questions
 */
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
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

/**
 * Get suspension statistics
 */
export async function getSuspensionStats() {
  const allQuestions = await entities.Question_Bank.find({});
  
  const stats = {
    total: allQuestions.length,
    active: allQuestions.filter(q => q.status === 'active').length,
    suspended: allQuestions.filter(q => q.status === 'suspended').length,
    draft: allQuestions.filter(q => q.status === 'draft').length,
    suspended_by_type: {},
    avg_success_rate_suspended: 0
  };

  const suspended = allQuestions.filter(q => q.status === 'suspended');
  
  if (suspended.length > 0) {
    stats.avg_success_rate_suspended = 
      suspended.reduce((sum, q) => sum + q.success_rate, 0) / suspended.length;

    // Group by question type
    suspended.forEach(q => {
      stats.suspended_by_type[q.question_type] = 
        (stats.suspended_by_type[q.question_type] || 0) + 1;
    });
  }

  return stats;
}
