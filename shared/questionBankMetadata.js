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
  '6. אנטומיה ופיזיולוגיה קרדיווסקולארית',
  '7. מחלות ופגיעות במערכת הווסקולארית',
  '8. מחלות קרדיווסקולאריות',
  '9. הפרעות קצב ואוטם בשריר הלב',
  '10. פגיעות בכלי דם',
  '11. אנטומיה ופיזיולוגיה של מערכת העצבים',
  '12. הפרעות במערכת העצבים',
  '13. פגיעות ראש',
  '14. אנטומיית הבטן ופגיעות באיברי הבטן והאגן',
  '15. אנטומיה ופגיעות במערכת העור השרירים והשלד',
  '16. מערכת המין גניקולוגיה ומיילדות',
  '17. אנדוקרינולוגיה',
  '18. טיפול חירום לאנשים בקבוצות עם מאפיינים מיוחדים',
  '19. טיפול במצבי חירום',
  '20. מצבי חירום בפסיכיאטריה',
  '21. פדיאטריה ורפואת ילדים',
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
export const MEDICAL_LEVEL_VALUES = ['ALS', 'BLS', 'CLS', 'DLS', 'ELS'];

/** @type {{ value: string, label: string }[]} — A=ALS … E=ELS */
export const TRAINING_LEVELS = [
  { value: 'A', label: 'A (ALS)' },
  { value: 'B', label: 'B (BLS)' },
  { value: 'C', label: 'C (CLS)' },
  { value: 'D', label: 'D (DLS)' },
  { value: 'E', label: 'E (ELS)' },
];

export const MEDICAL_LEVELS = [
  { value: 'ALS', label: 'ALS' },
  { value: 'BLS', label: 'BLS' },
  { value: 'CLS', label: 'CLS' },
  { value: 'DLS', label: 'DLS' },
  { value: 'ELS', label: 'ELS' },
];

export const QUESTION_STATUS_VALUES = ['active', 'under_review', 'draft'];

/** @type {{ value: string, label: string }[]} */
export const QUESTION_STATUSES = [
  { value: 'active', label: 'פעיל' },
  { value: 'under_review', label: 'בבדיקה' },
  { value: 'draft', label: 'טיוטה' },
];

const genericSubs = ['תת־נושא כללי'];

/** @type {Record<string, string[]>} sub-chapters keyed by category value */
export const PLACEHOLDER_SUBCATEGORIES_BY_CATEGORY = {
  '1. מבוא לרפואת חירום טרום אשפוזית': [
    'רפואת חירום: הגדרות כלליות.',
    'הדגמים של מערכות רפואת חירום טרום־אשפוזיות.',
    'מגן דוד אדום - ארגון רפואת החירום הטרום־אשפוזית של ישראל.',
  ],
  '2. הערכת מצב המטופל': [
    'דרכי פעולה מהרגע שמתקבלת הקריאה הראשונית',
    'הגישה להערכת פצוע',
    'הבדיקות הדרושות כשמגיעים לזירת האירוע',
    'פעולות שמבצעים בזירת האירוע',
    'הגישה לנפגע טראומה',
    'טראומה בסביבה עוינת',
  ],
  '3. אנטומיה ופיזיולוגיה של מערכת הנשימה': [
    'אנטומיה של מערכת הנשימה',
    'פיזיולוגיה של מערכת הנשימה',
  ],
  '4. החולה הנשימתי': [
    'הגישה למטופל הנשימתי',
    'סימנים למצוקה נשימתית',
    'אסתמה: מצב חירום נשימתי',
    'פגיעות נוספות בדרכי הנשימה',
    'דגשים שחשוב לשים לב אליהם',
  ],
  '5. פגיעות במערכת הנשימה': [
    'חזה אוויר בלחץ (Tension Pneumothorax)',
    'חבורה לבבית (Cardiac Contusion)',
    'פגיעות נוספות במערכת הנשימה',
  ],
  '6. אנטומיה ופיזיולוגיה קרדיווסקולארית': ['מבנה הלב ופעולתו'],
  '7. מחלות ופגיעות במערכת הווסקולארית': ['סוגי ההלם', 'הטיפול בפגיעות בטן'],
  '8. מחלות קרדיווסקולאריות': [
    'אבחון של אי־ספיקת לב',
    'קרדיומיופתיה (Cardiomyopathy)',
    'אנדוקרדיטיס',
    'הפרעות מבניות של הלב',
    'קרדיולוגיה פדיאטרית (מומי לב מולדים)',
    'קרדיאולוגיה בטראומה',
    'דום לב (Cardiac Arrest: CA)',
    'דום לב פתאומי (Sudden Cardiac Arrest: SCA)',
    'החייאה',
  ],
  '9. הפרעות קצב ואוטם בשריר הלב': [
    'הגלים הבסיסיים בבדיקת אק"ג',
    'האבחנה המבדלת על פי ממצאי תרשים האק"ג',
    'סינוס טכיקרדיה',
    'סינוס ברדיקרדיה',
    'טכיקרדיה צומתית',
    'טכיקרדיה חדרית (Ventricular Tachycardia: VT)',
    'תסמונת הסינוס החולה (Sick Sinus Syndrome: SSS)',
    'חסימת AV',
    'חסימת צרור הולכה (Bundle Branch Block: BBB)',
    'היפרטרופיה חדרית',
    'אוטם שריר הלב (Myocardial Infarction: MI)',
    'אוטם קדמי (Anterior MI)',
    'אוטם תחתון (Inferior MI)',
    'סוגי הקרדיומיופתיה',
    'קרדיומיופתיה רסטריקטיבית (Restrictive Cardiomyopathy: RCM)',
    'תסמונת ברוגדה (Brugada Syndrome)',
    'פרימיוקרדיטיס (Perimyocarditis)',
    'טמפונדה לבבית (Cardiac Tamponade)',
  ],
  '10. פגיעות בכלי דם': [
    'מבוא.',
    'קרישת הדם.',
    'מחלת לב איסכמית (Ischemic Heart Disease: IHD).',
    'טרשת עורקים קורונרית (Coronary Artery Disease).',
    'תעוקת חזה (Angina Pectoris).',
    'תסמונת כלילית חריפה (Acute Coronary Syndrome: ACS).',
    'אוטם שריר הלב (Myocardial Infarction: MI).',
    'שבץ מוחי (Acute Stroke: AS), שבץ מוחי איסכמי (Ischemic Stroke Accident: ISA).',
    'תסחיף ריאות (Pulmonary Embolism: PE).',
    'אירוע מזנטרי (Acute Mesenteric Ischemia).',
    'עקרונות הטיפול בדימומים.',
    'דיסצקציה של האאורטה (Aortic Dissection).',
    'הלם (Shock).',
    'סיכום.',
  ],
  '11. אנטומיה ופיזיולוגיה של מערכת העצבים': [
    'מבנה מערכת העצבים ותפקידיה.',
    'תא עצב, נוירון (Neuron, Nerve).',
    'מערכת העצבים המרכזית (Central Nervous System: CNS).',
    'מערכת העצבים ההיקפית (Peripheral Nervous System: PNS).',
  ],
  '12. הפרעות במערכת העצבים': [
    'פרכוסים (Seizures)',
    'שבץ מוחי, אירוע מוחי (Acute Stroke)',
    'מצבי חירום סוכרתיים',
  ],
  '13. פגיעות ראש': [
    'שלבי העלייה ב־ICP',
    'סימנים קליניים ב־ICP',
    'הטיפול בלחץ תוך־גולגולתי מוגבר',
    'דימום תוך־גולגולתי (Intracranial Hemorrhage)',
    'שברים בגולגולת',
    'טיפול',
  ],
  '14. אנטומיית הבטן ופגיעות באיברי הבטן והאגן': [
    'שליטה על מערכת העיכול בגוף',
    'כאבי בטן',
    'הגישה למצב חירום בטני',
    'הטיפול בכאב בטני',
  ],
  '15. אנטומיה ופגיעות במערכת העור השרירים והשלד': [
    'פגיעות במערכת העור',
    'הטיפול בפציעות בעור',
    'הערכה',
    'סכנות',
    'הטיפול',
  ],
  '16. מערכת המין גניקולוגיה ומיילדות': [
    'זקפה (Erection)',
    'שפיכה (Ejaculation)',
    'הטסטוסטרון (Testosterone)',
    'מבנה מערכת המין הנקבית',
    'הטיפול',
    'הפרעות רחמיות',
    'סוגי הפלות',
    'לידה מוקדמת',
    'השפעת הפיזיולוגיה על טראומה',
    'הגישה הטיפולית לטראומה בהיריון',
  ],
  '17. אנדוקרינולוגיה': [
    'המערכת האנדוקרינית (Endocrine System)',
    'אנטומיה ופיזיולוגיה',
    'מחלות ומצבי חירום אנדוקרינולוגיים',
    'מצבי חירום במחלת הסוכרת',
  ],
  '18. טיפול חירום לאנשים בקבוצות עם מאפיינים מיוחדים': [
    'עיוורים, חירשים או אילמים',
    'מטופלים סיעודיים',
    'אנשים עם מוגבלות קוגניטיבית או פיגור',
    'פגועי נפש, מתמודדי נפש',
    'הטיפול במצבי חירום ברפואת הנפש',
    'אשפוז פסיכיאטרי מרצון ואשפוז כפוי',
    'אנשים מקבוצות דתיות ועדתיות',
  ],
  '19. טיפול במצבי חירום': [
    'גישה קלינית לטיפול במצבי חירום',
    'חוסר הכרה',
    'דגשים לתשאול ולטיפול',
    'כאבי ראש',
    'כאבים בחזה',
    'כאבי בטן (Abdominal Pain)',
    'כאבי צד, כאבים לומבריים (Flank Pain)',
    'תסמונת זנב הסוס (Cauda Equina Syndrome)',
    'אונקולוגיה',
    'פענוח',
  ],
  '20. מצבי חירום בפסיכיאטריה': [
    'ההפרעות הפסיכיאטריות',
    'מצבי חירום בפסיכיאטריה: הגדרות',
    'יצירת קשר טיפולי בעת בדיקת המטופלים והנפגעים',
    'הרגעת נפגעים במצבי חרדה',
    'הרגעת המטופל הפסיכיאטרי הסוער',
    'מצבי חירום בהתמכרויות',
    'הנחיות לפעולה במטופל האובדני',
    'מניעת הפרעות פוסט־טראומטיות: תוכנית מד"א',
    'מניעת טראומטיזציה משנית ושחיקה אצל צוותי חירום והצלה',
    'טיפול כפוי בחולי נפש',
  ],
  '21. פדיאטריה ורפואת ילדים': [
    'הגדרות',
    'אנטומיה ופיזיולוגיה של ילדים',
    'האיברים שייפגעו בטראומה בילדים',
    'הטיפול בילדים',
    'הערכת נשימה',
    'אסתמה',
    'התייבשות בתינוקות וילדים',
  ],
  '22. טראומה סביבתית': [
    'פגיעות אקלים',
    'הפגיעה בריאות במהלך הטביעה',
    'החייאה במטופל היפותרמי',
    'תאונות צלילה',
    'הפגיעה בסינוסים ובאוזן התיכונה',
    'הנחשים הארסיים בישראל',
    'הטיפול בהכשת נחש ארסי',
    'עקרבים',
  ],
  '23. פרמקולוגיה ותרופות': [
    'מילון מונחים',
    'פרמקוקינטיקה',
    'פרמקודינמיקה (Pharmacodynamics)',
    'המרת מינונים',
    'חישוב נפח ומשקל של תרופות',
    'שימושים עיקריים בתרופות במד"א',
    'מודולת התרופות (מתוך פרוטוקול ALS)',
  ],
  '24. הרעלות': [
    'הקדמה',
    'רעלים המגיעים לגוף דרך מערכת העיכול',
    'רעלים המגיעים לגוף בשאיפה',
    'סמים',
    'התסמונה הקלינית בפגיעת זרחנים אורגניים',
    'ציאנידים',
  ],
  '25. מכשור ומיומנויות': ['סבבה שסתום פיפ (PEEP)', 'מדידת לחץ דם ידנית'],
  '26. עקרונות עבודה באירועים חריגים': [
    'הגדרת אר"ן לפי תנאי האירוע',
    'סיווג אר"ן לפי קטגוריות',
    'תעבורת הקשר באירוע רב־נפגעים',
    'מיון הנפגעים',
    'דגשים למיון וטיפול בילדים ובתינוקות',
    'זירת פיצוץ פח"ע (פעילות חבלנית עוינת)',
    'הטיפול הראשוני באר"ן',
    'סיכום תפקידי המטפלים במגה אר"ן',
    'עקרונות בהפשטה ובשטיפה',
  ],
  // לא נשלח פירוט תתי־נושאים לפרק 27 בבקשה, לכן נשמר ערך כללי עד לעדכון.
  '27. חילוץ, פינוי ונשיאת המטופל': [
    'העקרונות הכלליים לחילוץ',
    'שלבי החילוץ',
    'פינוי בהיטס',
    'אמצעים לנשיאת מטופל'
  ],
  '28. מבוא ובסיס': [
    'הקדמה',
    'המערכות בגוף האדם',
    'התהליכים המתקיימים בגוף האדם',
    'פתולוגיה (Pathology)',
    'מונחים רפואיים',
  ],
};

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
export function isValidMedicalLevel(value) {
  return typeof value === 'string' && MEDICAL_LEVEL_VALUES.includes(value);
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
  { value: 'rolling_case', label: 'שאלה מתגלגלת (גזע + ענפים)' },
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

/**
 * @param {{ media_attachment?: unknown, media_bank_tag?: unknown }} raw
 */
export function computeQuestionHasMedia(raw) {
  const tag =
    typeof raw?.media_bank_tag === 'string'
      ? raw.media_bank_tag.trim()
      : raw?.media_bank_tag != null
        ? String(raw.media_bank_tag).trim()
        : '';
  if (tag.length > 0) return true;
  return computeHasMedia(raw?.media_attachment);
}

/**
 * Static attachment vs מאגר תגית — לא יחד. אם יש תג לא ריק הוא מנצח (מוחק צרוף).
 * @param {{ media_attachment?: unknown, media_bank_tag?: unknown }} raw
 */
export function normalizeQuestionMediaPayload(raw) {
  const rawTag = raw?.media_bank_tag;
  const trimmed =
    typeof rawTag === 'string'
      ? rawTag.trim()
      : rawTag != null && String(rawTag).trim()
        ? String(rawTag).trim()
        : '';
  let media_attachment = raw?.media_attachment ?? null;
  if (trimmed) {
    return {
      media_attachment: null,
      media_bank_tag: trimmed,
      has_media: true,
    };
  }
  const hasAtt = computeHasMedia(media_attachment);
  return {
    media_attachment: hasAtt ? media_attachment : null,
    media_bank_tag: null,
    has_media: hasAtt,
  };
}
