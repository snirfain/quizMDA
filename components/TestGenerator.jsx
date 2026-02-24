/**
 * Test Generator Component
 * Instructor tool for creating exams
 * Hebrew: מחולל מבחנים
 */

import React, { useState, useEffect } from 'react';
import { generateRandomTest, getFilterOptions, exportTestToPDF } from '../workflows/testGenerator';
import { DIFFICULTY_EASY, DIFFICULTY_MEDIUM, DIFFICULTY_HARD, getDifficultyDisplay } from '../workflows/difficultyEngine';

export default function TestGenerator({ instructorId }) {
  const [filters, setFilters] = useState({
    category_name: '',
    topic_name: '',
    difficulty_levels: [],  // array of selected labels: ['קל','בינוני','קשה']
    question_types: [],
    count: 20
  });
  
  const [filterOptions, setFilterOptions] = useState(null);
  const [generatedTest, setGeneratedTest] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const options = await getFilterOptions();
      setFilterOptions(options);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleQuestionTypeToggle = (type) => {
    setFilters(prev => ({
      ...prev,
      question_types: prev.question_types.includes(type)
        ? prev.question_types.filter(t => t !== type)
        : [...prev.question_types, type]
    }));
  };

  const handleGenerateTest = async () => {
    setIsGenerating(true);
    try {
      const test = await generateRandomTest(filters);
      setGeneratedTest(test);
    } catch (error) {
      alert(`שגיאה ביצירת מבחן: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!generatedTest) return;

    setIsExporting(true);
    try {
      const result = await exportTestToPDF(generatedTest.questions, {
        title: `מבחן מד"א - ${filters.category_name || 'כללי'}`,
        instructor_name: instructorId,
        date: new Date().toLocaleDateString('he-IL')
      });

      if (result.success) {
        // In a real implementation, this would download the PDF
        alert('PDF הוכן בהצלחה. יש לשלב עם שירות יצירת PDF.');
      }
    } catch (error) {
      alert(`שגיאה ביצירת PDF: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!filterOptions) {
    return <div style={styles.loading}>טוען אפשרויות...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>מחולל מבחנים</h1>

      {/* Filters Section */}
      <div style={styles.filtersCard}>
        <h2 style={styles.sectionTitle}>סינון שאלות</h2>

        {/* Category Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>קטגוריה:</label>
          <select
            style={styles.select}
            value={filters.category_name}
            onChange={(e) => handleFilterChange('category_name', e.target.value)}
          >
            <option value="">כל הקטגוריות</option>
            {filterOptions.categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Topic Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>נושא:</label>
          <select
            style={styles.select}
            value={filters.topic_name}
            onChange={(e) => handleFilterChange('topic_name', e.target.value)}
          >
            <option value="">כל הנושאים</option>
            {filterOptions.topics.map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </div>

        {/* Difficulty Levels */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>רמת קושי:</label>
          <div style={styles.checkboxGroup}>
            {[DIFFICULTY_EASY, DIFFICULTY_MEDIUM, DIFFICULTY_HARD].map(lvl => {
              const d = getDifficultyDisplay(lvl);
              const checked = filters.difficulty_levels.includes(lvl);
              return (
                <label key={lvl} style={{ ...styles.checkboxLabel, color: checked ? d.color : undefined }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? filters.difficulty_levels.filter(l => l !== lvl)
                        : [...filters.difficulty_levels, lvl];
                      handleFilterChange('difficulty_levels', next);
                    }}
                    style={{ ...styles.checkbox, accentColor: d.color }}
                  />
                  <span style={{
                    padding: '2px 8px', borderRadius: '8px', fontSize: '13px',
                    background: checked ? d.bg : 'transparent',
                    border: `1px solid ${checked ? d.border : 'transparent'}`,
                    fontWeight: checked ? 600 : 400,
                  }}>
                    {lvl}
                  </span>
                </label>
              );
            })}
            <span style={{ fontSize: '12px', color: '#888', alignSelf: 'center' }}>
              (ריק = כל הרמות)
            </span>
          </div>
        </div>

        {/* Question Types */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>סוגי שאלות:</label>
          <div style={styles.checkboxGroup}>
            {filterOptions.question_types.map(type => (
              <label key={type.value} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={filters.question_types.includes(type.value)}
                  onChange={() => handleQuestionTypeToggle(type.value)}
                  style={styles.checkbox}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {/* Question Count */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>מספר שאלות:</label>
          <input
            type="number"
            min="1"
            max="100"
            value={filters.count}
            onChange={(e) => handleFilterChange('count', parseInt(e.target.value))}
            style={styles.numberInput}
          />
        </div>

        <button
          style={styles.generateButton}
          onClick={handleGenerateTest}
          disabled={isGenerating}
        >
          {isGenerating ? 'יוצר מבחן...' : 'צור מבחן אקראי'}
        </button>
      </div>

      {/* Generated Test Display */}
      {generatedTest && (
        <div style={styles.testCard}>
          <div style={styles.testHeader}>
            <h2>מבחן שנוצר</h2>
            <div style={styles.testStats}>
              <span>נבחרו {generatedTest.selected} מתוך {generatedTest.totalAvailable} שאלות זמינות</span>
            </div>
            <button
              style={styles.exportButton}
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? 'מייצא...' : 'ייצא ל-PDF'}
            </button>
          </div>

          <div style={styles.questionsList}>
            {generatedTest.questions.map((question, index) => (
              <div key={question.id} style={styles.questionItem}>
                <div style={styles.questionNumber}>{index + 1}.</div>
                <div style={styles.questionContent}>
                  <div style={styles.questionMeta}>
                    <span>סוג: {getQuestionTypeLabel(question.question_type)}</span>
                    <span>קושי: {question.difficulty_level || 'לא מדורג'}</span>
                  </div>
                  <div 
                    style={styles.questionText}
                    dangerouslySetInnerHTML={{ __html: question.question_text }}
                  />
                  {question.media_attachment && (
                    <div style={styles.questionMedia}>
                      <img 
                        src={question.media_attachment.url} 
                        alt="תמונה מצורפת"
                        style={styles.mediaThumbnail}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
    maxWidth: '1200px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
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
    padding: '30px',
    marginBottom: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#333'
  },
  filterGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    fontSize: '16px'
  },
  select: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    direction: 'rtl'
  },
  rangeContainer: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center'
  },
  range: {
    flex: 1
  },
  checkboxGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  checkbox: {
    marginLeft: '5px'
  },
  numberInput: {
    width: '100px',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    direction: 'rtl'
  },
  generateButton: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '20px'
  },
  testCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  testHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px'
  },
  testStats: {
    color: '#666',
    fontSize: '14px'
  },
  exportButton: {
    padding: '12px 24px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  questionItem: {
    display: 'flex',
    gap: '15px',
    padding: '20px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa'
  },
  questionNumber: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#CC0000',
    minWidth: '30px'
  },
  questionContent: {
    flex: 1
  },
  questionMeta: {
    display: 'flex',
    gap: '15px',
    marginBottom: '10px',
    fontSize: '14px',
    color: '#666'
  },
  questionText: {
    fontSize: '16px',
    lineHeight: '1.6',
    marginBottom: '10px'
  },
  questionMedia: {
    marginTop: '10px'
  },
  mediaThumbnail: {
    maxWidth: '200px',
    height: 'auto',
    borderRadius: '4px'
  }
};
