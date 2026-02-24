/**
 * Adaptive Practice Engine
 * Prioritizes mistakes and new material for trainees
 * Hebrew: מנוע תרגול אדפטיבי
 * 
 * Priority 1: Questions where user has is_correct = False (Mistakes)
 * Priority 2: Questions NOT in Activity_Log for this user (New material)
 * Priority 2.5: Questions answered correctly but >7 days ago (Review due)
 * Priority 3: Other review questions
 * Exclude: Questions where status is "Suspended"
 */

// Import entities
import { entities } from '../config/appConfig';

/**
 * Get last attempt date for a question by user
 */
async function getLastAttemptDate(userId, questionId) {
  const lastAttempt = await entities.Activity_Log.find({
    user_id: userId,
    question_id: questionId
  }, {
    sort: { timestamp: -1 },
    limit: 1
  });

  if (lastAttempt.length > 0 && lastAttempt[0].last_attempt_date) {
    return new Date(lastAttempt[0].last_attempt_date);
  }
  
  if (lastAttempt.length > 0) {
    return new Date(lastAttempt[0].timestamp);
  }
  
  return null;
}

/**
 * Check if question is due for review (answered correctly but >7 days ago)
 */
function isReviewDue(lastAttemptDate) {
  if (!lastAttemptDate) return false;
  
  const daysSince = (Date.now() - lastAttemptDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 7;
}

/**
 * Calculate adaptive difficulty based on user performance
 */
export async function calculateAdaptiveDifficulty(userId, baseDifficulty) {
  // Get user's overall success rate
  const userActivity = await entities.Activity_Log.find({
    user_id: userId
  });

  if (userActivity.length === 0) {
    return baseDifficulty; // No data, return base difficulty
  }

  const totalAttempts = userActivity.length;
  const totalCorrect = userActivity.filter(a => a.is_correct === true).length;
  const successRate = totalCorrect / totalAttempts;

  // Adjust difficulty based on performance
  if (successRate > 0.9) {
    // High performance - increase difficulty
    return Math.min(10, baseDifficulty + 1);
  } else if (successRate < 0.5) {
    // Low performance - decrease difficulty
    return Math.max(1, baseDifficulty - 1);
  }

  return baseDifficulty; // Keep base difficulty
}

export async function getAdaptiveQuestions(userId, hierarchyFilters = {}, tagFilters = [], excludeQuestionId = null) {
  const { category_name, topic_name } = hierarchyFilters;
  
  // Build hierarchy filter
  const hierarchyQuery = {};
  if (category_name) hierarchyQuery.category_name = category_name;
  if (topic_name) hierarchyQuery.topic_name = topic_name;
  
  // Get all active questions from selected hierarchy
  const allHierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
  const hierarchyIds = allHierarchies.map(h => h.id);
  
  let activeQuestions = await entities.Question_Bank.find({
    hierarchy_id: { $in: hierarchyIds },
    status: 'active' // Exclude suspended questions
  });

  // Filter by tags if provided
  if (tagFilters && tagFilters.length > 0) {
    activeQuestions = activeQuestions.filter(q => {
      if (!q.tags || !Array.isArray(q.tags)) return false;
      return tagFilters.some(tag => q.tags.includes(tag));
    });
  }

  // Get user's activity log
  const userActivity = await entities.Activity_Log.find({
    user_id: userId
  });

  // Create maps for quick lookup
  const answeredQuestionIds = new Set(
    userActivity.map(log => log.question_id)
  );
  
  const incorrectQuestionIds = new Set(
    userActivity
      .filter(log => log.is_correct === false)
      .map(log => log.question_id)
  );

  // Create map of last attempt dates for correct answers
  const lastAttemptDates = new Map();
  for (const activity of userActivity) {
    if (activity.is_correct) {
      const questionId = activity.question_id;
      const attemptDate = activity.last_attempt_date 
        ? new Date(activity.last_attempt_date)
        : new Date(activity.timestamp);
      
      if (!lastAttemptDates.has(questionId) || 
          attemptDate > lastAttemptDates.get(questionId)) {
        lastAttemptDates.set(questionId, attemptDate);
      }
    }
  }

  // Categorize questions
  const priority1_mistakes = [];
  const priority2_new = [];
  const priority2_5_review_due = [];
  const priority3_review = [];

  for (const question of activeQuestions) {
    const questionId = question.id;
    
    if (incorrectQuestionIds.has(questionId)) {
      // Priority 1: Questions user got wrong
      priority1_mistakes.push(question);
    } else if (!answeredQuestionIds.has(questionId)) {
      // Priority 2: Questions user hasn't seen
      priority2_new.push(question);
    } else {
      // Check if review is due (answered correctly but >7 days ago)
      const lastAttemptDate = lastAttemptDates.get(questionId);
      if (lastAttemptDate && isReviewDue(lastAttemptDate)) {
        // Priority 2.5: Questions answered correctly but review is due
        priority2_5_review_due.push(question);
      } else {
        // Priority 3: Other review questions
        priority3_review.push(question);
      }
    }
  }

  // Combine priorities: mistakes first, then new, then review due, then other review
  let adaptiveQuestions = [
    ...priority1_mistakes,
    ...priority2_new,
    ...priority2_5_review_due,
    ...priority3_review
  ];

  // Exclude the question we just answered (avoids same-question repeat)
  if (excludeQuestionId) {
    adaptiveQuestions = adaptiveQuestions.filter(q => q.id !== excludeQuestionId);
  }

  return {
    questions: adaptiveQuestions,
    stats: {
      mistakes: priority1_mistakes.length,
      new: priority2_new.length,
      reviewDue: priority2_5_review_due.length,
      review: priority3_review.length,
      total: adaptiveQuestions.length
    }
  };
}

/**
 * Get next question for practice session
 */
export async function getNextPracticeQuestion(userId, hierarchyFilters = {}, tagFilters = [], excludeQuestionId = null) {
  try {
    const result = await getAdaptiveQuestions(userId, hierarchyFilters, tagFilters, excludeQuestionId);
    
    if (result.questions && result.questions.length > 0) {
      return result.questions[0];
    }
    
    if (result.questions.length > 0) {
      return result.questions[0];
    }
    
    // Fallback: return a mock question for demo
    return {
      id: 'q1',
      hierarchy_id: 'h1',
      question_type: 'single_choice',
      question_text: 'מהו מספר הלחיצות המומלץ בהחייאה?',
      difficulty_level: 5,
      correct_answer: JSON.stringify({ value: '30', options: [
        { value: '15', label: '15' },
        { value: '30', label: '30' },
        { value: '50', label: '50' }
      ]}),
      status: 'active',
      hint: 'זה מספר זוגי',
      explanation: 'מספר הלחיצות המומלץ הוא 30 לפני 2 נשימות'
    };
  } catch (error) {
    console.error('Error getting next question:', error);
    // Return mock question on error
    return {
      id: 'q1',
      hierarchy_id: 'h1',
      question_type: 'single_choice',
      question_text: 'מהו מספר הלחיצות המומלץ בהחייאה?',
      difficulty_level: 5,
      correct_answer: JSON.stringify({ value: '30', options: [
        { value: '15', label: '15' },
        { value: '30', label: '30' },
        { value: '50', label: '50' }
      ]}),
      status: 'active',
      hint: 'זה מספר זוגי',
      explanation: 'מספר הלחיצות המומלץ הוא 30 לפני 2 נשימות'
    };
  }
}

/**
 * Get practice session with multiple questions
 */
export async function getPracticeSession(userId, count = 10, hierarchyFilters = {}, tagFilters = []) {
  const result = await getAdaptiveQuestions(userId, hierarchyFilters, tagFilters);
  
  // Return up to 'count' questions
  return {
    questions: result.questions.slice(0, count),
    stats: result.stats
  };
}
