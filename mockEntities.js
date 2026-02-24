/**
 * Mock Entities for Development
 * Hebrew: ישויות מדומות לפיתוח
 */

const STORAGE_KEY = 'quizMDA_mockData';

let _idCounter = Date.now();
function uid(prefix = '') {
  return `${prefix}${++_idCounter}`;
}

// Default seed data — used only when localStorage is empty
const DEFAULT_DATA = {
  questions: [],
  hierarchies: [],
  users: [],
  activityLogs: [],
  studyPlans: [],
  enrollments: [],
  notes: [],
  notifications: [],
  achievements: [],
  mediaBank: []
};

// Only Google sign-in users; new users are created on first Google login
DEFAULT_DATA.users = [
  {
    user_id: 'admin1',
    full_name: 'Snir Admin',
    email: 'snir@snir-ai.com',
    role: 'admin',
    auth_provider: 'google',
    points: 0,
    current_streak: 0,
    longest_streak: 0,
    email_verified: true,
    custom_permissions: []
  },
  {
    user_id: 'admin2',
    full_name: 'Snir Fain',
    email: 'snirfain@gmail.com',
    role: 'admin',
    auth_provider: 'google',
    points: 0,
    current_streak: 0,
    longest_streak: 0,
    email_verified: true,
    custom_permissions: []
  }
];

// 15 קטגוריות מד"א — תיוג תוכן
const MDA_CATEGORIES = [
  'מבואות',
  'החייאה בסיסית ומתקדמת',
  'פרמקולוגיה',
  'אנמנזה ובדיקה רפואית',
  'נתיב אוויר',
  'מצ״ח נשימתיים',
  'טראומה',
  'מצ״חים קרדיווסקולריים',
  'מצ״ח כלליים',
  'אוכלוסיות מיוחדות',
  'אג״מ',
  'אר״ן',
  'גניקולוגיה ומיילדות',
  'פדיאטריה',
  'מצ״חים התנהגותיים'
];

DEFAULT_DATA.hierarchies = MDA_CATEGORIES.map((name, i) => ({
  id: `h${i + 1}`,
  category_name: name,
  topic_name: name,
  lesson_source: 'MDA'
}));

DEFAULT_DATA.questions = [
  {
    id: 'q1',
    hierarchy_id: 'h1',
    question_type: 'single_choice',
    question_text: 'מהו מספר הלחיצות המומלץ בהחייאה?',
    difficulty_level: 'בינוני',
    correct_answer: JSON.stringify({ value: '30', options: [
      { value: '15', label: '15' },
      { value: '30', label: '30' },
      { value: '50', label: '50' }
    ]}),
    status: 'active',
    total_attempts: 100,
    total_success: 85,
    success_rate: 85,
    hint: 'זה מספר זוגי',
    explanation: 'מספר הלחיצות המומלץ הוא 30 לפני 2 נשימות',
    tags: ['החייאה', 'חירום']
  }
];

// ── Media Bank seed data ──────────────────────────────────────
// Real-world MDA use-case: ECG rhythm recognition images grouped by tag.
// In production, `url` would point to actual uploaded files.
// Placeholder image URLs (Wikipedia URLs often 404; replace with your own uploads in production)
const PLACEHOLDER_IMG = (seed) => `https://picsum.photos/seed/${seed}/640/360`;
DEFAULT_DATA.mediaBank = [
  // PSVT — Paroxysmal Supraventricular Tachycardia
  {
    id: 'mb1', tag: 'PSVT', name: 'PSVT פס קצב #1', media_type: 'image',
    url: PLACEHOLDER_IMG('psvt1'),
    description: 'פס קצב המדגים PSVT עם QRS צר וקצב של ~180 לדקה',
    status: 'active', total_attempts: 0, total_success: 0, success_rate: null,
    uploadedBy: 'admin1', createdAt: new Date().toISOString()
  },
  {
    id: 'mb2', tag: 'PSVT', name: 'PSVT פס קצב #2', media_type: 'image',
    url: PLACEHOLDER_IMG('psvt2'),
    description: 'AVNRT — תת-סוג נפוץ של PSVT',
    status: 'active', total_attempts: 0, total_success: 0, success_rate: null,
    uploadedBy: 'admin1', createdAt: new Date().toISOString()
  },
  // AFib — Atrial Fibrillation
  {
    id: 'mb3', tag: 'AFib', name: 'פרפור פרוזדורים #1', media_type: 'image',
    url: PLACEHOLDER_IMG('afib1'),
    description: 'פרפור פרוזדורים — קצב אי-סדיר ללא גלי P ברורים',
    status: 'active', total_attempts: 0, total_success: 0, success_rate: null,
    uploadedBy: 'admin1', createdAt: new Date().toISOString()
  },
  {
    id: 'mb4', tag: 'AFib', name: 'פרפור פרוזדורים #2', media_type: 'image',
    url: PLACEHOLDER_IMG('afib2'),
    description: 'מוביל II — פרפור פרוזדורים עם תגובה חדרית מהירה',
    status: 'active', total_attempts: 0, total_success: 0, success_rate: null,
    uploadedBy: 'admin1', createdAt: new Date().toISOString()
  },
  // VTach — Ventricular Tachycardia
  {
    id: 'mb5', tag: 'VTach', name: 'טכיקרדיה חדרית #1', media_type: 'image',
    url: PLACEHOLDER_IMG('vtach1'),
    description: 'טכיקרדיה חדרית מונומורפית — QRS רחב וסדיר',
    status: 'active', total_attempts: 0, total_success: 0, success_rate: null,
    uploadedBy: 'admin1', createdAt: new Date().toISOString()
  },
  {
    id: 'mb6', tag: 'VTach', name: 'טכיקרדיה חדרית #2', media_type: 'image',
    url: PLACEHOLDER_IMG('vtach2'),
    description: 'מוביל II — VT עם קצב 150-200 לדקה',
    status: 'active', total_attempts: 0, total_success: 0, success_rate: null,
    uploadedBy: 'admin1', createdAt: new Date().toISOString()
  },
  // SinusRhythm — for comparison
  {
    id: 'mb7', tag: 'SinusRhythm', name: 'קצב סינוס תקין #1', media_type: 'image',
    url: PLACEHOLDER_IMG('sinus1'),
    description: 'קצב סינוס תקין עם P-QRS-T תקין',
    status: 'active', total_attempts: 0, total_success: 0, success_rate: null,
    uploadedBy: 'admin1', createdAt: new Date().toISOString()
  }
];

// Demo question using media bank tag (ECG rhythm recognition)
DEFAULT_DATA.questions.push({
  id: 'q_ecg_demo',
  hierarchy_id: 'h8',  // מצ״חים קרדיווסקולריים
  question_type: 'single_choice',
  question_text: 'זהה את הפרעת הקצב המוצגת בפס הקצב:',
  media_bank_tag: 'PSVT',
  difficulty_level: null,
  correct_answer: JSON.stringify({
    value: '0',
    options: [
      { value: '0', label: 'PSVT (טכיקרדיה על-חדרית התקפית)' },
      { value: '1', label: 'פרפור פרוזדורים (AFib)' },
      { value: '2', label: 'טכיקרדיה חדרית (VTach)' },
      { value: '3', label: 'קצב סינוס תקין' },
    ]
  }),
  explanation: 'PSVT מאופיין ב-QRS צר, קצב סדיר ומהיר (140–280 לדקה), ללא גלי P ברורים לפני כל QRS.',
  status: 'active',
  total_attempts: 0,
  total_success: 0,
  success_rate: null,
  tags: ['אק"ג', 'קצב לב', 'PSVT']
});

/**
 * Minimal query matcher supporting: direct equality, $in, $gte, $lte, $ne
 */
function matchQuery(doc, query) {
  for (const [key, condition] of Object.entries(query)) {
    const val = doc[key];
    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      if ('$in' in condition && !condition.$in.includes(val)) return false;
      if ('$nin' in condition && condition.$nin.includes(val)) return false;
      if ('$gte' in condition && !(val >= condition.$gte)) return false;
      if ('$lte' in condition && !(val <= condition.$lte)) return false;
      if ('$gt' in condition && !(val > condition.$gt)) return false;
      if ('$lt' in condition && !(val < condition.$lt)) return false;
      if ('$ne' in condition && val === condition.$ne) return false;
    } else {
      if (val !== condition) return false;
    }
  }
  return true;
}

// Persistence helpers
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData));
  } catch (e) {
    console.warn('MockEntities: could not save to localStorage', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const hierarchies = (parsed.hierarchies?.length >= 15)
        ? parsed.hierarchies
        : DEFAULT_DATA.hierarchies;
      // ── Deduplicate by ID + normalize all questions ──────────
      const rawQuestions = parsed.questions ?? DEFAULT_DATA.questions;
      const seenIds = new Set();
      const LEADING_NUM_RE = /^\d{1,3}\s*[.):\-]\s*/;
      const VALID_TYPES = new Set(['single_choice','multi_choice','true_false','open_ended','ordering']);
      const VALID_DIFF  = new Set(['קל','בינוני','קשה',null,undefined]);

      const questions = rawQuestions.map(q => {
        // 1. Fix duplicate IDs
        let id = q.id;
        if (!id || seenIds.has(id)) id = uid('q');
        seenIds.add(id);

        // 2. Strip leading question number from question_text
        const rawText = q.question_text || '';
        const question_text = rawText.replace(LEADING_NUM_RE, '').trim() || rawText;

        // 3. Normalise question_type
        let question_type = q.question_type;
        if (!VALID_TYPES.has(question_type)) question_type = 'single_choice';

        // 4. Normalise difficulty_level — numeric → label
        let difficulty_level = q.difficulty_level;
        if (typeof difficulty_level === 'number') {
          difficulty_level = difficulty_level >= 8 ? 'קשה' : difficulty_level >= 5 ? 'בינוני' : 'קל';
        }
        if (!VALID_DIFF.has(difficulty_level)) difficulty_level = null;

        // 5. Ensure status is a known value
        const VALID_STATUS = new Set(['draft','pending_review','active','rejected','needs_revision','suspended']);
        const status = VALID_STATUS.has(q.status) ? q.status : 'active';

        return {
          ...q,
          id,
          question_text,
          question_type,
          difficulty_level: difficulty_level ?? null,
          status,
          total_attempts: q.total_attempts ?? 0,
          total_success:  q.total_success  ?? 0,
          success_rate:   q.success_rate   ?? null,
        };
      });

      return {
        questions,
        hierarchies,
        users:        parsed.users        ?? DEFAULT_DATA.users,
        activityLogs: parsed.activityLogs ?? [],
        studyPlans:   parsed.studyPlans   ?? [],
        enrollments:  parsed.enrollments  ?? [],
        notes:        parsed.notes        ?? [],
        notifications: parsed.notifications ?? [],
        achievements: parsed.achievements ?? [],
        // Seed media bank once; migrate old Wikipedia URLs (404) to placeholders
        mediaBank:    (() => {
          const mb = (parsed.mediaBank?.length > 0) ? parsed.mediaBank : DEFAULT_DATA.mediaBank;
          const PLACEHOLDER = (seed) => `https://picsum.photos/seed/${seed}/640/360`;
          let migrated = false;
          const result = mb.map((item, i) => {
            if (item.url && typeof item.url === 'string' && item.url.includes('wikimedia')) {
              migrated = true;
              return { ...item, url: PLACEHOLDER(`media${item.id || i}`) };
            }
            return item;
          });
          if (migrated) loadFromStorage._migratedMediaBank = true;
          return result;
        })()
      };
    }
  } catch (e) {
    console.warn('MockEntities: could not read from localStorage', e);
  }
  return { ...DEFAULT_DATA, mediaBank: [...DEFAULT_DATA.mediaBank] };
}

// Runtime data — loaded from localStorage, falls back to DEFAULT_DATA
const mockData = loadFromStorage();
if (loadFromStorage._migratedMediaBank) saveToStorage();

// Mock entity implementations
export const mockEntities = {
  Question_Bank: {
    find: async (query = {}, options = {}) => {
      let results = mockData.questions.filter(q => matchQuery(q, query));
      if (options.sort) {
        const [field, dir] = Object.entries(options.sort)[0];
        results.sort((a, b) => dir === -1 ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
      }
      if (options.limit) results = results.slice(0, options.limit);
      return results;
    },
    findOne: async (query) => {
      if (query.id) {
        return mockData.questions.find(q => q.id === query.id) || null;
      }
      return null;
    },
    create: async (data) => {
      const newQuestion = {
        id: uid('q'),
        ...data,
        total_attempts: 0,
        total_success: 0,
        success_rate: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockData.questions.push(newQuestion);
      saveToStorage();
      return newQuestion;
    },
    update: async (id, data) => {
      const index = mockData.questions.findIndex(q => q.id === id);
      if (index !== -1) {
        mockData.questions[index] = {
          ...mockData.questions[index],
          ...data,
          updatedAt: new Date()
        };
        saveToStorage();
        return mockData.questions[index];
      }
      return null;
    },
    delete: async (id) => {
      const index = mockData.questions.findIndex(q => q.id === id);
      if (index !== -1) {
        mockData.questions.splice(index, 1);
        saveToStorage();
        return { success: true };
      }
      return { success: false };
    },
    distinct: async (field) => {
      // Get unique values for a specific field
      const values = mockData.questions
        .map(q => q[field])
        .filter((value, index, self) => value != null && self.indexOf(value) === index);
      return values;
    }
  },
  
  Content_Hierarchy: {
    find: async (query = {}) => {
      return mockData.hierarchies.filter(h => matchQuery(h, query));
    },
    findOne: async (query) => {
      if (query.id) {
        return mockData.hierarchies.find(h => h.id === query.id) || null;
      }
      return null;
    },
    distinct: async (field) => {
      // Get unique values for a specific field
      const values = mockData.hierarchies
        .map(h => h[field])
        .filter((value, index, self) => value != null && self.indexOf(value) === index);
      return values;
    }
  },
  
  Users: {
    find: async (query = {}) => {
      return mockData.users.filter(u => matchQuery(u, query));
    },
    findOne: async (query) => {
      if (query.user_id) {
        return mockData.users.find(u => u.user_id === query.user_id) || null;
      }
      if (query.email) {
        return mockData.users.find(u => u.email === query.email) || null;
      }
      if (query.google_id) {
        return mockData.users.find(u => u.google_id === query.google_id) || null;
      }
      return null;
    },
    create: async (data) => {
      const newUser = {
        ...data,
        custom_permissions: data.custom_permissions ?? [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockData.users.push(newUser);
      saveToStorage();
      return newUser;
    },
    update: async (userId, data) => {
      const index = mockData.users.findIndex(u => u.user_id === userId);
      if (index !== -1) {
        mockData.users[index] = {
          ...mockData.users[index],
          ...data,
          updatedAt: new Date()
        };
        saveToStorage();
        return mockData.users[index];
      }
      return null;
    }
  },
  
  Activity_Log: {
    find: async (query = {}, options = {}) => {
      let results = mockData.activityLogs.filter(l => matchQuery(l, query));
      if (options.sort) {
        const [field, dir] = Object.entries(options.sort)[0];
        results.sort((a, b) => dir === -1 ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
      }
      if (options.limit) results = results.slice(0, options.limit);
      return results;
    },
    create: async (data) => {
      const newLog = {
        log_id: uid('log'),
        ...data,
        timestamp: data.timestamp || new Date()
      };
      mockData.activityLogs.push(newLog);
      return newLog;
    }
  },
  
  Study_Plans: {
    find: async (query = {}) => {
      return [...mockData.studyPlans];
    },
    findOne: async (query) => {
      if (query.id || query.plan_id) {
        return mockData.studyPlans.find(p => 
          p.id === query.id || p.plan_id === query.plan_id
        ) || null;
      }
      return null;
    },
    create: async (data) => {
      const newPlan = {
        plan_id: uid('plan'),
        ...data,
        created_at: new Date()
      };
      mockData.studyPlans.push(newPlan);
      saveToStorage();
      return newPlan;
    },
    update: async (id, data) => {
      const index = mockData.studyPlans.findIndex(p => 
        p.plan_id === id || p.id === id
      );
      if (index !== -1) {
        mockData.studyPlans[index] = {
          ...mockData.studyPlans[index],
          ...data
        };
        saveToStorage();
        return mockData.studyPlans[index];
      }
      return null;
    }
  },
  
  Study_Plan_Enrollments: {
    find: async (query = {}) => {
      return [...mockData.enrollments];
    },
    findOne: async (query) => {
      return mockData.enrollments.find(e => 
        (query.user_id && e.user_id === query.user_id) &&
        (query.plan_id && e.plan_id === query.plan_id)
      ) || null;
    },
    create: async (data) => {
      const newEnrollment = {
        enrollment_id: uid('enroll'),
        ...data,
        enrolled_at: new Date(),
        progress: 0
      };
      mockData.enrollments.push(newEnrollment);
      saveToStorage();
      return newEnrollment;
    },
    update: async (id, data) => {
      const index = mockData.enrollments.findIndex(e => 
        e.enrollment_id === id
      );
      if (index !== -1) {
        mockData.enrollments[index] = {
          ...mockData.enrollments[index],
          ...data
        };
        saveToStorage();
        return mockData.enrollments[index];
      }
      return null;
    }
  },
  
  User_Notes: {
    find: async (query = {}) => {
      return [...mockData.notes];
    },
    findOne: async (query) => {
      return mockData.notes.find(n => 
        (query.user_id && n.user_id === query.user_id) &&
        (query.question_id && n.question_id === query.question_id)
      ) || null;
    },
    create: async (data) => {
      const newNote = {
        note_id: uid('note'),
        ...data,
        created_at: new Date()
      };
      mockData.notes.push(newNote);
      saveToStorage();
      return newNote;
    },
    update: async (id, data) => {
      const index = mockData.notes.findIndex(n => n.note_id === id);
      if (index !== -1) {
        mockData.notes[index] = {
          ...mockData.notes[index],
          ...data,
          updated_at: new Date()
        };
        saveToStorage();
        return mockData.notes[index];
      }
      return null;
    },
    delete: async (id) => {
      const index = mockData.notes.findIndex(n => n.note_id === id);
      if (index !== -1) {
        mockData.notes.splice(index, 1);
        saveToStorage();
        return { success: true };
      }
      return { success: false };
    }
  },
  
  Notifications: {
    find: async (query = {}, options = {}) => {
      let results = mockData.notifications.filter(n => matchQuery(n, query));
      if (options.sort) {
        const [field, dir] = Object.entries(options.sort)[0];
        results.sort((a, b) => dir === -1 ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
      }
      if (options.limit) results = results.slice(0, options.limit);
      return results;
    },
    findOne: async (query) => {
      return mockData.notifications.find(n => matchQuery(n, query)) || null;
    },
    create: async (data) => {
      const newNotification = {
        notification_id: uid('notif'),
        ...data,
        created_at: data.created_at || new Date()
      };
      mockData.notifications.push(newNotification);
      saveToStorage();
      return newNotification;
    },
    update: async (id, data) => {
      const index = mockData.notifications.findIndex(n => n.notification_id === id);
      if (index !== -1) {
        mockData.notifications[index] = { ...mockData.notifications[index], ...data };
        saveToStorage();
        return mockData.notifications[index];
      }
      return null;
    }
  },
  
  Achievements: {
    find: async (query = {}) => {
      return mockData.achievements.filter(a => matchQuery(a, query));
    },
    create: async (data) => {
      const newAchievement = {
        achievement_id: uid('ach'),
        ...data,
        earned_at: new Date()
      };
      mockData.achievements.push(newAchievement);
      saveToStorage();
      return newAchievement;
    }
  },
  
  Media_Bank: {
    find: async (query = {}, options = {}) => {
      let results = mockData.mediaBank.filter(m => matchQuery(m, query));
      if (options.sort) {
        const [field, dir] = Object.entries(options.sort)[0];
        results.sort((a, b) => dir === -1 ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
      }
      if (options.limit) results = results.slice(0, options.limit);
      return results;
    },
    findOne: async (query) => {
      return mockData.mediaBank.find(m => matchQuery(m, query)) || null;
    },
    create: async (data) => {
      const newItem = {
        id: uid('mb'),
        ...data,
        total_attempts: 0,
        total_success:  0,
        success_rate:   null,
        status:         data.status || 'active',
        createdAt:      new Date().toISOString()
      };
      mockData.mediaBank.push(newItem);
      saveToStorage();
      return newItem;
    },
    update: async (id, data) => {
      const idx = mockData.mediaBank.findIndex(m => m.id === id);
      if (idx !== -1) {
        mockData.mediaBank[idx] = { ...mockData.mediaBank[idx], ...data, updatedAt: new Date().toISOString() };
        saveToStorage();
        return mockData.mediaBank[idx];
      }
      return null;
    },
    delete: async (id) => {
      const idx = mockData.mediaBank.findIndex(m => m.id === id);
      if (idx !== -1) {
        mockData.mediaBank.splice(idx, 1);
        saveToStorage();
        return { success: true };
      }
      return { success: false };
    },
    /** Return all distinct tag values present in the bank */
    distinctTags: async () => {
      const tags = [...new Set(mockData.mediaBank.map(m => m.tag).filter(Boolean))];
      return tags.sort();
    }
  },

  Question_Versions: {
    find: async (query = {}) => {
      // Import from entities file
      if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
        return window.mockEntities.Question_Versions.find(query);
      }
      return [];
    },
    findOne: async (query) => {
      if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
        return window.mockEntities.Question_Versions.findOne(query);
      }
      return null;
    },
    create: async (data) => {
      if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
        return window.mockEntities.Question_Versions.create(data);
      }
      return { id: uid('v_') };
    },
    getVersionHistory: async (questionId) => {
      if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
        return window.mockEntities.Question_Versions.getVersionHistory(questionId);
      }
      return [];
    },
    getLatestVersion: async (questionId) => {
      if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Question_Versions) {
        return window.mockEntities.Question_Versions.getLatestVersion(questionId);
      }
      return null;
    }
  }
};

// Make entities available globally for workflows
if (typeof window !== 'undefined') {
  window.mockEntities = mockEntities;
  window.entities = mockEntities;
}
