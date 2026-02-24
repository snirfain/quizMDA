/**
 * Notifications Entity
 * System notifications for users
 * Hebrew: התראות
 */

export const Notifications = {
  name: 'Notifications',
  displayName: 'התראות',
  fields: {
    notification_id: {
      type: 'id',
      required: true,
      primaryKey: true
    },
    user_id: {
      type: 'reference',
      referenceTo: 'Users',
      required: true,
      displayName: 'משתמש',
      description: 'המשתמש שמקבל את ההתראה'
    },
    type: {
      type: 'select',
      required: true,
      displayName: 'סוג התראה',
      options: [
        { value: 'achievement', label: 'הישג חדש' },
        { value: 'reminder', label: 'תזכורת' },
        { value: 'suspension', label: 'השעיית שאלה' },
        { value: 'system', label: 'מערכת' }
      ]
    },
    title: {
      type: 'text',
      required: true,
      displayName: 'כותרת'
    },
    message: {
      type: 'text',
      required: true,
      displayName: 'הודעה'
    },
    read: {
      type: 'boolean',
      required: true,
      displayName: 'נקרא',
      defaultValue: false
    },
    created_at: {
      type: 'datetime',
      required: true,
      displayName: 'תאריך יצירה',
      defaultValue: 'now'
    },
    action_url: {
      type: 'text',
      required: false,
      displayName: 'קישור פעולה',
      description: 'URL לפעולה (אופציונלי)'
    }
  },
  indexes: [
    { fields: ['user_id'] },
    { fields: ['read'] },
    { fields: ['created_at'] },
    { fields: ['user_id', 'read'] }
  ],
  permissions: {
    read: ['authenticated'],
    create: ['system', 'admin'],
    update: ['authenticated', 'admin'],
    delete: ['admin']
  }
};
