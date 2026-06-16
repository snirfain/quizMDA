/**
 * Instructor Dashboard Page
 * Main entry point for instructors
 * Hebrew: מסך מדריך
 */

import React, { useState } from 'react';
import TestGenerator from '../components/TestGenerator';
import InstructorAnalytics from '../components/InstructorAnalytics';
import QuestionManagement from '../components/QuestionManagement';
import EcgReviewQueue from '../components/EcgReviewQueue';

export default function InstructorDashboard({ instructorId }) {
  const [activeTab, setActiveTab] = useState('test-generator');

  return (
    <div style={styles.container} aria-label="לוח בקרה למדריך">
      <div style={styles.header}>
        <h1 style={styles.title}>לוח בקרה למדריך</h1>
        <nav className="tabs" style={styles.nav} role="tablist" aria-label="ניווט מדריך">
          <button
            className={`tab-btn ${activeTab === 'test-generator' ? 'active' : ''}`}
            onClick={() => setActiveTab('test-generator')}
            role="tab"
            aria-selected={activeTab === 'test-generator'}
            aria-controls="test-generator-panel"
            id="test-generator-tab"
          >
            מחולל מבחנים
          </button>
          <button
            className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
            role="tab"
            aria-selected={activeTab === 'questions'}
            aria-controls="questions-panel"
            id="questions-tab"
          >
            ניהול שאלות
          </button>
          <button
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
            role="tab"
            aria-selected={activeTab === 'analytics'}
            aria-controls="analytics-panel"
            id="analytics-tab"
          >
            אנליטיקה
          </button>
          <button
            className={`tab-btn ${activeTab === 'ecg' ? 'active' : ''}`}
            onClick={() => setActiveTab('ecg')}
            role="tab"
            aria-selected={activeTab === 'ecg'}
            aria-controls="ecg-panel"
            id="ecg-tab"
          >
            תור אישורי אקג
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
        {activeTab === 'ecg' && (
          <div role="tabpanel" aria-labelledby="ecg-tab" id="ecg-panel" style={{ padding: 'var(--space-6)' }}>
            <EcgReviewQueue />
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
    backgroundColor: 'var(--color-bg)',
  },
  header: {
    background: 'var(--color-bg-card)',
    padding: 'var(--space-6) var(--space-6)',
    borderBottom: '2px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  title: {
    margin: '0 0 var(--space-4) 0',
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  nav: {
    display: 'flex',
    gap: 'var(--space-2)',
    flexWrap: 'wrap',
  },
  main: {
    padding: 0,
  },
  placeholder: {
    padding: 'var(--space-10)',
    textAlign: 'center',
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-text-muted)',
  },
};
