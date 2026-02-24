/**
 * Tags Workflow
 * Manage question tags
 * Hebrew: תגיות
 */

import { entities } from '../config/appConfig';

/**
 * Get all tags
 */
export async function getAllTags() {
  const questions = await entities.Question_Bank.find({
    status: 'active'
  });

  const allTags = new Set();
  questions.forEach(question => {
    if (question.tags && Array.isArray(question.tags)) {
      question.tags.forEach(tag => allTags.add(tag));
    }
  });

  return Array.from(allTags).sort();
}

/**
 * Get questions by tag
 */
export async function getQuestionsByTag(tag) {
  return await entities.Question_Bank.find({
    tags: { $in: [tag] },
    status: 'active'
  });
}

/**
 * Suggest tags based on question content
 */
export async function suggestTags(questionText, categoryName) {
  // Simple tag suggestion based on keywords
  const suggestions = [];
  
  const keywords = {
    'חירום': ['חירום', 'דחוף'],
    'ילדים': ['ילדים', 'תינוק', 'ילד'],
    'טראומה': ['טראומה', 'פציעה', 'חבלה'],
    'לב': ['לב', 'התקף', 'ECG'],
    'נשימה': ['נשימה', 'אסתמה', 'חנק']
  };

  const text = (questionText + ' ' + categoryName).toLowerCase();
  
  Object.keys(keywords).forEach(tag => {
    if (keywords[tag].some(keyword => text.includes(keyword))) {
      suggestions.push(tag);
    }
  });

  return suggestions;
}
