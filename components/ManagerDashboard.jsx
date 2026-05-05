/**
 * Manager Dashboard Component
 * View and manage suspended questions — modern card-based UI
 * Hebrew: לוח בקרה למנהל
 */

import React, { useState, useEffect } from 'react';
import { getSuspendedQuestions, reactivateQuestion, getSuspensionStats } from '../workflows/managerDashboard';
import { navigateTo } from '../utils/router';
import { sanitizeHtml } from '../utils/sanitize';

const cardShadow = '0 2px 12px rgba(0,0,0,0.06)';
const cardRadius = 16;
const quickLinkColors = [
  { bg: '#e3f2fd', color: '#1565c0', hoverBg: '#bbdefb' },
  { bg: '#e8eaf6', color: '#3949ab', hoverBg: '#c5cae9' },
  { bg: '#f3e5f5', color: '#7b1fa2', hoverBg: '#e1bee7' },
  { bg: '#e0f2f1', color: '#00695c', hoverBg: '#b2dfdb' },
  { bg: '#fff3e0', color: '#e65100', hoverBg: '#ffe0b2' },
  { bg: '#e8f5e9', color: '#2e7d32', hoverBg: '#c8e6c9' },
];

export default function ManagerDashboard({ managerId }) {
  const [suspendedQuestions, setSuspendedQuestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    category_name: '',
    topic_name: '',
    min_attempts: 0,
    max_success_rate: 70,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [hoverLink, setHoverLink] = useState(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [questions, suspensionStats] = await Promise.all([
        getSuspendedQuestions(filters),
        getSuspensionStats(),
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
    if (!confirm('האם אתה בטוח שברצונך להפעיל מחדש את השאלה?')) return;
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
    if (!confirm(`האם אתה בטוח שברצונך להפעיל מחדש ${selectedQuestions.size} שאלות?`)) return;
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
    const next = new Set(selectedQuestions);
    if (next.has(questionId)) next.delete(questionId);
    else next.add(questionId);
    setSelectedQuestions(next);
  };

  const toggleSelectAll = () => {
    if (selectedQuestions.size === suspendedQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(suspendedQuestions.map((q) => q.id)));
    }
  };

  const quickLinks = [
    { label: 'לוח בקרה', href: '/manager', icon: '🎛️' },
    { label: 'ניהול שאלות', href: '/instructor/questions', icon: '❓', nav: '/instructor/questions' },
    { label: 'ייבוא/ייצוא נתונים', href: '/admin/data-import-export', icon: '📥', nav: '/admin/data-import-export' },
    { label: 'אנליטיקה', href: '/instructor/analytics', icon: '📊', nav: '/instructor/analytics' },
    { label: 'סטטיסטיקות', href: '/manager', icon: '📈', event: 'statistics' },
    { label: 'ניהול הרשאות', href: '/manager', icon: '🔐', event: 'permissions' },
    { label: 'תוכניות לימוד', href: '/instructor/study-plans', icon: '📋', nav: '/instructor/study-plans' },
    { label: 'תרגול', href: '/practice', icon: '📚', nav: '/practice' },
    { label: 'התקדמות', href: '/progress', icon: '📊', nav: '/progress' },
    { label: 'סימניות', href: '/bookmarks', icon: '🔖', nav: '/bookmarks' },
  ];

  const handleQuickLink = (e, link) => {
    e.preventDefault();
    if (link.nav) navigateTo(link.nav);
    else if (link.event) {
      navigateTo('/manager');
      window.dispatchEvent(new CustomEvent('managerTabChange', { detail: link.event }));
    } else navigateTo(link.href);
  };

  if (isLoading && !stats) {
    return (
      <div style={{ textAlign: 'center', padding: 48, fontSize: 18, color: '#64748b' }}>
        טוען נתונים...
      </div>
    );
  }

  return (
    <div style={s.container}>
      <h2 style={s.sectionTitle}>לוח בקרה - שאלות מושעות</h2>

      {/* Quick Access */}
      <div style={s.quickCard}>
        <h3 style={s.quickTitle}>גישה מהירה</h3>
        <div style={s.quickGrid}>
          {quickLinks.map((link, i) => {
            const c = quickLinkColors[i % quickLinkColors.length];
            const isHover = hoverLink === i;
            return (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleQuickLink(e, link)}
                onMouseEnter={() => setHoverLink(i)}
                onMouseLeave={() => setHoverLink(null)}
                style={{
                  ...s.quickLink,
                  backgroundColor: isHover ? c.hoverBg : c.bg,
                  color: c.color,
                  boxShadow: isHover ? '0 4px 14px rgba(0,0,0,0.08)' : 'none',
                  transform: isHover ? 'translateY(-2px)' : 'none',
                }}
                aria-label={link.label}
              >
                <span style={s.quickIcon}>{link.icon}</span>
                {link.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <div style={{ ...s.statValue, color: '#1565c0' }}>{stats.total}</div>
            <div style={s.statLabel}>סה"כ שאלות</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statValue, color: '#2e7d32' }}>{stats.active}</div>
            <div style={s.statLabel}>פעילות</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statValue, color: '#c62828' }}>{stats.under_review ?? stats.suspended}</div>
            <div style={s.statLabel}>מושעות</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statValue, color: '#64b5f6' }}>
              {stats.avg_success_rate_suspended.toFixed(1)}%
            </div>
            <div style={s.statLabel}>אחוז הצלחה ממוצע (מושעות)</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={s.filtersCard}>
        <h3 style={s.cardTitle}>סינון</h3>
        <div style={s.filterRow}>
          <div style={s.filterGroup}>
            <label style={s.label}>קטגוריה</label>
            <input
              type="text"
              style={s.input}
              value={filters.category_name}
              onChange={(e) => setFilters({ ...filters, category_name: e.target.value })}
              placeholder="שם קטגוריה"
            />
          </div>
          <div style={s.filterGroup}>
            <label style={s.label}>נושא</label>
            <input
              type="text"
              style={s.input}
              value={filters.topic_name}
              onChange={(e) => setFilters({ ...filters, topic_name: e.target.value })}
              placeholder="שם נושא"
            />
          </div>
          <div style={s.filterGroup}>
            <label style={s.label}>מינימום ניסיונות</label>
            <input
              type="number"
              style={s.input}
              value={filters.min_attempts}
              onChange={(e) => setFilters({ ...filters, min_attempts: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div style={s.filterGroup}>
            <label style={s.label}>מקסימום אחוז הצלחה</label>
            <input
              type="number"
              style={s.input}
              value={filters.max_success_rate}
              onChange={(e) => setFilters({ ...filters, max_success_rate: parseInt(e.target.value) || 70 })}
            />
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {suspendedQuestions.length > 0 && (
        <div style={s.bulkWrap}>
          <button type="button" style={s.btnSecondary} onClick={toggleSelectAll}>
            {selectedQuestions.size === suspendedQuestions.length ? 'בטל בחירה' : 'בחר הכל'}
          </button>
          {selectedQuestions.size > 0 && (
            <button type="button" style={s.btnPrimary} onClick={handleBulkReactivate}>
              הפעל מחדש {selectedQuestions.size} שאלות
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div style={s.list}>
        {suspendedQuestions.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyText}>אין שאלות מושעות התואמות את הסינון</p>
          </div>
        ) : (
          suspendedQuestions.map((question) => (
            <div key={question.id} style={s.questionCard}>
              <div style={s.qHeader}>
                <label style={s.checkWrap}>
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(question.id)}
                    onChange={() => toggleQuestionSelection(question.id)}
                    style={s.checkbox}
                  />
                </label>
                <div style={s.qInfo}>
                  <div style={s.badges}>
                    <span style={s.badge}>
                      {question.hierarchy?.category_name} / {question.hierarchy?.topic_name}
                    </span>
                    <span style={s.badge}>{getQuestionTypeLabel(question.question_type)}</span>
                    <span style={s.badge}>הכשרה: {question.training_level || '—'} · הצלחה: {question.success_rate != null ? `${question.success_rate}%` : '—'}</span>
                  </div>
                  <div
                    style={s.qText}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(question.question_text.substring(0, 200) + (question.question_text.length > 200 ? '...' : '')),
                    }}
                  />
                </div>
              </div>
              <div style={s.qStats}>
                <span><strong>ניסיונות:</strong> {question.total_attempts}</span>
                <span><strong>הצלחות:</strong> {question.total_success}</span>
                <span style={{ color: question.success_rate < 50 ? '#c62828' : '#e65100' }}>
                  <strong>אחוז הצלחה:</strong> {question.success_rate.toFixed(2)}%
                </span>
                {question.last_attempt && (
                  <span><strong>ניסיון אחרון:</strong> {new Date(question.last_attempt).toLocaleDateString('he-IL')}</span>
                )}
              </div>
              <div style={s.qActions}>
                <button type="button" style={s.btnSuccess} onClick={() => handleReactivate(question.id)}>
                  הפעל מחדש
                </button>
                <button type="button" style={s.btnOutline} onClick={() => navigateTo('/instructor/questions')}>
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
    open_ended: 'שאלה פתוחה',
  };
  return labels[type] || type;
}

const s = {
  container: {
    direction: 'rtl',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 24px',
  },
  quickCard: {
    backgroundColor: '#fff',
    borderRadius: cardRadius,
    padding: 24,
    marginBottom: 24,
    boxShadow: cardShadow,
    border: '1px solid rgba(0,0,0,0.04)',
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#334155',
    margin: '0 0 16px',
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
  },
  quickLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 16px',
    textDecoration: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
  },
  quickIcon: {
    fontSize: 18,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: cardRadius,
    textAlign: 'center',
    boxShadow: cardShadow,
    border: '1px solid rgba(0,0,0,0.04)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 6,
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 500,
  },
  filtersCard: {
    backgroundColor: '#fff',
    borderRadius: cardRadius,
    padding: 24,
    marginBottom: 24,
    boxShadow: cardShadow,
    border: '1px solid rgba(0,0,0,0.04)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#334155',
    margin: '0 0 16px',
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    fontSize: 14,
    direction: 'rtl',
    backgroundColor: '#f8fafc',
  },
  bulkWrap: {
    display: 'flex',
    gap: 12,
    marginBottom: 20,
  },
  btnPrimary: {
    padding: '12px 24px',
    backgroundColor: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(46,125,50,0.3)',
  },
  btnSecondary: {
    padding: '12px 24px',
    backgroundColor: '#fff',
    color: '#1565c0',
    border: '2px solid #1565c0',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  btnSuccess: {
    padding: '10px 20px',
    backgroundColor: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  btnOutline: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#1565c0',
    border: '2px solid #1565c0',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  empty: {
    textAlign: 'center',
    padding: 48,
    backgroundColor: '#fff',
    borderRadius: cardRadius,
    boxShadow: cardShadow,
  },
  emptyText: {
    margin: 0,
    fontSize: 16,
    color: '#64748b',
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: cardRadius,
    padding: 24,
    boxShadow: cardShadow,
    border: '1px solid rgba(0,0,0,0.04)',
  },
  qHeader: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  },
  checkWrap: {
    display: 'flex',
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: '#1565c0',
  },
  qInfo: { flex: 1 },
  badges: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  badge: {
    padding: '6px 12px',
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: '#1565c0',
  },
  qText: {
    fontSize: 15,
    lineHeight: 1.6,
    color: '#334155',
  },
  qStats: {
    display: 'flex',
    gap: 20,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    fontSize: 14,
    color: '#475569',
  },
  qActions: {
    display: 'flex',
    gap: 12,
  },
};
