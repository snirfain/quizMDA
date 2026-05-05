/**
 * Question Bank metadata: categories, sub-categories, thinking levels,
 * training levels, and statuses. Single source of truth shared by the
 * editor UI, validation, mongoose model, and entity definition.
 *
 * Hebrew: מטא־דאטה לבנק השאלות
 */

const chapterStrings = [
  '1. מבוא לרפואת חירום טרום אשפוזית',
  '2. הערכת מצב המטופל',
  '3. אנטומיה ופיזיולוגיה של מערכת הנשימה',
  '4. החולה הנשימתי',
  '5. פגיעות במערכת הנשימה',
  '6. אנטומיה ופיזיולוגיה של מערכת הלב וכלי הדם',
  '7. מחלות ופגיעות במערכת הלב וכלי הדם',
  '8. מחלות לב וכלי דם',
  '9. הפרעות קצב ואוטם בשריר הלב',
  '10. פגיעות בכלי דם',
  '11. אנטומיה ופיזיולוגיה של מערכת העצבים',
  '12. הפרעות במערכת העצבים',
  '13. פגיעות ראש',
  '14. אנטומיית הבטן ופגיעות באיברי הבטן והאגן',
  '15. אנטומיה ופגיעות במערכת העור, השרירים והשלד',
  '16. מערכת המין, גניקולוגיה ומיילדות',
  '17. אנדוקרינולוגיה',
  '18. טיפול חירום לאנשים בקבוצות עם מאפיינים ייחודיים',
  '19. טיפול במצבי חירום',
  '20. מצבי חירום בפסיכיאטריה, אחבון וטיפול ראשוני',
  '21. פדיאטריה, רפואת ילדים',
  '22. טראומה סביבתית',
  '23. פרמקולוגיה ותרופות',
  '24. הרעלות',
  '25. מכשור ומיומנויות',
  '26. עקרונות עבודה באירועים חריגים',
  '27. חילוץ, פינוי ונשיאת המטופל',
  '28. מבוא ובסיס',
];

/** @type {{ value: string, label: string }[]} */
export const QUESTION_CATEGORIES = chapterStrings.map((label) => ({ value: label, label }));

export const THINKING_LEVEL_VALUES = ['Knowledge', 'Understanding', 'Application', 'Synthesis'];

/** @type {{ value: string, label: string }[]} */
export const THINKING_LEVELS = [
  { value: 'Knowledge', label: 'ידע' },
  { value: 'Understanding', label: 'הבנה' },
  { value: 'Application', label: 'יישום' },
  { value: 'Synthesis', label: 'סינתזה' },
];

export const TRAINING_LEVEL_VALUES = ['A', 'B', 'C', 'D', 'E'];

/** @type {{ value: string, label: string }[]} — A=ALS … E=ELS */
export const TRAINING_LEVELS = [
  { value: 'A', label: 'A (ALS)' },
  { value: 'B', label: 'B (BLS)' },
  { value: 'C', label: 'C (CLS)' },
  { value: 'D', label: 'D (DLS)' },
  { value: 'E', label: 'E (ELS)' },
];

export const QUESTION_STATUS_VALUES = ['active', 'under_review', 'draft'];

/** @type {{ value: string, label: string }[]} */
export const QUESTION_STATUSES = [
  { value: 'active', label: 'פעיל' },
  { value: 'under_review', label: 'בבדיקה' },
  { value: 'draft', label: 'טיוטה' },
];

const genericSubs = ['תת־נושא א', 'תת־נושא ב', 'תת־נושא ג'];

/** @type {Record<string, string[]>} placeholder sub-chapters keyed by category value */
export const PLACEHOLDER_SUBCATEGORIES_BY_CATEGORY = Object.fromEntries(
  chapterStrings.map((c) => [c, [...genericSubs]])
);

/**
 * @param {string} categoryValue — full chapter string from QUESTION_CATEGORIES
 * @returns {string[]}
 */
export function getSubcategoriesForCategory(categoryValue) {
  if (!categoryValue) return [...genericSubs];
  return PLACEHOLDER_SUBCATEGORIES_BY_CATEGORY[categoryValue] ?? [...genericSubs];
}

/** @returns {boolean} */
export function isValidCategory(value) {
  return typeof value === 'string' && chapterStrings.includes(value.trim());
}

/** @returns {boolean} */
export function isValidThinkingLevel(value) {
  return typeof value === 'string' && THINKING_LEVEL_VALUES.includes(value);
}

/** @returns {boolean} */
export function isValidTrainingLevel(value) {
  return typeof value === 'string' && TRAINING_LEVEL_VALUES.includes(value);
}

/** @returns {boolean} */
export function isValidQuestionStatus(value) {
  return typeof value === 'string' && QUESTION_STATUS_VALUES.includes(value);
}

export const QUESTION_TYPES_UI = [
  { value: 'single_choice', label: 'רב ברירה תשובה אחת נכונה' },
  { value: 'multi_choice', label: 'רב ברירה מספר תשובות נכונות' },
  { value: 'true_false', label: 'נכון/לא נכון' },
  { value: 'open_ended', label: 'שאלה פתוחה' },
];

/**
 * Normalize legacy status values toward the new tri-state enum.
 * @param {string} status
 */
export function normalizeLegacyStatus(status) {
  if (status === 'suspended' || status === 'pending_review' || status === 'needs_revision')
    return 'under_review';
  if (status === 'rejected') return 'under_review';
  if (QUESTION_STATUS_VALUES.includes(status)) return status;
  return 'draft';
}

/**
 * Truthy media: non-empty URL string or object with usable url/url field.
 * @param {unknown} media
 */
export function computeHasMedia(media) {
  if (media == null) return false;
  if (typeof media === 'string') return media.trim().length > 0;
  if (typeof media === 'object' && media !== null && 'url' in media)
    return String(/** @type {{ url?: string }} */ (media).url ?? '').trim().length > 0;
  return true;
}
