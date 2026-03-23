/**
 * MDA content hierarchy categories and keyword-based classification.
 * Single source of truth -- used by both server (questionApi.js) and client (questionClassification.js).
 */

export const CATEGORY_KEYWORDS = [
  ['מבוא', 'בסיס', 'כללי', 'הגדרה', 'עקרון'], // h1
  ['החייאה', 'הנשמה', 'עיסוי', 'עיסויים', 'דום לב', 'CPR', 'BLS', 'ALS', 'חזה', '30:2', 'הנשמות', 'מפוח', 'AMBU', 'בלבד'], // h2
  ['תרופ', 'מינון', 'אדרנלין', 'אטרופין', 'פרמקולוגיה', 'Adenosine', 'אמפול', 'מתן תרופ'], // h3
  ['אנמנזה', 'בדיקה רפואית', 'סימנים', 'תסמין', 'GCS', 'הערכה'], // h4
  ['נתיב אוויר', 'אינטובציה', 'AW ', 'צנרור', 'קוניוטומיה', 'Coniotomy', 'חסימת נתיב'], // h5
  ['אסטמה', 'COPD', 'חנק', 'נשימה', 'ריאות', 'קוצר נשימה', 'מצפצף', 'סטרידור', 'בצקת ריאות', 'תסחיף ריאתי', 'היפווקסיה', 'חמצן'], // h6
  ['טראומה', 'PHTLS', 'שבר', 'דימום', 'פגיעות', 'חזה', 'בטן', 'ראש', 'שלד', 'כוויות', 'הלם', 'טביעה', 'תלייה', 'התחשמלות', 'מעיכה', 'הדף'], // h7
  ['אק"ג', 'אקג', 'קצב לב', 'דופק', 'אוטם', 'MI ', 'CVA', 'שבץ', 'טכיקרדיה', 'ברדיקרדיה', 'פרפור', 'דפיברילציה', 'קרדיווסקולר', 'לבבי', 'תעוקת חזה', 'ACS'], // h8
  ['סוכרת', 'פרכוס', 'הכרה', 'הרעלה', 'עילפון', 'סינקופה', 'חום', 'היפותרמיה', 'היפוגליקמיה', 'סטטוס'], // h9
  ['הריון', 'יילוד', 'קשיש', 'מבוגר', 'אוכלוסיות'], // h10
  ['אג"מ', 'אגמ'], // h11
  ['אר"ן', 'ארן', 'רב נפגעים', 'מיון'], // h12
  ['לידה', 'יולדת', 'גניקולוג', 'מיילדות', 'הריון', 'עובר', 'פרינאום'], // h13
  ['ילד', 'תינוק', 'פדיאטרי', 'ילדים', 'תינוקות', 'יילוד', 'משקל ק"ג'], // h14
  ['פסיכיאטר', 'אובדנות', 'התנהגות', 'איום'], // h15
];

function normalizeForMatch(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Classify question text into a hierarchy category by keyword scoring.
 * @param {string} questionText
 * @returns {string|null} hierarchy_id like "h2", "h7", or null if no match
 */
export function classifyQuestionToHierarchy(questionText) {
  if (!questionText) return null;
  const normalized = normalizeForMatch(questionText);
  if (!normalized) return null;

  let bestIdx = -1, bestScore = 0;
  for (let i = 0; i < CATEGORY_KEYWORDS.length; i++) {
    let score = 0;
    for (const kw of CATEGORY_KEYWORDS[i]) {
      if (normalized.includes(kw.toLowerCase())) {
        score += 1;
        if (kw.length >= 4) score += 0.5;
      }
    }
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestScore > 0 ? `h${bestIdx + 1}` : null;
}
