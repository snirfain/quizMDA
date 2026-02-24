/**
 * RTL (Right-to-Left) Helper Functions
 * Hebrew: פונקציות עזר ל-RTL
 */

/**
 * Get RTL styles for components
 */
export function getRTLStyles(additionalStyles = {}) {
  return {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: 'Arial, Helvetica, sans-serif',
    ...additionalStyles
  };
}

/**
 * Format Hebrew date
 */
export function formatHebrewDate(date) {
  return new Date(date).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format Hebrew datetime
 */
export function formatHebrewDateTime(date) {
  return new Date(date).toLocaleString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get question type label in Hebrew
 */
export function getQuestionTypeLabel(type) {
  const labels = {
    single_choice: 'בחירה יחידה',
    multi_choice: 'בחירה מרובה',
    true_false: 'נכון/לא נכון',
    open_ended: 'שאלה פתוחה'
  };
  return labels[type] || type;
}

/**
 * Get role label in Hebrew
 */
export function getRoleLabel(role) {
  const labels = {
    trainee: 'מתאמן',
    instructor: 'מדריך',
    admin: 'מנהל'
  };
  return labels[role] || role;
}

/**
 * Get status label in Hebrew
 */
export function getStatusLabel(status) {
  const labels = {
    active: 'פעיל',
    draft: 'טיוטה',
    suspended: 'מושעה'
  };
  return labels[status] || status;
}

/**
 * Format percentage
 */
export function formatPercentage(value, decimals = 2) {
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Check if device is mobile
 */
export function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Check if device is tablet
 */
export function isTablet() {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= 768 && width < 1024;
}

/**
 * Check if device is desktop
 */
export function isDesktop() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}
