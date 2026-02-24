/**
 * Classify question text into MDA content hierarchy (category) by keywords or by AI.
 * Used to assign hierarchy_id when missing and for "reclassify all by content".
 */

import { appConfig } from '../config/appConfig';

// Keywords per category (order matches mockEntities MDA_CATEGORIES: h1..h15)
// More specific terms first; we score by number of matches.
const CATEGORY_KEYWORDS = [
  ['מבוא', 'בסיס', 'כללי', 'הגדרה', 'עקרון'], // h1 מבואות
  ['החייאה', 'הנשמה', 'עיסוי', 'עיסויים', 'דום לב', 'CPR', 'BLS', 'ALS', 'חזה', '30:2', 'הנשמות', 'מפוח', 'AMBU', 'בלבד'], // h2 החייאה בסיסית ומתקדמת
  ['תרופ', 'מינון', 'אדרנלין', 'אטרופין', 'פרמקולוגיה', 'Adenosine', 'אמפול', 'מתן תרופ'], // h3 פרמקולוגיה
  ['אנמנזה', 'בדיקה רפואית', 'סימנים', 'תסמין', 'GCS', 'הערכה'], // h4 אנמנזה ובדיקה
  ['נתיב אוויר', 'אינטובציה', 'AW ', 'צנרור', 'קוניוטומיה', 'Coniotomy', 'חסימת נתיב'], // h5 נתיב אוויר
  ['אסטמה', 'COPD', 'חנק', 'נשימה', 'ריאות', 'קוצר נשימה', 'מצפצף', 'סטרידור', 'בצקת ריאות', 'תסחיף ריאתי', 'היפווקסיה', 'חמצן'], // h6 מצ״ח נשימתיים
  ['טראומה', 'PHTLS', 'שבר', 'דימום', 'פגיעות', 'חזה', 'בטן', 'ראש', 'שלד', 'כוויות', 'הלם', 'טביעה', 'תלייה', 'התחשמלות', 'מעיכה', 'הדף'], // h7 טראומה
  ['אק"ג', 'אקג', 'קצב לב', 'דופק', 'אוטם', 'MI ', 'CVA', 'שבץ', 'טכיקרדיה', 'ברדיקרדיה', 'פרפור', 'דפיברילציה', 'קרדיווסקולר', 'לבבי', 'תעוקת חזה', 'ACS'], // h8 מצ״חים קרדיווסקולריים
  ['סוכרת', 'פרכוס', 'הכרה', 'הרעלה', 'עילפון', 'סינקופה', 'חום', 'היפותרמיה', 'היפוגליקמיה', 'סטטוס'], // h9 מצ״ח כלליים
  ['הריון', 'יילוד', 'קשיש', 'מבוגר', 'אוכלוסיות'], // h10 אוכלוסיות מיוחדות
  ['אג"מ', 'אגמ'], // h11 אג״מ
  ['אר"ן', 'ארן', 'רב נפגעים', 'מיון'], // h12 אר״ן
  ['לידה', 'יולדת', 'גניקולוג', 'מיילדות', 'הריון', 'עובר', 'פרינאום'], // h13 גניקולוגיה ומיילדות
  ['ילד', 'תינוק', 'פדיאטרי', 'ילדים', 'תינוקות', 'יילוד', 'משקל ק"ג'], // h14 פדיאטריה
  ['פסיכיאטר', 'אובדנות', 'התנהגות', 'איום'], // h15 מצ״חים התנהגותיים
];

/**
 * Normalize text for matching: lowercase, collapse spaces, strip punctuation.
 */
function normalizeForMatch(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Return the best hierarchy_id for this question text.
 * @param {string} questionText
 * @param {Array<{id: string, category_name: string, topic_name: string}>} hierarchies - list of hierarchy objects (id, category_name, topic_name)
 * @returns {string|null} hierarchy_id or null if no match (caller can fallback to first/default)
 */
export function classifyQuestionToHierarchy(questionText, hierarchies) {
  if (!questionText || !hierarchies?.length) return null;
  const normalized = normalizeForMatch(questionText);
  if (!normalized) return null;

  const scores = new Array(CATEGORY_KEYWORDS.length).fill(0);
  for (let i = 0; i < CATEGORY_KEYWORDS.length; i++) {
    for (const keyword of CATEGORY_KEYWORDS[i]) {
      if (normalized.includes(keyword.toLowerCase())) {
        scores[i] += 1;
        // Bonus for longer/more specific keyword
        if (keyword.length >= 4) scores[i] += 0.5;
      }
    }
  }

  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIdx = i;
    }
  }

  if (bestScore === 0) return null;
  const expectedId = `h${bestIdx + 1}`;
  const found = hierarchies.find(h => h.id === expectedId);
  return found ? found.id : (hierarchies[0]?.id ?? null);
}

/**
 * Reclassify all questions in the bank by their question_text and persist.
 * @param {object} entities - mockEntities or real API
 * @returns {{ updated: number, skipped: number, errors: number }}
 */
export async function reclassifyAllQuestionsByContent(entities) {
  const Question_Bank = entities?.Question_Bank;
  const Content_Hierarchy = entities?.Content_Hierarchy;
  if (!Question_Bank || !Content_Hierarchy) {
    throw new Error('חסרים Question_Bank או Content_Hierarchy');
  }

  const [questions, hierarchies] = await Promise.all([
    Question_Bank.find({}),
    Content_Hierarchy.find({}),
  ]);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const q of questions) {
    const text = q.question_text || '';
    const suggestedId = classifyQuestionToHierarchy(text, hierarchies);
    if (!suggestedId) {
      skipped++;
      continue;
    }
    if (q.hierarchy_id === suggestedId) {
      skipped++;
      continue;
    }
    try {
      await Question_Bank.update(q.id, { hierarchy_id: suggestedId });
      updated++;
    } catch (e) {
      errors++;
    }
  }

  return { updated, skipped, errors };
}

// ─────────────────────────────────────────────────────────────
// AI-based classification (OpenAI)
// ─────────────────────────────────────────────────────────────

/**
 * Call OpenAI to classify question text into one of the given hierarchies.
 * @param {string} questionText
 * @param {Array<{id: string, category_name: string}>} hierarchies
 * @param {string} apiKey
 * @returns {Promise<string|null>} hierarchy_id or null
 */
export async function classifyQuestionToHierarchyWithAI(questionText, hierarchies, apiKey) {
  if (!questionText?.trim() || !hierarchies?.length || !apiKey) return null;

  const list = hierarchies.map(h => `${h.id}: ${h.category_name || h.topic_name || h.id}`).join('\n');
  const systemPrompt = `אתה מסווג שאלות רפואיות לקטגוריות של מגן דוד אדום.
תפקידך: לקבל שאלה ולהחזיר רק את מזהה הקטגוריה המתאימה (id) מהרשימה.
החזר JSON בלבד בפורמט: {"hierarchy_id": "hN"} כאשר hN הוא המזהה מהרשימה.`;

  const userPrompt = `רשימת קטגוריות (id: שם):
${list}

שאלה:
${questionText.trim().slice(0, 1500)}

החזר רק JSON: {"hierarchy_id": "hN"}`;

  try {
    const response = await fetch(appConfig.openai.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: appConfig.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 64,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const match = content.match(/\{\s*"hierarchy_id"\s*:\s*"(h\d+)"\s*\}/) || content.match(/"hierarchy_id"\s*:\s*"(h\d+)"/) || content.match(/(h\d+)/);
    const id = match ? (match[1] || match[0]) : null;
    if (id && hierarchies.some(h => h.id === id)) return id;
    return null;
  } catch (e) {
    console.warn('[classifyQuestionToHierarchyWithAI]', e.message);
    return null;
  }
}

/**
 * Reclassify only questions that were not yet analyzed by AI (hierarchy_ai_analyzed_at is null/absent).
 * Updates each with the AI-suggested hierarchy_id and sets hierarchy_ai_analyzed_at to current ISO time.
 * @param {object} entities - Question_Bank, Content_Hierarchy
 * @param {string} apiKey - OpenAI API key
 * @param {(data: { current: number, total: number, updated: number }) => void} [onProgress]
 * @returns {{ updated: number, skipped: number, errors: number, totalProcessed: number }}
 */
export async function reclassifyUnanalyzedQuestionsWithAI(entities, apiKey, onProgress) {
  const Question_Bank = entities?.Question_Bank;
  const Content_Hierarchy = entities?.Content_Hierarchy;
  if (!Question_Bank || !Content_Hierarchy) throw new Error('חסרים Question_Bank או Content_Hierarchy');
  if (!apiKey) throw new Error('נדרש מפתח OpenAI');

  const [allQuestions, hierarchies] = await Promise.all([
    Question_Bank.find({}),
    Content_Hierarchy.find({}),
  ]);

  const toProcess = allQuestions.filter(q => q != null && (q.hierarchy_ai_analyzed_at == null || q.hierarchy_ai_analyzed_at === ''));
  const total = toProcess.length;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const q = toProcess[i];
    onProgress?.({ current: i + 1, total, updated });
    const suggestedId = await classifyQuestionToHierarchyWithAI(q.question_text || '', hierarchies, apiKey);
    if (!suggestedId) {
      errors++;
      continue;
    }
    try {
      await Question_Bank.update(q.id, {
        hierarchy_id: suggestedId,
        hierarchy_ai_analyzed_at: new Date().toISOString(),
      });
      updated++;
    } catch (e) {
      errors++;
    }
  }

  return {
    updated,
    skipped: total - updated - errors,
    errors,
    totalProcessed: total,
  };
}
