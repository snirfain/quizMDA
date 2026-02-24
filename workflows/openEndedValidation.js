/**
 * Open-Ended Question Validation
 * Integrates with OpenAI API for answer validation
 * Hebrew: אימות שאלות פתוחות
 */

import { entities } from '../config/appConfig';
import { appConfig } from '../config/appConfig';

/**
 * Send answer to OpenAI API for validation
 */
export async function validateOpenEndedAnswer(questionId, userAnswerText) {
  try {
    // Fetch question details
    const question = await entities.Question_Bank.findOne({ id: questionId });
    
    if (!question) {
      throw new Error('Question not found');
    }

    if (question.question_type !== 'open_ended') {
      throw new Error('Question is not open-ended');
    }

    // Get correct answer if available
    let correctAnswer = '';
    try {
      const parsedAnswer = JSON.parse(question.correct_answer || '{}');
      correctAnswer = parsedAnswer.value || parsedAnswer.text || '';
    } catch (e) {
      // Ignore if correct_answer is not JSON
      correctAnswer = question.correct_answer || '';
    }

    // Prepare prompt for OpenAI
    const prompt = `אתה עוזר מערכת למידה רפואית למד"א (מגן דוד אדום).

שאלה: ${question.question_text}

${correctAnswer ? `תשובה נכונה/רצויה: ${correctAnswer}\n\n` : ''}תשובת המשתמש: ${userAnswerText}

אנא בדוק את תשובת המשתמש והחזר:
1. הערכה כללית (נכון/חלקי/שגוי)
2. משוב מפורט בעברית
3. ציון מ-0 עד 1 (0 = שגוי לחלוטין, 1 = נכון לחלוטין)
4. הצעות לשיפור (אם יש)

החזר תשובה בפורמט JSON:
{
  "score": 0.0-1.0,
  "feedback": "משוב מפורט בעברית",
  "is_correct": true/false,
  "suggestions": ["הצעה 1", "הצעה 2"]
}`;

    // Get API key
    const apiKey = appConfig.openai.getApiKey();

    // Call OpenAI API
    const response = await fetch(appConfig.openai.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: appConfig.openai.model,
        messages: [
          {
            role: 'system',
            content: 'אתה עוזר מערכת למידה רפואית. תן משוב מפורט ומקצועי בעברית על תשובות של מתאמנים.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const openaiResponse = await response.json();
    
    // Extract the assistant's message
    let botFeedback = '';
    let score = 0.5;
    let isCorrect = false;
    let suggestions = [];

    if (openaiResponse.choices && openaiResponse.choices[0]) {
      const content = openaiResponse.choices[0].message.content;
      
      // Try to parse JSON from the response
      try {
        // Extract JSON from the response (might be wrapped in markdown code blocks)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          botFeedback = parsed.feedback || content;
          score = parsed.score !== undefined ? parsed.score : 0.5;
          isCorrect = parsed.is_correct !== undefined ? parsed.is_correct : score >= 0.7;
          suggestions = parsed.suggestions || [];
        } else {
          botFeedback = content;
          score = 0.5;
          isCorrect = false;
        }
      } catch (e) {
        // If JSON parsing fails, use the raw content
        botFeedback = content;
        score = 0.5;
        isCorrect = false;
      }
    } else {
      botFeedback = 'לא התקבל משוב מהמערכת. נסה שוב.';
    }

    // Return bot feedback
    return {
      success: true,
      bot_feedback: botFeedback,
      score: score,
      is_correct: isCorrect,
      suggestions: suggestions
    };

  } catch (error) {
    console.error('Error validating open-ended answer:', error);
    return {
      success: false,
      error: error.message,
      bot_feedback: 'שגיאה בחיבור למערכת האימות. נסה שוב מאוחר יותר.',
      score: 0,
      is_correct: false,
      suggestions: []
    };
  }
}

/**
 * Save open-ended answer with bot feedback
 */
export async function saveOpenEndedAnswer(userId, questionId, userAnswerText, selfAssessment = false) {
  try {
    // Validate with OpenAI
    const validation = await validateOpenEndedAnswer(questionId, userAnswerText);

    if (!validation.success) {
      throw new Error(validation.error || 'שגיאה באימות התשובה');
    }

    // For open-ended questions, is_correct is determined by:
    // 1. Self-assessment (if user explicitly says they understood)
    // 2. OpenAI score (if >= 0.7)
    // 3. OpenAI is_correct flag (if available)
    const isCorrect = selfAssessment 
      || validation.is_correct 
      || (validation.score !== undefined && validation.score >= 0.7);

    // Calculate time spent
    const timeSpent = 0; // Will be calculated by the component

    // Create activity log entry
    const now = new Date();
    const logEntry = await entities.Activity_Log.create({
      user_id: userId,
      question_id: questionId,
      timestamp: now,
      user_answer: userAnswerText,
      is_correct: isCorrect,
      bot_feedback: validation.bot_feedback || '',
      self_assessment: selfAssessment,
      time_spent: timeSpent,
      last_attempt_date: now
    });

    // Trigger suspension check
    const { checkAndSuspendQuestion } = await import('./suspensionLogic.js');
    await checkAndSuspendQuestion(questionId);

    return {
      logEntry,
      botFeedback: validation.bot_feedback,
      isCorrect: isCorrect,
      score: validation.score,
      suggestions: validation.suggestions || []
    };
  } catch (error) {
    console.error('Error saving open-ended answer:', error);
    throw error;
  }
}
