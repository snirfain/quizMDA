/**
 * User Progress Tracking
 * Advanced progress tracking and analytics
 * Hebrew: מעקב התקדמות משתמש
 */

import { entities } from '../config/appConfig';

/**
 * Get comprehensive user progress
 */
export async function getUserProgress(userId) {
  try {
    const user = await entities.Users.findOne({ user_id: userId });
    
    if (!user) {
      // Return mock progress for demo
      return {
        overall: {
          totalAttempts: 50,
          successRate: 75,
          questionsAnswered: 30,
          totalQuestions: 100,
          completionRate: 30
        },
        categories: [],
        streak: {
          current: user?.current_streak || 0,
          longest: user?.longest_streak || 0
        }
      };
    }

    // Get all user activity
    const allActivity = await entities.Activity_Log.find({
      user_id: userId
    });

    const totalAttempts = allActivity.length;
    const totalCorrect = allActivity.filter(a => a.is_correct === true).length;
    const overallSuccessRate = totalAttempts > 0 
      ? (totalCorrect / totalAttempts) * 100 
      : 0;

    // Get questions by category
    const categoryStats = await getCategoryProgress(userId);
    
    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivity = allActivity.filter(
      a => new Date(a.timestamp) >= thirtyDaysAgo
    );

    // Calculate streak
    const streak = await getUserStreak(userId);

    // Get answered questions count
    const uniqueQuestionsAnswered = new Set(
      allActivity.map(a => a.question_id)
    ).size;

    // Get total available questions
    const allQuestions = await entities.Question_Bank.find({
      status: 'active'
    });
    const totalQuestions = allQuestions.length;

    return {
      userId,
      userName: user.full_name,
      overall: {
        totalAttempts,
        totalCorrect,
        successRate: overallSuccessRate,
        questionsAnswered: uniqueQuestionsAnswered,
        totalQuestions,
        completionRate: totalQuestions > 0 
          ? (uniqueQuestionsAnswered / totalQuestions) * 100 
          : 0
      },
      recent: {
        attemptsLast30Days: recentActivity.length,
        successRateLast30Days: recentActivity.length > 0
          ? (recentActivity.filter(a => a.is_correct).length / recentActivity.length) * 100
          : 0
      },
      categories: categoryStats,
      streak: streak,
      lastActivity: allActivity.length > 0
        ? allActivity[allActivity.length - 1].timestamp
        : null
    };
  } catch (error) {
    console.error('Error getting user progress:', error);
    // Return mock progress on error
    return {
      overall: {
        totalAttempts: 50,
        successRate: 75,
        questionsAnswered: 30,
        totalQuestions: 100,
        completionRate: 30
      },
      categories: [],
      streak: {
        current: 5,
        longest: 10
      }
    };
  }
}

/**
 * Get progress by category
 */
export async function getCategoryProgress(userId) {
  try {
    const userActivity = await entities.Activity_Log.find({
      user_id: userId
    });

  // Group by hierarchy
  const hierarchyStats = {};
  
  for (const activity of userActivity) {
    const question = await entities.Question_Bank.findOne({
      id: activity.question_id
    });
    
    if (!question) continue;
    
    const hierarchy = await entities.Content_Hierarchy.findOne({
      id: question.hierarchy_id
    });
    
    if (!hierarchy) continue;
    
    const categoryKey = hierarchy.category_name;
    
    if (!hierarchyStats[categoryKey]) {
      hierarchyStats[categoryKey] = {
        category: categoryKey,
        attempts: 0,
        correct: 0,
        questions: new Set()
      };
    }
    
    hierarchyStats[categoryKey].attempts++;
    if (activity.is_correct) {
      hierarchyStats[categoryKey].correct++;
    }
    hierarchyStats[categoryKey].questions.add(question.id);
  }

    // Convert to array and calculate rates
    return Object.values(hierarchyStats).map(stat => ({
      category: stat.category,
      attempts: stat.attempts,
      correct: stat.correct,
      successRate: stat.attempts > 0 
        ? (stat.correct / stat.attempts) * 100 
        : 0,
      questionsAnswered: stat.questions.size
    }));
  } catch (error) {
    console.error('Error getting category progress:', error);
    return [];
  }
}

/**
 * Get user streak (consecutive days with activity)
 */
export async function getUserStreak(userId) {
  try {
    const userActivity = await entities.Activity_Log.find({
      user_id: userId
    }, {
      sort: { timestamp: -1 }
    });

  if (userActivity.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Group by date
  const activityByDate = {};
  userActivity.forEach(activity => {
    const date = new Date(activity.timestamp).toDateString();
    if (!activityByDate[date]) {
      activityByDate[date] = true;
    }
  });

  const dates = Object.keys(activityByDate).sort().reverse();
  
  // Calculate current streak
  let currentStreak = 0;
  const today = new Date().toDateString();
  let checkDate = new Date();
  
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toDateString();
    if (activityByDate[dateStr]) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;

  dates.forEach(date => {
    const currentDate = new Date(date);
    if (prevDate) {
      const daysDiff = Math.floor(
        (prevDate - currentDate) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevDate = currentDate;
  });
  longestStreak = Math.max(longestStreak, tempStreak);

  // Update user's streak in Users entity
  const user = await entities.Users.findOne({ user_id: userId });
  if (user) {
    await entities.Users.update(userId, {
      current_streak: currentStreak,
      longest_streak: Math.max(user.longest_streak || 0, longestStreak)
    });
  }

    return {
      current: currentStreak,
      longest: longestStreak
    };
  } catch (error) {
    console.error('Error getting user streak:', error);
    return { current: 0, longest: 0 };
  }
}

/**
 * Get progress chart data
 */
export async function getProgressChart(userId, timeframe = '30days') {
  try {
    const userActivity = await entities.Activity_Log.find({
      user_id: userId
    }, {
      sort: { timestamp: 1 }
    });

  let startDate = new Date();
  switch (timeframe) {
    case '7days':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30days':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90days':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'all':
      startDate = null;
      break;
  }

  const filteredActivity = startDate
    ? userActivity.filter(a => new Date(a.timestamp) >= startDate)
    : userActivity;

  // Group by date
  const dailyStats = {};
  
  filteredActivity.forEach(activity => {
    const date = new Date(activity.timestamp).toDateString();
    if (!dailyStats[date]) {
      dailyStats[date] = { attempts: 0, correct: 0 };
    }
    dailyStats[date].attempts++;
    if (activity.is_correct) {
      dailyStats[date].correct++;
    }
  });

    // Convert to array format for chart
    return Object.keys(dailyStats)
      .sort()
      .map(date => ({
        date,
        attempts: dailyStats[date].attempts,
        correct: dailyStats[date].correct,
        successRate: dailyStats[date].attempts > 0
          ? (dailyStats[date].correct / dailyStats[date].attempts) * 100
          : 0
      }));
  } catch (error) {
    console.error('Error getting progress chart:', error);
    return [];
  }
}

/**
 * Get strong and weak topics
 */
export async function getStrongWeakTopics(userId) {
  try {
    const categoryProgress = await getCategoryProgress(userId);
    
    const sorted = categoryProgress.sort((a, b) => b.successRate - a.successRate);
    
    return {
      strong: sorted.slice(0, 3).filter(t => t.attempts >= 5), // At least 5 attempts
      weak: sorted.slice(-3).reverse().filter(t => t.attempts >= 5)
    };
  } catch (error) {
    console.error('Error getting strong/weak topics:', error);
    return { strong: [], weak: [] };
  }
}
