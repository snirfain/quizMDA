/**
 * Question Review Workflow
 * Review, approve, reject questions
 * Hebrew: בקרה על שאלות
 */

import { entities } from '../config/appConfig';

/**
 * Get pending questions (draft status or needs review)
 */
export async function getPendingQuestions(filters = {}) {
  try {
    const query = {
      status: { $in: ['draft', 'pending_review'] }
    };

    // Apply filters
    if (filters.questionType) {
      query.question_type = filters.questionType;
    }

    if (filters.difficulty) {
      const [min, max] = filters.difficulty.split('-').map(Number);
      query.difficulty_level = { $gte: min, $lte: max };
    }

    if (filters.hierarchyId) {
      query.hierarchy_id = filters.hierarchyId;
    }

    const questions = await entities.Question_Bank.find(query, {
      sort: { createdAt: -1 }
    });

    // Enrich with hierarchy data
    const enrichedQuestions = await Promise.all(
      questions.map(async (question) => {
        let hierarchy = null;
        if (question.hierarchy_id) {
          try {
            hierarchy = await entities.Content_Hierarchy.findOne({ id: question.hierarchy_id });
          } catch (e) {
            // Ignore
          }
        }

        return {
          ...question,
          hierarchy
        };
      })
    );

    return {
      questions: enrichedQuestions,
      total: enrichedQuestions.length
    };
  } catch (error) {
    console.error('Error getting pending questions:', error);
    return { questions: [], total: 0 };
  }
}

/**
 * Approve question
 */
export async function approveQuestion(questionId, reviewerId, notes = '') {
  try {
    const question = await entities.Question_Bank.findOne({ id: questionId });
    
    if (!question) {
      throw new Error('שאלה לא נמצאה');
    }

    const updated = await entities.Question_Bank.update(questionId, {
      status: 'active',
      reviewed_at: new Date(),
      reviewed_by: reviewerId,
      review_notes: notes
    });

    return {
      success: true,
      question: updated || question
    };
  } catch (error) {
    console.error('Error approving question:', error);
    throw error;
  }
}

/**
 * Reject question
 */
export async function rejectQuestion(questionId, reason, reviewerId) {
  try {
    const question = await entities.Question_Bank.findOne({ id: questionId });
    
    if (!question) {
      throw new Error('שאלה לא נמצאה');
    }

    const updated = await entities.Question_Bank.update(questionId, {
      status: 'rejected',
      reviewed_at: new Date(),
      reviewed_by: reviewerId,
      rejection_reason: reason
    });

    return {
      success: true,
      question: updated || question
    };
  } catch (error) {
    console.error('Error rejecting question:', error);
    throw error;
  }
}

/**
 * Request revision for question
 */
export async function requestRevision(questionId, feedback, reviewerId) {
  try {
    const question = await entities.Question_Bank.findOne({ id: questionId });
    
    if (!question) {
      throw new Error('שאלה לא נמצאה');
    }

    const updated = await entities.Question_Bank.update(questionId, {
      status: 'needs_revision',
      reviewed_at: new Date(),
      reviewed_by: reviewerId,
      revision_feedback: feedback
    });

    return {
      success: true,
      question: updated || question
    };
  } catch (error) {
    console.error('Error requesting revision:', error);
    throw error;
  }
}

/**
 * Bulk approve questions
 */
export async function bulkApproveQuestions(questionIds, reviewerId, notes = '') {
  const results = {
    total: questionIds.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const questionId of questionIds) {
    try {
      await approveQuestion(questionId, reviewerId, notes);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        questionId,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Get review statistics
 */
export async function getReviewStatistics() {
  try {
    const allQuestions = await entities.Question_Bank.find({});

    const stats = {
      total: allQuestions.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      needsRevision: 0,
      byType: {},
      avgReviewTime: null
    };

    allQuestions.forEach(question => {
      // Count by status
      if (question.status === 'draft' || question.status === 'pending_review') {
        stats.pending++;
      } else if (question.status === 'active') {
        stats.approved++;
      } else if (question.status === 'rejected') {
        stats.rejected++;
      } else if (question.status === 'needs_revision') {
        stats.needsRevision++;
      }

      // Count by type
      const type = question.question_type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting review statistics:', error);
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      needsRevision: 0,
      byType: {},
      avgReviewTime: null
    };
  }
}
