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
        <div className="tabs">
          {tabList.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
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
    backgroundColor: 'var(--color-bg)',
    minHeight: '100%',
    paddingBottom: 'var(--space-8)',
  },
  header: {
    background: 'var(--color-bg-card)',
    padding: 'var(--space-6) var(--space-8)',
    marginBottom: 0,
    boxShadow: 'var(--shadow-sm)',
    borderBottom: '1px solid var(--color-border)',
  },
  headerInner: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  title: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 800,
    color: 'var(--color-text)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-muted)',
    margin: 'var(--space-2) 0 0',
    fontWeight: 500,
  },
  tabsWrap: {
    backgroundColor: 'var(--color-bg-card)',
    padding: `0 var(--space-8)`,
    borderBottom: '2px solid var(--color-border)',
  },
  content: {
    padding: 'var(--space-6) var(--space-8)',
    minHeight: 'calc(100vh - 220px)',
    maxWidth: 1200,
    margin: '0 auto',
  },
};
