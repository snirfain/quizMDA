/**
 * Legacy hierarchy classification — questionnaire schema now uses `category` / `sub_category`.
 * Functions are retained for backwards compatibility but no longer assign hierarchy_id.
 */

export { classifyQuestionToHierarchy, CATEGORY_KEYWORDS } from '../shared/categories.js';

export async function reclassifyAllQuestionsByContent(entitiesApi) {
  const Question_Bank = entitiesApi?.Question_Bank;
  if (!Question_Bank) {
    throw new Error('חסר Question_Bank');
  }
  const questions = await Question_Bank.find({});
  return {
    updated: 0,
    skipped: questions.length,
    errors: 0,
    message: 'הסיווג לפי hierarchy הוסר; עדכן ידנית את שדה category.',
  };
}

export async function classifyQuestionToHierarchyWithAI(questionText, hierarchies, apiKey) {
  if (!questionText?.trim() || !apiKey) return null;
  return null;
}

export async function reclassifyUnanalyzedQuestionsWithAI(entitiesApi, apiKey, onProgress) {
  if (!apiKey) throw new Error('נדרש מפתח OpenAI');
  const Question_Bank = entitiesApi?.Question_Bank;
  if (!Question_Bank) throw new Error('חסר Question_Bank');
  const allQuestions = await Question_Bank.find({});
  return {
    updated: 0,
    skipped: allQuestions.length,
    errors: 0,
    totalProcessed: 0,
    message: 'deprecated',
  };
}
