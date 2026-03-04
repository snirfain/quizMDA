/**
 * Trainee Dashboard Page
 * Main entry point for trainees
 * Hebrew: מסך מתאמן
 */

import React, { useState, useEffect } from 'react';
import TraineePracticeSession from '../components/TraineePracticeSession';
import UserProgressDashboard from '../components/UserProgressDashboard';
import TagFilter from '../components/TagFilter';
import { getFilterOptions, generateTraineeExam } from '../workflows/testGenerator';
import { entities } from '../config/appConfig';
import { navigateTo } from '../utils/router';
import { showToast } from '../components/Toast';

const TIME_PER_QUESTION_MIN = 1.5;

export default function TraineeDashboard({ userId }) {
  const [hierarchyFilters, setHierarchyFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null);
  const [activeTab, setActiveTab] = useState('practice');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [practiceMode, setPracticeMode] = useState('create'); // 'create' | 'free'

  const [createSpec, setCreateSpec] = useState({
    selectedCategories: [],
    categoryCounts: {},
    difficultyCounts: { קל: 0, בינוני: 0, קשה: 0 },
    useTimeLimit: true,
    topic_name: '',
    tagFilters: [],
  });
  const [isStartingExam, setIsStartingExam] = useState(false);

  React.useEffect(() => {
    loadFilterOptions();
    loadAvailableTags();
  }, []);

  const loadAvailableTags = async () => {
    try {
      if (typeof window !== 'undefined' && window.__quizMDA_syncPromise) {
        await window.__quizMDA_syncPromise;
      }
      const questions = await entities.Question_Bank.find({ status: 'active' });
      const tagsSet = new Set();
      questions.forEach(q => {
        if (q.tags && Array.isArray(q.tags)) {
          q.tags.forEach(tag => tagsSet.add(tag));
        }
      });
      setAvailableTags(Array.from(tagsSet).sort());
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const loadFilterOptions = async () => {
    try {
      const options = await getFilterOptions();
      setFilterOptions(options);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const handleCategoryToggle = (cat) => {
    setCreateSpec(prev => {
      const selected = prev.selectedCategories.includes(cat)
        ? prev.selectedCategories.filter(c => c !== cat)
        : [...prev.selectedCategories, cat];
      const categoryCounts = { ...prev.categoryCounts };
      if (!selected.includes(cat)) delete categoryCounts[cat];
      else if (categoryCounts[cat] == null) categoryCounts[cat] = 5;
      return { ...prev, selectedCategories: selected, categoryCounts };
    });
  };

  const setCategoryCount = (cat, count) => {
    const n = Math.max(0, parseInt(count, 10) || 0);
    setCreateSpec(prev => ({
      ...prev,
      categoryCounts: { ...prev.categoryCounts, [cat]: n },
    }));
  };

  const setDifficultyCount = (level, count) => {
    const n = Math.max(0, parseInt(count, 10) || 0);
    setCreateSpec(prev => ({
      ...prev,
      difficultyCounts: { ...prev.difficultyCounts, [level]: n },
    }));
  };

  const totalFromCategories = () => {
    return createSpec.selectedCategories.reduce((sum, cat) => sum + (createSpec.categoryCounts[cat] || 0), 0);
  };
  const totalFromDifficulty = () => {
    const d = createSpec.difficultyCounts;
    return (d.קל || 0) + (d.בינוני || 0) + (d.קשה || 0);
  };
  const totalQuestions = () => {
    const byCat = totalFromCategories();
    const byDiff = totalFromDifficulty();
    if (createSpec.selectedCategories.length > 0) return byCat || totalFromDifficulty();
    return byDiff || 20;
  };

  const handleStartExam = async () => {
    const total = totalQuestions();
    if (total <= 0) {
      showToast('בחר לפחות שאלה אחת (קטגוריות או רמות קושי)', 'warning');
      return;
    }
    setIsStartingExam(true);
    try {
      const categoryCounts = {};
      createSpec.selectedCategories.forEach(cat => {
        const n = createSpec.categoryCounts[cat];
        if (n > 0) categoryCounts[cat] = n;
      });
      const spec = {
        categoryCounts: Object.keys(categoryCounts).length ? categoryCounts : undefined,
        difficultyCounts: totalFromDifficulty() > 0 ? createSpec.difficultyCounts : undefined,
        topic_name: createSpec.topic_name || undefined,
        tagFilters: createSpec.tagFilters.length ? createSpec.tagFilters : [],
        maxTotal: total,
      };
      const { questions } = await generateTraineeExam(spec);
      if (questions.length === 0) {
        showToast('לא נמצאו שאלות התואמות את הסינון', 'warning');
        return;
      }
      const timeLimit = createSpec.useTimeLimit ? TIME_PER_QUESTION_MIN * questions.length : 0;
      navigateTo('/mock-exam', {
        state: {
          questionCount: questions.length,
          timeLimitMinutes: timeLimit,
          hierarchyFilters: createSpec.topic_name ? { topic_name: createSpec.topic_name } : {},
          tagFilters: createSpec.tagFilters,
          examSpec: spec,
          preGeneratedQuestions: questions,
        },
      });
    } catch (e) {
      showToast('שגיאה ביצירת המבחן: ' + (e?.message || ''), 'error');
    } finally {
      setIsStartingExam(false);
    }
  };

  const switchToFreePractice = () => {
    setHierarchyFilters(createSpec.topic_name ? { topic_name: createSpec.topic_name } : {});
    setSelectedTags(createSpec.tagFilters);
    setPracticeMode('free');
  };

  return (
    <div style={styles.container} aria-label="לוח בקרה מתאמן">
      <div style={styles.header}>
        <h1 style={styles.title}>מערכת תרגול מד"א</h1>
        <div style={styles.headerActions}>
          <div style={styles.tabs} role="tablist" aria-label="טאבים">
            <button
              style={{
                ...styles.tabButton,
                ...(activeTab === 'practice' ? styles.tabButtonActive : {})
              }}
              onClick={() => { setActiveTab('practice'); setPracticeMode('create'); }}
              role="tab"
              aria-selected={activeTab === 'practice'}
              aria-controls="practice-panel"
              id="practice-tab"
            >
              תרגול
            </button>
            <button
              style={{
                ...styles.tabButton,
                ...(activeTab === 'progress' ? styles.tabButtonActive : {})
              }}
              onClick={() => setActiveTab('progress')}
              role="tab"
              aria-selected={activeTab === 'progress'}
              aria-controls="progress-panel"
              id="progress-tab"
            >
              התקדמות
            </button>
          </div>
          {activeTab === 'practice' && practiceMode === 'free' && (
            <button
              style={styles.filterButton}
              onClick={() => setShowFilters(!showFilters)}
              aria-label={showFilters ? 'סגור סינון' : 'פתח סינון נושאים'}
              aria-expanded={showFilters}
            >
              {showFilters ? 'סגור סינון' : 'סינון נושאים'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'practice' && (
        <div role="tabpanel" aria-labelledby="practice-tab" id="practice-panel">
          {practiceMode === 'create' ? (
            <div style={styles.createPanel} role="region" aria-labelledby="create-exam-heading">
              <h2 id="create-exam-heading" style={styles.createTitle}>צור מבחן</h2>

              {filterOptions && (
                <>
                  <div style={styles.formSection}>
                    <h3 style={styles.sectionTitle}>קטגוריות (ניתן לבחור כמה)</h3>
                    <div style={styles.checkboxGroup}>
                      {filterOptions.categories.map(cat => (
                        <div key={cat} style={styles.categoryRow}>
                          <label style={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={createSpec.selectedCategories.includes(cat)}
                              onChange={() => handleCategoryToggle(cat)}
                              aria-label={`קטגוריה ${cat}`}
                            />
                            <span style={{ marginRight: 8 }}>{cat}</span>
                          </label>
                          {createSpec.selectedCategories.includes(cat) && (
                            <input
                              type="number"
                              min={0}
                              value={createSpec.categoryCounts[cat] ?? 5}
                              onChange={(e) => setCategoryCount(cat, e.target.value)}
                              style={styles.numberInput}
                              aria-label={`כמה שאלות מקטגוריה ${cat}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={styles.formSection}>
                    <h3 style={styles.sectionTitle}>כמה שאלות מכל רמת קושי</h3>
                    <div style={styles.difficultyRow}>
                      {['קל', 'בינוני', 'קשה'].map(level => (
                        <label key={level} style={styles.diffLabel}>
                          <span style={{ marginLeft: 8 }}>{level}:</span>
                          <input
                            type="number"
                            min={0}
                            value={createSpec.difficultyCounts[level] ?? 0}
                            onChange={(e) => setDifficultyCount(level, e.target.value)}
                            style={styles.numberInput}
                            aria-label={`שאלות ${level}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={styles.formSection}>
                    <label style={styles.label}>נושא (אופציונלי)</label>
                    <select
                      style={styles.select}
                      value={createSpec.topic_name}
                      onChange={(e) => setCreateSpec(prev => ({ ...prev, topic_name: e.target.value }))}
                      aria-label="בחר נושא"
                    >
                      <option value="">כל הנושאים</option>
                      {filterOptions.topics.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {availableTags.length > 0 && (
                    <div style={styles.formSection}>
                      <h3 style={styles.sectionTitle}>תגיות (אופציונלי)</h3>
                      <TagFilter
                        tags={availableTags}
                        selectedTags={createSpec.tagFilters}
                        onToggle={(tag) => {
                          setCreateSpec(prev => ({
                            ...prev,
                            tagFilters: prev.tagFilters.includes(tag)
                              ? prev.tagFilters.filter(t => t !== tag)
                              : [...prev.tagFilters, tag],
                          }));
                        }}
                        multiSelect={true}
                      />
                    </div>
                  )}

                  <div style={styles.formSection}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={createSpec.useTimeLimit}
                        onChange={(e) => setCreateSpec(prev => ({ ...prev, useTimeLimit: e.target.checked }))}
                        aria-label="הגבלת זמן"
                        aria-describedby="time-limit-note"
                      />
                      <span style={{ marginRight: 8 }}>הגבלת זמן למבחן</span>
                    </label>
                    <p id="time-limit-note" style={styles.timeNote} role="note">
                      הגבלת הזמן: 1.5 דקות לכל שאלה שנבחרה.
                    </p>
                    {createSpec.useTimeLimit && totalQuestions() > 0 && (
                      <p style={styles.timeCalc}>
                        סה&quot;כ זמן למבחן: {Math.ceil(TIME_PER_QUESTION_MIN * totalQuestions())} דקות
                      </p>
                    )}
                  </div>
                </>
              )}

              <div style={styles.buttonRow}>
                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={handleStartExam}
                  disabled={isStartingExam || !filterOptions}
                  aria-label="התחל מבחן"
                >
                  {isStartingExam ? 'מייצר מבחן...' : 'התחל מבחן'}
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={switchToFreePractice}
                  aria-label="תרגול חופשי"
                >
                  תרגול חופשי
                </button>
              </div>
            </div>
          ) : (
            <>
              {showFilters && (
                <div style={styles.filtersPanel} role="region" aria-label="סינון נושאים">
                  {availableTags.length > 0 && (
                    <TagFilter
                      tags={availableTags}
                      selectedTags={selectedTags}
                      onToggle={handleTagToggle}
                      multiSelect={true}
                    />
                  )}
                  {filterOptions && (
                    <>
                      <div style={styles.filterGroup}>
                        <label htmlFor="category-filter" style={styles.label}>קטגוריה:</label>
                        <select
                          id="category-filter"
                          style={styles.select}
                          value={hierarchyFilters.category_name || ''}
                          onChange={(e) => setHierarchyFilters({
                            ...hierarchyFilters,
                            category_name: e.target.value || undefined
                          })}
                          aria-label="בחר קטגוריה"
                        >
                          <option value="">כל הקטגוריות</option>
                          {filterOptions.categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.filterGroup}>
                        <label htmlFor="topic-filter" style={styles.label}>נושא:</label>
                        <select
                          id="topic-filter"
                          style={styles.select}
                          value={hierarchyFilters.topic_name || ''}
                          onChange={(e) => setHierarchyFilters({
                            ...hierarchyFilters,
                            topic_name: e.target.value || undefined
                          })}
                          aria-label="בחר נושא"
                        >
                          <option value="">כל הנושאים</option>
                          {filterOptions.topics.map(topic => (
                            <option key={topic} value={topic}>{topic}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}
              <TraineePracticeSession
                userId={userId}
                hierarchyFilters={hierarchyFilters}
                tagFilters={selectedTags}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div role="tabpanel" aria-labelledby="progress-tab" id="progress-panel">
          <UserProgressDashboard userId={userId} />
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#CC0000',
    color: 'white',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    flexWrap: 'wrap',
    gap: '15px',
  },
  headerActions: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  tabs: {
    display: 'flex',
    gap: '5px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '4px',
    padding: '4px'
  },
  tabButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    minHeight: '44px',
    '&:focus': {
      outline: '3px solid white',
      outlineOffset: '2px'
    }
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    fontWeight: 'bold'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold'
  },
  filterButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  filtersPanel: {
    backgroundColor: 'white',
    padding: '20px',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '200px',
  },
  label: {
    marginBottom: '5px',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  select: {
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
  createPanel: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    maxWidth: 640,
  },
  createTitle: {
    margin: '0 0 20px 0',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: 16,
    fontWeight: 600,
    color: '#555',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: 14,
  },
  numberInput: {
    width: 64,
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: 4,
    fontSize: 14,
    direction: 'rtl',
  },
  difficultyRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
  },
  diffLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 14,
  },
  timeNote: {
    margin: '8px 0 0 0',
    fontSize: 13,
    color: '#666',
  },
  timeCalc: {
    margin: '4px 0 0 0',
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#CC0000',
    border: '2px solid #CC0000',
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
