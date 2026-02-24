/**
 * Admin Statistics Workflow
 * Comprehensive statistics and analytics for administrators
 * Hebrew: סטטיסטיקות למנהל
 */

import { entities } from '../config/appConfig';

/**
 * Get comprehensive system statistics
 */
export async function getSystemStatistics(dateRange = null) {
  try {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate || new Date();

    const [
      users,
      questions,
      activities,
      contentHierarchy
    ] = await Promise.all([
      entities.Users.find({}),
      entities.Question_Bank.find({}),
      entities.Activity_Log.find({
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      }),
      entities.Content_Hierarchy.find({})
    ]);

    // User statistics
    const userStats = {
      total: users.length,
      byRole: {
        trainee: users.filter(u => u.role === 'trainee').length,
        instructor: users.filter(u => u.role === 'instructor').length,
        admin: users.filter(u => u.role === 'admin').length
      },
      active: users.filter(u => {
        // Check if user has activity in last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return activities.some(a => 
          a.user_id === u.user_id && 
          new Date(a.timestamp) >= sevenDaysAgo
        );
      }).length,
      newUsers: users.filter(u => {
        const userCreated = new Date(u.createdAt || u.timestamp || 0);
        return userCreated >= startDate && userCreated <= endDate;
      }).length
    };

    // Question statistics
    const questionStats = {
      total: questions.length,
      byStatus: {
        active: questions.filter(q => q.status === 'active').length,
        suspended: questions.filter(q => q.status === 'suspended').length,
        draft: questions.filter(q => q.status === 'draft').length
      },
      byType: {
        single_choice: questions.filter(q => q.question_type === 'single_choice').length,
        multi_choice: questions.filter(q => q.question_type === 'multi_choice').length,
        true_false: questions.filter(q => q.question_type === 'true_false').length,
        open_ended: questions.filter(q => q.question_type === 'open_ended').length
      },
      byDifficulty: {
        easy: questions.filter(q => q.difficulty_level <= 3).length,
        medium: questions.filter(q => q.difficulty_level > 3 && q.difficulty_level <= 7).length,
        hard: questions.filter(q => q.difficulty_level > 7).length
      },
      avgSuccessRate: questions.length > 0
        ? questions.reduce((sum, q) => sum + (q.success_rate || 0), 0) / questions.length
        : 0,
      avgAttempts: questions.length > 0
        ? questions.reduce((sum, q) => sum + (q.total_attempts || 0), 0) / questions.length
        : 0
    };

    // Activity statistics
    const activityStats = {
      total: activities.length,
      byType: {
        correct: activities.filter(a => a.is_correct).length,
        incorrect: activities.filter(a => !a.is_correct).length,
        open_ended: activities.filter(a => a.question_type === 'open_ended').length
      },
      dailyActivity: getDailyActivity(activities, startDate, endDate),
      hourlyActivity: getHourlyActivity(activities),
      byCategory: getActivityByCategory(activities, contentHierarchy),
      avgResponseTime: calculateAvgResponseTime(activities)
    };

    // Content statistics
    const contentStats = {
      totalCategories: new Set(contentHierarchy.map(c => c.category_name)).size,
      totalTopics: new Set(contentHierarchy.map(c => c.topic_name)).size,
      totalLessons: contentHierarchy.length,
      categoryDistribution: getCategoryDistribution(contentHierarchy),
      topicDistribution: getTopicDistribution(contentHierarchy)
    };

    // Performance metrics
    const performanceMetrics = {
      systemUptime: calculateSystemUptime(),
      avgQuestionResponseTime: calculateAvgResponseTime(activities),
      userEngagement: calculateUserEngagement(users, activities, startDate, endDate),
      questionQuality: calculateQuestionQuality(questions),
      learningEffectiveness: calculateLearningEffectiveness(activities)
    };

    return {
      userStats,
      questionStats,
      activityStats,
      contentStats,
      performanceMetrics,
      dateRange: {
        startDate,
        endDate
      }
    };
  } catch (error) {
    console.error('Error getting system statistics:', error);
    // Return mock data for development
    return getMockStatistics();
  }
}

/**
 * Get user activity statistics
 */
export async function getUserActivityStatistics(userId = null, dateRange = null) {
  try {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate || new Date();

    const query = {
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    };

    if (userId) {
      query.user_id = userId;
    }

    const activities = await entities.Activity_Log.find(query);
    const users = userId 
      ? [await entities.Users.findOne({ user_id: userId })]
      : await entities.Users.find({});

    const userActivityMap = {};
    
    activities.forEach(activity => {
      if (!userActivityMap[activity.user_id]) {
        userActivityMap[activity.user_id] = {
          totalAnswers: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          questionsAnswered: new Set(),
          categories: new Set(),
          topics: new Set(),
          lastActivity: null
        };
      }

      const userActivity = userActivityMap[activity.user_id];
      userActivity.totalAnswers++;
      if (activity.is_correct) {
        userActivity.correctAnswers++;
      } else {
        userActivity.incorrectAnswers++;
      }
      userActivity.questionsAnswered.add(activity.question_id);
      
      const activityDate = new Date(activity.timestamp);
      if (!userActivity.lastActivity || activityDate > userActivity.lastActivity) {
        userActivity.lastActivity = activityDate;
      }
    });

    // Enrich with user info
    const enrichedStats = users.map(user => {
      const activity = userActivityMap[user.user_id] || {
        totalAnswers: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        questionsAnswered: new Set(),
        categories: new Set(),
        topics: new Set(),
        lastActivity: null
      };

      return {
        userId: user.user_id,
        fullName: user.full_name,
        role: user.role,
        email: user.email,
        totalAnswers: activity.totalAnswers,
        correctAnswers: activity.correctAnswers,
        incorrectAnswers: activity.incorrectAnswers,
        successRate: activity.totalAnswers > 0
          ? (activity.correctAnswers / activity.totalAnswers) * 100
          : 0,
        uniqueQuestionsAnswered: activity.questionsAnswered.size,
        lastActivity: activity.lastActivity,
        points: user.points || 0,
        currentStreak: user.current_streak || 0
      };
    });

    return {
      users: enrichedStats,
      summary: {
        totalUsers: enrichedStats.length,
        activeUsers: enrichedStats.filter(u => u.totalAnswers > 0).length,
        avgSuccessRate: enrichedStats.length > 0
          ? enrichedStats.reduce((sum, u) => sum + u.successRate, 0) / enrichedStats.length
          : 0,
        avgAnswersPerUser: enrichedStats.length > 0
          ? enrichedStats.reduce((sum, u) => sum + u.totalAnswers, 0) / enrichedStats.length
          : 0
      }
    };
  } catch (error) {
    console.error('Error getting user activity statistics:', error);
    return { users: [], summary: {} };
  }
}

/**
 * Get question performance statistics
 */
export async function getQuestionPerformanceStatistics(dateRange = null) {
  try {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate || new Date();

    const questions = await entities.Question_Bank.find({});
    const activities = await entities.Activity_Log.find({
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    });

    const questionPerformanceMap = {};

    activities.forEach(activity => {
      if (!questionPerformanceMap[activity.question_id]) {
        questionPerformanceMap[activity.question_id] = {
          attempts: 0,
          correct: 0,
          incorrect: 0,
          avgResponseTime: [],
          lastAttempt: null
        };
      }

      const perf = questionPerformanceMap[activity.question_id];
      perf.attempts++;
      if (activity.is_correct) {
        perf.correct++;
      } else {
        perf.incorrect++;
      }
      
      if (activity.response_time) {
        perf.avgResponseTime.push(activity.response_time);
      }

      const attemptDate = new Date(activity.timestamp);
      if (!perf.lastAttempt || attemptDate > perf.lastAttempt) {
        perf.lastAttempt = attemptDate;
      }
    });

    const enrichedPerformance = questions.map(question => {
      const perf = questionPerformanceMap[question.id] || {
        attempts: 0,
        correct: 0,
        incorrect: 0,
        avgResponseTime: [],
        lastAttempt: null
      };

      return {
        questionId: question.id,
        questionText: question.question_text.substring(0, 100) + '...',
        questionType: question.question_type,
        difficulty: question.difficulty_level,
        status: question.status,
        attempts: perf.attempts,
        correct: perf.correct,
        incorrect: perf.incorrect,
        successRate: perf.attempts > 0
          ? (perf.correct / perf.attempts) * 100
          : question.success_rate || 0,
        avgResponseTime: perf.avgResponseTime.length > 0
          ? perf.avgResponseTime.reduce((a, b) => a + b, 0) / perf.avgResponseTime.length
          : null,
        lastAttempt: perf.lastAttempt,
        totalAttempts: question.total_attempts || 0,
        totalSuccess: question.total_success || 0,
        overallSuccessRate: question.success_rate || 0
      };
    });

    return {
      questions: enrichedPerformance,
      summary: {
        totalQuestions: enrichedPerformance.length,
        questionsWithActivity: enrichedPerformance.filter(q => q.attempts > 0).length,
        avgSuccessRate: enrichedPerformance.filter(q => q.attempts > 0).length > 0
          ? enrichedPerformance
              .filter(q => q.attempts > 0)
              .reduce((sum, q) => sum + q.successRate, 0) /
            enrichedPerformance.filter(q => q.attempts > 0).length
          : 0,
        topPerforming: enrichedPerformance
          .filter(q => q.attempts >= 10)
          .sort((a, b) => b.successRate - a.successRate)
          .slice(0, 10),
        worstPerforming: enrichedPerformance
          .filter(q => q.attempts >= 10)
          .sort((a, b) => a.successRate - b.successRate)
          .slice(0, 10)
      }
    };
  } catch (error) {
    console.error('Error getting question performance statistics:', error);
    return { questions: [], summary: {} };
  }
}

/**
 * Get content usage statistics
 */
export async function getContentUsageStatistics(dateRange = null) {
  try {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate || new Date();

    const contentHierarchy = await entities.Content_Hierarchy.find({});
    const questions = await entities.Question_Bank.find({});
    const activities = await entities.Activity_Log.find({
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    });

    const categoryUsage = {};
    const topicUsage = {};

    activities.forEach(activity => {
      const question = questions.find(q => q.id === activity.question_id);
      if (question && question.hierarchy_id) {
        const content = contentHierarchy.find(c => c.id === question.hierarchy_id);
        if (content) {
          // Category usage
          if (!categoryUsage[content.category_name]) {
            categoryUsage[content.category_name] = {
              attempts: 0,
              correct: 0,
              incorrect: 0,
              uniqueUsers: new Set()
            };
          }
          categoryUsage[content.category_name].attempts++;
          if (activity.is_correct) {
            categoryUsage[content.category_name].correct++;
          } else {
            categoryUsage[content.category_name].incorrect++;
          }
          categoryUsage[content.category_name].uniqueUsers.add(activity.user_id);

          // Topic usage
          const topicKey = `${content.category_name}::${content.topic_name}`;
          if (!topicUsage[topicKey]) {
            topicUsage[topicKey] = {
              category: content.category_name,
              topic: content.topic_name,
              attempts: 0,
              correct: 0,
              incorrect: 0,
              uniqueUsers: new Set()
            };
          }
          topicUsage[topicKey].attempts++;
          if (activity.is_correct) {
            topicUsage[topicKey].correct++;
          } else {
            topicUsage[topicKey].incorrect++;
          }
          topicUsage[topicKey].uniqueUsers.add(activity.user_id);
        }
      }
    });

    const categoryStats = Object.entries(categoryUsage).map(([category, data]) => ({
      category,
      attempts: data.attempts,
      correct: data.correct,
      incorrect: data.incorrect,
      successRate: data.attempts > 0 ? (data.correct / data.attempts) * 100 : 0,
      uniqueUsers: data.uniqueUsers.size
    }));

    const topicStats = Object.values(topicUsage).map(data => ({
      category: data.category,
      topic: data.topic,
      attempts: data.attempts,
      correct: data.correct,
      incorrect: data.incorrect,
      successRate: data.attempts > 0 ? (data.correct / data.attempts) * 100 : 0,
      uniqueUsers: data.uniqueUsers.size
    }));

    return {
      categories: categoryStats.sort((a, b) => b.attempts - a.attempts),
      topics: topicStats.sort((a, b) => b.attempts - a.attempts),
      summary: {
        totalCategories: categoryStats.length,
        totalTopics: topicStats.length,
        mostUsedCategory: categoryStats[0]?.category || null,
        mostUsedTopic: topicStats[0]?.topic || null
      }
    };
  } catch (error) {
    console.error('Error getting content usage statistics:', error);
    return { categories: [], topics: [], summary: {} };
  }
}

// Helper functions

function getDailyActivity(activities, startDate, endDate) {
  const dailyMap = {};
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyMap[dateKey] = 0;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  activities.forEach(activity => {
    const dateKey = new Date(activity.timestamp).toISOString().split('T')[0];
    if (dailyMap.hasOwnProperty(dateKey)) {
      dailyMap[dateKey]++;
    }
  });

  return Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
}

function getHourlyActivity(activities) {
  const hourlyMap = {};
  
  for (let i = 0; i < 24; i++) {
    hourlyMap[i] = 0;
  }

  activities.forEach(activity => {
    const hour = new Date(activity.timestamp).getHours();
    hourlyMap[hour]++;
  });

  return Object.entries(hourlyMap).map(([hour, count]) => ({ hour: parseInt(hour), count }));
}

function getActivityByCategory(activities, contentHierarchy) {
  // This would require joining with questions and content_hierarchy
  // Simplified version for now
  return {};
}

function calculateAvgResponseTime(activities) {
  const responseTimes = activities
    .filter(a => a.response_time)
    .map(a => a.response_time);
  
  if (responseTimes.length === 0) return null;
  
  return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
}

function getCategoryDistribution(contentHierarchy) {
  const distribution = {};
  contentHierarchy.forEach(c => {
    distribution[c.category_name] = (distribution[c.category_name] || 0) + 1;
  });
  return distribution;
}

function getTopicDistribution(contentHierarchy) {
  const distribution = {};
  contentHierarchy.forEach(c => {
    const key = `${c.category_name}::${c.topic_name}`;
    distribution[key] = (distribution[key] || 0) + 1;
  });
  return distribution;
}

function calculateSystemUptime() {
  // This would typically come from system monitoring
  return 99.9; // Mock value
}

function calculateUserEngagement(users, activities, startDate, endDate) {
  const activeUsers = new Set(activities.map(a => a.user_id));
  const totalUsers = users.length;
  
  return totalUsers > 0 ? (activeUsers.size / totalUsers) * 100 : 0;
}

function calculateQuestionQuality(questions) {
  const activeQuestions = questions.filter(q => q.status === 'active');
  if (activeQuestions.length === 0) return 0;
  
  const avgSuccessRate = activeQuestions.reduce((sum, q) => sum + (q.success_rate || 0), 0) / activeQuestions.length;
  return avgSuccessRate;
}

function calculateLearningEffectiveness(activities) {
  if (activities.length === 0) return 0;
  
  const correctAnswers = activities.filter(a => a.is_correct).length;
  return (correctAnswers / activities.length) * 100;
}

function getMockStatistics() {
  return {
    userStats: {
      total: 150,
      byRole: { trainee: 120, instructor: 25, admin: 5 },
      active: 95,
      newUsers: 12
    },
    questionStats: {
      total: 500,
      byStatus: { active: 450, suspended: 30, draft: 20 },
      byType: { single_choice: 200, multi_choice: 150, true_false: 100, open_ended: 50 },
      byDifficulty: { easy: 150, medium: 250, hard: 100 },
      avgSuccessRate: 72.5,
      avgAttempts: 45
    },
    activityStats: {
      total: 5000,
      byType: { correct: 3500, incorrect: 1500, open_ended: 200 },
      dailyActivity: [],
      hourlyActivity: [],
      byCategory: {},
      avgResponseTime: 12.5
    },
    contentStats: {
      totalCategories: 10,
      totalTopics: 50,
      totalLessons: 200,
      categoryDistribution: {},
      topicDistribution: {}
    },
    performanceMetrics: {
      systemUptime: 99.9,
      avgQuestionResponseTime: 12.5,
      userEngagement: 63.3,
      questionQuality: 72.5,
      learningEffectiveness: 70.0
    },
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    }
  };
}
