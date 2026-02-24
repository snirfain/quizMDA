/**
 * Trainee Practice Session Component
 * Mobile-first RTL Hebrew interface
 * Hebrew: מסך תרגול למתאמן
 */

import React, { useState, useEffect } from 'react';
import { getNextPracticeQuestion, getPracticeSession } from '../workflows/adaptivePracticeEngine';
import { saveOpenEndedAnswer } from '../workflows/openEndedValidation';
import { entities } from '../config/appConfig';
import { announce } from '../utils/accessibility';
import { savePracticeSession, loadQuestions, addToSyncQueue } from '../utils/offlineStorage';
import { getDifficultyDisplay } from '../workflows/difficultyEngine';
import { pickRandomMedia, recalcMediaStats } from '../workflows/mediaEngine';
import LoadingSpinner from './LoadingSpinner';
// Responsive styles are handled via CSS media queries

export default function TraineePracticeSession({ userId, hierarchyFilters = {}, tagFilters = [] }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [botFeedback, setBotFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [sessionStats, setSessionStats] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineAnswers, setOfflineAnswers] = useState([]);
  // Dynamic media bank: selected item for current question
  const [activeMedia, setActiveMedia] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadNextQuestion();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [tagFilters]);

  const loadNextQuestion = async (excludeId = null) => {
    const excludeQuestionId = excludeId ?? currentQuestion?.id;
    setIsLoading(true);
    try {
      let question = null;

      if (isOnline) {
        // Try to load from server (exclude the question we just answered)
        question = await getNextPracticeQuestion(userId, hierarchyFilters, tagFilters, excludeQuestionId);
      } else {
        // Load from offline cache
        const cachedQuestions = await loadQuestions();
        if (cachedQuestions && cachedQuestions.length > 0) {
          // Get a random question from cache
          const randomIndex = Math.floor(Math.random() * cachedQuestions.length);
          question = cachedQuestions[randomIndex];
        } else {
          throw new Error('אין שאלות זמינות במצב לא מקוון');
        }
      }

      if (question) {
        setCurrentQuestion(question);
        setUserAnswer('');
        setSelectedOptions([]);
        setBotFeedback(null);
        setShowResult(false);
        setQuestionStartTime(Date.now());
        setShowHint(false);
        setShowExplanation(false);
        // Pick a random media item when the question uses a media bank tag
        if (question.media_bank_tag) {
          const mediaItem = await pickRandomMedia(question.media_bank_tag);
          setActiveMedia(mediaItem);
        } else {
          setActiveMedia(null);
        }
      }
    } catch (error) {
      console.error('Error loading question:', error);
      if (!isOnline) {
        announce('אין חיבור לאינטרנט. שאלות זמינות רק מהמטמון המקומי.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;

    // Validate input
    if (currentQuestion.question_type === 'open_ended' && !userAnswer.trim()) {
      alert('אנא הזן תשובה לפני שליחה');
      return;
    }

    if ((currentQuestion.question_type === 'single_choice' || currentQuestion.question_type === 'true_false') && !userAnswer) {
      alert('אנא בחר תשובה לפני שליחה');
      return;
    }

    if (currentQuestion.question_type === 'multi_choice' && selectedOptions.length === 0) {
      alert('אנא בחר לפחות תשובה אחת לפני שליחה');
      return;
    }

    setIsLoading(true);
    let result = null;

    try {
      if (currentQuestion.question_type === 'open_ended') {
        // For open-ended questions, validate with OpenAI first
        // Calculate time spent
        const timeSpent = questionStartTime 
          ? Math.floor((Date.now() - questionStartTime) / 1000) 
          : 0;
        
        try {
          result = await saveOpenEndedAnswer(
            userId,
            currentQuestion.id,
            userAnswer.trim(),
            false // self-assessment will be set after user sees feedback
          );
          setBotFeedback(result.botFeedback || 'ממתין למשוב...');
          setIsCorrect(result.isCorrect || false);
        } catch (error) {
          console.error('Error validating answer:', error);
          setBotFeedback('שגיאה באימות התשובה. נסה שוב מאוחר יותר.');
          setIsCorrect(false);
        }
      } else {
        // For other question types, check answer immediately
        const correct = checkAnswer(currentQuestion, selectedOptions, userAnswer);
        setIsCorrect(correct);

        // Calculate time spent
        const timeSpent = questionStartTime 
          ? Math.floor((Date.now() - questionStartTime) / 1000) 
          : 0;

        // Save to activity log
        const now = new Date();
        const activityData = {
          user_id: userId,
          question_id: currentQuestion.id,
          timestamp: now,
          user_answer: currentQuestion.question_type === 'single_choice' || currentQuestion.question_type === 'true_false'
            ? userAnswer
            : JSON.stringify(selectedOptions),
          is_correct: correct,
          time_spent: timeSpent,
          last_attempt_date: now,
          // Include selected media item id when question uses media bank
          ...(activeMedia ? { media_id: activeMedia.id } : {}),
        };

        if (isOnline) {
          // Save directly to server
          await entities.Activity_Log.create(activityData);
        } else {
          // Save to sync queue for later
          await addToSyncQueue({
            type: 'activity_log',
            data: activityData
          });
          setOfflineAnswers(prev => [...prev, activityData]);
        }

        // Trigger suspension check (question-level)
        const { checkAndSuspendQuestion } = await import('../workflows/suspensionLogic');
        await checkAndSuspendQuestion(currentQuestion.id);

        // Trigger media stats recalc (media item level)
        if (activeMedia) {
          recalcMediaStats(activeMedia.id).catch(e =>
            console.warn('[media] שגיאה בחישוב סטטיסטיקות מדיה:', e)
          );
        }
      }

      setShowResult(true);
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('שגיאה בשליחת התשובה. נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAnswer = (question, selected, answer) => {
    const correctAnswer = JSON.parse(question.correct_answer || '{}');
    
    switch (question.question_type) {
      case 'single_choice':
        return answer === correctAnswer.value;
      case 'multi_choice':
        return JSON.stringify(selected.sort()) === JSON.stringify(correctAnswer.values?.sort() || []);
      case 'true_false':
        return answer === correctAnswer.value;
      default:
        return false;
    }
  };

  const handleSelfAssessment = async (understood) => {
    if (currentQuestion && currentQuestion.question_type === 'open_ended') {
      try {
        setIsLoading(true);
        const result = await saveOpenEndedAnswer(
          userId,
          currentQuestion.id,
          userAnswer,
          understood
        );
        setIsCorrect(result.isCorrect);
        if (result.botFeedback && !botFeedback) {
          setBotFeedback(result.botFeedback);
        }
      } catch (error) {
        console.error('Error in self-assessment:', error);
        alert('שגיאה בשמירת התשובה. נסה שוב.');
      } finally {
        setIsLoading(false);
      }
    }
    const justAnsweredId = currentQuestion?.id;
    setShowResult(false);
    setTimeout(() => loadNextQuestion(justAnsweredId), 500);
  };

  const handleNextQuestion = () => {
    const justAnsweredId = currentQuestion?.id;
    setShowResult(false);
    loadNextQuestion(justAnsweredId);
  };

  if (isLoading && !currentQuestion) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>טוען שאלה...</div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <h2>אין שאלות זמינות</h2>
          <p>כל השאלות נענו או מושעות</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} aria-label="מסך תרגול">
      {!isOnline && (
        <div style={styles.offlineBanner} role="alert" aria-live="polite">
          <span style={styles.offlineIcon} aria-hidden="true">⚠</span>
          <span>מצב לא מקוון - תשובות יישמרו ויסונכרנו כשחוזר החיבור</span>
          {offlineAnswers.length > 0 && (
            <span style={styles.offlineCount}>
              ({offlineAnswers.length} תשובות ממתינות לסנכרון)
            </span>
          )}
        </div>
      )}
      <div style={styles.questionCard} role="article" aria-label="שאלה">
        {/* Question Header */}
        <div style={styles.questionHeader} role="group" aria-label="פרטי שאלה">
          {(() => {
            const d = getDifficultyDisplay(currentQuestion.difficulty_level);
            return (
              <span style={{ ...styles.difficulty, color: d.color, background: d.bg,
                border: `1px solid ${d.border}`, borderRadius: '10px', padding: '3px 10px' }}
                aria-label={`רמת קושי: ${d.label}`}>
                {currentQuestion.difficulty_level ? `קושי: ${d.label}` : 'לא מדורג'}
              </span>
            );
          })()}
          <span style={styles.questionType} aria-label={`סוג שאלה: ${getQuestionTypeLabel(currentQuestion.question_type)}`}>
            {getQuestionTypeLabel(currentQuestion.question_type)}
          </span>
        </div>

        {/* ── Media display — dynamic (bank) or static attachment ── */}
        {(activeMedia || currentQuestion.media_attachment) && (() => {
          // Dynamic media from bank takes priority
          const media = activeMedia
            ? { url: activeMedia.url, type: activeMedia.media_type, desc: activeMedia.description }
            : { url: currentQuestion.media_attachment?.url, type: 'image', desc: '' };

          return (
            <div style={styles.mediaContainer} role="region" aria-label="מדיה לשאלה">
              {(!media.type || media.type === 'image') && (
                <img
                  src={media.url}
                  alt={media.desc || 'מדיה לשאלה'}
                  style={styles.media}
                  loading="lazy"
                />
              )}
              {media.type === 'video' && (
                <video
                  src={media.url}
                  controls
                  style={{ ...styles.media, maxHeight: '360px' }}
                  aria-label={media.desc || 'וידאו לשאלה'}
                />
              )}
              {media.type === 'audio' && (
                <audio
                  src={media.url}
                  controls
                  style={{ width: '100%', marginTop: '8px' }}
                  aria-label={media.desc || 'אודיו לשאלה'}
                />
              )}
              {media.desc && (
                <p style={{ fontSize: '12px', color: '#78909c', textAlign: 'center', margin: '4px 0 0' }}>
                  {media.desc}
                </p>
              )}
            </div>
          );
        })()}

        {/* Question Text */}
        <div 
          style={styles.questionText} 
          dangerouslySetInnerHTML={{
            __html: currentQuestion.question_text
          }}
          role="heading"
          aria-level={2}
          aria-label="טקסט השאלה"
        />

        {/* Hint */}
        {!showResult && currentQuestion.hint && (
          <div style={styles.hintSection}>
            {!showHint ? (
              <button
                style={styles.hintButton}
                onClick={() => {
                  setShowHint(true);
                  announce('רמז הוצג');
                }}
                aria-label="הצג רמז"
              >
                💡 הצג רמז
              </button>
            ) : (
              <div style={styles.hintBox} role="region" aria-label="רמז">
                <strong>רמז:</strong> {currentQuestion.hint}
              </div>
            )}
          </div>
        )}

        {/* Answer Input */}
        {!showResult && (
          <div style={styles.answerSection}>
            {renderAnswerInput(
              currentQuestion,
              userAnswer,
              setUserAnswer,
              selectedOptions,
              setSelectedOptions
            )}
            <button 
              style={styles.submitButton}
              onClick={handleSubmitAnswer}
              disabled={isLoading}
              aria-label="שלח תשובה"
              aria-busy={isLoading}
            >
              {isLoading ? 'שולח...' : 'שלח תשובה'}
            </button>
          </div>
        )}

        {/* Result Display */}
        {showResult && (
          <div style={styles.resultSection} role="region" aria-live="polite" aria-atomic="true">
            <div 
              style={{
                ...styles.resultIndicator,
                backgroundColor: isCorrect ? '#4CAF50' : '#f44336',
                color: 'white'
              }}
              role="status"
              aria-label={isCorrect ? 'תשובה נכונה' : 'תשובה שגויה'}
            >
              {isCorrect ? '✓ תשובה נכונה!' : '✗ תשובה שגויה'}
            </div>

            {/* Explanation - Show automatically for wrong answers, optional for correct */}
            {currentQuestion.explanation && (
              <div style={styles.explanationSection}>
                {!isCorrect && (
                  <div style={styles.explanationBox}>
                    <h3 style={styles.explanationTitle}>הסבר:</h3>
                    <div 
                      style={styles.explanationText}
                      dangerouslySetInnerHTML={{ __html: currentQuestion.explanation }}
                    />
                  </div>
                )}
                {isCorrect && !showExplanation && (
                  <button
                    style={styles.explanationButton}
                    onClick={() => setShowExplanation(true)}
                  >
                    📖 למה זה נכון?
                  </button>
                )}
                {isCorrect && showExplanation && (
                  <div style={styles.explanationBox}>
                    <h3 style={styles.explanationTitle}>הסבר:</h3>
                    <div 
                      style={styles.explanationText}
                      dangerouslySetInnerHTML={{ __html: currentQuestion.explanation }}
                    />
                  </div>
                )}
              </div>
            )}

            {currentQuestion.question_type === 'open_ended' && (
              <div style={styles.botFeedback}>
                <h3>משוב מערכת:</h3>
                {botFeedback ? (
                  <div>
                    <p style={styles.feedbackText}>{botFeedback}</p>
                    <div style={styles.selfAssessment}>
                      <button
                        style={{
                          ...styles.assessmentButton,
                          ...styles.assessmentButtonSuccess
                        }}
                        onClick={() => handleSelfAssessment(true)}
                        aria-label="הבנתי את התשובה"
                      >
                        הבנתי ✓
                      </button>
                      <button
                        style={{
                          ...styles.assessmentButton,
                          ...styles.assessmentButtonError
                        }}
                        onClick={() => handleSelfAssessment(false)}
                        aria-label="לא הבנתי את התשובה"
                      >
                        לא הבנתי ✗
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={styles.loadingFeedback}>
                    <LoadingSpinner size="sm" />
                    <span>ממתין למשוב מהמערכת...</span>
                  </div>
                )}
              </div>
            )}

            {currentQuestion.question_type !== 'open_ended' && (
              <button 
                style={styles.nextButton}
                onClick={() => {
                  handleNextQuestion();
                  announce('טוען שאלה הבאה');
                }}
                aria-label="עבור לשאלה הבאה"
              >
                שאלה הבאה →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Session Stats */}
      {sessionStats && (
        <div style={styles.statsBar}>
          <span>שאלות חדשות: {sessionStats.new}</span>
          <span>שגיאות: {sessionStats.mistakes}</span>
          <span>סקירה: {sessionStats.review}</span>
        </div>
      )}
    </div>
  );
}

function renderAnswerInput(question, userAnswer, setUserAnswer, selectedOptions, setSelectedOptions) {
  let correctAnswer;
  try {
    correctAnswer = JSON.parse(question.correct_answer || '{}');
  } catch (e) {
    correctAnswer = { value: question.correct_answer, options: [] };
  }

  // If no options, create default options for single choice
  if (!correctAnswer.options && question.question_type === 'single_choice') {
    correctAnswer.options = [
      { value: '15', label: '15' },
      { value: '30', label: '30' },
      { value: '50', label: '50' }
    ];
  }

  switch (question.question_type) {
    case 'single_choice':
    case 'true_false':
      return (
        <div style={styles.optionsContainer} role="radiogroup" aria-label="אפשרויות תשובה">
          {correctAnswer.options?.map((option, index) => (
            <label key={index} style={styles.radioLabel}>
              <input
                type="radio"
                name="answer"
                value={option.value}
                checked={userAnswer === option.value}
                onChange={(e) => setUserAnswer(e.target.value)}
                style={styles.radioInput}
                aria-label={option.label}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );

    case 'multi_choice':
      return (
        <div style={styles.optionsContainer} role="group" aria-label="אפשרויות תשובה מרובות">
          {correctAnswer.options?.map((option, index) => (
            <label key={index} style={styles.checkboxLabel}>
              <input
                type="checkbox"
                value={option.value}
                checked={selectedOptions.includes(option.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedOptions([...selectedOptions, option.value]);
                  } else {
                    setSelectedOptions(selectedOptions.filter(v => v !== option.value));
                  }
                }}
                style={styles.checkboxInput}
                aria-label={option.label}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );

    case 'open_ended':
      return (
        <textarea
          style={styles.textArea}
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="הקלד את תשובתך כאן..."
          rows={6}
          aria-label="תשובה לשאלה פתוחה"
        />
      );

    default:
      return null;
  }
}

function getQuestionTypeLabel(type) {
  const labels = {
    single_choice: 'בחירה יחידה',
    multi_choice: 'בחירה מרובה',
    true_false: 'נכון/לא נכון',
    open_ended: 'שאלה פתוחה'
  };
  return labels[type] || type;
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '20px',
    maxWidth: '100%',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px'
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '15px',
    fontSize: '14px',
    color: '#666',
    flexWrap: 'wrap',
    gap: '8px'
  },
  difficulty: {},
  questionType: {
    fontWeight: 'bold'
  },
  mediaContainer: {
    marginBottom: '15px',
    textAlign: 'center'
  },
  media: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '4px'
  },
  questionText: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '20px',
    lineHeight: '1.6'
  },
  hintSection: {
    marginBottom: '20px'
  },
  hintButton: {
    padding: '10px 20px',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: 'bold',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#F57C00'
    },
    '&:focus': {
      outline: '3px solid #ff9800',
      outlineOffset: '2px'
    }
  },
  hintBox: {
    padding: '15px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    fontSize: '14px',
    lineHeight: '1.6'
  },
  answerSection: {
    marginTop: '20px'
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  radioInput: {
    marginLeft: '8px'
  },
  checkboxInput: {
    marginLeft: '8px'
  },
  textArea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    fontFamily: 'inherit',
    direction: 'rtl',
    textAlign: 'right',
    resize: 'vertical'
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    minHeight: '44px', // Touch target size
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '3px solid #CC0000',
      outlineOffset: '2px'
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed'
    }
  },
  resultSection: {
    marginTop: '20px'
  },
  explanationSection: {
    marginBottom: '15px'
  },
  explanationButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  explanationBox: {
    padding: '15px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #CC0000',
    borderRadius: '4px',
    marginBottom: '15px'
  },
  explanationTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#1976d2'
  },
  explanationText: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#333'
  },
  resultIndicator: {
    padding: '15px',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '15px'
  },
  botFeedback: {
    backgroundColor: '#f9f9f9',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '15px',
    border: '1px solid #e0e0e0'
  },
  feedbackText: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#333',
    marginBottom: '15px',
    whiteSpace: 'pre-wrap'
  },
  loadingFeedback: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    color: '#666'
  },
  selfAssessment: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px'
  },
  assessmentButton: {
    flex: 1,
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    minHeight: '44px',
    transition: 'all 0.2s',
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    '&:focus': {
      outline: '3px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  assessmentButtonSuccess: {
    borderColor: '#4CAF50',
    color: '#4CAF50',
    '&:hover': {
      backgroundColor: '#e8f5e9'
    }
  },
  assessmentButtonError: {
    borderColor: '#f44336',
    color: '#f44336',
    '&:hover': {
      backgroundColor: '#ffebee'
    }
  },
  nextButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#666',
    flexWrap: 'wrap',
    gap: '12px'
  },
  offlineBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#ff9800',
    color: '#FFFFFF',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  offlineIcon: {
    fontSize: '18px',
    fontWeight: 'bold'
  },
  offlineCount: {
    marginRight: 'auto',
    fontSize: '12px',
    opacity: 0.9
  }
};
