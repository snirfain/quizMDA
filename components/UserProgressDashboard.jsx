/**
 * User Progress Dashboard Component
 * Displays comprehensive progress tracking for trainees
 * Hebrew: דשבורד התקדמות משתמש
 */

import React, { useState, useEffect } from 'react';
import { getUserProgress, getProgressChart, getStrongWeakTopics } from '../workflows/userProgress';
import { getUserPoints } from '../workflows/gamification';
import AchievementsPanel from './AchievementsPanel';
import Leaderboard from './Leaderboard';

export default function UserProgressDashboard({ userId }) {
  const [progress, setProgress] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [strongWeak, setStrongWeak] = useState(null);
  const [timeframe, setTimeframe] = useState('30days');
  const [isLoading, setIsLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    loadProgress();
  }, [userId, timeframe]);

  const loadProgress = async () => {
    setIsLoading(true);
    try {
      const [progressData, chart, topics, userPoints] = await Promise.all([
        getUserProgress(userId),
        getProgressChart(userId, timeframe),
        getStrongWeakTopics(userId),
        getUserPoints(userId)
      ]);
      setProgress(progressData);
      setChartData(chart);
      setStrongWeak(topics);
      setPoints(userPoints);
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>טוען נתונים...</div>;
  }

  if (!progress) {
    return <div style={styles.empty}>אין נתוני התקדמות</div>;
  }

  return (
    <div style={styles.container} role="main" aria-label="לוח התקדמות">
      <div style={styles.header}>
        <h1 style={styles.title}>התקדמות שלי</h1>
        <div style={styles.headerActions}>
          <div style={styles.pointsBadge} role="status" aria-label={`${points} נקודות`}>
            💎 {points} נקודות
          </div>
          <button
            style={styles.actionButton}
            onClick={() => setShowAchievements(!showAchievements)}
            aria-label={showAchievements ? 'הסתר הישגים' : 'הצג הישגים'}
            aria-expanded={showAchievements}
          >
            {showAchievements ? 'הסתר הישגים' : 'הצג הישגים'}
          </button>
          <button
            style={styles.actionButton}
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            aria-label={showLeaderboard ? 'הסתר לידרים' : 'הצג טבלת לידרים'}
            aria-expanded={showLeaderboard}
          >
            {showLeaderboard ? 'הסתר לידרים' : 'טבלת לידרים'}
          </button>
        </div>
      </div>

      {/* Achievements Panel */}
      {showAchievements && (
        <div style={styles.section}>
          <AchievementsPanel userId={userId} />
        </div>
      )}

      {/* Leaderboard */}
      {showLeaderboard && (
        <div style={styles.section}>
          <Leaderboard userId={userId} />
        </div>
      )}

      {/* Overall Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{progress.overall.totalAttempts}</div>
          <div style={styles.statLabel}>סה"כ ניסיונות</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {progress.overall.successRate.toFixed(1)}%
          </div>
          <div style={styles.statLabel}>אחוז הצלחה</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {progress.overall.questionsAnswered} / {progress.overall.totalQuestions}
          </div>
          <div style={styles.statLabel}>שאלות נענו</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{progress.streak.current}</div>
          <div style={styles.statLabel}>רצף ימים</div>
        </div>
      </div>

      {/* Progress Chart */}
      <div style={styles.chartCard}>
        <div style={styles.chartHeader}>
          <h2 style={styles.sectionTitle}>גרף התקדמות</h2>
          <select
            style={styles.timeframeSelect}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="7days">7 ימים אחרונים</option>
            <option value="30days">30 ימים אחרונים</option>
            <option value="90days">90 ימים אחרונים</option>
            <option value="all">הכל</option>
          </select>
        </div>
        {chartData && chartData.length > 0 ? (
          <div style={styles.chartContainer}>
            {/* Simple bar chart visualization */}
            <div style={styles.barChart}>
              {chartData.map((day, index) => (
                <div key={index} style={styles.barWrapper}>
                  <div style={styles.barContainer}>
                    <div
                      style={{
                        ...styles.bar,
                        height: `${Math.min(day.successRate, 100)}%`,
                        backgroundColor: day.successRate >= 70 ? '#4CAF50' : '#ff9800'
                      }}
                    />
                  </div>
                  <div style={styles.barLabel}>
                    {new Date(day.date).toLocaleDateString('he-IL', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.noData}>אין נתונים לתקופה זו</div>
        )}
      </div>

      {/* Category Progress */}
      <div style={styles.categoriesCard}>
        <h2 style={styles.sectionTitle}>התקדמות לפי קטגוריה</h2>
        <div style={styles.categoriesList}>
          {progress.categories.map((cat, index) => (
            <div key={index} style={styles.categoryItem}>
              <div style={styles.categoryHeader}>
                <span style={styles.categoryName}>{cat.category}</span>
                <span style={styles.categoryRate}>
                  {cat.successRate.toFixed(1)}%
                </span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${cat.successRate}%`,
                    backgroundColor: cat.successRate >= 70 ? '#4CAF50' : '#ff9800'
                  }}
                />
              </div>
              <div style={styles.categoryStats}>
                {cat.attempts} ניסיונות • {cat.questionsAnswered} שאלות
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strong & Weak Topics */}
      {strongWeak && (
        <div style={styles.topicsGrid}>
          <div style={styles.topicsCard}>
            <h3 style={styles.topicsTitle}>נושאים חזקים 💪</h3>
            {strongWeak.strong.length > 0 ? (
              <ul style={styles.topicsList}>
                {strongWeak.strong.map((topic, index) => (
                  <li key={index} style={styles.topicItem}>
                    {topic.category} - {topic.successRate.toFixed(1)}%
                  </li>
                ))}
              </ul>
            ) : (
              <div style={styles.noData}>עוד לא מספיק נתונים</div>
            )}
          </div>
          <div style={styles.topicsCard}>
            <h3 style={styles.topicsTitle}>נושאים לשיפור 📚</h3>
            {strongWeak.weak.length > 0 ? (
              <ul style={styles.topicsList}>
                {strongWeak.weak.map((topic, index) => (
                  <li key={index} style={styles.topicItem}>
                    {topic.category} - {topic.successRate.toFixed(1)}%
                  </li>
                ))}
              </ul>
            ) : (
              <div style={styles.noData}>עוד לא מספיק נתונים</div>
            )}
          </div>
        </div>
      )}

      {/* Completion Progress */}
      <div style={styles.completionCard}>
        <h2 style={styles.sectionTitle}>התקדמות כללית</h2>
        <div style={styles.completionBar}>
          <div
            style={{
              ...styles.completionFill,
              width: `${progress.overall.completionRate}%`
            }}
          />
        </div>
        <div style={styles.completionText}>
          {progress.overall.completionRate.toFixed(1)}% הושלם
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px',
    color: '#666'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  pointsBadge: {
    padding: '10px 20px',
    backgroundColor: '#ffd700',
    color: '#333',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '16px'
  },
  actionButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '3px solid #CC0000',
      outlineOffset: '2px'
    },
  },
  section: {
    marginBottom: '30px'
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
  chartCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '25px',
    marginBottom: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '20px',
    marginBottom: '15px',
    color: '#333'
  },
  timeframeSelect: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl'
  },
  chartContainer: {
    marginTop: '20px'
  },
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    height: '200px',
    padding: '20px 0'
  },
  barWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  barContainer: {
    width: '100%',
    height: '150px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  bar: {
    width: '80%',
    minHeight: '4px',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease'
  },
  barLabel: {
    fontSize: '10px',
    marginTop: '5px',
    color: '#666',
    transform: 'rotate(-45deg)',
    whiteSpace: 'nowrap'
  },
  noData: {
    textAlign: 'center',
    padding: '20px',
    color: '#999',
    fontSize: '14px'
  },
  categoriesCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '25px',
    marginBottom: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  categoriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  categoryItem: {
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px'
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  categoryName: {
    color: '#333'
  },
  categoryRate: {
    color: '#CC0000'
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
  categoryStats: {
    fontSize: '12px',
    color: '#666'
  },
  topicsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  topicsCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  topicsTitle: {
    fontSize: '18px',
    marginBottom: '15px',
    color: '#333'
  },
  topicsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  topicItem: {
    padding: '10px',
    marginBottom: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    fontSize: '14px'
  },
  completionCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  completionBar: {
    width: '100%',
    height: '20px',
    backgroundColor: '#e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '10px'
  },
  completionFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease'
  },
  completionText: {
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333'
  }
};
