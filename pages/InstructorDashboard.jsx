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
    fontFamily: "'Heebo', 'Assistant', Arial, sans-serif",
    backgroundColor: '#f8f9fa',
  },
  header: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    padding: '24px 28px',
    borderBottom: '1px solid #e8e8e8',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '26px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  nav: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  navButton: {
    padding: '10px 18px',
    backgroundColor: '#f0f0f0',
    color: '#555',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 500,
    minHeight: '44px',
    transition: 'background-color 0.2s, color 0.2s',
  },
  navButtonActive: {
    backgroundColor: '#fff',
    color: '#CC0000',
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #e8e8e8',
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
