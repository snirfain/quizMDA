/**
 * Offline Storage Utilities
 * Local storage for offline practice sessions
 * Hebrew: אחסון מקומי למצב לא מקוון
 */

const STORAGE_PREFIX = 'mda_offline_';
const PRACTICE_SESSIONS_KEY = 'practice_sessions';
const QUESTIONS_CACHE_KEY = 'questions_cache';
const SYNC_QUEUE_KEY = 'sync_queue';

/**
 * Save practice session data locally
 * @param {Object} sessionData - Session data to save
 * @returns {Promise<void>}
 */
export async function savePracticeSession(sessionData) {
  try {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      // Fallback to localStorage
      return saveToLocalStorage(PRACTICE_SESSIONS_KEY, sessionData);
    }

    // Use IndexedDB for larger data
    const db = await openDB();
    const transaction = db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    
    await store.put({
      id: sessionData.id || Date.now().toString(),
      ...sessionData,
      timestamp: Date.now()
    });

    return Promise.resolve();
  } catch (error) {
    console.error('Error saving practice session:', error);
    // Fallback to localStorage
    return saveToLocalStorage(PRACTICE_SESSIONS_KEY, sessionData);
  }
}

/**
 * Load practice sessions from local storage
 * @returns {Promise<Array>} Array of practice sessions
 */
export async function loadPracticeSessions() {
  try {
    if (typeof window === 'undefined') return [];

    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    }

    // Fallback to localStorage
    return loadFromLocalStorage(PRACTICE_SESSIONS_KEY) || [];
  } catch (error) {
    console.error('Error loading practice sessions:', error);
    return loadFromLocalStorage(PRACTICE_SESSIONS_KEY) || [];
  }
}

/**
 * Save questions cache locally
 * @param {Array} questions - Questions to cache
 * @returns {Promise<void>}
 */
export async function saveQuestions(questions) {
  try {
    if (typeof window === 'undefined') return;

    const cacheData = {
      questions,
      timestamp: Date.now(),
      expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await store.put({
        key: QUESTIONS_CACHE_KEY,
        data: cacheData,
        timestamp: Date.now()
      });
    } else {
      saveToLocalStorage(QUESTIONS_CACHE_KEY, cacheData);
    }
  } catch (error) {
    console.error('Error saving questions cache:', error);
  }
}

/**
 * Load questions from cache
 * @returns {Promise<Array|null>} Cached questions or null
 */
export async function loadQuestions() {
  try {
    if (typeof window === 'undefined') return null;

    let cacheData = null;

    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(QUESTIONS_CACHE_KEY);
      
      cacheData = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => reject(request.error);
      });
    } else {
      cacheData = loadFromLocalStorage(QUESTIONS_CACHE_KEY);
    }

    if (!cacheData) return null;

    // Check expiry
    if (cacheData.expiry && Date.now() > cacheData.expiry) {
      await clearQuestionsCache();
      return null;
    }

    return cacheData.questions || null;
  } catch (error) {
    console.error('Error loading questions cache:', error);
    return null;
  }
}

/**
 * Add item to sync queue
 * @param {Object} item - Item to sync
 * @returns {Promise<void>}
 */
export async function addToSyncQueue(item) {
  try {
    if (typeof window === 'undefined') return;

    const queue = await getSyncQueue();
    queue.push({
      ...item,
      id: item.id || Date.now().toString(),
      timestamp: Date.now(),
      retries: 0
    });

    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['sync'], 'readwrite');
      const store = transaction.objectStore('sync');
      await store.put({
        key: SYNC_QUEUE_KEY,
        data: queue,
        timestamp: Date.now()
      });
    } else {
      saveToLocalStorage(SYNC_QUEUE_KEY, queue);
    }
  } catch (error) {
    console.error('Error adding to sync queue:', error);
  }
}

/**
 * Get sync queue
 * @returns {Promise<Array>} Sync queue
 */
export async function getSyncQueue() {
  try {
    if (typeof window === 'undefined') return [];

    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['sync'], 'readonly');
      const store = transaction.objectStore('sync');
      const request = store.get(SYNC_QUEUE_KEY);
      
      const result = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.data || []);
        request.onerror = () => reject(request.error);
      });
      
      return result;
    }

    return loadFromLocalStorage(SYNC_QUEUE_KEY) || [];
  } catch (error) {
    console.error('Error getting sync queue:', error);
    return loadFromLocalStorage(SYNC_QUEUE_KEY) || [];
  }
}

/**
 * Clear sync queue
 * @returns {Promise<void>}
 */
export async function clearSyncQueue() {
  try {
    if (typeof window === 'undefined') return;

    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['sync'], 'readwrite');
      const store = transaction.objectStore('sync');
      await store.delete(SYNC_QUEUE_KEY);
    } else {
      localStorage.removeItem(STORAGE_PREFIX + SYNC_QUEUE_KEY);
    }
  } catch (error) {
    console.error('Error clearing sync queue:', error);
  }
}

/**
 * Sync when online
 * @param {Function} syncFunction - Function to sync each item
 * @returns {Promise<Object>} Sync results
 */
export async function syncWhenOnline(syncFunction) {
  if (!navigator.onLine) {
    return { successful: 0, failed: 0, total: 0 };
  }

  const queue = await getSyncQueue();
  if (queue.length === 0) {
    return { successful: 0, failed: 0, total: 0 };
  }

  let successful = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await syncFunction(item);
      successful++;
    } catch (error) {
      console.error('Sync error:', error);
      item.retries = (item.retries || 0) + 1;
      
      // Remove item if retries exceeded
      if (item.retries > 3) {
        failed++;
      } else {
        // Re-add to queue
        await addToSyncQueue(item);
      }
    }
  }

  // Clear successfully synced items
  if (successful > 0) {
    const remainingQueue = queue.filter(item => item.retries <= 3);
    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['sync'], 'readwrite');
      const store = transaction.objectStore('sync');
      await store.put({
        key: SYNC_QUEUE_KEY,
        data: remainingQueue,
        timestamp: Date.now()
      });
    } else {
      saveToLocalStorage(SYNC_QUEUE_KEY, remainingQueue);
    }
  }

  return { successful, failed, total: queue.length };
}

/**
 * Clear questions cache
 * @returns {Promise<void>}
 */
export async function clearQuestionsCache() {
  try {
    if (typeof window === 'undefined') return;

    if ('indexedDB' in window) {
      const db = await openDB();
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await store.delete(QUESTIONS_CACHE_KEY);
    } else {
      localStorage.removeItem(STORAGE_PREFIX + QUESTIONS_CACHE_KEY);
    }
  } catch (error) {
    console.error('Error clearing questions cache:', error);
  }
}

/**
 * Open IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MDA_OfflineDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('sync')) {
        db.createObjectStore('sync', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Save to localStorage (fallback)
 */
function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (error) {
    console.error('localStorage save error:', error);
  }
}

/**
 * Load from localStorage (fallback)
 */
function loadFromLocalStorage(key) {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('localStorage load error:', error);
    return null;
  }
}
