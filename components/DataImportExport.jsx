/**
 * Data Import/Export Component
 * CSV/Excel import and export
 * Hebrew: ייבוא וייצוא נתונים
 */

import React, { useState } from 'react';
import { entities } from '../config/appConfig';
import { showToast } from './Toast';
import { announce } from '../utils/accessibility';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import PermissionGate from './PermissionGate';
import { permissions } from '../utils/permissions';

export default function DataImportExport() {
  const [activeTab, setActiveTab] = useState('export');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState('csv');

  const handleExport = async () => {
    try {
      announce('מייצא נתונים...');
      
      const questions = await entities.Question_Bank.find({});
      
      if (exportFormat === 'csv') {
        exportToCSV(questions);
      } else if (exportFormat === 'json') {
        exportToJSON(questions);
      } else if (exportFormat === 'excel') {
        exportToExcel(questions);
      }
      
      showToast('ייצוא הושלם בהצלחה', 'success');
      announce('ייצוא הושלם בהצלחה');
    } catch (error) {
      console.error('Error exporting:', error);
      showToast('שגיאה בייצוא', 'error');
      announceError('שגיאה בייצוא');
    }
  };

  const exportToCSV = (data) => {
    if (data.length === 0) {
      showToast('אין נתונים לייצוא', 'warning');
      return;
    }

    const headers = [
      'ID',
      'היררכיה',
      'סוג שאלה',
      'טקסט שאלה',
      'קושי',
      'תשובה נכונה',
      'סטטוס',
      'תגיות'
    ];

    const rows = data.map(q => [
      q.id,
      q.hierarchy_id,
      q.question_type,
      q.question_text?.replace(/"/g, '""'),
      q.difficulty_level,
      q.correct_answer,
      q.status,
      q.tags?.join(';') || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `questions_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToJSON = (data) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `questions_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const exportToExcel = async (data) => {
    // In production, use a library like xlsx
    showToast('ייצוא ל-Excel דורש ספרייה נוספת', 'info');
  };

  const handleImport = async (file) => {
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (fileExtension === 'csv') {
        await importFromCSV(file);
      } else if (fileExtension === 'json') {
        await importFromJSON(file);
      } else {
        showToast('פורמט קובץ לא נתמך', 'error');
        return;
      }

      showToast('ייבוא הושלם בהצלחה', 'success');
      announce('ייבוא הושלם בהצלחה');
    } catch (error) {
      console.error('Error importing:', error);
      showToast('שגיאה בייבוא', 'error');
      announceError('שגיאה בייבוא');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const importFromCSV = async (file) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('קובץ CSV ריק או לא תקין');
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const rows = lines.slice(1);

    let imported = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        const values = parseCSVRow(rows[i]);
        
        if (values.length !== headers.length) {
          errors++;
          continue;
        }

        const questionData = {
          hierarchy_id: values[headers.indexOf('היררכיה')] || values[headers.indexOf('hierarchy_id')],
          question_type: values[headers.indexOf('סוג שאלה')] || values[headers.indexOf('question_type')],
          question_text: values[headers.indexOf('טקסט שאלה')] || values[headers.indexOf('question_text')],
          difficulty_level: parseInt(values[headers.indexOf('קושי')] || values[headers.indexOf('difficulty_level')]) || 5,
          correct_answer: values[headers.indexOf('תשובה נכונה')] || values[headers.indexOf('correct_answer')],
          status: values[headers.indexOf('סטטוס')] || values[headers.indexOf('status')] || 'draft',
          tags: (values[headers.indexOf('תגיות')] || values[headers.indexOf('tags')] || '').split(';').filter(t => t.trim())
        };

        await entities.Question_Bank.create(questionData);
        imported++;
        
        setImportProgress(Math.round(((i + 1) / rows.length) * 100));
      } catch (error) {
        console.error(`Error importing row ${i + 1}:`, error);
        errors++;
      }
    }

    if (errors > 0) {
      showToast(`יובאו ${imported} שאלות, ${errors} שגיאות`, 'warning');
    }
  };

  const parseCSVRow = (row) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  };

  const importFromJSON = async (file) => {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!Array.isArray(data)) {
      throw new Error('קובץ JSON חייב להכיל מערך');
    }

    let imported = 0;
    let errors = 0;

    for (let i = 0; i < data.length; i++) {
      try {
        await entities.Question_Bank.create(data[i]);
        imported++;
        setImportProgress(Math.round(((i + 1) / data.length) * 100));
      } catch (error) {
        console.error(`Error importing item ${i + 1}:`, error);
        errors++;
      }
    }

    if (errors > 0) {
      showToast(`יובאו ${imported} שאלות, ${errors} שגיאות`, 'warning');
    }
  };

  return (
    <PermissionGate permission={permissions.QUESTION_EXPORT}>
      <div style={styles.container}>
          <h1 style={styles.title}>ייבוא וייצוא נתונים</h1>

          <div style={styles.tabs} role="tablist">
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'export' ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab('export')}
              role="tab"
              aria-selected={activeTab === 'export'}
            >
              ייצוא
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'import' ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab('import')}
              role="tab"
              aria-selected={activeTab === 'import'}
            >
              ייבוא
            </button>
          </div>

          <div style={styles.content}>
            {activeTab === 'export' && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>ייצוא שאלות</h2>
                <p style={styles.description}>
                  ייצא את כל השאלות מהמערכת בפורמט הנבחר
                </p>

                <div style={styles.form}>
                  <label style={styles.label}>
                    בחר פורמט ייצוא:
                  </label>
                  <select
                    style={styles.select}
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    aria-label="פורמט ייצוא"
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="excel">Excel</option>
                  </select>

                  <button
                    style={styles.button}
                    onClick={handleExport}
                    aria-label="ייצא נתונים"
                  >
                    ייצא נתונים
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'import' && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>ייבוא שאלות</h2>
                <p style={styles.description}>
                  ייבא שאלות מקובץ CSV או JSON
                </p>

                {isImporting ? (
                  <div style={styles.progressSection}>
                    <LoadingSpinner message="מייבא נתונים..." />
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${importProgress}%`
                        }}
                      />
                    </div>
                    <div style={styles.progressText}>{importProgress}%</div>
                  </div>
                ) : (
                  <div style={styles.form}>
                    <label style={styles.label}>
                      בחר קובץ לייבוא:
                    </label>
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          handleImport(file);
                        }
                      }}
                      style={styles.fileInput}
                      aria-label="בחר קובץ לייבוא"
                    />
                    <p style={styles.helpText}>
                      תמיכה בפורמטים: CSV, JSON
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </PermissionGate>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#212121'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    borderBottom: '2px solid #e0e0e0',
    marginBottom: '30px'
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
      outlineOffset: '2px'
    }
  },
  tabActive: {
    color: '#CC0000',
    borderBottom: '2px solid #CC0000',
    fontWeight: 'bold'
  },
  content: {
    minHeight: '400px'
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#212121'
  },
  description: {
    fontSize: '14px',
    color: '#757575',
    marginBottom: '24px',
    lineHeight: 1.6
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  label: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#212121'
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl',
    maxWidth: '300px'
  },
  fileInput: {
    padding: '10px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px'
  },
  helpText: {
    fontSize: '12px',
    color: '#757575',
    marginTop: '-16px'
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '40px'
  },
  progressBar: {
    width: '100%',
    maxWidth: '400px',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#CC0000',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#CC0000'
  }
};
