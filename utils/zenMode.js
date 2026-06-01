/**
 * Zen mode — hide global chrome during exam/practice
 * Hebrew: מצב זן ללא הסחות
 */

export function setZenMode(enabled) {
  if (typeof document === 'undefined') return;
  if (enabled) {
    document.body.classList.add('zen-mode');
  } else {
    document.body.classList.remove('zen-mode');
  }
}
