import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS when using dangerouslySetInnerHTML.
 * Allows basic formatting tags but strips scripts, event handlers, etc.
 */
export function sanitizeHtml(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div', 'ul', 'ol', 'li', 'sub', 'sup'],
    ALLOWED_ATTR: ['style', 'class', 'dir'],
  });
}
