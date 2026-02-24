/**
 * Achievements Entity
 * Tracks user achievements and badges
 * Hebrew: הישגים
 */

export const Achievements = {
  name: 'Achievements',
  displayName: 'הישגים',
  fields: {
    achievement_id: {
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
    achievement_type: {
      type: 'select',
      required: true,
      displayName: 'סוג הישג',
      options: [
        { value: 'streak_10', label: '10 ימים ברצף' },
        { value: 'streak_30', label: '30 ימים ברצף' },
        { value: 'questions_100', label: '100 שאלות נענו' },
        { value: 'questions_500', label: '500 שאלות נענו' },
        { value: 'questions_1000', label: '1000 שאלות נענו' },
        { value: 'expert_topic', label: 'מומחה בנושא' },
        { value: 'fast_answer', label: 'תשובה נכונה תוך 10 שניות' },
        { value: 'perfect_session', label: 'סשן מושלם (10/10)' },
        { value: 'first_attempt', label: 'ניסיון ראשון מושלם' }
      ]
    },
    earned_date: {
      type: 'datetime',
      required: true,
      displayName: 'תאריך השגה',
      defaultValue: 'now'
    },
    points_awarded: {
      type: 'number',
      required: true,
      displayName: 'נקודות שהוענקו',
      defaultValue: 0,
      min: 0
    },
    metadata: {
      type: 'text',
      required: false,
      displayName: 'נתונים נוספים',
      description: 'JSON עם פרטים נוספים (למשל: שם הנושא למומחה)'
    }
  },
  indexes: [
    { fields: ['user_id'] },
    { fields: ['achievement_type'] },
    { fields: ['earned_date'] },
    { fields: ['user_id', 'achievement_type'] }
  ],
  permissions: {
    read: ['authenticated'],
    create: ['system'], // Created by system only
    update: ['admin'],
    delete: ['admin']
  }
};
