/**
 * Study_Plan_Enrollments Entity
 * Tracks user enrollments in study plans
 * Hebrew: הרשמות לתוכניות לימוד
 */

export const Study_Plan_Enrollments = {
  name: 'Study_Plan_Enrollments',
  displayName: 'הרשמות לתוכניות לימוד',
  fields: {
    enrollment_id: {
      type: 'id',
      required: true,
      primaryKey: true
    },
    user_id: {
      type: 'reference',
      referenceTo: 'Users',
      required: true,
      displayName: 'משתמש',
      description: 'המשתמש שנרשם'
    },
    plan_id: {
      type: 'reference',
      referenceTo: 'Study_Plans',
      required: true,
      displayName: 'תוכנית לימוד',
      description: 'התוכנית שנרשם אליה'
    },
    enrolled_at: {
      type: 'datetime',
      required: true,
      displayName: 'תאריך הרשמה',
      defaultValue: 'now'
    },
    progress: {
      type: 'number',
      required: true,
      displayName: 'התקדמות (%)',
      description: 'אחוז השלמה של התוכנית',
      min: 0,
      max: 100,
      defaultValue: 0
    },
    completed_at: {
      type: 'datetime',
      required: false,
      displayName: 'תאריך השלמה',
      description: 'מתי הושלמה התוכנית'
    },
    last_activity: {
      type: 'datetime',
      required: false,
      displayName: 'פעילות אחרונה',
      description: 'מתי הייתה הפעילות האחרונה בתוכנית'
    }
  },
  indexes: [
    { fields: ['user_id'] },
    { fields: ['plan_id'] },
    { fields: ['user_id', 'plan_id'] },
    { fields: ['progress'] }
  ],
  permissions: {
    read: ['authenticated'],
    create: ['authenticated'],
    update: ['authenticated', 'admin'],
    delete: ['admin']
  }
};
