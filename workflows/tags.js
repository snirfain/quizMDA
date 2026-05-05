/**
 * Tags Workflow — derives "tags" from question categories when present
 * Hebrew: תגיות
 */

import { entities } from '../config/appConfig';

export async function getAllTags() {
  const questions = await entities.Question_Bank.find({
    status: 'active',
  });

  const allTags = new Set();
  questions.forEach((question) => {
    if (question.category) allTags.add(question.category);
    if (question.sub_category) allTags.add(question.sub_category);
  });

  return Array.from(allTags).sort();
}

export async function getQuestionsByTag(tag) {
  return await entities.Question_Bank.find({
    status: 'active',
    $or: [{ category: tag }, { sub_category: tag }],
  });
}

export async function suggestTags(questionText, categoryName) {
  const suggestions = [];

  const keywords = {
    חירום: ['חירום', 'דחוף'],
    ילדים: ['ילדים', 'תינוק', 'ילד'],
    טראומה: ['טראומה', 'פציעה', 'חבלה'],
    לב: ['לב', 'התקף', 'ECG'],
    נשימה: ['נשימה', 'אסתמה', 'חנק'],
  };

  const text = (questionText + ' ' + categoryName).toLowerCase();

  Object.keys(keywords).forEach((tag) => {
    if (keywords[tag].some((keyword) => text.includes(keyword))) {
      suggestions.push(tag);
    }
  });

  return suggestions;
}
