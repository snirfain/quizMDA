/**
 * Mock Exam Workflow
 * Generate and manage mock exams
 * Hebrew: בחינה מדומה
 */

import { entities } from '../config/appConfig';
import { getAdaptiveQuestions } from './adaptivePracticeEngine';

/**
 * Generate mock exam based on preferences
 * @param {string} userId - User ID
 * @param {Object} preferences - Exam preferences
 * @returns {Promise<Object>} Mock exam data
 */
export async function generateMockExam(userId, preferences = {}) {
  const {
    questionCount = 20,
    timeLimit = 30, // minutes
    category_name,
    topic_name,
    difficulty_range,
    questionTypes = []
  } = preferences;

  try {
    // Build filters
    const hierarchyFilters = {};
    if (category_name) hierarchyFilters.category_name = category_name;
    if (topic_name) hierarchyFilters.topic_name = topic_name;

    // Get questions
    const result = await getAdaptiveQuestions(userId, hierarchyFilters);
    let questions = result.questions || [];

    // Filter by difficulty if specified
    if (difficulty_range) {
      const [min, max] = difficulty_range.split('-').map(Number);
      questions = questions.filter(q => 
        q.difficulty_level >= min && q.difficulty_level <= max
      );
    }

    // Filter by question types if specified
    if (questionTypes.length > 0) {
      questions = questions.filter(q => questionTypes.includes(q.question_type));
    }

    // Shuffle and limit
    questions = shuffleArray(questions).slice(0, questionCount);

    // Create exam object
    const exam = {
      id: `exam_${Date.now()}`,
      userId,
      questions: questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        difficulty_level: q.difficulty_level,
        hint: q.hint,
        explanation: q.explanation
      })),
      timeLimit: timeLimit * 60, // Convert to seconds
      startedAt: new Date(),
      preferences
    };

    // Save exam to storage (localStorage for now)
    if (typeof window !== 'undefined') {
      const exams = JSON.parse(localStorage.getItem('mock_exams') || '[]');
      exams.push(exam);
      localStorage.setItem('mock_exams', JSON.stringify(exams));
    }

    return exam;
  } catch (error) {
    console.error('Error generating mock exam:', error);
    throw error;
  }
}

/**
 * Submit mock exam answers
 * @param {string} examId - Exam ID
 * @param {Object} answers - User answers
 * @returns {Promise<Object>} Exam results
 */
export async function submitMockExam(examId, answers) {
  try {
    // Load exam
    const exam = await getMockExam(examId);
    if (!exam) {
      throw new Error('בחינה לא נמצאה');
    }

    // Grade answers
    const results = gradeExam(exam, answers);

    // Save results
    const examResult = {
      examId,
      userId: exam.userId,
      answers,
      results,
      submittedAt: new Date(),
      timeSpent: exam.timeLimit - (results.timeRemaining || 0)
    };

    // Save to storage
    if (typeof window !== 'undefined') {
      const resultsList = JSON.parse(localStorage.getItem('mock_exam_results') || '[]');
      resultsList.push(examResult);
      localStorage.setItem('mock_exam_results', JSON.stringify(resultsList));
    }

    // Save to Activity_Log
    try {
      for (let i = 0; i < exam.questions.length; i++) {
        const question = exam.questions[i];
        const userAnswer = answers[question.id];
        const isCorrect = results.correctAnswers[question.id] || false;

        await entities.Activity_Log.create({
          user_id: exam.userId,
          question_id: question.id,
          timestamp: new Date(),
          user_answer: typeof userAnswer === 'object' ? JSON.stringify(userAnswer) : userAnswer,
          is_correct: isCorrect,
          time_spent: results.timeSpent / exam.questions.length,
          last_attempt_date: new Date()
        });
      }
    } catch (error) {
      console.error('Error saving to activity log:', error);
    }

    return examResult;
  } catch (error) {
    console.error('Error submitting mock exam:', error);
    throw error;
  }
}

/**
 * Grade exam answers
 * @param {Object} exam - Exam object
 * @param {Object} answers - User answers
 * @returns {Object} Grading results
 */
function gradeExam(exam, answers) {
  const correctAnswers = {};
  const userAnswers = {};
  let correctCount = 0;
  let totalQuestions = exam.questions.length;

  for (const question of exam.questions) {
    const userAnswer = answers[question.id];
    userAnswers[question.id] = userAnswer;

    // Get correct answer from question bank
    let isCorrect = false;
    
    try {
      // This would normally fetch from Question_Bank
      // For now, we'll need to get the correct answer from the question object
      // In a real implementation, you'd fetch the full question with correct_answer
      isCorrect = checkAnswer(question, userAnswer);
    } catch (error) {
      console.error('Error checking answer:', error);
    }

    correctAnswers[question.id] = isCorrect;
    if (isCorrect) correctCount++;
  }

  const score = (correctCount / totalQuestions) * 100;
  const grade = calculateGrade(score);

  return {
    correctCount,
    totalQuestions,
    score: Math.round(score * 100) / 100,
    grade,
    correctAnswers,
    userAnswers,
    timeRemaining: 0 // Would be calculated from exam state
  };
}

/**
 * Check if answer is correct
 */
function checkAnswer(question, userAnswer) {
  // This is a simplified check
  // In production, you'd fetch the full question with correct_answer field
  // For now, return false as placeholder
  return false;
}

/**
 * Calculate grade based on score
 */
function calculateGrade(score) {
  if (score >= 90) return 'מצוין';
  if (score >= 80) return 'טוב מאוד';
  if (score >= 70) return 'טוב';
  if (score >= 60) return 'מספיק';
  return 'לא עבר';
}

/**
 * Get mock exam by ID
 */
export async function getMockExam(examId) {
  if (typeof window === 'undefined') return null;

  try {
    const exams = JSON.parse(localStorage.getItem('mock_exams') || '[]');
    return exams.find(e => e.id === examId) || null;
  } catch (error) {
    console.error('Error getting mock exam:', error);
    return null;
  }
}

/**
 * Get user's exam history
 */
export async function getExamHistory(userId) {
  if (typeof window === 'undefined') return [];

  try {
    const results = JSON.parse(localStorage.getItem('mock_exam_results') || '[]');
    return results.filter(r => r.userId === userId);
  } catch (error) {
    console.error('Error getting exam history:', error);
    return [];
  }
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get exam statistics
 */
export async function getExamStatistics(userId) {
  const history = await getExamHistory(userId);
  
  if (history.length === 0) {
    return {
      totalExams: 0,
      averageScore: 0,
      bestScore: 0,
      worstScore: 0
    };
  }

  const scores = history.map(h => h.results.score);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);

  return {
    totalExams: history.length,
    averageScore: Math.round(averageScore * 100) / 100,
    bestScore,
    worstScore,
    recentExams: history.slice(-5)
  };
}
