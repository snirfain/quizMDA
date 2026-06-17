/**
 * Mock Entities for Development
 * Hebrew: ישויות מדומות לפיתוח
 */

import {
  QUESTION_CATEGORIES,
  normalizeLegacyStatus,
  getSubcategoriesForCategory,
  computeQuestionHasMedia,
  normalizeQuestionMediaPayload,
} from './shared/questionBankMetadata.js';
import { getAuthToken } from './utils/authToken.js';
import {
  SYNC_MAX_ATTEMPTS,
  SYNC_TOKEN_WAIT_MS,
  SYNC_TOKEN_POLL_MS,
  shouldRetrySync,
  backoffDelay,
} from './shared/syncRetry.js';

const STORAGE_KEY = 'quizMDA_mockData';

const SEED_CATEGORY = QUESTION_CATEGORIES[0].value;
const SEED_SUB = getSubcategoriesForCategory(SEED_CATEGORY)[0];

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
    category: SEED_CATEGORY,
    sub_category: SEED_SUB,
    thinking_level: 'Knowledge',
    training_level: 'B',
    has_media: false,
    question_type: 'single_choice',
    question_text: 'מהו מספר הלחיצות המומלץ בהחייאה?',
    correct_answer: JSON.stringify({
      value: '1',
      options: [
        { value: '0', label: '15' },
        { value: '1', label: '30' },
        { value: '2', label: '50' },
      ],
    }),
    status: 'active',
    total_attempts: 100,
    total_success: 85,
    success_rate: 85,
    hint: 'זה מספר זוגי',
    explanation: 'מספר הלחיצות המומלץ הוא 30 לפני 2 נשימות',
    options: [
      { value: '0', label: '15' },
      { value: '1', label: '30' },
      { value: '2', label: '50' },
    ],
    media_attachment: null,
  },
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

// Demo question with static ECG-style image placeholder
DEFAULT_DATA.questions.push({
  id: 'q_ecg_demo',
  category: QUESTION_CATEGORIES[7]?.value ?? SEED_CATEGORY,
  sub_category: getSubcategoriesForCategory(QUESTION_CATEGORIES[7]?.value ?? SEED_CATEGORY)[0],
  thinking_level: 'Application',
  training_level: 'A',
  has_media: true,
  question_type: 'single_choice',
  question_text: 'זהה את הפרעת הקצב המוצגת בפס הקצב:',
  media_attachment: { url: PLACEHOLDER_IMG('psvtquiz'), type: 'image', name: 'rhythm.png' },
  correct_answer: JSON.stringify({
    value: '0',
    options: [
      { value: '0', label: 'PSVT (טכיקרדיה על-חדרית התקפית)' },
      { value: '1', label: 'פרפור פרוזדורים (AFib)' },
      { value: '2', label: 'טכיקרדיה חדרית (VTach)' },
      { value: '3', label: 'קצב סינוס תקין' },
    ],
  }),
  options: [
    { value: '0', label: 'PSVT (טכיקרדיה על-חדרית התקפית)' },
    { value: '1', label: 'פרפור פרוזדורים (AFib)' },
    { value: '2', label: 'טכיקרדיה חדרית (VTach)' },
    { value: '3', label: 'קצב סינוס תקין' },
  ],
  explanation:
    'PSVT מאופיין ב-QRS צר, קצב סדיר ומהיר (140–280 לדקה), ללא גלי P ברורים לפני כל QRS.',
  status: 'active',
  total_attempts: 0,
  total_success: 0,
  success_rate: null,
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

// ────────────────────────────────────────────────────────────────────
// IndexedDB layer for the questions cache
// בנק השאלות (אלפי שאלות) נשמר ב-IndexedDB ולא ב-localStorage, כדי לעקוף
// את מגבלת ה-5MB ולמנוע שגיאות QuotaExceededError שקוטעות חצי מהשאלות.
// ────────────────────────────────────────────────────────────────────
const QUESTIONS_DB_NAME = 'quizMDA_QuestionsDB';
const QUESTIONS_DB_VERSION = 1;
const QUESTIONS_STORE = 'questions';

/** true עד שמתגלה שאין IndexedDB זמין — אז נופלים בבטחה לזיכרון בלבד. */
let idbAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
let _questionsDbPromise = null;

/**
 * פותח (ויוצר במידת הצורך) את בסיס הנתונים המקומי לשאלות.
 * מגדיר object store בשם `questions` עם מפתח ראשי `id`.
 * @returns {Promise<IDBDatabase>}
 */
function initQuestionsDB() {
  if (!idbAvailable) return Promise.reject(new Error('IndexedDB אינו זמין בדפדפן זה'));
  if (_questionsDbPromise) return _questionsDbPromise;

  _questionsDbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(QUESTIONS_DB_NAME, QUESTIONS_DB_VERSION);
    } catch (err) {
      idbAvailable = false;
      return reject(err);
    }
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(QUESTIONS_STORE)) {
        // מפתח ראשי `id`; נשתמש ב-_id מהשרת כ-fallback בעת ההמרה.
        db.createObjectStore(QUESTIONS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { try { db.close(); } catch (_) {} _questionsDbPromise = null; };
      resolve(db);
    };
    request.onerror = () => {
      idbAvailable = false;
      reject(request.error || new Error('פתיחת IndexedDB נכשלה'));
    };
    request.onblocked = () => {
      console.warn('[IndexedDB] פתיחת בסיס הנתונים חסומה על ידי טאב אחר');
    };
  });

  // אם הפתיחה נכשלה — מאפסים את ה-promise כדי לאפשר ניסיון חוזר בעתיד.
  _questionsDbPromise.catch(() => { _questionsDbPromise = null; });
  return _questionsDbPromise;
}

/** שולף את כל השאלות מ-IndexedDB. מחזיר [] בכל שגיאה (fallback בטוח). */
async function idbGetAllQuestions() {
  try {
    const db = await initQuestionsDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUESTIONS_STORE, 'readonly');
      const store = tx.objectStore(QUESTIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] שליפת שאלות נכשלה — fallback לזיכרון:', err?.message || err);
    return [];
  }
}

/**
 * שומר מערך שאלות בבת אחת (bulk) בתוך טרנזקציה אחת.
 * @param {Array} questions
 * @param {{ clear?: boolean }} [opts] - clear: לרוקן את החנות לפני הכתיבה
 * @returns {Promise<boolean>} האם הכתיבה הצליחה
 */
async function idbSaveQuestionsBulk(questions, opts = {}) {
  const list = Array.isArray(questions) ? questions : [];
  try {
    const db = await initQuestionsDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUESTIONS_STORE, 'readwrite');
      const store = tx.objectStore(QUESTIONS_STORE);
      tx.oncomplete = () => resolve(true);
      tx.onabort = () => reject(tx.error || new Error('טרנזקציית כתיבה בוטלה'));
      tx.onerror = () => reject(tx.error);
      if (opts.clear) store.clear();
      for (const q of list) {
        if (q && q.id != null) store.put(q);
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] שמירת שאלות (bulk) נכשלה — נשמר בזיכרון בלבד:', err?.message || err);
    return false;
  }
}

/** כותב/מעדכן שאלה בודדת ב-IndexedDB. */
async function idbPutQuestion(question) {
  if (!question || question.id == null) return false;
  try {
    const db = await initQuestionsDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUESTIONS_STORE, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore(QUESTIONS_STORE).put(question);
    });
  } catch (err) {
    console.warn('[IndexedDB] שמירת שאלה נכשלה:', err?.message || err);
    return false;
  }
}

/** מוחק שאלה בודדת מ-IndexedDB. */
async function idbDeleteQuestion(id) {
  if (id == null) return false;
  try {
    const db = await initQuestionsDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUESTIONS_STORE, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore(QUESTIONS_STORE).delete(id);
    });
  } catch (err) {
    console.warn('[IndexedDB] מחיקת שאלה נכשלה:', err?.message || err);
    return false;
  }
}

/**
 * טוען את בנק השאלות פעם אחת (memoized): מ-IndexedDB, או מהגרציה חד-פעמית
 * מ-localStorage הישן, או fallback לזיכרון. כל קריאות ה-find ממתינות לזה.
 */
let _questionsLoadedPromise = null;
function ensureQuestionsLoaded() {
  if (_questionsLoadedPromise) return _questionsLoadedPromise;
  _questionsLoadedPromise = (async () => {
    if (!idbAvailable) {
      console.warn('[mockEntities] IndexedDB אינו זמין — בנק השאלות יישמר בזיכרון בלבד.');
      return mockData.questions;
    }
    try {
      const stored = await idbGetAllQuestions();
      if (stored.length > 0) {
        mockData.questions = stored;
        console.log(`[mockEntities] נטענו ${stored.length} שאלות מ-IndexedDB`);
        return mockData.questions;
      }
      // IndexedDB ריק — אם יש שאלות ישנות ב-localStorage, נבצע הגירה חד-פעמית.
      if (loadFromStorage._hadStoredQuestions && mockData.questions.length > 0) {
        const ok = await idbSaveQuestionsBulk(mockData.questions, { clear: true });
        if (ok) {
          console.log(`[mockEntities] הוגרו ${mockData.questions.length} שאלות מ-localStorage ל-IndexedDB`);
          // משחררים את ה-localStorage מהשאלות הכבדות (מונע QuotaExceededError).
          saveToStorage();
        }
      }
      return mockData.questions;
    } catch (err) {
      console.warn('[mockEntities] טעינת שאלות מ-IndexedDB נכשלה — fallback לזיכרון:', err?.message || err);
      return mockData.questions;
    }
  })();
  return _questionsLoadedPromise;
}

// ────────────────────────────────────────────────────────────────────
// Sync status events — מאפשרים ל-UI להציג חיווי סנכרון עדין
// ────────────────────────────────────────────────────────────────────
export const SYNC_EVENT = 'quizMDA:questions-sync';

function emitSyncStatus(detail) {
  if (typeof window === 'undefined') return;
  try {
    window.__quizMDA_syncStatus = detail;
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail }));
  } catch (_) {
    /* never let a UI event break sync */
  }
}

// Persistence helpers
function saveToStorage() {
  try {
    // השאלות נשמרות ב-IndexedDB בלבד — לא כוללים אותן ב-localStorage כדי
    // להישאר הרבה מתחת למגבלת ~5MB. שאר הישויות (קטנות) נשמרות כרגיל.
    const rest = { ...mockData, questions: [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch (e) {
    console.warn('MockEntities: could not save to localStorage', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // האם קיימות שאלות ישנות ב-localStorage שצריך להגר ל-IndexedDB?
      loadFromStorage._hadStoredQuestions = Array.isArray(parsed.questions) && parsed.questions.length > 0;
      const hierarchies = (parsed.hierarchies?.length >= 15)
        ? parsed.hierarchies
        : DEFAULT_DATA.hierarchies;
      // ── Deduplicate by ID + normalize all questions ──────────
      const rawQuestions = parsed.questions ?? DEFAULT_DATA.questions;
      const seenIds = new Set();
      const LEADING_NUM_RE = /^\d{1,3}\s*[.):\-]\s*/;
      const VALID_TYPES = new Set(['single_choice', 'multi_choice', 'true_false', 'open_ended', 'rolling_case']);

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

        const status = normalizeLegacyStatus(q.status);
        const category = q.category || SEED_CATEGORY;
        const sub_category = q.sub_category || getSubcategoriesForCategory(category)[0];

        return {
          ...q,
          id,
          question_text,
          question_type: VALID_TYPES.has(question_type) ? question_type : 'single_choice',
          category,
          sub_category,
          thinking_level: q.thinking_level || 'Knowledge',
          training_level: q.training_level || 'A',
          medical_levels: Array.isArray(q.medical_levels) ? q.medical_levels : [],
          case_name: q.case_name || '',
          rolling_case: q.rolling_case || null,
          suspended_due_to_branch: q.suspended_due_to_branch || '',
          has_media: computeQuestionHasMedia({
            media_attachment: q.media_attachment,
            media_bank_tag: q.media_bank_tag,
          }),
          status,
          total_attempts: q.total_attempts ?? 0,
          total_success: q.total_success ?? 0,
          success_rate: q.success_rate ?? null,
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

// Runtime data — non-question entities load from localStorage; questions load
// from IndexedDB (async) via ensureQuestionsLoaded() below.
const mockData = loadFromStorage();
if (loadFromStorage._migratedMediaBank) saveToStorage();

// Begin loading the questions bank from IndexedDB immediately (non-blocking).
// Components read via the async find()/findOne() which await this first.
if (typeof window !== 'undefined') {
  window.__quizMDA_questionsReady = ensureQuestionsLoaded();
}

async function readApiError(res, fallbackMessage) {
  try {
    const data = await res.json();
    if (data?.error) return data.error;
  } catch {
    // ignore parse errors
  }
  return fallbackMessage;
}

/**
 * Normalize a server question doc into the local format used by components.
 */
function serverToLocal(sq) {
  const cat = sq.category || SEED_CATEGORY;
  return {
    id: sq.id || sq._id || uid('q'),
    category: cat,
    sub_category: sq.sub_category || getSubcategoriesForCategory(cat)[0],
    thinking_level: sq.thinking_level || 'Knowledge',
    training_level: sq.training_level || 'A',
    medical_levels: Array.isArray(sq.medical_levels) ? sq.medical_levels : [],
    case_name: sq.case_name || '',
    rolling_case: sq.rolling_case || null,
    suspended_due_to_branch: sq.suspended_due_to_branch || '',
    has_media:
      typeof sq.has_media === 'boolean'
        ? sq.has_media
        : computeQuestionHasMedia({
            media_attachment: sq.media_attachment,
            media_bank_tag: sq.media_bank_tag,
          }),
    question_type: sq.question_type || 'single_choice',
    question_text: sq.question_text,
    options: sq.options ?? [],
    correct_answer: sq.correct_answer,
    explanation: sq.explanation ?? null,
    hint: sq.hint ?? null,
    status: normalizeLegacyStatus(sq.status) || 'draft',
    media_attachment: sq.media_attachment ?? null,
    media_bank_tag: sq.media_bank_tag ?? null,
    total_attempts: sq.total_attempts ?? 0,
    total_success: sq.total_success ?? 0,
    success_rate: sq.success_rate ?? 0,
    book_classified_at: sq.book_classified_at ?? '',
    createdAt: sq.createdAt,
    updatedAt: sq.updatedAt,
  };
}

function isLocalhostEnv() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/**
 * Fetch ALL questions from the server (paginated) and REPLACE the local cache
 * in IndexedDB. Server = single source of truth; IndexedDB is the local cache.
 *
 * חשוב: הסנכרון רץ אך ורק לאחר התחברות (קיים auth token) — כדי למנוע 401
 * במחשבים חדשים. הלולאה מושכת את כל הדפים עד שבנק השאלות מתרוקן, ואז שומרת
 * הכול במכה אחת ל-IndexedDB. במהלך הסנכרון נורים אירועי התקדמות ל-UI.
 *
 * @param {{ force?: boolean }} [opts] force=true עוקף את בדיקת ההתחברות (לדיבוג)
 */
export async function syncQuestionsFromServer(opts = {}) {
  if (typeof window === 'undefined') return { fetched: 0 };

  // ── Auth gate: לא מסנכרנים לפני התחברות מאומתת ──────────────────────
  const hasToken = !!getAuthToken();
  if (!opts.force && !hasToken && !isLocalhostEnv()) {
    console.warn('[syncQuestionsFromServer] דילוג: אין טוקן הזדהות עדיין (לפני התחברות).');
    return { fetched: 0, local: mockData.questions.length, skipped: true, reason: 'no-auth' };
  }

  // מבטיחים שה-cache המקומי נטען לפני שנדרוס אותו.
  await ensureQuestionsLoaded();

  const PAGE_SIZE = 1000;
  let skip = 0;
  let apiQuestions = [];
  let page;
  let total = null;
  let serverDbConnected = true;
  let gotSuccessfulPage = false;

  emitSyncStatus({ phase: 'start', loaded: 0, total: null });

  try {
    do {
      const res = await fetch(
        `/api/questions?skip=${skip}&limit=${PAGE_SIZE}&_t=${Date.now()}`,
        { cache: 'no-store' },
      );
      if (res.status === 401 || res.status === 403) {
        console.warn('[syncQuestionsFromServer] 401/403 — נדרשת התחברות מחדש; שומרים cache מקומי.');
        emitSyncStatus({ phase: 'error', loaded: apiQuestions.length, total, reason: 'unauthorized' });
        return { fetched: 0, local: mockData.questions.length, skipped: true, reason: 'unauthorized' };
      }
      if (!res.ok) break;
      if (skip === 0) {
        serverDbConnected = res.headers.get('X-QuizMDA-Db-Connected') !== '0';
        const totalHeader = parseInt(res.headers.get('X-QuizMDA-Total-Count') || '', 10);
        if (Number.isFinite(totalHeader) && totalHeader >= 0) total = totalHeader;
      }
      page = await res.json();
      if (!Array.isArray(page)) break;
      gotSuccessfulPage = true;
      apiQuestions = apiQuestions.concat(page);
      skip += PAGE_SIZE;
      emitSyncStatus({ phase: 'progress', loaded: apiQuestions.length, total: total ?? apiQuestions.length });
    } while (page.length === PAGE_SIZE);

    if (!gotSuccessfulPage) {
      console.warn('[syncQuestionsFromServer] לא התקבל דף תקין; שומרים cache מקומי.');
      emitSyncStatus({ phase: 'done', loaded: mockData.questions.length, total: mockData.questions.length });
      // transient: דף ראשון ריק/שגוי (לרוב שרת/רשת מתעוררים) — שווה ניסיון חוזר.
      return { fetched: 0, local: mockData.questions.length, skipped: true, transient: true };
    }
    if (!serverDbConnected) {
      console.warn('[syncQuestionsFromServer] מסד הנתונים בשרת אינו מחובר; שומרים cache מקומי.');
      emitSyncStatus({ phase: 'done', loaded: mockData.questions.length, total: mockData.questions.length });
      // transient: מסד הנתונים בשרת עדיין מתחבר (cold start) — שווה ניסיון חוזר.
      return { fetched: 0, local: mockData.questions.length, skipped: true, transient: true };
    }

    // המרה ושמירה בבת אחת ל-IndexedDB (כולל ניקוי הקיים).
    mockData.questions = apiQuestions.map(serverToLocal);
    const saved = await idbSaveQuestionsBulk(mockData.questions, { clear: true });
    if (!saved) {
      console.warn('[syncQuestionsFromServer] שמירה ל-IndexedDB נכשלה; הנתונים זמינים בזיכרון בלבד.');
    }
    console.log(`[syncQuestionsFromServer] הוחלף ה-cache ב-${mockData.questions.length} שאלות מהשרת`);
    emitSyncStatus({ phase: 'done', loaded: mockData.questions.length, total: total ?? mockData.questions.length });
    return { fetched: mockData.questions.length };
  } catch (e) {
    console.error('[syncQuestionsFromServer] שגיאה:', e);
    emitSyncStatus({ phase: 'error', loaded: apiQuestions.length, total, reason: e?.message });
    // transient: שגיאת רשת/שרת — שווה ניסיון חוזר במחשב חדש שאין בו cache.
    return { fetched: 0, local: mockData.questions.length, error: e.message, transient: true };
  }
}

/** האם קיים cache אמיתי של שאלות מקומית (שאלות seed לעולם אינן נכתבות ל-IndexedDB). */
async function hasCachedQuestions() {
  try {
    const stored = await idbGetAllQuestions();
    return Array.isArray(stored) && stored.length > 0;
  } catch {
    return false;
  }
}

/** ממתין שטוקן ההזדהות ייכתב ל-localStorage (מטפל במרוץ שאחרי התחברות). */
async function waitForAuthToken(maxWaitMs = SYNC_TOKEN_WAIT_MS, pollMs = SYNC_TOKEN_POLL_MS) {
  if (getAuthToken()) return true;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    if (getAuthToken()) return true;
  }
  return !!getAuthToken();
}

/**
 * סנכרון עמיד (resilient) של בנק השאלות מהשרת.
 *
 * זהו ה-entry point שבו יש להשתמש אחרי התחברות / טעינת משתמש: הוא ממתין
 * תחילה לטוקן ההזדהות (כדי לא לשלוח בקשה לא מאומתת מיד אחרי לוגין), ואז מבצע
 * את הסנכרון עם ניסיונות חוזרים והשהיה גדלה — אך ורק כל עוד אין עדיין cache
 * מקומי אמיתי והשרת החזיר תשובה חולפת (cold start / מסד מתחבר / שגיאת רשת).
 *
 * כך משתמש חדש במחשב נקי מקבל בוודאות את כל מאגר השאלות מהשרת, במקום להיתקע
 * על שתי שאלות ה-seed בעקבות כשל חולף יחיד. משתמשים חוזרים (שכבר יש להם cache)
 * ומחשבי dev לוקאליים שומרים על ההתנהגות הקיימת.
 *
 * @param {{ force?: boolean, maxAttempts?: number }} [opts]
 * @returns {Promise<object>} תוצאת הסנכרון האחרונה
 */
export async function ensureQuestionsSynced(opts = {}) {
  if (typeof window === 'undefined') return { fetched: 0 };

  // ממתינים לטוקן לפני הניסיון הראשון (לא בלוקאלי, שבו אין אכיפת auth).
  if (!opts.force && !isLocalhostEnv()) {
    await waitForAuthToken();
  }

  // Snapshot whether a REAL question cache already existed before this sync.
  // Used by the UI to detect the one-time "no real cache → real questions just
  // arrived" transition (so it can refresh once to surface the new bank).
  const hadCacheBefore = await hasCachedQuestions();

  const maxAttempts = Math.max(1, opts.maxAttempts ?? SYNC_MAX_ATTEMPTS);
  let result = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result = await syncQuestionsFromServer(opts);
    const cached = await hasCachedQuestions();
    if (!shouldRetrySync(result, cached)) {
      return tagFirstPopulation(result, hadCacheBefore);
    }
    if (attempt < maxAttempts) {
      const delay = backoffDelay(attempt);
      console.warn(
        `[ensureQuestionsSynced] סנכרון לא הושלם (ניסיון ${attempt}/${maxAttempts}); ניסיון חוזר בעוד ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return tagFirstPopulation(result || { fetched: 0 }, hadCacheBefore);
}

/**
 * Mark a sync result as the FIRST population of the local cache, i.e. the client
 * previously had no real cached questions and this sync just fetched the real
 * bank. The UI uses this (once, guarded) to refresh so freshly-synced questions
 * display without a manual reload. Returning users (cache already present) and
 * transient/failed syncs (fetched === 0) are never flagged.
 */
function tagFirstPopulation(result, hadCacheBefore) {
  if (result && typeof result.fetched === 'number' && result.fetched > 0 && !hadCacheBefore) {
    return { ...result, firstPopulation: true };
  }
  return result;
}

// Mock entity implementations
export const mockEntities = {
  Question_Bank: {
    find: async (query = {}, options = {}) => {
      await ensureQuestionsLoaded();
      let results = mockData.questions.filter(q => matchQuery(q, query));
      if (options.sort) {
        const [field, dir] = Object.entries(options.sort)[0];
        results.sort((a, b) => dir === -1 ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
      }
      if (options.limit) results = results.slice(0, options.limit);
      return results;
    },
    findOne: async (query) => {
      await ensureQuestionsLoaded();
      if (query.id) {
        return mockData.questions.find(q => q.id === query.id) || null;
      }
      return null;
    },
    create: async (data) => {
      await ensureQuestionsLoaded();
      try {
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const msg = await readApiError(res, 'יצירת השאלה נכשלה בשרת');
          throw new Error(msg);
        }
        const created = await res.json();
        const q = serverToLocal(Array.isArray(created) ? created[0] : created);
        mockData.questions.push(q);
        await idbPutQuestion(q);
        return q;
      } catch (err) {
        throw new Error(err?.message || 'שגיאת תקשורת בשמירת השאלה');
      }
    },
    update: async (id, data) => {
      await ensureQuestionsLoaded();
      try {
        const res = await fetch(`/api/questions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const msg = await readApiError(res, 'עדכון השאלה נכשל בשרת');
          throw new Error(msg);
        }
        const updated = serverToLocal(await res.json());
        const idx = mockData.questions.findIndex(q => q.id === id);
        if (idx !== -1) mockData.questions[idx] = updated;
        else mockData.questions.push(updated);
        await idbPutQuestion(updated);
        return updated;
      } catch (err) {
        throw new Error(err?.message || 'שגיאת תקשורת בעדכון השאלה');
      }
    },
    delete: async (id) => {
      await ensureQuestionsLoaded();
      try {
        const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const msg = await readApiError(res, 'מחיקת השאלה נכשלה בשרת');
          throw new Error(msg);
        }
      } catch (err) {
        throw new Error(err?.message || 'שגיאת תקשורת במחיקת השאלה');
      }
      const index = mockData.questions.findIndex(q => q.id === id);
      if (index !== -1) {
        mockData.questions.splice(index, 1);
        await idbDeleteQuestion(id);
        return { success: true };
      }
      return { success: false };
    },
    distinct: async (field) => {
      await ensureQuestionsLoaded();
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
      try {
        const res = await fetch('/api/users', { cache: 'no-store' });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) return list.filter(u => matchQuery(u, query));
        }
      } catch (_) { /* server unreachable — use local */ }
      return mockData.users.filter(u => matchQuery(u, query));
    },
    findOne: async (query) => {
      try {
        const res = await fetch('/api/users', { cache: 'no-store' });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            if (query.user_id) {
              const u = list.find(x => x.user_id === query.user_id);
              if (u) return u;
            }
            if (query.email) {
              const u = list.find(x => (x.email || '').toLowerCase() === (query.email || '').toLowerCase());
              if (u) return u;
            }
            if (query.google_id) {
              const u = list.find(x => x.google_id === query.google_id);
              if (u) return u;
            }
          }
        }
      } catch (_) { /* fallback to local */ }
      if (query.user_id) return mockData.users.find(u => u.user_id === query.user_id) || null;
      if (query.email) return mockData.users.find(u => u.email === query.email) || null;
      if (query.google_id) return mockData.users.find(u => u.google_id === query.google_id) || null;
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
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser),
        });
      } catch (_) { /* server unreachable */ }
      return newUser;
    },
    update: async (userId, data) => {
      let index = mockData.users.findIndex(u => u.user_id === userId);
      if (index === -1) {
        try {
          const res = await fetch('/api/users', { cache: 'no-store' });
          if (res.ok) {
            const list = await res.json();
            const remote = Array.isArray(list) ? list.find((u) => u.user_id === userId) : null;
            if (remote) {
              mockData.users.push({ ...remote });
              index = mockData.users.length - 1;
            }
          }
        } catch (_) { /* offline */ }
      }
      if (index !== -1) {
        mockData.users[index] = {
          ...mockData.users[index],
          ...data,
          updatedAt: new Date()
        };
        saveToStorage();
        try {
          await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockData.users[index]),
          });
        } catch (_) { /* server unreachable */ }
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
      saveToStorage();
      try {
        const { onActivityLogCreated } = await import('./workflows/suspensionLogic.js');
        await onActivityLogCreated(newLog);
      } catch (err) {
        console.warn('[Activity_Log] hook נכשל:', err?.message || err);
      }
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
