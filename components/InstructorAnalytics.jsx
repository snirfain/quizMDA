/**
 * Instructor Analytics Component
 * Analytics dashboard for instructors
 * Hebrew: אנליטיקה למדריך
 */

import React, { useState, useEffect } from 'react';
import {
  getClassPerformance,
  getQuestionDifficultyAnalysis,
  getTopicPerformanceChart,
  getTraineeProgressOverview,
  getProblematicQuestions
} from '../workflows/instructorAnalytics';

export default function InstructorAnalytics({ instructorId }) {
  const [classPerformance, setClassPerformance] = useState(null);
  const [difficultyAnalysis, setDifficultyAnalysis] = useState(null);
  const [topicPerformance, setTopicPerformance] = useState(null);
  const [traineeProgress, setTraineeProgress] = useState(null);
  const [problematicQuestions, setProblematicQuestions] = useState(null);
  const [filters, setFilters] = useState({
    category_name: '',
    topic_name: '',
    startDate: '',
    endDate: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalytics();
  }, [filters]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [performance, difficulty, topics, trainees, problematic] = await Promise.all([
        getClassPerformance(filters),
        getQuestionDifficultyAnalysis(filters),
        getTopicPerformanceChart(filters),
        getTraineeProgressOverview(filters),
        getProblematicQuestions()
      ]);
      
      setClassPerformance(performance);
      setDifficultyAnalysis(difficulty);
      setTopicPerformance(topics);
      setTraineeProgress(trainees);
      setProblematicQuestions(problematic);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>טוען נתונים...</div>;
  }

  return (
    <div style={styles.container} role="main" aria-label="אנליטיקה למדריך">
      <h1 style={styles.title}>אנליטיקה ומעקב</h1>

      {/* Filters */}
      <div style={styles.filtersCard} role="region" aria-label="סינון נתונים">
        <h2 style={styles.sectionTitle}>סינון</h2>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label htmlFor="category-filter" style={styles.label}>קטגוריה:</label>
            <input
              id="category-filter"
              type="text"
              style={styles.input}
              value={filters.category_name}
              onChange={(e) => setFilters({...filters, category_name: e.target.value})}
              placeholder="הקלד שם קטגוריה"
              aria-label="סינון לפי קטגוריה"
            />
          </div>
          <div style={styles.filterGroup}>
            <label htmlFor="topic-filter" style={styles.label}>נושא:</label>
            <input
              id="topic-filter"
              type="text"
              style={styles.input}
              value={filters.topic_name}
              onChange={(e) => setFilters({...filters, topic_name: e.target.value})}
              placeholder="הקלד שם נושא"
              aria-label="סינון לפי נושא"
            />
          </div>
          <div style={styles.filterGroup}>
            <label htmlFor="start-date-filter" style={styles.label}>מתאריך:</label>
            <input
              id="start-date-filter"
              type="date"
              style={styles.input}
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              aria-label="סינון מתאריך"
            />
          </div>
          <div style={styles.filterGroup}>
            <label htmlFor="end-date-filter" style={styles.label}>עד תאריך:</label>
            <input
              id="end-date-filter"
              type="date"
              style={styles.input}
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              aria-label="סינון עד תאריך"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs} role="tablist" aria-label="קטגוריות אנליטיקה">
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'overview' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveTab('overview')}
          role="tab"
          aria-selected={activeTab === 'overview'}
          aria-controls="overview-panel"
          id="overview-tab"
        >
          סקירה כללית
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'difficulty' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveTab('difficulty')}
          role="tab"
          aria-selected={activeTab === 'difficulty'}
          aria-controls="difficulty-panel"
          id="difficulty-tab"
        >
          ניתוח קושי
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'topics' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveTab('topics')}
          role="tab"
          aria-selected={activeTab === 'topics'}
          aria-controls="topics-panel"
          id="topics-tab"
        >
          ביצועי נושאים
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'trainees' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveTab('trainees')}
          role="tab"
          aria-selected={activeTab === 'trainees'}
          aria-controls="trainees-panel"
          id="trainees-tab"
        >
          התקדמות מתאמנים
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'problematic' ? styles.tabButtonActive : {})
          }}
          onClick={() => setActiveTab('problematic')}
          role="tab"
          aria-selected={activeTab === 'problematic'}
          aria-controls="problematic-panel"
          id="problematic-tab"
        >
          שאלות בעייתיות
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && classPerformance && (
        <div role="tabpanel" aria-labelledby="overview-tab" id="overview-panel" style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{classPerformance.totalAttempts}</div>
            <div style={styles.statLabel}>סה"כ ניסיונות</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {classPerformance.overallSuccessRate.toFixed(1)}%
            </div>
            <div style={styles.statLabel}>אחוז הצלחה כללי</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{classPerformance.uniqueUsers}</div>
            <div style={styles.statLabel}>מתאמנים פעילים</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {Math.round(classPerformance.avgTimeSpent / 60)} דק'
            </div>
            <div style={styles.statLabel}>זמן ממוצע לשאלה</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{classPerformance.totalQuestions}</div>
            <div style={styles.statLabel}>שאלות נענו</div>
          </div>
        </div>
      )}

      {/* Difficulty Analysis Tab */}
      {activeTab === 'difficulty' && difficultyAnalysis && (
        <div role="tabpanel" aria-labelledby="difficulty-tab" id="difficulty-panel" style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>ניתוח לפי רמת קושי</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>רמת קושי</th>
                <th style={styles.th}>מספר שאלות</th>
                <th style={styles.th}>סה"כ ניסיונות</th>
                <th style={styles.th}>אחוז הצלחה</th>
                <th style={styles.th}>שאלות בעייתיות</th>
              </tr>
            </thead>
            <tbody>
              {difficultyAnalysis.map((stat, index) => (
                <tr key={index}>
                  <td style={styles.td}>{stat.difficulty}/10</td>
                  <td style={styles.td}>{stat.totalQuestions}</td>
                  <td style={styles.td}>{stat.totalAttempts}</td>
                  <td style={styles.td}>
                    <span style={{
                      color: stat.avgSuccessRate >= 70 ? '#4CAF50' : '#f44336'
                    }}>
                      {stat.avgSuccessRate.toFixed(1)}%
                    </span>
                  </td>
                  <td style={styles.td}>{stat.problematicQuestions.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Topics Performance Tab */}
      {activeTab === 'topics' && topicPerformance && (
        <div role="tabpanel" aria-labelledby="topics-tab" id="topics-panel" style={styles.topicsCard}>
          <h2 style={styles.sectionTitle}>ביצועי נושאים</h2>
          <div style={styles.topicsList}>
            {topicPerformance.slice(0, 20).map((topic, index) => (
              <div key={index} style={styles.topicItem}>
                <div style={styles.topicHeader}>
                  <span style={styles.topicName}>
                    {topic.category} / {topic.topic}
                  </span>
                  <span style={{
                    ...styles.topicRate,
                    color: topic.successRate >= 70 ? '#4CAF50' : '#f44336'
                  }}>
                    {topic.successRate.toFixed(1)}%
                  </span>
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${topic.successRate}%`,
                      backgroundColor: topic.successRate >= 70 ? '#4CAF50' : '#f44336'
                    }}
                  />
                </div>
                <div style={styles.topicStats}>
                  {topic.attempts} ניסיונות • {topic.questionsCount} שאלות
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainees Progress Tab */}
      {activeTab === 'trainees' && traineeProgress && (
        <div role="tabpanel" aria-labelledby="trainees-tab" id="trainees-panel" style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>התקדמות מתאמנים</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>שם</th>
                <th style={styles.th}>ניסיונות</th>
                <th style={styles.th}>אחוז הצלחה</th>
                <th style={styles.th}>שאלות נענו</th>
                <th style={styles.th}>רצף ימים</th>
                <th style={styles.th}>פעילות אחרונה</th>
              </tr>
            </thead>
            <tbody>
              {traineeProgress.map((trainee, index) => (
                <tr key={index}>
                  <td style={styles.td}>{trainee.name}</td>
                  <td style={styles.td}>{trainee.attempts}</td>
                  <td style={styles.td}>
                    <span style={{
                      color: trainee.successRate >= 70 ? '#4CAF50' : '#f44336'
                    }}>
                      {trainee.successRate.toFixed(1)}%
                    </span>
                  </td>
                  <td style={styles.td}>{trainee.questionsAnswered}</td>
                  <td style={styles.td}>{trainee.streak}</td>
                  <td style={styles.td}>
                    {trainee.lastActivity
                      ? new Date(trainee.lastActivity).toLocaleDateString('he-IL')
                      : 'אין פעילות'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Problematic Questions Tab */}
      {activeTab === 'problematic' && problematicQuestions && (
        <div role="tabpanel" aria-labelledby="problematic-tab" id="problematic-panel" style={styles.problematicCard}>
          <h2 style={styles.sectionTitle}>שאלות בעייתיות (אחוז הצלחה נמוך)</h2>
          <div style={styles.problematicList}>
            {problematicQuestions.map((question, index) => (
              <div key={index} style={styles.problematicItem}>
                <div style={styles.problematicHeader}>
                  <span style={styles.problematicCategory}>
                    {question.hierarchy?.category} / {question.hierarchy?.topic}
                  </span>
                  <span style={styles.problematicRate}>
                    {question.success_rate.toFixed(1)}% ({question.total_attempts} ניסיונות)
                  </span>
                </div>
                <div
                  style={styles.problematicText}
                  dangerouslySetInnerHTML={{ __html: question.question_text }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#333'
  },
  filtersCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '20px',
    marginBottom: '15px',
    color: '#333'
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '5px',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  input: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl',
    minHeight: '44px',
    '&:focus': {
      outline: '3px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  tabButton: {
    padding: '12px 24px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '3px solid #CC0000',
      outlineOffset: '2px'
    },
  },
  tabButtonActive: {
    backgroundColor: '#CC0000',
    color: 'white',
    borderColor: '#CC0000'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#CC0000',
    marginBottom: '8px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#666'
  },
  tableCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '12px',
    textAlign: 'right',
    borderBottom: '2px solid #ddd',
    fontWeight: 'bold',
    backgroundColor: '#f9f9f9'
  },
  td: {
    padding: '12px',
    textAlign: 'right',
    borderBottom: '1px solid #eee'
  },
  topicsCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  topicsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  topicItem: {
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px'
  },
  topicHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  topicName: {
    color: '#333'
  },
  topicRate: {
    fontWeight: 'bold'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease'
  },
  topicStats: {
    fontSize: '12px',
    color: '#666'
  },
  problematicCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  problematicList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  problematicItem: {
    padding: '15px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px'
  },
  problematicHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  problematicCategory: {
    color: '#856404'
  },
  problematicRate: {
    color: '#f44336',
    fontWeight: 'bold'
  },
  problematicText: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#333'
  }
};
