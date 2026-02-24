/**
 * Manager Dashboard Page
 * Main entry point for managers/admins
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

  // Listen for tab change events from quick links
  React.useEffect(() => {
    const handleTabChange = (e) => {
      if (e.detail && ['suspended-questions', 'statistics', 'permissions', 'questions', 'import-export'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('managerTabChange', handleTabChange);
    return () => {
      window.removeEventListener('managerTabChange', handleTabChange);
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>לוח בקרה למנהל</h1>
      </div>

      <div style={styles.tabs} role="tablist" aria-label="קטגוריות ניהול">
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'suspended-questions' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('suspended-questions')}
          role="tab"
          aria-selected={activeTab === 'suspended-questions'}
          aria-controls="suspended-questions-panel"
          id="suspended-questions-tab"
        >
          שאלות מושעות
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'statistics' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('statistics')}
          role="tab"
          aria-selected={activeTab === 'statistics'}
          aria-controls="statistics-panel"
          id="statistics-tab"
        >
          סטטיסטיקות
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'permissions' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('permissions')}
          role="tab"
          aria-selected={activeTab === 'permissions'}
          aria-controls="permissions-panel"
          id="permissions-tab"
        >
          ניהול הרשאות
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
          ניהול שאלות
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'import-export' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('import-export')}
          role="tab"
          aria-selected={activeTab === 'import-export'}
          aria-controls="import-export-panel"
          id="import-export-tab"
        >
          ייבוא/ייצוא נתונים
        </button>
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
    fontFamily: 'Arial, Helvetica, sans-serif',
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: '20px 30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#212121',
    margin: 0
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    borderBottom: '2px solid #e0e0e0',
    padding: '0 30px',
    backgroundColor: '#FFFFFF',
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
    marginBottom: '-2px',
    '&:hover': {
      color: '#CC0000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderRadius: '4px 4px 0 0'
    }
  },
  tabActive: {
    color: '#CC0000',
    borderBottomColor: '#CC0000',
    fontWeight: 'bold'
  },
  content: {
    padding: '20px 30px',
    minHeight: 'calc(100vh - 200px)'
  }
};
