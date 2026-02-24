/**
 * Manager Dashboard Page
 * Modern, inviting UI aligned with login/landing design
 * Hebrew: מסך מנהל
 */

import React, { useState } from 'react';
import ManagerDashboard from '../components/ManagerDashboard';
import AdminStatistics from '../components/AdminStatistics';
import PermissionManagement from '../components/PermissionManagement';
import QuestionManagement from '../components/QuestionManagement';
import DataImportExport from '../components/DataImportExport';

export default function ManagerDashboardPage({ managerId }) {
  const [activeTab, setActiveTab] = useState('suspended-questions');

  React.useEffect(() => {
    const handleTabChange = (e) => {
      if (e.detail && ['suspended-questions', 'statistics', 'permissions', 'questions', 'import-export'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('managerTabChange', handleTabChange);
    return () => window.removeEventListener('managerTabChange', handleTabChange);
  }, []);

  const tabList = [
    { id: 'suspended-questions', label: 'שאלות מושעות', panelId: 'suspended-questions-panel', tabId: 'suspended-questions-tab' },
    { id: 'statistics', label: 'סטטיסטיקות', panelId: 'statistics-panel', tabId: 'statistics-tab' },
    { id: 'permissions', label: 'ניהול הרשאות', panelId: 'permissions-panel', tabId: 'permissions-tab' },
    { id: 'questions', label: 'ניהול שאלות', panelId: 'questions-panel', tabId: 'questions-tab' },
    { id: 'import-export', label: 'ייבוא/ייצוא נתונים', panelId: 'import-export-panel', tabId: 'import-export-tab' },
  ];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <h1 style={styles.title}>לוח בקרה למנהל</h1>
          <p style={styles.subtitle}>ניהול שאלות, הרשאות ונתוני מערכת</p>
        </div>
      </header>

      <div style={styles.tabsWrap} role="tablist" aria-label="קטגוריות ניהול">
        <div style={styles.tabs}>
          {tabList.map((tab) => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={tab.panelId}
              id={tab.tabId}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.content}>
        {activeTab === 'suspended-questions' && (
          <div role="tabpanel" aria-labelledby="suspended-questions-tab" id="suspended-questions-panel">
            <ManagerDashboard managerId={managerId} />
          </div>
        )}
        {activeTab === 'statistics' && (
          <div role="tabpanel" aria-labelledby="statistics-tab" id="statistics-panel">
            <AdminStatistics />
          </div>
        )}
        {activeTab === 'permissions' && (
          <div role="tabpanel" aria-labelledby="permissions-tab" id="permissions-panel">
            <PermissionManagement />
          </div>
        )}
        {activeTab === 'questions' && (
          <div role="tabpanel" aria-labelledby="questions-tab" id="questions-panel">
            <QuestionManagement />
          </div>
        )}
        {activeTab === 'import-export' && (
          <div role="tabpanel" aria-labelledby="import-export-tab" id="import-export-panel">
            <DataImportExport />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
    backgroundColor: 'var(--panel-bg, #f4f6fb)',
    minHeight: '100%',
    paddingBottom: 32,
  },
  header: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    padding: '28px 32px',
    marginBottom: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  headerInner: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#1a1a2e',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '15px',
    color: '#64748b',
    margin: '6px 0 0',
    fontWeight: 500,
  },
  tabsWrap: {
    backgroundColor: '#fff',
    padding: '0 32px',
    borderBottom: '1px solid #e8ecf0',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  tab: {
    padding: '14px 22px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 600,
    color: '#64748b',
    marginBottom: -1,
    fontFamily: 'inherit',
    transition: 'color 0.2s, border-color 0.2s, background 0.2s',
  },
  tabActive: {
    color: '#0d47a1',
    borderBottomColor: '#64b5f6',
  },
  content: {
    padding: '28px 32px',
    minHeight: 'calc(100vh - 220px)',
    maxWidth: 1200,
    margin: '0 auto',
  },
};
