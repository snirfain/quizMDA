/**
 * Answer Validation Utilities
 * Hebrew: כלי אימות תשובות
 */

/**
 * Validate single choice answer
 */
export function validateSingleChoice(userAnswer, correctAnswer) {
  if (typeof correctAnswer === 'string') {
    return userAnswer === correctAnswer;
  }
  
  if (typeof correctAnswer === 'object' && correctAnswer.value) {
    return userAnswer === correctAnswer.value;
  }
  
  return false;
}

/**
 * Validate multi-choice answer
 */
export function validateMultiChoice(userAnswers, correctAnswers) {
  if (!Array.isArray(userAnswers) || !Array.isArray(correctAnswers)) {
    return false;
  }
  
  // Sort both arrays for comparison
  const sortedUser = [...userAnswers].sort();
  const sortedCorrect = [...correctAnswers].sort();
  
  if (sortedUser.length !== sortedCorrect.length) {
    return false;
  }
  
  return sortedUser.every((val, index) => val === sortedCorrect[index]);
}

/**
 * Validate true/false answer
 */
export function validateTrueFalse(userAnswer, correctAnswer) {
  const normalizedUser = String(userAnswer).toLowerCase().trim();
  const normalizedCorrect = String(correctAnswer).toLowerCase().trim();
  
  return normalizedUser === normalizedCorrect;
}

/**
 * Parse correct answer from question
 */
export function parseCorrectAnswer(question) {
  if (!question.correct_answer) {
    return null;
  }
  
  try {
    if (typeof question.correct_answer === 'string') {
      return JSON.parse(question.correct_answer);
    }
    return question.correct_answer;
  } catch (e) {
    // If not JSON, treat as plain string
    return question.correct_answer;
  }
}

/**
 * Validate answer based on question type
 */
export function validateAnswer(question, userAnswer, selectedOptions = []) {
  const correctAnswer = parseCorrectAnswer(question);
  
  if (!correctAnswer) {
    return false;
  }
  
  switch (question.question_type) {
    case 'single_choice':
      return validateSingleChoice(userAnswer, correctAnswer);
    
    case 'multi_choice':
      return validateMultiChoice(selectedOptions, correctAnswer.values || correctAnswer);
    
    case 'true_false':
      return validateTrueFalse(userAnswer, correctAnswer.value || correctAnswer);
    
    case 'open_ended':
      // Open-ended questions are validated by bot or self-assessment
      return null;
    
    default:
      return false;
  }
}

/**
 * Format answer for storage
 */
export function formatAnswerForStorage(questionType, userAnswer, selectedOptions = []) {
  switch (questionType) {
    case 'single_choice':
    case 'true_false':
      return userAnswer;
    
    case 'multi_choice':
      return JSON.stringify(selectedOptions);
    
    case 'open_ended':
      return userAnswer;
    
    default:
      return String(userAnswer);
  }
}
