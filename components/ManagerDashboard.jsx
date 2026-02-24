/**
 * Manager Dashboard Component
 * View and manage suspended questions
 * Hebrew: לוח בקרה למנהל
 */

import React, { useState, useEffect } from 'react';
import { getSuspendedQuestions, reactivateQuestion, getSuspensionStats } from '../workflows/managerDashboard';
import { navigateTo } from '../utils/router';

export default function ManagerDashboard({ managerId }) {
  const [suspendedQuestions, setSuspendedQuestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    category_name: '',
    topic_name: '',
    min_attempts: 0,
    max_success_rate: 70
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [questions, suspensionStats] = await Promise.all([
        getSuspendedQuestions(filters),
        getSuspensionStats()
      ]);
      setSuspendedQuestions(questions.questions);
      setStats(suspensionStats);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async (questionId, reason = '') => {
    if (!confirm('האם אתה בטוח שברצונך להפעיל מחדש את השאלה?')) {
      return;
    }

    try {
      await reactivateQuestion(questionId, reason);
      await loadData();
      alert('השאלה הופעלה מחדש בהצלחה');
    } catch (error) {
      alert(`שגיאה: ${error.message}`);
    }
  };

  const handleBulkReactivate = async () => {
    if (selectedQuestions.size === 0) {
      alert('אנא בחר שאלות להפעלה מחדש');
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך להפעיל מחדש ${selectedQuestions.size} שאלות?`)) {
      return;
    }

    try {
      const { bulkReactivateQuestions } = await import('../workflows/managerDashboard');
      const result = await bulkReactivateQuestions(Array.from(selectedQuestions), 'הפעלה מחדש מרובה');
      alert(`הופעלו מחדש ${result.successful} מתוך ${result.total} שאלות`);
      setSelectedQuestions(new Set());
      await loadData();
    } catch (error) {
      alert(`שגיאה: ${error.message}`);
    }
  };

  const toggleQuestionSelection = (questionId) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedQuestions.size === suspendedQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(suspendedQuestions.map(q => q.id)));
    }
  };

  if (isLoading && !stats) {
    return <div style={styles.loading}>טוען נתונים...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>לוח בקרה - שאלות מושעות</h1>

      {/* Quick Links */}
      <div style={styles.quickLinks}>
        <h3 style={styles.quickLinksTitle}>גישה מהירה:</h3>
        <div style={styles.linksGrid}>
          <a
            href="/manager"
            onClick={(e) => { e.preventDefault(); navigateTo('/manager'); }}
            style={styles.quickLink}
            aria-label="לוח בקרה"
          >
            🎛️ לוח בקרה
          </a>
          <a
            href="/instructor/questions"
            onClick={(e) => { e.preventDefault(); navigateTo('/instructor/questions'); }}
            style={styles.quickLink}
            aria-label="ניהול שאלות"
          >
            ❓ ניהול שאלות
          </a>
          <a
            href="/admin/data-import-export"
            onClick={(e) => { e.preventDefault(); navigateTo('/admin/data-import-export'); }}
            style={styles.quickLink}
            aria-label="ייבוא/ייצוא נתונים"
          >
            📥 ייבוא/ייצוא נתונים
          </a>
          <a
            href="/instructor/analytics"
            onClick={(e) => { e.preventDefault(); navigateTo('/instructor/analytics'); }}
            style={styles.quickLink}
            aria-label="אנליטיקה"
          >
            📊 אנליטיקה
          </a>
          <a
            href="/manager"
            onClick={(e) => { 
              e.preventDefault(); 
              navigateTo('/manager');
              // Trigger tab change via event
              window.dispatchEvent(new CustomEvent('managerTabChange', { detail: 'statistics' }));
            }}
            style={styles.quickLink}
            aria-label="סטטיסטיקות"
          >
            📈 סטטיסטיקות
          </a>
          <a
            href="/manager"
            onClick={(e) => { 
              e.preventDefault(); 
              navigateTo('/manager');
              // Trigger tab change via event
              window.dispatchEvent(new CustomEvent('managerTabChange', { detail: 'permissions' }));
            }}
            style={styles.quickLink}
            aria-label="ניהול הרשאות"
          >
            🔐 ניהול הרשאות
          </a>
          <a
            href="/instructor/study-plans"
            onClick={(e) => { e.preventDefault(); navigateTo('/instructor/study-plans'); }}
            style={styles.quickLink}
            aria-label="תוכניות לימוד"
          >
            📋 תוכניות לימוד
          </a>
          <a
            href="/practice"
            onClick={(e) => { e.preventDefault(); navigateTo('/practice'); }}
            style={styles.quickLink}
            aria-label="תרגול"
          >
            📚 תרגול
          </a>
          <a
            href="/progress"
            onClick={(e) => { e.preventDefault(); navigateTo('/progress'); }}
            style={styles.quickLink}
            aria-label="התקדמות"
          >
            📊 התקדמות
          </a>
          <a
            href="/bookmarks"
            onClick={(e) => { e.preventDefault(); navigateTo('/bookmarks'); }}
            style={styles.quickLink}
            aria-label="סימניות"
          >
            🔖 סימניות
          </a>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>סה"כ שאלות</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.active}</div>
            <div style={styles.statLabel}>פעילות</div>
          </div>
          <div style={styles.statCard}>
            <div style={{...styles.statValue, color: '#f44336'}}>{stats.suspended}</div>
            <div style={styles.statLabel}>מושעות</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {stats.avg_success_rate_suspended.toFixed(1)}%
            </div>
            <div style={styles.statLabel}>אחוז הצלחה ממוצע (מושעות)</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filtersCard}>
        <h2 style={styles.sectionTitle}>סינון</h2>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.label}>קטגוריה:</label>
            <input
              type="text"
              style={styles.input}
              value={filters.category_name}
              onChange={(e) => setFilters({...filters, category_name: e.target.value})}
              placeholder="הקלד שם קטגוריה"
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.label}>נושא:</label>
            <input
              type="text"
              style={styles.input}
              value={filters.topic_name}
              onChange={(e) => setFilters({...filters, topic_name: e.target.value})}
              placeholder="הקלד שם נושא"
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.label}>מינימום ניסיונות:</label>
            <input
              type="number"
              style={styles.input}
              value={filters.min_attempts}
              onChange={(e) => setFilters({...filters, min_attempts: parseInt(e.target.value) || 0})}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.label}>מקסימום אחוז הצלחה:</label>
            <input
              type="number"
              style={styles.input}
              value={filters.max_success_rate}
              onChange={(e) => setFilters({...filters, max_success_rate: parseInt(e.target.value) || 70})}
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {suspendedQuestions.length > 0 && (
        <div style={styles.bulkActions}>
          <button
            style={styles.selectAllButton}
            onClick={toggleSelectAll}
          >
            {selectedQuestions.size === suspendedQuestions.length ? 'בטל בחירה' : 'בחר הכל'}
          </button>
          {selectedQuestions.size > 0 && (
            <button
              style={styles.bulkReactivateButton}
              onClick={handleBulkReactivate}
            >
              הפעל מחדש {selectedQuestions.size} שאלות
            </button>
          )}
        </div>
      )}

      {/* Suspended Questions List */}
      <div style={styles.questionsList}>
        {suspendedQuestions.length === 0 ? (
          <div style={styles.emptyState}>
            <p>אין שאלות מושעות התואמות את הסינון</p>
          </div>
        ) : (
          suspendedQuestions.map(question => (
            <div key={question.id} style={styles.questionCard}>
              <div style={styles.questionHeader}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(question.id)}
                    onChange={() => toggleQuestionSelection(question.id)}
                    style={styles.checkbox}
                  />
                </label>
                <div style={styles.questionInfo}>
                  <div style={styles.questionMeta}>
                    <span style={styles.badge}>
                      {question.hierarchy?.category_name} / {question.hierarchy?.topic_name}
                    </span>
                    <span style={styles.badge}>
                      {getQuestionTypeLabel(question.question_type)}
                    </span>
                    <span style={styles.badge}>
                      קושי: {question.difficulty_level}/10
                    </span>
                  </div>
                  <div style={styles.questionText} dangerouslySetInnerHTML={{
                    __html: question.question_text.substring(0, 200) + '...'
                  }} />
                </div>
              </div>

              <div style={styles.questionStats}>
                <div style={styles.statItem}>
                  <strong>ניסיונות:</strong> {question.total_attempts}
                </div>
                <div style={styles.statItem}>
                  <strong>הצלחות:</strong> {question.total_success}
                </div>
                <div style={{
                  ...styles.statItem,
                  color: question.success_rate < 50 ? '#f44336' : '#ff9800'
                }}>
                  <strong>אחוז הצלחה:</strong> {question.success_rate.toFixed(2)}%
                </div>
                {question.last_attempt && (
                  <div style={styles.statItem}>
                    <strong>ניסיון אחרון:</strong> {new Date(question.last_attempt).toLocaleDateString('he-IL')}
                  </div>
                )}
              </div>

              <div style={styles.questionActions}>
                <button
                  style={styles.reactivateButton}
                  onClick={() => handleReactivate(question.id)}
                >
                  הפעל מחדש
                </button>
                <button
                  style={styles.viewButton}
                  onClick={() => {
                    navigateTo('/instructor/questions');
                  }}
                >
                  ניהול שאלות
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
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
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
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
    gap: '15px'
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
    direction: 'rtl'
  },
  bulkActions: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  selectAllButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  bulkReactivateButton: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '8px'
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  questionHeader: {
    display: 'flex',
    gap: '15px',
    marginBottom: '15px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    paddingTop: '5px'
  },
  checkbox: {
    marginLeft: '5px'
  },
  questionInfo: {
    flex: 1
  },
  questionMeta: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
    flexWrap: 'wrap'
  },
  badge: {
    padding: '4px 12px',
    backgroundColor: '#e3f2fd',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#1976d2'
  },
  questionText: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#333'
  },
  questionStats: {
    display: 'flex',
    gap: '20px',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '15px',
    flexWrap: 'wrap'
  },
  statItem: {
    fontSize: '14px'
  },
  questionActions: {
    display: 'flex',
    gap: '10px'
  },
  reactivateButton: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  viewButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  quickLinks: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  quickLinksTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#333'
  },
  linksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px'
  },
  quickLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#f5f5f5',
    color: '#CC0000',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#e3f2fd',
      transform: 'translateY(-2px)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  }
};
