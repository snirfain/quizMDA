/**
 * Advanced Permissions System
 * Role-based access control (RBAC) with granular permissions
 * Hebrew: מערכת הרשאות מתקדמת
 */

// Permission definitions - granular permissions
export const permissions = {
  // Question permissions
  QUESTION_READ: 'question:read',
  QUESTION_CREATE: 'question:create',
  QUESTION_UPDATE: 'question:update',
  QUESTION_DELETE: 'question:delete',
  QUESTION_EXPORT: 'question:export',
  QUESTION_SUSPEND: 'question:suspend',
  QUESTION_REACTIVATE: 'question:reactivate',
  QUESTION_APPROVE: 'question:approve',
  QUESTION_REVIEW: 'question:review',
  
  // Content permissions
  CONTENT_READ: 'content:read',
  CONTENT_CREATE: 'content:create',
  CONTENT_UPDATE: 'content:update',
  CONTENT_DELETE: 'content:delete',
  CONTENT_PUBLISH: 'content:publish',
  
  // Activity permissions
  ACTIVITY_READ_OWN: 'activity:read:own',
  ACTIVITY_READ_ALL: 'activity:read:all',
  ACTIVITY_CREATE: 'activity:create',
  ACTIVITY_UPDATE: 'activity:update',
  ACTIVITY_DELETE: 'activity:delete',
  ACTIVITY_EXPORT: 'activity:export',
  
  // Progress permissions
  PROGRESS_READ_OWN: 'progress:read:own',
  PROGRESS_READ_ALL: 'progress:read:all',
  PROGRESS_EXPORT: 'progress:export',
  
  // Notes permissions
  NOTE_CREATE: 'note:create',
  NOTE_READ_OWN: 'note:read:own',
  NOTE_READ_ALL: 'note:read:all',
  NOTE_UPDATE_OWN: 'note:update:own',
  NOTE_UPDATE_ALL: 'note:update:all',
  NOTE_DELETE_OWN: 'note:delete:own',
  NOTE_DELETE_ALL: 'note:delete:all',
  
  // Study plan permissions
  PLAN_READ: 'plan:read',
  PLAN_CREATE: 'plan:create',
  PLAN_UPDATE: 'plan:update',
  PLAN_DELETE: 'plan:delete',
  PLAN_ENROLL: 'plan:enroll',
  PLAN_ASSIGN: 'plan:assign',
  PLAN_PUBLISH: 'plan:publish',
  
  // User permissions
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_UPDATE_OWN: 'user:update:own',
  USER_VIEW_PROFILE: 'user:view:profile',
  USER_CHANGE_ROLE: 'user:change:role',
  USER_MANAGE_PERMISSIONS: 'user:manage:permissions',
  
  // Analytics permissions
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',
  ANALYTICS_ADVANCED: 'analytics:advanced',
  
  // System permissions
  SYSTEM_SETTINGS: 'system:settings',
  AUDIT_LOG_VIEW: 'audit:view',
  AUDIT_LOG_EXPORT: 'audit:export',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  
  // Test permissions
  TEST_CREATE: 'test:create',
  TEST_VIEW: 'test:view',
  TEST_EDIT: 'test:edit',
  TEST_DELETE: 'test:delete',
  TEST_PUBLISH: 'test:publish',
  TEST_ASSIGN: 'test:assign',
  TEST_GRADE: 'test:grade',
  
  // Notification permissions
  NOTIFICATION_SEND: 'notification:send',
  NOTIFICATION_MANAGE: 'notification:manage',
  
  // Report permissions
  REPORT_VIEW: 'report:view',
  REPORT_CREATE: 'report:create',
  REPORT_EXPORT: 'report:export'
};

// Role permissions mapping - detailed permissions per role
const rolePermissions = {
  trainee: [
    permissions.QUESTION_READ,
    permissions.CONTENT_READ,
    permissions.ACTIVITY_READ_OWN,
    permissions.ACTIVITY_CREATE,
    permissions.PROGRESS_READ_OWN,
    permissions.NOTE_CREATE,
    permissions.NOTE_READ_OWN,
    permissions.NOTE_UPDATE_OWN,
    permissions.NOTE_DELETE_OWN,
    permissions.PLAN_READ,
    permissions.PLAN_ENROLL,
    permissions.USER_UPDATE_OWN,
    permissions.USER_VIEW_PROFILE,
    permissions.TEST_VIEW
  ],
  instructor: [
    // All trainee permissions
    permissions.QUESTION_READ,
    permissions.QUESTION_CREATE,
    permissions.QUESTION_UPDATE,
    permissions.QUESTION_EXPORT,
    permissions.QUESTION_REVIEW,
    permissions.CONTENT_READ,
    permissions.CONTENT_CREATE,
    permissions.CONTENT_UPDATE,
    permissions.ACTIVITY_READ_ALL,
    permissions.ACTIVITY_CREATE,
    permissions.ACTIVITY_EXPORT,
    permissions.PROGRESS_READ_ALL,
    permissions.PROGRESS_EXPORT,
    permissions.NOTE_CREATE,
    permissions.NOTE_READ_OWN,
    permissions.NOTE_READ_ALL,
    permissions.NOTE_UPDATE_OWN,
    permissions.NOTE_DELETE_OWN,
    permissions.PLAN_READ,
    permissions.PLAN_CREATE,
    permissions.PLAN_UPDATE,
    permissions.PLAN_ENROLL,
    permissions.PLAN_ASSIGN,
    permissions.PLAN_PUBLISH,
    permissions.ANALYTICS_VIEW,
    permissions.ANALYTICS_EXPORT,
    permissions.USER_UPDATE_OWN,
    permissions.USER_VIEW_PROFILE,
    permissions.TEST_CREATE,
    permissions.TEST_VIEW,
    permissions.TEST_EDIT,
    permissions.TEST_PUBLISH,
    permissions.TEST_ASSIGN,
    permissions.TEST_GRADE,
    permissions.REPORT_VIEW,
    permissions.REPORT_EXPORT
  ],
  admin: [
    // All permissions
    ...Object.values(permissions)
  ]
};

// Custom permission assignments (for fine-grained control)
// Format: { userId: [permission1, permission2, ...] }
const customPermissions = {};

/**
 * Check if user has permission
 */
export function hasPermission(userRole, permission, userId = null) {
  if (!userRole || !permission) return false;
  
  // Check custom permissions first
  if (userId && customPermissions[userId]) {
    if (customPermissions[userId].includes(permission)) {
      return true;
    }
  }
  
  // Check role permissions
  const userPerms = rolePermissions[userRole] || [];
  return userPerms.includes(permission);
}

/**
 * Check if user can perform action on resource
 */
export function canPerformAction(userRole, action, resource, isOwner = false, userId = null) {
  const permissionKey = `${resource}:${action}`;
  
  // Check for owner-specific permissions
  if (isOwner) {
    const ownerPermission = `${resource}:${action}:own`;
    if (hasPermission(userRole, ownerPermission, userId)) {
      return true;
    }
  }
  
  // Check general permission
  return hasPermission(userRole, permissionKey, userId) || 
         hasPermission(userRole, `${resource}:${action}:all`, userId);
}

/**
 * Get permissions for role
 */
export function getRolePermissions(role) {
  return rolePermissions[role] || [];
}

/**
 * Get custom permissions for user
 */
export function getCustomPermissions(userId) {
  return customPermissions[userId] || [];
}

/**
 * Set custom permissions for user
 */
export function setCustomPermissions(userId, permissionList) {
  if (!Array.isArray(permissionList)) {
    throw new Error('Permission list must be an array');
  }
  
  // Validate permissions
  const validPermissions = Object.values(permissions);
  const invalidPermissions = permissionList.filter(p => !validPermissions.includes(p));
  
  if (invalidPermissions.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
  }
  
  customPermissions[userId] = permissionList;
}

/**
 * Add custom permission to user
 */
export function addCustomPermission(userId, permission) {
  if (!Object.values(permissions).includes(permission)) {
    throw new Error(`Invalid permission: ${permission}`);
  }
  
  if (!customPermissions[userId]) {
    customPermissions[userId] = [];
  }
  
  if (!customPermissions[userId].includes(permission)) {
    customPermissions[userId].push(permission);
  }
}

/**
 * Remove custom permission from user
 */
export function removeCustomPermission(userId, permission) {
  if (customPermissions[userId]) {
    customPermissions[userId] = customPermissions[userId].filter(p => p !== permission);
    
    if (customPermissions[userId].length === 0) {
      delete customPermissions[userId];
    }
  }
}

/**
 * Get all permissions for user (role + custom)
 */
export function getUserPermissions(userRole, userId = null) {
  const rolePerms = getRolePermissions(userRole);
  const customPerms = userId ? getCustomPermissions(userId) : [];
  
  // Combine and deduplicate
  return [...new Set([...rolePerms, ...customPerms])];
}

/**
 * Check if user can access route
 */
export function canAccessRoute(userRole, route, userId = null) {
  if (route.public) return true;
  if (!userRole) return false;
  
  // Route-specific permission checks
  const routePermissions = {
    '/instructor': permissions.ANALYTICS_VIEW,
    '/instructor/questions': permissions.QUESTION_CREATE,
    '/instructor/analytics': permissions.ANALYTICS_VIEW,
    '/manager': permissions.SYSTEM_SETTINGS,
    '/admin': permissions.SYSTEM_SETTINGS,
    '/admin/statistics': permissions.ANALYTICS_ADVANCED,
    '/admin/users': permissions.USER_READ,
    '/admin/permissions': permissions.USER_MANAGE_PERMISSIONS,
    '/admin/audit': permissions.AUDIT_LOG_VIEW
  };
  
  const requiredPermission = routePermissions[route.path];
  if (requiredPermission) {
    return hasPermission(userRole, requiredPermission, userId);
  }
  
  return true; // Default allow if no specific permission
}

/**
 * Filter items by permissions
 */
export function filterByPermissions(items, userRole, permissionKey, userId = null) {
  return items.filter(item => {
    if (!item.permissions || !item.permissions[permissionKey]) {
      return true; // No permission requirement
    }
    return hasPermission(userRole, item.permissions[permissionKey], userId);
  });
}

/**
 * Check if user can access resource by ID (for resource-level permissions)
 */
export function canAccessResource(userRole, resourceType, resourceId, userId = null) {
  // This can be extended to check resource-specific permissions
  // For now, use general permissions
  return hasPermission(userRole, `${resourceType}:read`, userId);
}

/**
 * Get permission description (Hebrew)
 */
export function getPermissionDescription(permission) {
  const descriptions = {
    [permissions.QUESTION_READ]: 'צפייה בשאלות',
    [permissions.QUESTION_CREATE]: 'יצירת שאלות',
    [permissions.QUESTION_UPDATE]: 'עדכון שאלות',
    [permissions.QUESTION_DELETE]: 'מחיקת שאלות',
    [permissions.QUESTION_EXPORT]: 'ייצוא שאלות',
    [permissions.QUESTION_SUSPEND]: 'השעיית שאלות',
    [permissions.QUESTION_REACTIVATE]: 'הפעלת שאלות מחדש',
    [permissions.QUESTION_APPROVE]: 'אישור שאלות',
    [permissions.QUESTION_REVIEW]: 'סקירת שאלות',
    [permissions.CONTENT_READ]: 'צפייה בתוכן',
    [permissions.CONTENT_CREATE]: 'יצירת תוכן',
    [permissions.CONTENT_UPDATE]: 'עדכון תוכן',
    [permissions.CONTENT_DELETE]: 'מחיקת תוכן',
    [permissions.CONTENT_PUBLISH]: 'פרסום תוכן',
    [permissions.ACTIVITY_READ_OWN]: 'צפייה בפעילות עצמית',
    [permissions.ACTIVITY_READ_ALL]: 'צפייה בכל הפעילויות',
    [permissions.ACTIVITY_CREATE]: 'יצירת פעילות',
    [permissions.ACTIVITY_UPDATE]: 'עדכון פעילות',
    [permissions.ACTIVITY_DELETE]: 'מחיקת פעילות',
    [permissions.ACTIVITY_EXPORT]: 'ייצוא פעילות',
    [permissions.PROGRESS_READ_OWN]: 'צפייה בהתקדמות עצמית',
    [permissions.PROGRESS_READ_ALL]: 'צפייה בכל ההתקדמות',
    [permissions.PROGRESS_EXPORT]: 'ייצוא התקדמות',
    [permissions.NOTE_CREATE]: 'יצירת הערות',
    [permissions.NOTE_READ_OWN]: 'צפייה בהערות עצמיות',
    [permissions.NOTE_READ_ALL]: 'צפייה בכל ההערות',
    [permissions.NOTE_UPDATE_OWN]: 'עדכון הערות עצמיות',
    [permissions.NOTE_UPDATE_ALL]: 'עדכון כל ההערות',
    [permissions.NOTE_DELETE_OWN]: 'מחיקת הערות עצמיות',
    [permissions.NOTE_DELETE_ALL]: 'מחיקת כל ההערות',
    [permissions.PLAN_READ]: 'צפייה בתוכניות לימוד',
    [permissions.PLAN_CREATE]: 'יצירת תוכניות לימוד',
    [permissions.PLAN_UPDATE]: 'עדכון תוכניות לימוד',
    [permissions.PLAN_DELETE]: 'מחיקת תוכניות לימוד',
    [permissions.PLAN_ENROLL]: 'הרשמה לתוכניות לימוד',
    [permissions.PLAN_ASSIGN]: 'הקצאת תוכניות לימוד',
    [permissions.PLAN_PUBLISH]: 'פרסום תוכניות לימוד',
    [permissions.USER_READ]: 'צפייה במשתמשים',
    [permissions.USER_CREATE]: 'יצירת משתמשים',
    [permissions.USER_UPDATE]: 'עדכון משתמשים',
    [permissions.USER_DELETE]: 'מחיקת משתמשים',
    [permissions.USER_UPDATE_OWN]: 'עדכון פרופיל עצמי',
    [permissions.USER_VIEW_PROFILE]: 'צפייה בפרופילים',
    [permissions.USER_CHANGE_ROLE]: 'שינוי תפקידים',
    [permissions.USER_MANAGE_PERMISSIONS]: 'ניהול הרשאות',
    [permissions.ANALYTICS_VIEW]: 'צפייה באנליטיקה',
    [permissions.ANALYTICS_EXPORT]: 'ייצוא אנליטיקה',
    [permissions.ANALYTICS_ADVANCED]: 'אנליטיקה מתקדמת',
    [permissions.SYSTEM_SETTINGS]: 'הגדרות מערכת',
    [permissions.AUDIT_LOG_VIEW]: 'צפייה ביומן ביקורת',
    [permissions.AUDIT_LOG_EXPORT]: 'ייצוא יומן ביקורת',
    [permissions.SYSTEM_BACKUP]: 'גיבוי מערכת',
    [permissions.SYSTEM_RESTORE]: 'שחזור מערכת',
    [permissions.TEST_CREATE]: 'יצירת מבחנים',
    [permissions.TEST_VIEW]: 'צפייה במבחנים',
    [permissions.TEST_EDIT]: 'עריכת מבחנים',
    [permissions.TEST_DELETE]: 'מחיקת מבחנים',
    [permissions.TEST_PUBLISH]: 'פרסום מבחנים',
    [permissions.TEST_ASSIGN]: 'הקצאת מבחנים',
    [permissions.TEST_GRADE]: 'ציון מבחנים',
    [permissions.NOTIFICATION_SEND]: 'שליחת התראות',
    [permissions.NOTIFICATION_MANAGE]: 'ניהול התראות',
    [permissions.REPORT_VIEW]: 'צפייה בדוחות',
    [permissions.REPORT_CREATE]: 'יצירת דוחות',
    [permissions.REPORT_EXPORT]: 'ייצוא דוחות'
  };
  
  return descriptions[permission] || permission;
}
