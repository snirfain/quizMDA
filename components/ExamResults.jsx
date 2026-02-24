/**
 * Exam Results Component
 * Display exam results and review
 * Hebrew: תוצאות בחינה
 */

import React, { useState } from 'react';
import { navigateTo } from '../utils/router';
import { showToast } from './Toast';

export default function ExamResults({ results, questions, answers }) {
  const [showReview, setShowReview] = useState(false);
  const [reviewQuestionId, setReviewQuestionId] = useState(null);

  const getGradeColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  const getGradeText = (score) => {
    if (score >= 80) return 'מצוין';
    if (score >= 60) return 'טוב';
    return 'נדרש שיפור';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} דקות ו-${secs} שניות`;
  };

  const reviewQuestion = questions.find(q => q.id === reviewQuestionId);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>תוצאות הבחינה</h1>
        <button
          style={styles.backButton}
          onClick={() => navigateTo('/practice')}
          aria-label="חזור לתרגול"
        >
          חזור לתרגול
        </button>
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <div style={styles.scoreCard}>
          <div style={{
            ...styles.scoreCircle,
            borderColor: getGradeColor(results.score)
          }}>
            <div style={{
              ...styles.scoreValue,
              color: getGradeColor(results.score)
            }}>
              {results.score}%
            </div>
          </div>
          <div style={styles.scoreLabel}>{getGradeText(results.score)}</div>
        </div>

        <div style={styles.stats}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{results.totalQuestions}</div>
            <div style={styles.statLabel}>סה"כ שאלות</div>
          </div>
          <div style={styles.statItem}>
            <div style={{...styles.statValue, color: '#4CAF50'}}>
              {results.correctAnswers}
            </div>
            <div style={styles.statLabel}>תשובות נכונות</div>
          </div>
          <div style={styles.statItem}>
            <div style={{...styles.statValue, color: '#f44336'}}>
              {results.incorrectAnswers}
            </div>
            <div style={styles.statLabel}>תשובות שגויות</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>
              {formatTime(results.timeSpent)}
            </div>
            <div style={styles.statLabel}>זמן שהושקע</div>
          </div>
        </div>
      </div>

      {/* Questions Review */}
      <div style={styles.reviewSection}>
        <h2 style={styles.sectionTitle}>סקירת שאלות</h2>
        <div style={styles.questionsGrid}>
          {questions.map((question, index) => {
            const isCorrect = results.correctQuestionIds.includes(question.id);
            const userAnswer = answers[question.id];

            return (
              <div
                key={question.id}
                style={{
                  ...styles.questionCard,
                  ...(isCorrect ? styles.questionCardCorrect : styles.questionCardIncorrect)
                }}
                onClick={() => {
                  setReviewQuestionId(question.id);
                  setShowReview(true);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setReviewQuestionId(question.id);
                    setShowReview(true);
                  }
                }}
                aria-label={`שאלה ${index + 1}: ${isCorrect ? 'נכונה' : 'שגויה'}`}
              >
                <div style={styles.questionCardHeader}>
                  <span style={styles.questionNumber}>שאלה {index + 1}</span>
                  <span style={{
                    ...styles.statusBadge,
                    ...(isCorrect ? styles.statusCorrect : styles.statusIncorrect)
                  }}>
                    {isCorrect ? '✓ נכון' : '✗ שגוי'}
                  </span>
                </div>
                <div style={styles.questionPreview}>
                  {question.question_text?.substring(0, 100)}
                  {question.question_text?.length > 100 && '...'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question Review Modal */}
      {showReview && reviewQuestion && (
        <div
          style={styles.modal}
          onClick={() => setShowReview(false)}
          role="dialog"
          aria-modal="true"
          aria-label="סקירת שאלה"
        >
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>סקירת שאלה</h3>
              <button
                style={styles.closeButton}
                onClick={() => setShowReview(false)}
                aria-label="סגור"
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.questionText}>
                {reviewQuestion.question_text}
              </div>

              <div style={styles.answerSection}>
                <div style={styles.answerRow}>
                  <strong>תשובתך:</strong>
                  <span style={{
                    ...styles.answerValue,
                    ...(results.correctQuestionIds.includes(reviewQuestion.id) 
                      ? styles.answerCorrect 
                      : styles.answerIncorrect)
                  }}>
                    {answers[reviewQuestion.id] || 'לא ענה'}
                  </span>
                </div>
                <div style={styles.answerRow}>
                  <strong>תשובה נכונה:</strong>
                  <span style={styles.answerValue}>
                    {reviewQuestion.correct_answer}
                  </span>
                </div>
              </div>

              {reviewQuestion.explanation && (
                <div style={styles.explanation}>
                  <strong>הסבר:</strong>
                  <p>{reviewQuestion.explanation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: 0,
    color: '#212121'
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#757575',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#616161'
    },
    '&:focus': {
      outline: '2px solid #757575',
      outlineOffset: '2px'
    }
  },
  summary: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '40px',
    marginBottom: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '30px'
  },
  scoreCard: {
    textAlign: 'center'
  },
  scoreCircle: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    border: '8px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px'
  },
  scoreValue: {
    fontSize: '48px',
    fontWeight: 'bold'
  },
  scoreLabel: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#212121'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '20px',
    width: '100%',
    maxWidth: '800px'
  },
  statItem: {
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#CC0000',
    marginBottom: '8px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#757575'
  },
  reviewSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121'
  },
  questionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px'
  },
  questionCard: {
    padding: '16px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    border: '2px solid',
    '&:hover': {
      transform: 'translateY(-2px)'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  questionCardCorrect: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50'
  },
  questionCardIncorrect: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336'
  },
  questionCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  questionNumber: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#212121'
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  statusCorrect: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF'
  },
  statusIncorrect: {
    backgroundColor: '#f44336',
    color: '#FFFFFF'
  },
  questionPreview: {
    fontSize: '14px',
    color: '#757575',
    lineHeight: 1.4
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#757575',
    '&:hover': {
      color: '#212121'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  modalBody: {
    padding: '20px'
  },
  questionText: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121',
    lineHeight: 1.6
  },
  answerSection: {
    marginBottom: '20px'
  },
  answerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px'
  },
  answerValue: {
    fontSize: '14px'
  },
  answerCorrect: {
    color: '#4CAF50',
    fontWeight: 'bold'
  },
  answerIncorrect: {
    color: '#f44336',
    fontWeight: 'bold'
  },
  explanation: {
    padding: '16px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    marginTop: '20px'
  }
};
