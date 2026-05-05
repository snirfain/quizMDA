/**
 * Test Generator
 * Instructor tool for creating exams
 * Hebrew: מחולל מבחנים
 */

import { entities } from '../config/appConfig';
import { QUESTION_TYPES_UI } from '../shared/questionBankMetadata.js';
import { pickRandomMedia } from './mediaEngine.js';

async function resolvedQuestionMediaUrlForExport(q) {
  const att = q.media_attachment;
  if (att && typeof att === 'object' && att.url) return att.url;
  if (typeof att === 'string' && att.trim()) return att.trim();
  const tag = typeof q.media_bank_tag === 'string' ? q.media_bank_tag.trim() : '';
  if (!tag) return null;
  const item = await pickRandomMedia(tag);
  return item?.url ?? null;
}

/**
 * Generate random test based on filters
 * @param {object} filters
 * @param {string} [filters.category] — full chapter line or prefix match on question.category
 * @param {string} [filters.sub_category]
 * @param {string[]} [filters.training_levels] — ['A','B']
 * @param {string[]} [filters.question_types]
 * @param {number} [filters.count]
 */
export async function generateRandomTest(filters) {
  const { category = '', sub_category = '', training_levels = [], question_types = [], count = 20 } = filters;

  let pool = await entities.Question_Bank.find({ status: 'active' });

  const catNeedle = typeof category === 'string' ? category.trim() : '';
  if (catNeedle) {
    pool = pool.filter((q) => (q.category || '').includes(catNeedle));
  }

  const subNeedle = typeof sub_category === 'string' ? sub_category.trim() : '';
  if (subNeedle) {
    pool = pool.filter((q) => (q.sub_category || '').includes(subNeedle));
  }

  if (training_levels.length > 0) {
    pool = pool.filter((q) => training_levels.includes(q.training_level));
  }

  if (question_types.length > 0) {
    pool = pool.filter((q) => question_types.includes(q.question_type));
  }

  if (pool.length === 0) {
    throw new Error('No questions match the selected filters');
  }

  const shuffled = pool.sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, Math.min(count, shuffled.length));

  return {
    questions: selectedQuestions,
    totalAvailable: pool.length,
    selected: selectedQuestions.length,
    filters,
  };
}

export async function exportTestToPDF(testQuestions, testMetadata = {}) {
  const {
    title = 'מבחן מד"א',
    instructor_name = '',
    date = new Date().toLocaleDateString('he-IL'),
    time_limit = null,
  } = testMetadata;

  const pdfContent = {
    title,
    instructor_name,
    date,
    time_limit,
    questions: await Promise.all(
      testQuestions.map(async (q, index) => ({
        number: index + 1,
        type: q.question_type,
        text: q.question_text,
        category: q.category,
        media_bank_tag: q.media_bank_tag || null,
        media: await resolvedQuestionMediaUrlForExport(q),
      })),
    ),
  };

  return {
    success: true,
    pdfData: pdfContent,
    message: 'PDF data prepared. Integrate with PDF generation service.',
  };
}

/**
 * Generate exam for trainee
 */
export async function generateTraineeExam(spec) {
  const { categoryCounts = {}, topic_name, tagFilters = [], maxTotal, training_levels = [] } = spec;
  const categories = Object.keys(categoryCounts).filter((c) => categoryCounts[c] > 0);
  const hasCategorySpec = categories.length > 0;

  let pool = await entities.Question_Bank.find({ status: 'active' });

  if (training_levels.length > 0) {
    pool = pool.filter((q) => training_levels.includes(q.training_level));
  }

  if (topic_name) {
    const needle = String(topic_name);
    pool = pool.filter((q) => (q.sub_category || '').includes(needle));
  }

  if (tagFilters.length > 0) {
    pool = pool.filter((q) => tagFilters.some((t) => (q.category || '').includes(t)));
  }

  if (hasCategorySpec) {
    const selected = [];
    for (const cat of categories) {
      const needle = cat;
      const list = pool
        .filter((q) => (q.category || '').includes(needle))
        .sort(() => 0.5 - Math.random());
      selected.push(...list.slice(0, categoryCounts[cat] || 0));
    }
    pool = selected;
  }

  pool = pool.sort(() => 0.5 - Math.random());
  const totalRequested = maxTotal || pool.length;
  const questions = pool.slice(0, totalRequested);
  return { questions, totalAvailable: pool.length };
}

export async function getFilterOptions() {
  const questions = await entities.Question_Bank.find({ status: 'active' });
  const categories = [...new Set(questions.map((q) => q.category).filter(Boolean))].sort();
  const topics = [...new Set(questions.map((q) => q.sub_category).filter(Boolean))].sort();

  return {
    categories: categories.length ? categories : [],
    topics: topics.length ? topics : [],
    question_types: QUESTION_TYPES_UI,
  };
}
