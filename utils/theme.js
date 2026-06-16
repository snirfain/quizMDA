/**
 * Theme management — light only.
 * Dark mode was removed; the whole system is always light.
 * Hebrew: ניהול ערכת נושא — מצב בהיר בלבד (מצב כהה הוסר).
 */

const THEME_KEY = 'mda-theme';

export function getThemePreference() {
  return 'light';
}

export function resolveTheme() {
  return 'light';
}

export function applyTheme() {
  if (typeof document === 'undefined') return 'light';
  // Ensure no leftover dark attribute from a previous version.
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = 'light';
  return 'light';
}

export function setThemePreference() {
  applyTheme();
}

export function toggleTheme() {
  applyTheme();
}

export function initTheme() {
  if (typeof window === 'undefined') return;
  // Clear any previously stored dark/system preference so it never re-applies.
  try {
    if (localStorage.getItem(THEME_KEY) && localStorage.getItem(THEME_KEY) !== 'light') {
      localStorage.setItem(THEME_KEY, 'light');
    }
  } catch {
    /* ignore */
  }
  applyTheme();
}

export function getTheme() {
  return 'light';
}
