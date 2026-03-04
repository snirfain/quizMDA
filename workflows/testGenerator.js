/**
 * Test Generator
 * Instructor tool for creating exams
 * Hebrew: מחולל מבחנים
 */

import { entities } from '../config/appConfig';

/**
 * Generate random test based on filters
 */
export async function generateRandomTest(filters) {
  const {
    category_name,
    topic_name,
    difficulty_levels = [],   // array of labels: ['קל','בינוני','קשה']
    question_types = [],
    count = 20
  } = filters;

  // Build hierarchy filter
  const hierarchyQuery = {};
  if (category_name) hierarchyQuery.category_name = category_name;
  if (topic_name) hierarchyQuery.topic_name = topic_name;

  // Get matching hierarchies
  const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
  const hierarchyIds = hierarchies.map(h => h.id);

  if (hierarchyIds.length === 0) {
    throw new Error('No matching content found');
  }

  // Build question filter
  const questionQuery = {
    hierarchy_id: { $in: hierarchyIds },
    status: 'active',
  };

  if (difficulty_levels.length > 0) {
    questionQuery.difficulty_level = { $in: difficulty_levels };
  }

  if (question_types.length > 0) {
    questionQuery.question_type = { $in: question_types };
  }

  // Get all matching questions
  const allQuestions = await entities.Question_Bank.find(questionQuery);

  if (allQuestions.length === 0) {
    throw new Error('No questions match the selected filters');
  }

  // Randomize and select
  const shuffled = allQuestions.sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, Math.min(count, shuffled.length));

  return {
    questions: selectedQuestions,
    totalAvailable: allQuestions.length,
    selected: selectedQuestions.length,
    filters: filters
  };
}

/**
 * Export test to PDF format
 */
export async function exportTestToPDF(testQuestions, testMetadata = {}) {
  const {
    title = 'מבחן מד"א',
    instructor_name = '',
    date = new Date().toLocaleDateString('he-IL'),
    time_limit = null
  } = testMetadata;

  // This would integrate with a PDF generation library
  // For Base44, you might use a backend function or external service
  
  const pdfContent = {
    title,
    instructor_name,
    date,
    time_limit,
    questions: testQuestions.map((q, index) => ({
      number: index + 1,
      type: q.question_type,
      text: q.question_text,
      difficulty: q.difficulty_level,
      media: q.media_attachment ? q.media_attachment.url : null
    }))
  };

  // In a real implementation, you would use a library like pdfkit or puppeteer
  // For now, return structured data that can be sent to a PDF service
  return {
    success: true,
    pdfData: pdfContent,
    message: 'PDF data prepared. Integrate with PDF generation service.'
  };
}

const DIFFICULTY_LABELS = { קל: 'קל', בינוני: 'בינוני', קשה: 'קשה' };

/**
 * Generate exam for trainee: by categories (with per-category counts), difficulty breakdown, topic/tags.
 * Returns { questions, totalAvailable }.
 * @param {Object} spec
 * @param {Object} spec.categoryCounts - { categoryName: number } e.g. { "מבוא": 5, "קרדיולוגיה": 10 }
 * @param {Object} spec.difficultyCounts - { "קל": n, "בינוני": m, "קשה": k }
 * @param {string} [spec.topic_name]
 * @param {string[]} [spec.tagFilters]
 * @param {number} [spec.maxTotal] - cap total questions (default: sum of category counts or difficulty counts)
 */
export async function generateTraineeExam(spec) {
  const { categoryCounts = {}, difficultyCounts = {}, topic_name, tagFilters = [], maxTotal } = spec;
  const categories = Object.keys(categoryCounts).filter(c => categoryCounts[c] > 0);
  const hasCategorySpec = categories.length > 0;
  const hasDifficultySpec = Object.keys(difficultyCounts).some(k => (difficultyCounts[k] || 0) > 0);

  let pool = [];
  if (hasCategorySpec) {
    const hierarchyQuery = { category_name: { $in: categories } };
    if (topic_name) hierarchyQuery.topic_name = topic_name;
    const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
    const hierarchyIds = hierarchies.map(h => h.id);
    if (hierarchyIds.length === 0) {
      return { questions: [], totalAvailable: 0 };
    }
    const questionQuery = { hierarchy_id: { $in: hierarchyIds }, status: 'active' };
    if (tagFilters.length > 0) {
      const allCat = await entities.Question_Bank.find(questionQuery);
      pool = allCat.filter(q => q.tags && tagFilters.some(t => (q.tags || []).includes(t)));
    } else {
      pool = await entities.Question_Bank.find(questionQuery);
    }
    const byCategory = {};
    for (const q of pool) {
      const h = hierarchies.find(hh => hh.id === q.hierarchy_id || String(hh.id) === String(q.hierarchy_id));
      const cat = h ? h.category_name : null;
      if (cat && categories.includes(cat)) {
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(q);
      }
    }
    const selected = [];
    for (const cat of categories) {
      const list = (byCategory[cat] || []).sort(() => 0.5 - Math.random());
      selected.push(...list.slice(0, categoryCounts[cat] || 0));
    }
    pool = selected;
  } else {
    const hierarchyQuery = topic_name ? { topic_name } : {};
    const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
    const hierarchyIds = hierarchies.length ? hierarchies.map(h => h.id) : [];
    const questionQuery = hierarchyIds.length
      ? { hierarchy_id: { $in: hierarchyIds }, status: 'active' }
      : { status: 'active' };
    pool = await entities.Question_Bank.find(questionQuery);
    if (tagFilters.length > 0) {
      pool = pool.filter(q => q.tags && tagFilters.some(t => (q.tags || []).includes(t)));
    }
  }

  const normalizeDiff = (q) => {
    const d = q.difficulty_level;
    if (d === 'קל' || (typeof d === 'number' && d <= 4)) return 'קל';
    if (d === 'קשה' || (typeof d === 'number' && d >= 7)) return 'קשה';
    return 'בינוני';
  };

  if (hasDifficultySpec && pool.length > 0) {
    const byDiff = { קל: [], בינוני: [], קשה: [] };
    for (const q of pool) {
      const d = normalizeDiff(q);
      if (byDiff[d]) byDiff[d].push(q);
    }
    const out = [];
    for (const label of ['קל', 'בינוני', 'קשה']) {
      const list = (byDiff[label] || []).sort(() => 0.5 - Math.random());
      const cap = difficultyCounts[label] || 0;
      out.push(...list.slice(0, cap));
    }
    pool = out.sort(() => 0.5 - Math.random());
  } else if (pool.length > 0) {
    pool = pool.sort(() => 0.5 - Math.random());
  }

  const totalRequested = maxTotal || (hasDifficultySpec
    ? (difficultyCounts.קל || 0) + (difficultyCounts.בינוני || 0) + (difficultyCounts.קשה || 0)
    : pool.length);
  const questions = pool.slice(0, totalRequested);
  return { questions, totalAvailable: pool.length };
}

/**
 * Get filter options for UI
 */
export async function getFilterOptions() {
  // Get all categories
  const categories = await entities.Content_Hierarchy.distinct('category_name');
  
  // Get all topics
  const topics = await entities.Content_Hierarchy.distinct('topic_name');
  
  // Get question type counts
  const questionTypes = await entities.Question_Bank.distinct('question_type');
  
  return {
    categories: categories.sort(),
    topics: topics.sort(),
    question_types: [
      { value: 'single_choice', label: 'בחירה יחידה' },
      { value: 'multi_choice', label: 'בחירה מרובה' },
      { value: 'true_false', label: 'נכון/לא נכון' },
      { value: 'open_ended', label: 'שאלה פתוחה' }
    ],
  };
}
