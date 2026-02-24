/**
 * Router System
 * Central routing with role-based guards
 * Hebrew: מערכת ניתוב
 */

// Route definitions
export const routes = {
  home: {
    path: '/',
    component: 'HomePage',
    public: true,
    roles: []
  },
  login: {
    path: '/login',
    component: 'LoginPage',
    public: true,
    roles: []
  },
  practice: {
    path: '/practice',
    component: 'TraineeDashboard',
    public: false,
    roles: ['trainee', 'instructor', 'admin']
  },
  progress: {
    path: '/progress',
    component: 'UserProgressDashboard',
    public: false,
    roles: ['trainee', 'instructor', 'admin']
  },
  studyPlans: {
    path: '/study-plans',
    component: 'StudyPlanViewer',
    public: false,
    roles: ['trainee']
  },
  bookmarks: {
    path: '/bookmarks',
    component: 'BookmarksList',
    public: false,
    roles: ['trainee', 'instructor', 'admin']
  },
  mockExam: {
    path: '/mock-exam',
    component: 'MockExam',
    public: false,
    roles: ['trainee']
  },
  instructor: {
    path: '/instructor',
    component: 'InstructorDashboard',
    public: false,
    roles: ['instructor', 'admin']
  },
  instructorQuestions: {
    path: '/instructor/questions',
    component: 'QuestionManagement',
    public: false,
    roles: ['instructor', 'admin']
  },
  instructorStudyPlans: {
    path: '/instructor/study-plans',
    component: 'StudyPlanManager',
    public: false,
    roles: ['instructor', 'admin']
  },
  instructorAnalytics: {
    path: '/instructor/analytics',
    component: 'InstructorAnalytics',
    public: false,
    roles: ['instructor', 'admin']
  },
  mediaBankManager: {
    path: '/instructor/media-bank',
    component: 'MediaBankManager',
    public: false,
    roles: ['instructor', 'admin']
  },
  manager: {
    path: '/manager',
    component: 'ManagerDashboard',
    public: false,
    roles: ['admin']
  },
  dataImportExport: {
    path: '/admin/data-import-export',
    component: 'DataImportExport',
    public: false,
    roles: ['admin']
  },
  settings: {
    path: '/settings',
    component: 'SettingsPage',
    public: false,
    roles: ['trainee', 'instructor', 'admin']
  },
  profile: {
    path: '/profile',
    component: 'ProfilePage',
    public: false,
    roles: ['trainee', 'instructor', 'admin']
  },
  help: {
    path: '/help',
    component: 'HelpPage',
    public: true,
    roles: []
  },
  notFound: {
    path: '/404',
    component: 'NotFoundPage',
    public: true,
    roles: []
  },
  unauthorized: {
    path: '/unauthorized',
    component: 'UnauthorizedPage',
    public: true,
    roles: []
  }
};

/**
 * Get route by path
 */
export function getRouteByPath(path) {
  return Object.values(routes).find(route => route.path === path);
}

/**
 * Check if user has access to route
 */
export function canAccessRoute(userRole, route) {
  if (route.public) return true;
  if (!userRole) return false;
  return route.roles.length === 0 || route.roles.includes(userRole);
}

/**
 * Navigate to route
 */
export function navigateTo(path, options = {}) {
  const { replace = false, state = null } = options;
  
  if (typeof window !== 'undefined' && window.history) {
    if (replace) {
      window.history.replaceState(state, '', path);
    } else {
      window.history.pushState(state, '', path);
    }
    
    // Trigger popstate event for React Router compatibility
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  }
}

/**
 * Get current path
 */
export function getCurrentPath() {
  if (typeof window !== 'undefined') {
    return window.location.pathname;
  }
  return '/';
}

/**
 * Get navigation items for user role
 */
export function getNavigationItems(userRole) {
  const navItems = {
    trainee: [
      { path: routes.practice.path, label: 'תרגול', icon: '📚' },
      { path: routes.progress.path, label: 'התקדמות', icon: '📊' },
      { path: routes.studyPlans.path, label: 'תוכניות לימוד', icon: '📋' },
      { path: routes.bookmarks.path, label: 'סימניות', icon: '🔖' },
      { path: routes.mockExam.path, label: 'בחינה מדומה', icon: '📝' },
      { path: routes.settings.path, label: 'הגדרות', icon: '⚙️' }
    ],
    instructor: [
      { path: routes.instructor.path,          label: 'מחולל מבחנים',  icon: '📝' },
      { path: routes.instructorQuestions.path, label: 'ניהול שאלות',   icon: '❓' },
      { path: routes.mediaBankManager.path,    label: 'מאגר מדיה',     icon: '🗃️' },
      { path: routes.instructorStudyPlans.path, label: 'תוכניות לימוד', icon: '📋' },
      { path: routes.instructorAnalytics.path, label: 'אנליטיקה',      icon: '📊' },
      { path: routes.settings.path,            label: 'הגדרות',         icon: '⚙️' }
    ],
    admin: [
      { path: routes.manager.path,             label: 'לוח בקרה',             icon: '🎛️' },
      { path: routes.instructor.path,          label: 'מחולל מבחנים',          icon: '📝' },
      { path: routes.instructorQuestions.path, label: 'ניהול שאלות',           icon: '❓' },
      { path: routes.mediaBankManager.path,    label: 'מאגר מדיה',             icon: '🗃️' },
      { path: routes.dataImportExport.path,    label: 'ייבוא/ייצוא נתונים',   icon: '📥' },
      { path: routes.instructorAnalytics.path, label: 'אנליטיקה',              icon: '📊' },
      { path: routes.settings.path,            label: 'הגדרות מערכת',          icon: '⚙️' }
    ]
  };

  return navItems[userRole] || [];
}

/**
 * Get breadcrumbs for current path
 */
export function getBreadcrumbs(path, userRole) {
  const breadcrumbs = [];
  
  // Home
  breadcrumbs.push({ path: '/', label: 'בית' });
  
  // Parse path segments
  const segments = path.split('/').filter(s => s);
  
  segments.forEach((segment, index) => {
    const currentPath = '/' + segments.slice(0, index + 1).join('/');
    const route = getRouteByPath(currentPath);
    
    if (route) {
      // Get label from route or segment
      let label = segment;
      
      // Map common segments to Hebrew labels
      const labelMap = {
        'practice': 'תרגול',
        'progress': 'התקדמות',
        'study-plans': 'תוכניות לימוד',
        'bookmarks': 'סימניות',
        'mock-exam': 'בחינה מדומה',
        'instructor': 'מדריך',
        'questions': 'שאלות',
        'analytics': 'אנליטיקה',
        'manager': 'מנהל',
        'admin': 'מנהל',
        'data-import-export': 'ייבוא/ייצוא נתונים',
        'media-bank': 'מאגר מדיה',
        'settings': 'הגדרות',
        'profile': 'פרופיל',
        'help': 'עזרה'
      };
      
      label = labelMap[segment] || segment;
      breadcrumbs.push({ path: currentPath, label });
    }
  });
  
  return breadcrumbs;
}
