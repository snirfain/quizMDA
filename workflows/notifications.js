/**
 * Notifications Workflow
 * Send and manage notifications
 * Hebrew: מערכת התראות
 */

import { entities } from '../config/appConfig';

/**
 * Send a notification to a user
 */
export async function sendNotification(userId, type, title, message, actionUrl = null) {
  const notification = await entities.Notifications.create({
    user_id: userId,
    type,
    title,
    message,
    read: false,
    created_at: new Date(),
    action_url: actionUrl
  });

  return notification;
}

/**
 * Send daily reminder to users without activity
 */
export async function sendDailyReminder() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Get all trainees
  const trainees = await entities.Users.find({
    role: 'trainee'
  });

  const reminders = [];

  for (const trainee of trainees) {
    // Check last activity
    const lastActivity = await entities.Activity_Log.find({
      user_id: trainee.user_id
    }, {
      sort: { timestamp: -1 },
      limit: 1
    });

    const shouldRemind = lastActivity.length === 0 || 
      new Date(lastActivity[0].timestamp) < yesterday;

    if (shouldRemind) {
      const notification = await sendNotification(
        trainee.user_id,
        'reminder',
        'תזכורת יומית',
        'לא תרגלת היום! בואו נמשיך ללמוד 💪',
        '/practice'
      );
      reminders.push(notification);
    }
  }

  return reminders;
}

/**
 * Notify user about achievement
 */
export async function notifyAchievement(userId, achievementType) {
  const { getAchievementLabel } = await import('./gamification');
  const label = getAchievementLabel(achievementType);

  return await sendNotification(
    userId,
    'achievement',
    'הישג חדש! 🎉',
    `זכית בהישג: ${label}`,
    '/progress'
  );
}

/**
 * Notify instructor about question suspension
 */
export async function notifyInstructorSuspension(questionId, instructorIds) {
  const question = await entities.Question_Bank.findOne({ id: questionId });
  if (!question) return [];

  const notifications = [];

  for (const instructorId of instructorIds) {
    const notification = await sendNotification(
      instructorId,
      'suspension',
      'שאלה הושעתה',
      `השאלה "${question.question_text.substring(0, 50)}..." הושעתה בגלל אחוז הצלחה נמוך`,
      `/manager`
    );
    notifications.push(notification);
  }

  return notifications;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId, userId) {
  const notification = await entities.Notifications.findOne({
    notification_id: notificationId,
    user_id: userId
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  await entities.Notifications.update(notificationId, {
    read: true
  });

  return notification;
}

/**
 * Get user notifications
 */
export async function getUserNotifications(userId, unreadOnly = false) {
  const filter = { user_id: userId };
  if (unreadOnly) {
    filter.read = false;
  }

  const notifications = await entities.Notifications.find(filter, {
    sort: { created_at: -1 },
    limit: 50
  });

  return notifications;
}
