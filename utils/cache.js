/**
 * Caching Utilities
 * API response caching and localStorage cache
 * Hebrew: כלי מטמון
 */

const CACHE_PREFIX = 'mda_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached value
 */
export function getCache(key) {
  try {
    if (typeof window === 'undefined') return null;
    
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const { value, expiry } = JSON.parse(cached);
    
    if (Date.now() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return value;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set cache value
 */
export function setCache(key, value, ttl = DEFAULT_TTL) {
  try {
    if (typeof window === 'undefined') return;
    
    const expiry = Date.now() + ttl;
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, expiry }));
  } catch (error) {
    console.error('Cache set error:', error);
    // Handle quota exceeded
    if (error.name === 'QuotaExceededError') {
      clearOldCache();
    }
  }
}

/**
 * Remove cache entry
 */
export function removeCache(key) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.error('Cache remove error:', error);
  }
}

/**
 * Clear all cache
 */
export function clearCache() {
  try {
    if (typeof window === 'undefined') return;
    
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

/**
 * Clear expired cache entries
 */
function clearOldCache() {
  try {
    if (typeof window === 'undefined') return;
    
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { expiry } = JSON.parse(cached);
            if (Date.now() > expiry) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error('Clear old cache error:', error);
  }
}

/**
 * Cache API response
 */
export async function cachedFetch(url, options = {}, ttl = DEFAULT_TTL) {
  const cacheKey = `fetch_${url}_${JSON.stringify(options)}`;
  
  // Check cache
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch
  const response = await fetch(url, options);
  const data = await response.json();

  // Cache response
  setCache(cacheKey, data, ttl);

  return data;
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCache(pattern) {
  try {
    if (typeof window === 'undefined') return;
    
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX) && key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

// Clean old cache on load
if (typeof window !== 'undefined') {
  clearOldCache();
}
