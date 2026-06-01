/**
 * Theme management — light / dark / system
 * Hebrew: ניהול ערכת נושא
 */

const THEME_KEY = 'mda-theme';
const VALID = ['light', 'dark', 'system'];

export function getThemePreference() {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return VALID.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference = getThemePreference()) {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(preference) {
  if (typeof document === 'undefined') return resolveTheme(preference);
  const resolved = resolveTheme(preference ?? getThemePreference());
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function setThemePreference(preference) {
  if (!VALID.includes(preference)) return;
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    /* ignore */
  }
  applyTheme(preference);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { preference, resolved: resolveTheme(preference) } }));
  }
}

export function toggleTheme() {
  const resolved = resolveTheme();
  setThemePreference(resolved === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  if (typeof window === 'undefined') return;
  applyTheme(getThemePreference());
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (mq) {
    const onChange = () => {
      if (getThemePreference() === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onChange);
  }
}

export function getTheme() {
  return resolveTheme();
}
