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
    roles: ['trainee', 'instructor', 'school_staff', 'manager', 'admin']
  },
  progress: {
    path: '/progress',
    component: 'UserProgressDashboard',
    public: false,
    roles: ['trainee', 'instructor', 'school_staff', 'manager', 'admin']
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
    roles: ['trainee', 'instructor', 'school_staff', 'manager', 'admin']
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
    roles: ['instructor', 'school_staff', 'manager', 'admin']
  },
  instructorQuestions: {
    path: '/instructor/questions',
    component: 'QuestionManagement',
    public: false,
    roles: ['instructor', 'school_staff', 'manager', 'admin']
  },
  instructorChapterGenerator: {
    path: '/instructor/chapter-generator',
    component: 'ChapterQuestionGenerator',
    public: false,
    roles: ['instructor', 'school_staff', 'manager', 'admin']
  },
  instructorStudyPlans: {
    path: '/instructor/study-plans',
    component: 'StudyPlanManager',
    public: false,
    roles: ['instructor', 'school_staff', 'manager', 'admin']
  },
  instructorAnalytics: {
    path: '/instructor/analytics',
    component: 'InstructorAnalytics',
    public: false,
    roles: ['instructor', 'school_staff', 'manager', 'admin']
  },
  mediaBankManager: {
    path: '/instructor/media-bank',
    component: 'MediaBankManager',
    public: false,
    roles: ['instructor', 'school_staff', 'manager', 'admin']
  },
  instructorTranscripts: {
    path: '/instructor/transcripts',
    component: 'TranscriptUpload',
    public: false,
    roles: ['school_staff', 'manager', 'admin']
  },
  manager: {
    path: '/manager',
    component: 'ManagerDashboard',
    public: false,
    roles: ['manager', 'admin']
  },
  dataImportExport: {
    path: '/admin/data-import-export',
    component: 'DataImportExport',
    public: false,
    roles: ['manager', 'admin']
  },
  settings: {
    path: '/settings',
    component: 'SettingsPage',
    public: false,
    roles: ['trainee', 'instructor', 'school_staff', 'manager', 'admin']
  },
  profile: {
    path: '/profile',
    component: 'ProfilePage',
    public: false,
    roles: ['trainee', 'instructor', 'school_staff', 'manager', 'admin']
  },
  setup: {
    path: '/setup',
    component: 'CourseSetupPage',
    public: false,
    roles: ['trainee', 'instructor', 'school_staff', 'manager', 'admin']
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
      { path: routes.practice.path, label: 'תרגול', icon: 'book' },
      { path: routes.progress.path, label: 'התקדמות', icon: 'chart' },
      { path: routes.settings.path, label: 'הגדרות', icon: 'settings' },
    ],
    instructor: [
      { path: routes.instructor.path,           label: 'מחולל מבחנים',  icon: 'edit' },
      { path: routes.instructorChapterGenerator.path, label: 'שאלות מפרק (AI)', icon: 'sparkles' },
      { path: routes.instructorQuestions.path,  label: 'ניהול שאלות',   icon: 'help' },
      { path: routes.mediaBankManager.path,    label: 'מאגר מדיה',     icon: 'media' },
      { path: routes.instructorStudyPlans.path, label: 'תוכניות לימוד', icon: 'clipboard' },
      { path: routes.instructorAnalytics.path, label: 'אנליטיקה',      icon: 'chart' },
      { path: routes.settings.path,             label: 'הגדרות',         icon: 'settings' },
    ],
    school_staff: [
      { path: routes.instructor.path,             label: 'מחולל מבחנים',   icon: 'edit' },
      { path: routes.instructorChapterGenerator.path, label: 'שאלות מפרק (AI)', icon: 'sparkles' },
      { path: routes.instructorQuestions.path,    label: 'ניהול שאלות',    icon: 'help' },
      { path: routes.mediaBankManager.path,      label: 'מאגר מדיה',      icon: 'media' },
      { path: routes.instructorTranscripts.path, label: 'העלאת תמלילים',  icon: 'file' },
      { path: routes.instructorStudyPlans.path,   label: 'תוכניות לימוד',  icon: 'clipboard' },
      { path: routes.instructorAnalytics.path,   label: 'אנליטיקה',       icon: 'chart' },
      { path: routes.settings.path,               label: 'הגדרות',          icon: 'settings' },
    ],
    manager: [
      { path: routes.manager.path,               label: 'לוח בקרה',            icon: 'dashboard' },
      { path: routes.instructor.path,            label: 'מחולל מבחנים',         icon: 'edit' },
      { path: routes.instructorChapterGenerator.path, label: 'שאלות מפרק (AI)', icon: 'sparkles' },
      { path: routes.instructorQuestions.path,   label: 'ניהול שאלות',          icon: 'help' },
      { path: routes.mediaBankManager.path,     label: 'מאגר מדיה',            icon: 'media' },
      { path: routes.instructorTranscripts.path, label: 'העלאת תמלילים',       icon: 'file' },
      { path: routes.dataImportExport.path,     label: 'ייבוא/ייצוא נתונים',  icon: 'import' },
      { path: routes.instructorAnalytics.path,  label: 'אנליטיקה',             icon: 'chart' },
      { path: routes.settings.path,              label: 'הגדרות',               icon: 'settings' },
    ],
    admin: [
      { path: routes.manager.path,               label: 'לוח בקרה',            icon: 'dashboard' },
      { path: routes.instructor.path,            label: 'מחולל מבחנים',         icon: 'edit' },
      { path: routes.instructorChapterGenerator.path, label: 'שאלות מפרק (AI)', icon: 'sparkles' },
      { path: routes.instructorQuestions.path,   label: 'ניהול שאלות',          icon: 'help' },
      { path: routes.mediaBankManager.path,     label: 'מאגר מדיה',            icon: 'media' },
      { path: routes.instructorTranscripts.path, label: 'העלאת תמלילים',       icon: 'file' },
      { path: routes.dataImportExport.path,     label: 'ייבוא/ייצוא נתונים',  icon: 'import' },
      { path: routes.instructorAnalytics.path,  label: 'אנליטיקה',             icon: 'chart' },
      { path: routes.settings.path,              label: 'הגדרות מערכת',         icon: 'settings' },
    ],
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
        'chapter-generator': 'שאלות מפרק (AI)',
        'analytics': 'אנליטיקה',
        'manager': 'מנהל',
        'admin': 'מנהל',
        'data-import-export': 'ייבוא/ייצוא נתונים',
        'media-bank': 'מאגר מדיה',
        'transcripts': 'תמלילים',
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
