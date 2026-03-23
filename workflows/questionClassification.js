/**
 * Classify question text into MDA content hierarchy (category) by keywords or by AI.
 * Used to assign hierarchy_id when missing and for "reclassify all by content".
 */

import { appConfig } from '../config/appConfig';
export { classifyQuestionToHierarchy, CATEGORY_KEYWORDS } from '../shared/categories.js';

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
