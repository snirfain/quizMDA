/**
 * Instructor Analytics
 * Analytics and statistics dashboard for instructors
 * Hebrew: אנליטיקה למדריך
 */

import { entities } from '../config/appConfig';

/**
 * Get overall class performance
 */
export async function getClassPerformance(filters = {}) {
  const { startDate, endDate, category_name, topic_name } = filters;
  
  // Build activity filter
  const activityFilter = {};
  if (startDate) activityFilter.timestamp = { $gte: startDate };
  if (endDate) {
    activityFilter.timestamp = activityFilter.timestamp || {};
    activityFilter.timestamp.$lte = endDate;
  }

  // Get all activity
  let allActivity = await entities.Activity_Log.find(activityFilter);

  // Filter by hierarchy if needed
  if (category_name || topic_name) {
    const hierarchyQuery = {};
    if (category_name) hierarchyQuery.category_name = category_name;
    if (topic_name) hierarchyQuery.topic_name = topic_name;
    
    const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
    const hierarchyIds = hierarchies.map(h => h.id);
    
    const questions = await entities.Question_Bank.find({
      hierarchy_id: { $in: hierarchyIds }
    });
    const questionIds = new Set(questions.map(q => q.id));
    
    allActivity = allActivity.filter(a => questionIds.has(a.question_id));
  }

  const totalAttempts = allActivity.length;
  const totalCorrect = allActivity.filter(a => a.is_correct === true).length;
  const overallSuccessRate = totalAttempts > 0 
    ? (totalCorrect / totalAttempts) * 100 
    : 0;

  // Get unique users
  const uniqueUsers = new Set(allActivity.map(a => a.user_id)).size;

  // Get average time spent
  const activitiesWithTime = allActivity.filter(a => a.time_spent && a.time_spent > 0);
  const avgTimeSpent = activitiesWithTime.length > 0
    ? activitiesWithTime.reduce((sum, a) => sum + a.time_spent, 0) / activitiesWithTime.length
    : 0;

  return {
    totalAttempts,
    totalCorrect,
    overallSuccessRate,
    uniqueUsers,
    avgTimeSpent: Math.round(avgTimeSpent),
    totalQuestions: new Set(allActivity.map(a => a.question_id)).size
  };
}

/**
 * Get question difficulty analysis
 */
export async function getQuestionDifficultyAnalysis(filters = {}) {
  const { category_name, topic_name } = filters;
  
  // Build hierarchy filter
  const hierarchyQuery = {};
  if (category_name) hierarchyQuery.category_name = category_name;
  if (topic_name) hierarchyQuery.topic_name = topic_name;

  const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
  const hierarchyIds = hierarchies.map(h => h.id);

  const questions = await entities.Question_Bank.find({
    hierarchy_id: { $in: hierarchyIds },
    status: 'active'
  });

  // Analyze by difficulty level
  const difficultyStats = {};
  
  for (const question of questions) {
    const difficulty = question.difficulty_level;
    if (!difficultyStats[difficulty]) {
      difficultyStats[difficulty] = {
        difficulty,
        totalQuestions: 0,
        totalAttempts: question.total_attempts || 0,
        totalSuccess: question.total_success || 0,
        avgSuccessRate: 0,
        problematicQuestions: []
      };
    }
    
    difficultyStats[difficulty].totalQuestions++;
    difficultyStats[difficulty].totalAttempts += question.total_attempts || 0;
    difficultyStats[difficulty].totalSuccess += question.total_success || 0;
    
    // Identify problematic questions (low success rate with enough attempts)
    if (question.total_attempts >= 10 && question.success_rate < 60) {
      difficultyStats[difficulty].problematicQuestions.push({
        id: question.id,
        text: question.question_text.substring(0, 100) + '...',
        successRate: question.success_rate,
        attempts: question.total_attempts
      });
    }
  }

  // Calculate average success rates
  Object.keys(difficultyStats).forEach(difficulty => {
    const stats = difficultyStats[difficulty];
    stats.avgSuccessRate = stats.totalAttempts > 0
      ? (stats.totalSuccess / stats.totalAttempts) * 100
      : 0;
  });

  return Object.values(difficultyStats).sort((a, b) => a.difficulty - b.difficulty);
}

/**
 * Get topic performance chart data
 */
export async function getTopicPerformanceChart(filters = {}) {
  const { startDate, endDate } = filters;
  
  // Get all hierarchies
  const hierarchies = await entities.Content_Hierarchy.find({});
  
  const topicStats = [];
  
  for (const hierarchy of hierarchies) {
    const questions = await entities.Question_Bank.find({
      hierarchy_id: hierarchy.id,
      status: 'active'
    });
    
    const questionIds = questions.map(q => q.id);
    
    // Build activity filter
    const activityFilter = {
      question_id: { $in: questionIds }
    };
    if (startDate) activityFilter.timestamp = { $gte: startDate };
    if (endDate) {
      activityFilter.timestamp = activityFilter.timestamp || {};
      activityFilter.timestamp.$lte = endDate;
    }
    
    const activity = await entities.Activity_Log.find(activityFilter);
    
    const attempts = activity.length;
    const correct = activity.filter(a => a.is_correct === true).length;
    const successRate = attempts > 0 ? (correct / attempts) * 100 : 0;
    
    topicStats.push({
      category: hierarchy.category_name,
      topic: hierarchy.topic_name,
      attempts,
      correct,
      successRate,
      questionsCount: questions.length
    });
  }
  
  return topicStats.sort((a, b) => b.attempts - a.attempts);
}

/**
 * Get trainee progress overview
 */
export async function getTraineeProgressOverview(filters = {}) {
  const { category_name, topic_name } = filters;
  
  // Get all trainees
  const trainees = await entities.Users.find({
    role: 'trainee'
  });
  
  const traineeStats = [];
  
  for (const trainee of trainees) {
    // Build activity filter
    let activityFilter = { user_id: trainee.user_id };
    
    // Filter by hierarchy if needed
    if (category_name || topic_name) {
      const hierarchyQuery = {};
      if (category_name) hierarchyQuery.category_name = category_name;
      if (topic_name) hierarchyQuery.topic_name = topic_name;
      
      const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
      const hierarchyIds = hierarchies.map(h => h.id);
      
      const questions = await entities.Question_Bank.find({
        hierarchy_id: { $in: hierarchyIds }
      });
      const questionIds = new Set(questions.map(q => q.id));
      
      activityFilter.question_id = { $in: Array.from(questionIds) };
    }
    
    const activity = await entities.Activity_Log.find(activityFilter);
    
    const attempts = activity.length;
    const correct = activity.filter(a => a.is_correct === true).length;
    const successRate = attempts > 0 ? (correct / attempts) * 100 : 0;
    
    // Get unique questions answered
    const questionsAnswered = new Set(activity.map(a => a.question_id)).size;
    
    // Get last activity date
    const lastActivity = activity.length > 0
      ? activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].timestamp
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
      streak: trainee.current_streak || 0
    });
  }
  
  return traineeStats.sort((a, b) => b.attempts - a.attempts);
}

/**
 * Get problematic questions (low success rate)
 */
export async function getProblematicQuestions(threshold = 60, minAttempts = 10) {
  const questions = await entities.Question_Bank.find({
    status: 'active',
    total_attempts: { $gte: minAttempts },
    success_rate: { $lt: threshold }
  }, {
    sort: { success_rate: 1 }
  });
  
  const enrichedQuestions = [];
  
  for (const question of questions) {
    const hierarchy = await entities.Content_Hierarchy.findOne({
      id: question.hierarchy_id
    });
    
    enrichedQuestions.push({
      ...question,
      hierarchy: hierarchy ? {
        category: hierarchy.category_name,
        topic: hierarchy.topic_name
      } : null
    });
  }
  
  return enrichedQuestions;
}
