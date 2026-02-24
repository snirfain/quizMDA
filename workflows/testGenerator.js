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
