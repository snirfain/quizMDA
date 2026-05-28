/**
 * Mock Exam Component
 * Full-screen exam mode with timer
 * Hebrew: בחינה מדומה
 */

import React, { useState, useEffect, useRef } from 'react';
import { getPracticeSession } from '../workflows/adaptivePracticeEngine';
import { generateTraineeExam } from '../workflows/testGenerator';
import { getCurrentUser } from '../utils/auth';
import ExamResults from './ExamResults';
import LoadingSpinner from './LoadingSpinner';
import { showToast } from './Toast';
import { announce } from '../utils/accessibility';
import QuestionReportModal from './QuestionReportModal';
import QuestionResolvedMedia from './QuestionResolvedMedia';
import { computeRollingCaseTotalScore } from '../workflows/rollingCaseEngine';

const safeParse = (v, fallback = []) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') try { return JSON.parse(v); } catch { return fallback; }
  return fallback;
};

function getExamStateFromRouter() {
  if (typeof window === 'undefined' || !window.history || !window.history.state) return null;
  return window.history.state;
}

export default function MockExam({ questionCount: propCount = 20, timeLimit: propTimeLimit = 30 }) {
  const routeState = getExamStateFromRouter();
  const questionCount = routeState?.questionCount ?? routeState?.preGeneratedQuestions?.length ?? propCount;
  const timeLimitMinutes = routeState?.timeLimitMinutes ?? (routeState?.useTimeLimit ? 1.5 * questionCount : 0) ?? propTimeLimit;
  const timeLimit = timeLimitMinutes > 0 ? timeLimitMinutes : 999;

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit * 60);
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportQuestion, setReportQuestion] = useState(null);
  const [effectiveQuestionUnits, setEffectiveQuestionUnits] = useState(questionCount);
  const [rollingProgress, setRollingProgress] = useState({});
  const [rollingDraft, setRollingDraft] = useState({});
  const timerRef = useRef(null);

  const hasTimeLimit = timeLimit < 999;
  useEffect(() => {
    if (isStarted && hasTimeLimit && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isStarted, timeRemaining, hasTimeLimit]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      if (routeState?.preGeneratedQuestions?.length > 0) {
        setQuestions(routeState.preGeneratedQuestions);
        const units = routeState.preGeneratedQuestions.reduce((sum, q) => {
          if (q.question_type === 'rolling_case' && q.rolling_case?.branches?.length) return sum + q.rolling_case.branches.length;
          return sum + 1;
        }, 0);
        setEffectiveQuestionUnits(units);
        if (hasTimeLimit) setTimeRemaining(Math.round((timeLimitMinutes * 60 * units) / Math.max(1, questionCount)));
        setIsLoading(false);
        return;
      }
      if (routeState?.examSpec) {
        const { questions: qs } = await generateTraineeExam(routeState.examSpec);
        setQuestions(qs);
        const units = qs.reduce((sum, q) => {
          if (q.question_type === 'rolling_case' && q.rolling_case?.branches?.length) return sum + q.rolling_case.branches.length;
          return sum + 1;
        }, 0);
        setEffectiveQuestionUnits(units);
        if (hasTimeLimit) setTimeRemaining(Math.round((timeLimitMinutes * 60 * units) / Math.max(1, questionCount)));
        return;
      }
      const user = await getCurrentUser();
      const result = await getPracticeSession(
        user.user_id,
        questionCount,
        routeState?.hierarchyFilters || {},
        routeState?.tagFilters || []
      );
      const picked = result.questions.slice(0, questionCount);
      setQuestions(picked);
      const units = picked.reduce((sum, q) => {
        if (q.question_type === 'rolling_case' && q.rolling_case?.branches?.length) return sum + q.rolling_case.branches.length;
        return sum + 1;
      }, 0);
      setEffectiveQuestionUnits(units);
      if (hasTimeLimit) setTimeRemaining(Math.round((timeLimitMinutes * 60 * units) / Math.max(1, questionCount)));
    } catch (error) {
      console.error('Error loading questions:', error);
      showToast('שגיאה בטעינת שאלות', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    await loadQuestions();
    setIsStarted(true);
    announce('בחינה התחילה');
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleRollingBranchAnswer = (questionId, branchId, answer) => {
    const existing = answers[questionId] || {};
    if (existing[branchId] != null) return; // no backtracking edits
    const next = { ...existing, [branchId]: answer };
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    setRollingProgress((prev) => ({
      ...prev,
      [questionId]: Math.max(prev[questionId] || 0, Object.keys(next).length),
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      announce(`שאלה ${currentIndex + 2} מתוך ${questions.length}`);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      announce(`שאלה ${currentIndex} מתוך ${questions.length}`);
    }
  };

  const handleGoToQuestion = (index) => {
    setCurrentIndex(index);
    announce(`שאלה ${index + 1} מתוך ${questions.length}`);
  };

  const calculateResults = async () => {
    const correctAnswers = [];
    const incorrectAnswers = [];
    const rollingBreakdown = [];
    let scoredUnits = 0;
    let maxUnits = 0;

    for (const question of questions) {
      const userAnswer = answers[question.id];
      if (question.question_type === 'rolling_case' && question.rolling_case) {
        const rcScore = computeRollingCaseTotalScore(question.rolling_case, userAnswer || {});
        scoredUnits += rcScore.rawScore;
        maxUnits += rcScore.totalBranches;
        rollingBreakdown.push({ question_id: question.id, ...rcScore });
        if (rcScore.percent >= 99.9) correctAnswers.push(question.id);
        else incorrectAnswers.push(question.id);
        continue;
      }

      const isCorrect = await checkAnswer(question, userAnswer);
      
      if (isCorrect) {
        correctAnswers.push(question.id);
        scoredUnits += 1;
      } else {
        incorrectAnswers.push(question.id);
      }
      maxUnits += 1;
    }

    const score = maxUnits > 0 ? (scoredUnits / maxUnits) * 100 : 0;

    return {
      totalQuestions: questions.length,
      correctAnswers: correctAnswers.length,
      incorrectAnswers: incorrectAnswers.length,
      score: Math.round(score),
      scoreUnits: { scored: scoredUnits, total: maxUnits },
      effectiveQuestionUnits,
      rollingBreakdown,
      correctQuestionIds: correctAnswers,
      incorrectQuestionIds: incorrectAnswers,
      timeSpent: (timeLimit * 60) - timeRemaining
    };
  };

  const checkAnswer = async (question, userAnswer) => {
    if (!userAnswer) return false;

    if (question.question_type === 'single_choice' || question.question_type === 'true_false') {
      return userAnswer === question.correct_answer;
    }

    if (question.question_type === 'multi_choice') {
      const correctAnswers = safeParse(question.correct_answer);
      const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      return JSON.stringify(correctAnswers.sort()) === JSON.stringify(userAnswers.sort());
    }

    // For open-ended, we'd need bot validation, but for mock exam we'll skip
    return false;
  };

  const handleSubmit = async () => {
    if (window.confirm('האם אתה בטוח שברצונך להגיש את הבחינה?')) {
      const examResults = await calculateResults();
      setResults(examResults);
      setIsSubmitted(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      announce('בחינה הוגשה');
    }
  };

  const handleAutoSubmit = async () => {
    const examResults = await calculateResults();
    setResults(examResults);
    setIsSubmitted(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    showToast('הזמן נגמר - הבחינה הוגשה אוטומטית', 'warning');
    announce('הזמן נגמר - הבחינה הוגשה אוטומטית');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="טוען שאלות..." />;
  }

  if (isSubmitted && results) {
    return (
      <ExamResults
        results={results}
        questions={questions}
        answers={answers}
      />
    );
  }

  if (!isStarted) {
    return (
      <div style={styles.startScreen}>
          <h1 style={styles.title}>בחינה מדומה</h1>
          <div style={styles.info}>
            <p style={styles.infoItem}>
              <strong>מספר שאלות:</strong> {questionCount}
            </p>
            <p style={styles.infoItem}>
              <strong>זמן מוקצב:</strong> {timeLimit >= 999 ? 'ללא הגבלה' : `${timeLimit} דקות`}
            </p>
            <p style={styles.infoItem}>
              <strong>סוג שאלות:</strong> מעורב
            </p>
          </div>
          <div style={styles.instructions}>
            <h2 style={styles.instructionsTitle}>הוראות:</h2>
            <ul style={styles.instructionsList}>
              <li>הבחינה תתחיל בלחיצה על הכפתור למטה</li>
              <li>יש לענות על כל השאלות בזמן המוקצב</li>
              <li>ניתן לנווט בין שאלות באמצעות הכפתורים</li>
              <li>הבחינה תוגש אוטומטית עם סיום הזמן</li>
            </ul>
          </div>
          <button
            style={styles.startButton}
            onClick={handleStart}
            aria-label="התחל בחינה"
          >
            התחל בחינה
          </button>
        </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div style={styles.examContainer}>
        {/* Header */}
        <div style={styles.header}>
          {hasTimeLimit && (
            <div style={styles.timer}>
              <span style={styles.timerLabel}>זמן נותר:</span>
              <span style={{
                ...styles.timerValue,
                ...(timeRemaining < 300 ? styles.timerWarning : {})
              }}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
          <div style={styles.progress}>
            שאלה {currentIndex + 1} מתוך {questions.length}
          </div>
          <button
            style={styles.submitButton}
            onClick={handleSubmit}
            aria-label="הגש בחינה"
          >
            הגש בחינה
          </button>
        </div>

        {/* Question Navigation */}
        <div style={styles.navigation}>
          {questions.map((q, index) => (
            <button
              key={q.id}
              style={{
                ...styles.navButton,
                ...(index === currentIndex ? styles.navButtonActive : {}),
                ...(answers[q.id] ? styles.navButtonAnswered : {})
              }}
              onClick={() => handleGoToQuestion(index)}
              aria-label={`עבור לשאלה ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {/* Question */}
        <div style={styles.questionSection}>
          <div style={styles.questionNumber}>
            שאלה {currentIndex + 1} מתוך {questions.length}
          </div>
          <h2 style={styles.questionText}>{currentQuestion.question_text}</h2>
          {currentQuestion.question_type === 'rolling_case' && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{currentQuestion.case_name || 'מקרה מתגלגל'}</div>
              <div style={{ fontSize: 13, color: '#555' }}>
                ענף {(rollingProgress[currentQuestion.id] || 0) + 1} מתוך {(currentQuestion.rolling_case?.branches || []).length}
              </div>
            </div>
          )}
          <button
            type="button"
            style={{ padding: '4px 10px', fontSize: '12px', color: '#c62828', background: 'transparent', border: '1px solid #c62828', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px' }}
            onClick={() => setReportQuestion(currentQuestion)}
          >
            דווח על בעיה
          </button>

          <QuestionResolvedMedia
            question={currentQuestion}
            containerStyle={styles.media}
            imageStyle={styles.mediaImage}
          />

          <div style={styles.answers}>
            {currentQuestion.question_type === 'single_choice' && (
              <div style={styles.optionsList}>
                {safeParse(currentQuestion.options).map((option, index) => (
                  <label key={index} style={styles.optionLabel}>
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={index}
                      checked={answers[currentQuestion.id] === index.toString()}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      style={styles.radio}
                    />
                    <span>{option.label ?? option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.question_type === 'multi_choice' && (
              <div style={styles.optionsList}>
                {safeParse(currentQuestion.options).map((option, index) => (
                  <label key={index} style={styles.optionLabel}>
                    <input
                      type="checkbox"
                      value={index}
                      checked={(answers[currentQuestion.id] || []).includes(index.toString())}
                      onChange={(e) => {
                        const current = answers[currentQuestion.id] || [];
                        const newAnswers = e.target.checked
                          ? [...current, index.toString()]
                          : current.filter(a => a !== index.toString());
                        handleAnswerChange(currentQuestion.id, newAnswers);
                      }}
                      style={styles.checkbox}
                    />
                    <span>{option.label ?? option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.question_type === 'true_false' && (
              <div style={styles.optionsList}>
                <label style={styles.optionLabel}>
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value="true"
                    checked={answers[currentQuestion.id] === 'true'}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    style={styles.radio}
                  />
                  <span>נכון</span>
                </label>
                <label style={styles.optionLabel}>
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value="false"
                    checked={answers[currentQuestion.id] === 'false'}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    style={styles.radio}
                  />
                  <span>לא נכון</span>
                </label>
              </div>
            )}

            {currentQuestion.question_type === 'open_ended' && (
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                style={styles.textarea}
                placeholder="הקלד את תשובתך כאן..."
                rows={6}
                aria-label="תשובה לשאלה פתוחה"
              />
            )}

            {currentQuestion.question_type === 'rolling_case' && (
              <div style={styles.optionsList}>
                {(currentQuestion.rolling_case?.branches || []).map((branch, branchIdx) => {
                  const branchAns = answers[currentQuestion.id]?.[branch.id];
                  const prevAnsweredCount = rollingProgress[currentQuestion.id] || 0;
                  const enabled = branchIdx <= prevAnsweredCount;
                  return (
                    <div key={branch.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 10, opacity: enabled ? 1 : 0.6 }}>
                      <div style={{ fontSize: 12, color: '#777', marginBottom: 4 }}>ענף {branchIdx + 1}</div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{branch.question_text}</div>
                      {branch.question_type === 'true_false' ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                          {['true', 'false'].map((v) => (
                            <button
                              key={v}
                              type="button"
                              disabled={!enabled || branchAns != null}
                              onClick={() => handleRollingBranchAnswer(currentQuestion.id, branch.id, v)}
                              style={styles.controlButton}
                            >
                              {v === 'true' ? 'נכון' : 'לא נכון'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(branch.options || []).map((opt, optIdx) => {
                            const v = String(opt.value ?? optIdx);
                            const draftKey = `${currentQuestion.id}:${branch.id}`;
                            const draftValues = Array.isArray(rollingDraft[draftKey]) ? rollingDraft[draftKey] : [];
                            return (
                              <button
                                key={v}
                                type="button"
                                disabled={!enabled || branchAns != null}
                                onClick={() => {
                                  if (branch.question_type === 'multi_choice') {
                                    const next = draftValues.includes(v)
                                      ? draftValues.filter((x) => x !== v)
                                      : [...draftValues, v];
                                    setRollingDraft((prev) => ({ ...prev, [draftKey]: next }));
                                  } else {
                                    handleRollingBranchAnswer(currentQuestion.id, branch.id, v);
                                  }
                                }}
                                style={{ ...styles.optionLabel, justifyContent: 'flex-start', textAlign: 'right', background: draftValues.includes(v) ? '#e3f2fd' : styles.optionLabel.backgroundColor }}
                              >
                                {opt.label ?? opt.text ?? v}
                              </button>
                            );
                          })}
                          {branch.question_type === 'multi_choice' && branchAns == null && enabled && (
                            <button
                              type="button"
                              style={styles.controlButton}
                              onClick={() => {
                                const draftKey = `${currentQuestion.id}:${branch.id}`;
                                handleRollingBranchAnswer(currentQuestion.id, branch.id, rollingDraft[draftKey] || []);
                              }}
                            >
                              אשר ענף
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div style={styles.controls}>
          <button
            style={styles.controlButton}
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            aria-label="שאלה קודמת"
          >
            ← קודם
          </button>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${(answeredCount / questions.length) * 100}%`
              }}
            />
          </div>
          <button
            style={styles.controlButton}
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            aria-label="שאלה הבאה"
          >
            הבא →
          </button>
        </div>

        {reportQuestion && (
          <QuestionReportModal question={reportQuestion} onClose={() => setReportQuestion(null)} />
        )}
      </div>
  );
}

const styles = {
  startScreen: {
    direction: 'rtl',
    maxWidth: '600px',
    margin: '0 auto',
    padding: 'clamp(16px, 5vw, 40px)',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  title: {
    fontSize: 'clamp(24px, 5vw, 36px)',
    fontWeight: 'bold',
    marginBottom: '24px',
    color: '#212121'
  },
  info: {
    backgroundColor: '#f5f5f5',
    padding: '24px',
    borderRadius: '8px',
    marginBottom: '30px'
  },
  infoItem: {
    fontSize: '16px',
    marginBottom: '12px',
    color: '#212121'
  },
  instructions: {
    textAlign: 'right',
    marginBottom: '30px'
  },
  instructionsTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '16px'
  },
  instructionsList: {
    textAlign: 'right',
    paddingRight: '20px',
    lineHeight: 1.8
  },
  startButton: {
    padding: '16px 32px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  examContainer: {
    direction: 'rtl',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: '16px 24px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  timer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '18px',
    fontWeight: 'bold'
  },
  timerLabel: {
    color: '#757575'
  },
  timerValue: {
    color: '#CC0000',
    fontSize: '20px'
  },
  timerWarning: {
    color: '#f44336'
  },
  progress: {
    fontSize: '16px',
    color: '#757575'
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#388E3C'
    },
    '&:focus': {
      outline: '2px solid #4CAF50',
      outlineOffset: '2px'
    }
  },
  navigation: {
    backgroundColor: '#FFFFFF',
    padding: '12px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    borderBottom: '1px solid #e0e0e0'
  },
  navButton: {
    width: '40px',
    height: '40px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '14px',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  navButtonActive: {
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    borderColor: '#CC0000'
  },
  navButtonAnswered: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50'
  },
  questionSection: {
    flex: 1,
    padding: 'clamp(14px, 4vw, 40px)',
    maxWidth: '1000px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  questionNumber: {
    fontSize: '14px',
    color: '#757575',
    marginBottom: '16px'
  },
  questionText: {
    fontSize: 'clamp(17px, 3.5vw, 24px)',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121',
    lineHeight: 1.6,
    wordBreak: 'break-word',
  },
  media: {
    marginBottom: '24px'
  },
  mediaImage: {
    maxWidth: '100%',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  answers: {
    marginTop: '32px'
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid #e0e0e0',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    }
  },
  radio: {
    margin: 0,
    cursor: 'pointer'
  },
  checkbox: {
    margin: 0,
    cursor: 'pointer'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '16px',
    direction: 'rtl',
    fontFamily: 'inherit',
    resize: 'vertical',
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  controls: {
    backgroundColor: '#FFFFFF',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    borderTop: '1px solid #e0e0e0'
  },
  controlButton: {
    padding: '12px 24px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover:not(:disabled)': {
      backgroundColor: '#A50000'
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  progressBar: {
    flex: 1,
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease'
  }
};
