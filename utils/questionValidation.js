/**
 * Question Validation Utility
 * Validates question data before saving
 * Hebrew: בדיקת תקינות שאלות
 */

/**
 * Validate question text
 */
export function validateQuestionText(text) {
  const errors = [];
  
  if (!text || typeof text !== 'string') {
    errors.push('טקסט השאלה הוא שדה חובה');
    return errors;
  }

  const trimmed = text.trim();
  
  if (trimmed.length === 0) {
    errors.push('טקסט השאלה לא יכול להיות ריק');
  }
  
  if (trimmed.length < 10) {
    errors.push('טקסט השאלה חייב להכיל לפחות 10 תווים');
  }
  
  if (trimmed.length > 2000) {
    errors.push('טקסט השאלה לא יכול להכיל יותר מ-2000 תווים');
  }

  return errors;
}

/**
 * Validate options for choice questions
 */
export function validateOptions(options, questionType) {
  const errors = [];
  
  if (questionType === 'single_choice' || questionType === 'multi_choice') {
    if (!options || !Array.isArray(options)) {
      errors.push('יש לספק רשימת אופציות');
      return errors;
    }

    if (options.length < 2) {
      errors.push('יש לספק לפחות 2 אופציות');
    }

    if (options.length > 50) {
      errors.push('לא ניתן לספק יותר מ-50 אופציות');
    }

    // Check each option (support both .text and .label for compatibility with Moodle/Excel import)
    const getOptionLabel = (opt) =>
      typeof opt === 'string' ? opt : (opt?.label ?? opt?.text ?? '');
    options.forEach((option, index) => {
      if (typeof option === 'string') {
        if (option.trim().length === 0) {
          errors.push(`אופציה ${index + 1} ריקה`);
        }
      } else if (typeof option === 'object' && (option.text != null || option.label != null)) {
        const label = (option.label ?? option.text ?? '').trim();
        if (label.length === 0) {
          errors.push(`אופציה ${index + 1} ריקה`);
        }
      } else {
        errors.push(`אופציה ${index + 1} לא תקינה`);
      }
    });

    // Check for duplicate options
    const optionTexts = options.map(opt => getOptionLabel(opt).trim()).filter(Boolean);
    
    const uniqueTexts = new Set(optionTexts);
    if (uniqueTexts.size !== optionTexts.length) {
      errors.push('יש אופציות כפולות');
    }
  }

  return errors;
}

/**
 * Validate correct answer
 */
export function validateCorrectAnswer(answer, questionType, options = []) {
  const errors = [];
  
  if (!answer && answer !== 0 && answer !== false) {
    errors.push('יש לספק תשובה נכונה');
    return errors;
  }

  switch (questionType) {
    case 'single_choice':
    case 'true_false':
      if (typeof answer !== 'string' && typeof answer !== 'number' && typeof answer !== 'boolean') {
        errors.push('תשובה נכונה לא תקינה לסוג שאלה זה');
      }
      if (questionType === 'single_choice' && options.length > 0) {
        const answerIndex = typeof answer === 'string' ? parseInt(answer) : answer;
        if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
          errors.push('תשובה נכונה לא קיימת ברשימת האופציות');
        }
      }
      break;

    case 'multi_choice':
      if (!Array.isArray(answer)) {
        errors.push('תשובה נכונה חייבת להיות מערך עבור שאלות בחירה מרובה');
      } else {
        if (answer.length === 0) {
          errors.push('יש לבחור לפחות תשובה נכונה אחת');
        }
        if (options.length > 0) {
          answer.forEach((ans, index) => {
            const answerIndex = typeof ans === 'string' ? parseInt(ans) : ans;
            if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
              errors.push(`תשובה נכונה ${index + 1} לא קיימת ברשימת האופציות`);
            }
          });
        }
      }
      break;

    case 'open_ended':
      if (typeof answer !== 'string') {
        errors.push('תשובה נכונה חייבת להיות טקסט עבור שאלות פתוחות');
      } else if (answer.trim().length === 0) {
        errors.push('תשובה נכונה לא יכולה להיות ריקה');
      }
      break;

    default:
      errors.push('סוג שאלה לא מוכר');
  }

  return errors;
}

/**
 * Validate difficulty level.
 * Difficulty is optional (calculated automatically after enough answers).
 * If provided, it must be a number between 1 and 10.
 */
export function validateDifficultyLevel(difficulty) {
  const errors = [];
  if (difficulty === null || difficulty === undefined || difficulty === '') {
    return errors;
  }

  const level = typeof difficulty === 'string' ? parseInt(difficulty) : difficulty;
  if (isNaN(level)) {
    errors.push('רמת קושי חייבת להיות מספר');
  } else {
    if (level < 1 || level > 10) {
      errors.push('רמת קושי חייבת להיות בין 1 ל-10');
    }
  }
  return errors;
}

/**
 * Validate hierarchy ID
 */
export function validateHierarchyId(hierarchyId) {
  const errors = [];
  
  if (!hierarchyId || hierarchyId.trim().length === 0) {
    errors.push('יש לבחור נושא מההיררכיה');
  }

  return errors;
}

/**
 * Validate complete question object
 */
export function validateQuestion(question) {
  const errors = [];
  
  if (!question) {
    errors.push('שאלה לא תקינה');
    return { isValid: false, errors };
  }

  // Validate question text
  const textErrors = validateQuestionText(question.question_text);
  errors.push(...textErrors);

  // Validate question type
  const validTypes = ['single_choice', 'multi_choice', 'true_false', 'open_ended'];
  if (!question.question_type || !validTypes.includes(question.question_type)) {
    errors.push('סוג שאלה לא תקין');
  }

  // Validate options if needed
  if (question.question_type === 'single_choice' || question.question_type === 'multi_choice') {
    let options = question.options;
    let answerForValidation = question.correct_answer;

    // correct_answer may be JSON string { value, options } (e.g. Moodle Excel import)
    if (typeof question.correct_answer === 'string' && question.correct_answer.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(question.correct_answer);
        if (parsed && typeof parsed.value !== 'undefined' && Array.isArray(parsed.options)) {
          answerForValidation = parsed.value;
          if (!options || !Array.isArray(options) || options.length === 0) {
            options = parsed.options;
          }
        }
      } catch (_) {}
    }

    // Parse options if string
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (e) {
        errors.push('אופציות לא תקינות (JSON)');
        options = [];
      }
    }

    const optionErrors = validateOptions(options, question.question_type);
    errors.push(...optionErrors);

    // Validate correct answer with options
    if (options.length > 0) {
      const answerErrors = validateCorrectAnswer(
        answerForValidation,
        question.question_type,
        options
      );
      errors.push(...answerErrors);
    }
  } else {
    // Validate correct answer without options
    const answerErrors = validateCorrectAnswer(
      question.correct_answer,
      question.question_type
    );
    errors.push(...answerErrors);
  }

  // Validate difficulty
  const difficultyErrors = validateDifficultyLevel(question.difficulty_level);
  errors.push(...difficultyErrors);

  // Validate hierarchy
  const hierarchyErrors = validateHierarchyId(question.hierarchy_id);
  errors.push(...hierarchyErrors);

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Get validation summary
 */
export function getValidationSummary(question) {
  const validation = validateQuestion(question);
  
  return {
    isValid: validation.isValid,
    errorCount: validation.errors.length,
    errors: validation.errors,
    warnings: []
  };
}
