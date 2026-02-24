/**
 * Admin Statistics Dashboard Component
 * Comprehensive statistics and analytics for administrators
 * Hebrew: לוח סטטיסטיקות למנהל
 */

import React, { useState, useEffect } from 'react';
import {
  getSystemStatistics,
  getUserActivityStatistics,
  getQuestionPerformanceStatistics,
  getContentUsageStatistics
} from '../workflows/adminStatistics';
import LoadingSpinner from './LoadingSpinner';

export default function AdminStatistics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStats, setSystemStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [questionStats, setQuestionStats] = useState(null);
  const [contentStats, setContentStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });

  useEffect(() => {
    loadStatistics();
  }, [dateRange, activeTab]);

  const loadStatistics = async () => {
    setIsLoading(true);
    try {
      switch (activeTab) {
        case 'overview':
          const sysStats = await getSystemStatistics(dateRange);
          setSystemStats(sysStats);
          break;
        case 'users':
          const usrStats = await getUserActivityStatistics(null, dateRange);
          setUserStats(usrStats);
          break;
        case 'questions':
          const qStats = await getQuestionPerformanceStatistics(dateRange);
          setQuestionStats(qStats);
          break;
        case 'content':
          const cStats = await getContentUsageStatistics(dateRange);
          setContentStats(cStats);
          break;
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: new Date(value)
    }));
  };

  if (isLoading && !systemStats && !userStats && !questionStats && !contentStats) {
    return <LoadingSpinner fullScreen message="טוען סטטיסטיקות..." />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>סטטיסטיקות מערכת</h1>
        <div style={styles.dateRangeSelector}>
          <label style={styles.label}>
            מתאריך:
            <input
              type="date"
              value={dateRange.startDate.toISOString().split('T')[0]}
              onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
              style={styles.dateInput}
            />
          </label>
          <label style={styles.label}>
            עד תאריך:
            <input
              type="date"
              value={dateRange.endDate.toISOString().split('T')[0]}
              onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
              style={styles.dateInput}
            />
          </label>
        </div>
      </div>

      <div style={styles.tabs} role="tablist" aria-label="קטגוריות סטטיסטיקות">
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'overview' ? styles.tabActive : {})
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
            ...styles.tab,
            ...(activeTab === 'users' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('users')}
          role="tab"
          aria-selected={activeTab === 'users'}
          aria-controls="users-panel"
          id="users-tab"
        >
          משתמשים
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'questions' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('questions')}
          role="tab"
          aria-selected={activeTab === 'questions'}
          aria-controls="questions-panel"
          id="questions-tab"
        >
          שאלות
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'content' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('content')}
          role="tab"
          aria-selected={activeTab === 'content'}
          aria-controls="content-panel"
          id="content-tab"
        >
          תוכן
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'overview' && systemStats && (
          <div role="tabpanel" aria-labelledby="overview-tab" id="overview-panel">
            <OverviewTab stats={systemStats} />
          </div>
        )}

        {activeTab === 'users' && userStats && (
          <div role="tabpanel" aria-labelledby="users-tab" id="users-panel">
            <UsersTab stats={userStats} />
          </div>
        )}

        {activeTab === 'questions' && questionStats && (
          <div role="tabpanel" aria-labelledby="questions-tab" id="questions-panel">
            <QuestionsTab stats={questionStats} />
          </div>
        )}

        {activeTab === 'content' && contentStats && (
          <div role="tabpanel" aria-labelledby="content-tab" id="content-panel">
            <ContentTab stats={contentStats} />
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ stats }) {
  return (
    <div>
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.userStats?.total || 0}</div>
          <div style={styles.statLabel}>סה"כ משתמשים</div>
          <div style={styles.statSubtext}>
            פעילים: {stats.userStats?.active || 0} | חדשים: {stats.userStats?.newUsers || 0}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.questionStats?.total || 0}</div>
          <div style={styles.statLabel}>סה"כ שאלות</div>
          <div style={styles.statSubtext}>
            פעילות: {stats.questionStats?.byStatus?.active || 0} | מושעות: {stats.questionStats?.byStatus?.suspended || 0}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.activityStats?.total || 0}</div>
          <div style={styles.statLabel}>סה"כ פעילויות</div>
          <div style={styles.statSubtext}>
            נכונות: {stats.activityStats?.byType?.correct || 0} | שגויות: {stats.activityStats?.byType?.incorrect || 0}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {stats.performanceMetrics?.userEngagement?.toFixed(1) || 0}%
          </div>
          <div style={styles.statLabel}>שיעור מעורבות</div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>סטטיסטיקות משתמשים</h2>
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <strong>מתאמנים:</strong> {stats.userStats?.byRole?.trainee || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>מדריכים:</strong> {stats.userStats?.byRole?.instructor || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>מנהלים:</strong> {stats.userStats?.byRole?.admin || 0}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>סטטיסטיקות שאלות</h2>
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <strong>אחוז הצלחה ממוצע:</strong> {stats.questionStats?.avgSuccessRate?.toFixed(1) || 0}%
          </div>
          <div style={styles.detailItem}>
            <strong>ניסיונות ממוצעים:</strong> {stats.questionStats?.avgAttempts?.toFixed(1) || 0}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>ביצועי מערכת</h2>
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <strong>זמן פעילות מערכת:</strong> {stats.performanceMetrics?.systemUptime || 0}%
          </div>
          <div style={styles.detailItem}>
            <strong>איכות שאלות:</strong> {stats.performanceMetrics?.questionQuality?.toFixed(1) || 0}%
          </div>
          <div style={styles.detailItem}>
            <strong>אפקטיביות למידה:</strong> {stats.performanceMetrics?.learningEffectiveness?.toFixed(1) || 0}%
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ stats }) {
  return (
    <div>
      <div style={styles.summaryCard}>
        <h2 style={styles.sectionTitle}>סיכום</h2>
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <strong>סה"כ משתמשים:</strong> {stats.summary?.totalUsers || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>משתמשים פעילים:</strong> {stats.summary?.activeUsers || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>אחוז הצלחה ממוצע:</strong> {stats.summary?.avgSuccessRate?.toFixed(1) || 0}%
          </div>
          <div style={styles.detailItem}>
            <strong>תשובות ממוצעות למשתמש:</strong> {stats.summary?.avgAnswersPerUser?.toFixed(1) || 0}
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>שם משתמש</th>
              <th style={styles.th}>תפקיד</th>
              <th style={styles.th}>תשובות</th>
              <th style={styles.th}>נכונות</th>
              <th style={styles.th}>אחוז הצלחה</th>
              <th style={styles.th}>נקודות</th>
              <th style={styles.th}>פעילות אחרונה</th>
            </tr>
          </thead>
          <tbody>
            {stats.users?.slice(0, 50).map((user, index) => (
              <tr key={user.userId || index}>
                <td style={styles.td}>{user.fullName}</td>
                <td style={styles.td}>
                  {user.role === 'trainee' ? 'מתאמן' :
                   user.role === 'instructor' ? 'מדריך' : 'מנהל'}
                </td>
                <td style={styles.td}>{user.totalAnswers}</td>
                <td style={styles.td}>{user.correctAnswers}</td>
                <td style={styles.td}>{user.successRate.toFixed(1)}%</td>
                <td style={styles.td}>{user.points}</td>
                <td style={styles.td}>
                  {user.lastActivity
                    ? new Date(user.lastActivity).toLocaleDateString('he-IL')
                    : 'אין'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionsTab({ stats }) {
  return (
    <div>
      <div style={styles.summaryCard}>
        <h2 style={styles.sectionTitle}>סיכום</h2>
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <strong>סה"כ שאלות:</strong> {stats.summary?.totalQuestions || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>שאלות עם פעילות:</strong> {stats.summary?.questionsWithActivity || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>אחוז הצלחה ממוצע:</strong> {stats.summary?.avgSuccessRate?.toFixed(1) || 0}%
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>שאלות בעלות ביצועים גבוהים</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>שאלה</th>
                <th style={styles.th}>סוג</th>
                <th style={styles.th}>קושי</th>
                <th style={styles.th}>ניסיונות</th>
                <th style={styles.th}>אחוז הצלחה</th>
              </tr>
            </thead>
            <tbody>
              {stats.summary?.topPerforming?.map((q, index) => (
                <tr key={q.questionId || index}>
                  <td style={styles.td}>{q.questionText}</td>
                  <td style={styles.td}>{q.questionType}</td>
                  <td style={styles.td}>{q.difficulty}</td>
                  <td style={styles.td}>{q.attempts}</td>
                  <td style={styles.td}>{q.successRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>שאלות בעלות ביצועים נמוכים</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>שאלה</th>
                <th style={styles.th}>סוג</th>
                <th style={styles.th}>קושי</th>
                <th style={styles.th}>ניסיונות</th>
                <th style={styles.th}>אחוז הצלחה</th>
              </tr>
            </thead>
            <tbody>
              {stats.summary?.worstPerforming?.map((q, index) => (
                <tr key={q.questionId || index}>
                  <td style={styles.td}>{q.questionText}</td>
                  <td style={styles.td}>{q.questionType}</td>
                  <td style={styles.td}>{q.difficulty}</td>
                  <td style={styles.td}>{q.attempts}</td>
                  <td style={styles.td}>{q.successRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContentTab({ stats }) {
  return (
    <div>
      <div style={styles.summaryCard}>
        <h2 style={styles.sectionTitle}>סיכום</h2>
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <strong>סה"כ קטגוריות:</strong> {stats.summary?.totalCategories || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>סה"כ נושאים:</strong> {stats.summary?.totalTopics || 0}
          </div>
          <div style={styles.detailItem}>
            <strong>קטגוריה בשימוש ביותר:</strong> {stats.summary?.mostUsedCategory || 'אין'}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>שימוש בקטגוריות</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>קטגוריה</th>
                <th style={styles.th}>ניסיונות</th>
                <th style={styles.th}>נכונות</th>
                <th style={styles.th}>אחוז הצלחה</th>
                <th style={styles.th}>משתמשים ייחודיים</th>
              </tr>
            </thead>
            <tbody>
              {stats.categories?.slice(0, 20).map((cat, index) => (
                <tr key={cat.category || index}>
                  <td style={styles.td}>{cat.category}</td>
                  <td style={styles.td}>{cat.attempts}</td>
                  <td style={styles.td}>{cat.correct}</td>
                  <td style={styles.td}>{cat.successRate.toFixed(1)}%</td>
                  <td style={styles.td}>{cat.uniqueUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>שימוש בנושאים</h2>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>קטגוריה</th>
                <th style={styles.th}>נושא</th>
                <th style={styles.th}>ניסיונות</th>
                <th style={styles.th}>נכונות</th>
                <th style={styles.th}>אחוז הצלחה</th>
                <th style={styles.th}>משתמשים ייחודיים</th>
              </tr>
            </thead>
            <tbody>
              {stats.topics?.slice(0, 30).map((topic, index) => (
                <tr key={`${topic.category}-${topic.topic}` || index}>
                  <td style={styles.td}>{topic.category}</td>
                  <td style={styles.td}>{topic.topic}</td>
                  <td style={styles.td}>{topic.attempts}</td>
                  <td style={styles.td}>{topic.correct}</td>
                  <td style={styles.td}>{topic.successRate.toFixed(1)}%</td>
                  <td style={styles.td}>{topic.uniqueUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '20px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#212121',
    margin: 0
  },
  dateRangeSelector: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  dateInput: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    borderBottom: '2px solid #e0e0e0',
    marginBottom: '30px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#757575',
    marginBottom: '-2px'
  },
  tabActive: {
    color: '#CC0000',
    borderBottomColor: '#CC0000',
    fontWeight: 'bold'
  },
  content: {
    minHeight: '400px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#CC0000',
    marginBottom: '8px'
  },
  statLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: '4px'
  },
  statSubtext: {
    fontSize: '12px',
    color: '#757575'
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: '20px'
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  },
  detailItem: {
    fontSize: '16px',
    color: '#212121'
  },
  tableContainer: {
    overflowX: 'auto',
    marginTop: '20px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#FFFFFF'
  },
  th: {
    padding: '12px',
    textAlign: 'right',
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    borderBottom: '2px solid #e0e0e0',
    color: '#212121'
  },
  td: {
    padding: '12px',
    textAlign: 'right',
    borderBottom: '1px solid #e0e0e0',
    color: '#212121'
  }
};
