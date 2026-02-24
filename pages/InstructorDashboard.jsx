/**
 * Instructor Dashboard Page
 * Main entry point for instructors
 * Hebrew: מסך מדריך
 */

import React, { useState } from 'react';
import TestGenerator from '../components/TestGenerator';
import InstructorAnalytics from '../components/InstructorAnalytics';
import QuestionManagement from '../components/QuestionManagement';

export default function InstructorDashboard({ instructorId }) {
  const [activeTab, setActiveTab] = useState('test-generator');

  return (
    <div style={styles.container} aria-label="לוח בקרה למדריך">
      <div style={styles.header}>
        <h1 style={styles.title}>לוח בקרה למדריך</h1>
        <nav style={styles.nav} role="navigation" aria-label="ניווט מדריך">
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === 'test-generator' ? styles.navButtonActive : {})
            }}
            onClick={() => setActiveTab('test-generator')}
            role="tab"
            aria-selected={activeTab === 'test-generator'}
            aria-controls="test-generator-panel"
            id="test-generator-tab"
          >
            מחולל מבחנים
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === 'questions' ? styles.navButtonActive : {})
            }}
            onClick={() => setActiveTab('questions')}
            role="tab"
            aria-selected={activeTab === 'questions'}
            aria-controls="questions-panel"
            id="questions-tab"
          >
            ניהול שאלות
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(activeTab === 'analytics' ? styles.navButtonActive : {})
            }}
            onClick={() => setActiveTab('analytics')}
            role="tab"
            aria-selected={activeTab === 'analytics'}
            aria-controls="analytics-panel"
            id="analytics-tab"
          >
            אנליטיקה
          </button>
        </nav>
      </div>

      <main style={styles.main}>
        {activeTab === 'test-generator' && (
          <div role="tabpanel" aria-labelledby="test-generator-tab" id="test-generator-panel">
            <TestGenerator instructorId={instructorId} />
          </div>
        )}
        {activeTab === 'questions' && (
          <div role="tabpanel" aria-labelledby="questions-tab" id="questions-panel">
            <QuestionManagement />
          </div>
        )}
        {activeTab === 'analytics' && (
          <div role="tabpanel" aria-labelledby="analytics-tab" id="analytics-panel">
            <InstructorAnalytics instructorId={instructorId} />
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: 'Arial, Helvetica, sans-serif',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#CC0000',
    color: 'white',
    padding: '20px 30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 15px 0',
    fontSize: '28px',
    fontWeight: 'bold',
  },
  nav: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  navButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.3)'
    },
    '&:focus': {
      outline: '3px solid white',
      outlineOffset: '2px'
    },
  },
  navButtonActive: {
    backgroundColor: 'white',
    color: '#CC0000',
    fontWeight: 'bold'
  },
  main: {
    padding: '0'
  },
  placeholder: {
    padding: '40px',
    textAlign: 'center',
    fontSize: '18px',
    color: '#666',
  }
};
