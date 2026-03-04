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

  const maxDifficultyTotal = () => {
    const fromCat = totalFromCategories();
    if (createSpec.selectedCategories.length > 0 && fromCat > 0) return fromCat;
    return null; // no cap when no categories
  };

  const setDifficultyCount = (level, count) => {
    let n = Math.max(0, parseInt(count, 10) || 0);
    const cap = maxDifficultyTotal();
    if (cap != null) {
      const rest = ['קל', 'בינוני', 'קשה'].filter(l => l !== level).reduce((s, l) => s + (createSpec.difficultyCounts[l] || 0), 0);
      n = Math.min(n, Math.max(0, cap - rest));
    }
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
      <div style={styles.pageTop}>
        <h1 style={styles.pageTitle}>תרגול</h1>
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
              aria-label={showFilters ? 'סגור סינון' : 'פתח סינון קטגוריות'}
              aria-expanded={showFilters}
            >
              {showFilters ? 'סגור סינון' : 'סינון קטגוריות'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'practice' && (
        <div role="tabpanel" aria-labelledby="practice-tab" id="practice-panel">
          {practiceMode === 'create' ? (
            <div style={styles.createPanel} role="region" aria-labelledby="create-exam-heading">
              <h2 id="create-exam-heading" style={styles.createTitle}>צור מבחן</h2>
              <p style={styles.createSubtitle}>בחר קטגוריות וכמות שאלות לכל אחת, ואפשר גם להתאים לפי רמת קושי.</p>

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
                    {maxDifficultyTotal() != null && (
                      <p style={styles.hint}>סה״כ עד {maxDifficultyTotal()} שאלות (לפי הקטגוריות שבחרת)</p>
                    )}
                    <div style={styles.difficultyRow}>
                      {['קל', 'בינוני', 'קשה'].map(level => (
                        <label key={level} style={styles.diffLabel}>
                          <span style={{ marginLeft: 8 }}>{level}:</span>
                          <input
                            type="number"
                            min={0}
                            max={maxDifficultyTotal() ?? undefined}
                            value={createSpec.difficultyCounts[level] ?? 0}
                            onChange={(e) => setDifficultyCount(level, e.target.value)}
                            style={styles.numberInput}
                            aria-label={`שאלות ${level}`}
                          />
                        </label>
                      ))}
                    </div>
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
                    <div style={styles.filterGroup}>
                      <label htmlFor="category-filter" style={styles.label}>קטגוריה:</label>
                      <select
                        id="category-filter"
                        style={styles.select}
                        value={hierarchyFilters.category_name || ''}
                        onChange={(e) => {
                          const v = e.target.value || undefined;
                          setHierarchyFilters({ category_name: v, topic_name: v });
                        }}
                        aria-label="בחר קטגוריה"
                      >
                        <option value="">כל הקטגוריות</option>
                        {filterOptions.categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
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
    fontFamily: "'Heebo', 'Assistant', Arial, sans-serif",
    backgroundColor: '#f8f9fa',
    minHeight: '100vh',
  },
  pageTop: {
    padding: '24px 24px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e8e8e8',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  pageTitle: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#f0f0f0',
    borderRadius: '10px',
    padding: '4px'
  },
  tabButton: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#555',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 500,
    transition: 'background-color 0.2s, color 0.2s',
    minHeight: '44px',
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    color: '#CC0000',
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  filterButton: {
    padding: '10px 18px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  filtersPanel: {
    backgroundColor: '#fff',
    padding: '20px',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    marginBottom: '20px',
    borderRadius: '12px',
    border: '1px solid #eee',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '200px',
  },
  hint: {
    margin: '0 0 10px 0',
    fontSize: '13px',
    color: '#666',
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
    backgroundColor: '#fff',
    padding: '32px 28px',
    margin: '24px auto',
    borderRadius: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    maxWidth: 720,
    border: '1px solid #eee',
  },
  createTitle: {
    margin: '0 0 8px 0',
    fontSize: '22px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  createSubtitle: {
    margin: '0 0 24px 0',
    fontSize: '14px',
    color: '#666',
    lineHeight: 1.5,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
  },
  checkboxGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '10px 24px',
  },
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 12px',
    backgroundColor: '#fafafa',
    borderRadius: 8,
    border: '1px solid #eee',
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
