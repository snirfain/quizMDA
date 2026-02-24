/**
 * Activity_Log Entity
 * Tracks every single answer by every user
 * Drives the adaptive algorithm
 * Hebrew: יומן פעילות
 */

export const Activity_Log = {
  name: 'Activity_Log',
  displayName: 'יומן פעילות',
  fields: {
    log_id: {
      type: 'id',
      required: true,
      primaryKey: true
    },
    user_id: {
      type: 'reference',
      referenceTo: 'Users',
      required: true,
      displayName: 'משתמש',
      description: 'קישור למשתמש'
    },
    question_id: {
      type: 'reference',
      referenceTo: 'Question_Bank',
      required: true,
      displayName: 'שאלה',
      description: 'קישור לשאלה'
    },
    timestamp: {
      type: 'datetime',
      required: true,
      displayName: 'תאריך ושעה',
      defaultValue: 'now'
    },
    user_answer: {
      type: 'text',
      required: true,
      displayName: 'תשובת המשתמש',
      description: 'מה שהמשתמש ענה בפועל'
    },
    is_correct: {
      type: 'boolean',
      required: true,
      displayName: 'תשובה נכונה',
      description: 'אמת/שקר'
    },
    bot_feedback: {
      type: 'text',
      required: false,
      displayName: 'משוב בוט',
      description: 'תגובה מ-API חיצוני (לשאלות פתוחות)'
    },
    self_assessment: {
      type: 'boolean',
      required: false,
      displayName: 'הבנתי',
      description: 'הערכה עצמית של המשתמש (לשאלות פתוחות)'
    },
    time_spent: {
      type: 'number',
      required: false,
      displayName: 'זמן שהושקע (שניות)',
      description: 'כמה זמן לקח למשתמש לענות על השאלה',
      min: 0,
      defaultValue: 0
    },
    last_attempt_date: {
      type: 'datetime',
      required: false,
      displayName: 'תאריך ניסיון אחרון',
      description: 'תאריך הניסיון האחרון לשאלה זו על ידי משתמש זה',
      defaultValue: 'now'
    }
  },
  indexes: [
    { fields: ['user_id'] },
    { fields: ['question_id'] },
    { fields: ['user_id', 'question_id'] },
    { fields: ['user_id', 'is_correct'] },
    { fields: ['timestamp'] },
    { fields: ['last_attempt_date'] },
    { fields: ['user_id', 'last_attempt_date'] }
  ],
  permissions: {
    read: ['authenticated'],
    create: ['authenticated'],
    update: ['admin'],
    delete: ['admin']
  }
};
