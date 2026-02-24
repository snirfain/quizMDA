/**
 * Application Configuration
 * Hebrew: תצורת האפליקציה
 */

// Fallback entities (used if window.entities is not available)
const fallbackEntities = {
      Question_Bank: {
        find: async () => [],
        findOne: async () => null,
        create: async () => ({ id: Date.now() }),
        update: async () => ({}),
        delete: async () => ({}),
        distinct: async (field) => {
          // Fallback mock distinct
          return [];
        }
      },
      Content_Hierarchy: {
        find: async () => [],
        findOne: async () => null,
        distinct: async (field) => {
          // Fallback mock distinct
          return [];
        }
      },
      Users: {
        find: async () => [],
        findOne: async () => null,
        create: async (data) => {
          // Fallback mock create
          const newUser = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          return newUser;
        },
        update: async (userId, data) => {
          // Fallback mock update
          return { ...data, user_id: userId, updatedAt: new Date() };
        }
      },
      Activity_Log: {
        find: async () => [],
        create: async () => ({})
      },
      Study_Plans: {
        find: async () => [],
        findOne: async () => null,
        create: async () => ({ plan_id: Date.now() })
      },
      Study_Plan_Enrollments: {
        find: async () => [],
        findOne: async () => null,
        create: async () => ({})
      },
      User_Notes: {
        find: async () => [],
        findOne: async () => null,
        create: async () => ({ note_id: Date.now() }),
        update: async () => ({}),
        delete: async () => ({})
      },
      Notifications: {
        find: async () => []
      },
      Achievements: {
        find: async () => []
      },
      Question_Versions: {
        find: async () => [],
        findOne: async () => null,
        create: async () => ({ id: Date.now() }),
        getVersionHistory: async () => [],
        getLatestVersion: async () => null
      }
};

// Get entities from window (set by mockEntities.js) or use fallback
// Note: In browser, window.entities is set by mockEntities.js which is imported in main.jsx
// We use a getter function to always get the latest value
function getEntities() {
  if (typeof window !== 'undefined' && window.entities) {
    return window.entities;
  }
  return fallbackEntities;
}

// Export entities as a Proxy to dynamically resolve to the correct entities
export const entities = new Proxy(fallbackEntities, {
  get(target, prop) {
    const actualEntities = getEntities();
    if (prop in actualEntities) {
      return actualEntities[prop];
    }
    return target[prop];
  },
  ownKeys(target) {
    const actualEntities = getEntities();
    return Reflect.ownKeys(actualEntities);
  },
  has(target, prop) {
    const actualEntities = getEntities();
    return prop in actualEntities || prop in target;
  }
});

export const appConfig = {
  // Application Metadata
  appName: 'מערכת למידה ותרגול מד"א',
  appNameEn: 'MDA Adaptive Learning & Assessment Platform',
  
  // Language & Direction
  language: 'he',
  direction: 'rtl',
  
  // API Configuration
  api: {
    // Default values - can be overridden via environment variables in production
    mdaBotUrl: 'https://api.mda-bot.example.com/validate',
    mdaBotApiKey: ''
  },
  
  // OpenAI Configuration (question import AI + open-ended validation)
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    getApiKey: function() {
      return import.meta.env?.VITE_OPENAI_API_KEY || '';
    }
  },
  
  // Google OAuth (clientId from env; no clientSecret in client)
  google: {
    clientId: import.meta.env?.VITE_GOOGLE_CLIENT_ID || '177431900868-95hpv33cfkhtsu0d7p2u8p74ejb6j5e2.apps.googleusercontent.com',
    redirectUri: typeof window !== 'undefined' ? window.location.origin + '/auth/google/callback' : ''
  },
  
  // Difficulty & Suspension Thresholds
  // These mirror the constants in workflows/difficultyEngine.js
  suspension: {
    minAttemptsForRating: 50,  // minimum answers before a difficulty label is assigned
    suspendBelowRate: 70,      // success-rate % below which the question is auto-suspended
    // Difficulty bands (success-rate %)
    difficultyBands: {
      קל:     { min: 95, max: 100 },
      בינוני: { min: 80, max: 94  },
      קשה:    { min: 70, max: 79  },
    },
  },
  
  // Practice Session Defaults
  practice: {
    defaultQuestionCount: 10,
    priorityMistakes: true,
    priorityNew: true
  },
  
  // Test Generator Defaults
  testGenerator: {
    defaultQuestionCount: 20,
    minDifficulty: 1,
    maxDifficulty: 10
  },
  
  // UI Configuration
  ui: {
    theme: {
      primaryColor: '#2196F3',
      successColor: '#4CAF50',
      errorColor: '#f44336',
      warningColor: '#ff9800'
    },
    mobileBreakpoint: 768,
    desktopBreakpoint: 1024
  },
  
  // Admin emails — full access to all pages and functions
  adminEmails: ['snir@snir-ai.com'],

  // Roles
  roles: {
    trainee: 'trainee',
    instructor: 'instructor',
    admin: 'admin'
  },
  
  // Question Types
  questionTypes: {
    singleChoice: 'single_choice',
    multiChoice: 'multi_choice',
    trueFalse: 'true_false',
    openEnded: 'open_ended'
  },
  
  // Question Status
  questionStatus: {
    active: 'active',
    draft: 'draft',
    suspended: 'suspended'
  }
};
