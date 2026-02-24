/**
 * Gamification System
 * Achievements, points, and leaderboard
 * Hebrew: מערכת גיימיפיקציה
 */

import { entities } from '../config/appConfig';

/**
 * Check and award achievements for a user
 */
export async function checkAchievements(userId, action) {
  const achievements = [];
  
  // Get user's current achievements
  const existingAchievements = await entities.Achievements.find({
    user_id: userId
  });
  const existingTypes = new Set(existingAchievements.map(a => a.achievement_type));
  
  // Get user activity
  const userActivity = await entities.Activity_Log.find({
    user_id: userId
  });
  
  const user = await entities.Users.findOne({ user_id: userId });
  if (!user) return achievements;
  
  // Check streak achievements
  const currentStreak = user.current_streak || 0;
  if (currentStreak >= 10 && !existingTypes.has('streak_10')) {
    achievements.push(await awardAchievement(userId, 'streak_10', 50));
  }
  if (currentStreak >= 30 && !existingTypes.has('streak_30')) {
    achievements.push(await awardAchievement(userId, 'streak_30', 200));
  }
  
  // Check question count achievements
  const totalQuestionsAnswered = new Set(userActivity.map(a => a.question_id)).size;
  if (totalQuestionsAnswered >= 100 && !existingTypes.has('questions_100')) {
    achievements.push(await awardAchievement(userId, 'questions_100', 100));
  }
  if (totalQuestionsAnswered >= 500 && !existingTypes.has('questions_500')) {
    achievements.push(await awardAchievement(userId, 'questions_500', 500));
  }
  if (totalQuestionsAnswered >= 1000 && !existingTypes.has('questions_1000')) {
    achievements.push(await awardAchievement(userId, 'questions_1000', 1000));
  }
  
  // Check fast answer achievement (if action is answer submission)
  if (action && action.type === 'answer' && action.timeSpent && action.timeSpent <= 10 && action.isCorrect) {
    if (!existingTypes.has('fast_answer')) {
      achievements.push(await awardAchievement(userId, 'fast_answer', 25));
    }
  }
  
  // Check perfect session (if action is session completion)
  if (action && action.type === 'session_complete' && action.correctCount === action.totalCount && action.totalCount >= 10) {
    if (!existingTypes.has('perfect_session')) {
      achievements.push(await awardAchievement(userId, 'perfect_session', 100));
    }
  }
  
  // Check expert topic achievements (by category)
  const categoryStats = {};
  userActivity.forEach(activity => {
    if (activity.is_correct) {
      // This would need to be enriched with category info
      // For now, we'll skip this check as it requires additional queries
    }
  });
  
  return achievements;
}

/**
 * Award an achievement to a user
 */
export async function awardAchievement(userId, achievementType, points = 0, metadata = null) {
  // Check if already awarded
  const existing = await entities.Achievements.findOne({
    user_id: userId,
    achievement_type: achievementType
  });
  
  if (existing) {
    return existing;
  }
  
  // Create achievement
  const achievement = await entities.Achievements.create({
    user_id: userId,
    achievement_type: achievementType,
    earned_date: new Date(),
    points_awarded: points,
    metadata: metadata ? JSON.stringify(metadata) : null
  });
  
  // Add points to user
  if (points > 0) {
    const user = await entities.Users.findOne({ user_id: userId });
    if (user) {
      await entities.Users.update(userId, {
        points: (user.points || 0) + points
      });
    }
  }
  
  return achievement;
}

/**
 * Get user points
 */
export async function getUserPoints(userId) {
  try {
    const user = await entities.Users.findOne({ user_id: userId });
    if (!user) return 0;
    
    return user.points || 0;
  } catch (error) {
    console.error('Error getting user points:', error);
    return 0;
  }
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(timeframe = 'all', limit = 100) {
  try {
    let startDate = null;
    
    if (timeframe === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === 'month') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // Get all users with points
    const users = await entities.Users.find({
      role: 'trainee'
    }, {
      sort: { points: -1 },
      limit: limit
    });
  
  // Enrich with recent activity if timeframe is specified
  const leaderboard = [];
  for (const user of users) {
    let recentPoints = 0;
    
    if (startDate) {
      // Calculate points from recent achievements
      const recentAchievements = await entities.Achievements.find({
        user_id: user.user_id,
        earned_date: { $gte: startDate }
      });
      recentPoints = recentAchievements.reduce((sum, a) => sum + (a.points_awarded || 0), 0);
    }
    
    leaderboard.push({
      userId: user.user_id,
      name: user.full_name,
      totalPoints: user.points || 0,
      recentPoints: recentPoints,
      streak: user.current_streak || 0
    });
  }
  
  // Sort by recent points if timeframe is specified, otherwise by total points
  if (startDate) {
    leaderboard.sort((a, b) => b.recentPoints - a.recentPoints);
  } else {
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
  }
  
    return leaderboard.slice(0, limit);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

/**
 * Get user badges/achievements
 */
export async function getUserBadges(userId) {
  try {
    const achievements = await entities.Achievements.find({
      user_id: userId
    }, {
      sort: { earned_date: -1 }
    });
    
    return achievements.map(a => ({
      type: a.achievement_type,
      earnedDate: a.earned_date,
      points: a.points_awarded,
      metadata: a.metadata ? JSON.parse(a.metadata) : null
    }));
  } catch (error) {
    console.error('Error getting user badges:', error);
    return [];
  }
}

/**
 * Get achievement label in Hebrew
 */
export function getAchievementLabel(type) {
  const labels = {
    streak_10: '10 ימים ברצף',
    streak_30: '30 ימים ברצף',
    questions_100: '100 שאלות נענו',
    questions_500: '500 שאלות נענו',
    questions_1000: '1000 שאלות נענו',
    expert_topic: 'מומחה בנושא',
    fast_answer: 'תשובה נכונה תוך 10 שניות',
    perfect_session: 'סשן מושלם',
    first_attempt: 'ניסיון ראשון מושלם'
  };
  return labels[type] || type;
}
