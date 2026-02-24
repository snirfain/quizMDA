/**
 * Security Utilities
 * Rate limiting and input validation
 * Hebrew: כלי אבטחה
 */

// Simple in-memory rate limiter (in production, use Redis or similar)
const rateLimitStore = new Map();

/**
 * Rate limiting
 */
export function rateLimit(userId, action, maxRequests = 10, windowMs = 60000) {
  const key = `${userId}_${action}`;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const record = rateLimitStore.get(key);
  
  if (now > record.resetTime) {
    // Reset window
    record.count = 1;
    record.resetTime = now + windowMs;
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { 
      allowed: false, 
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  record.count++;
  return { 
    allowed: true, 
    remaining: maxRequests - record.count 
  };
}

/**
 * Validate input
 */
export function validateInput(input, type = 'text', maxLength = 1000) {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }

  if (input.length > maxLength) {
    return { valid: false, error: `Input too long (max ${maxLength} characters)` };
  }

  // XSS protection - remove script tags
  const sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  return { valid: true, sanitized };
}

/**
 * Sanitize HTML
 */
export function sanitizeHTML(html) {
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}
