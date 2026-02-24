/**
 * Study Plan Card Component
 * Display study plan preview
 * Hebrew: כרטיס תוכנית לימוד
 */

import React from 'react';
import ProgressBar from './LoadingSpinner';

export default function StudyPlanCard({ 
  plan, 
  isEnrolled = false, 
  progress = 0, 
  onEnroll, 
  onView 
}) {
  return (
    <div style={styles.card} role="article" aria-label={`תוכנית לימוד: ${plan.title}`}>
      <div style={styles.header}>
        <h3 style={styles.title}>{plan.title}</h3>
        {isEnrolled && (
          <span style={styles.badge} aria-label="רשום">רשום</span>
        )}
      </div>

      {plan.description && (
        <p style={styles.description}>{plan.description}</p>
      )}

      <div style={styles.details}>
        <div style={styles.detailItem}>
          <span style={styles.detailLabel}>יעד יומי:</span>
          <span style={styles.detailValue}>{plan.daily_goal} שאלות</span>
        </div>
        {plan.categories && plan.categories.length > 0 && (
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>קטגוריות:</span>
            <span style={styles.detailValue}>
              {plan.categories.slice(0, 2).join(', ')}
              {plan.categories.length > 2 && ` +${plan.categories.length - 2}`}
            </span>
          </div>
        )}
      </div>

      {isEnrolled && (
        <div style={styles.progressSection}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>התקדמות</span>
            <span style={styles.progressPercent}>{progress}%</span>
          </div>
          <ProgressBar value={progress} max={100} />
        </div>
      )}

      <div style={styles.actions}>
        {isEnrolled ? (
          <button
            style={styles.viewButton}
            onClick={onView}
            aria-label={`צפה בתוכנית ${plan.title}`}
          >
            צפה בתוכנית
          </button>
        ) : (
          <button
            style={styles.enrollButton}
            onClick={onEnroll}
            aria-label={`הירשם לתוכנית ${plan.title}`}
          >
            הירשם
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
    }
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px'
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
    color: '#212121',
    flex: 1
  },
  badge: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    flexShrink: 0
  },
  description: {
    fontSize: '14px',
    color: '#757575',
    lineHeight: 1.6,
    margin: 0
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px'
  },
  detailLabel: {
    color: '#757575',
    fontWeight: '500'
  },
  detailValue: {
    color: '#212121'
  },
  progressSection: {
    paddingTop: '16px',
    borderTop: '1px solid #f5f5f5'
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px'
  },
  progressLabel: {
    color: '#757575',
    fontWeight: '500'
  },
  progressPercent: {
    color: '#CC0000',
    fontWeight: 'bold'
  },
  actions: {
    marginTop: 'auto',
    paddingTop: '16px'
  },
  enrollButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
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
  viewButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#FFFFFF',
    color: '#CC0000',
    border: '1px solid #CC0000',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f0f7ff'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  }
};
