/**
 * Trainee Dashboard Page
 * Main entry point for trainees
 * Hebrew: מסך מתאמן
 */

import React, { useState, useEffect } from 'react';
import TraineePracticeSession from '../components/TraineePracticeSession';
import UserProgressDashboard from '../components/UserProgressDashboard';
import EcgUploadPanel from '../components/EcgUploadPanel';
import DailyChallenge from '../components/DailyChallenge';
import Leaderboard from '../components/Leaderboard';
import TagFilter from '../components/TagFilter';
import StreakBadge from '../components/StreakBadge';
import ProgressRing from '../components/ProgressRing';
import { SkeletonCard } from '../components/Skeleton';
import { getFilterOptions, generateTraineeExam } from '../workflows/testGenerator';
import { getUserProgress } from '../workflows/userProgress';
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
  const [progressStats, setProgressStats] = useState(null);
  const [progressLoading, setProgressLoading] = useState(true);

  React.useEffect(() => {
    loadFilterOptions();
    loadAvailableTags();
    if (userId) loadProgress();
  }, [userId]);

  const loadProgress = async () => {
    setProgressLoading(true);
    try {
      const data = await getUserProgress(userId);
      setProgressStats(data);
    } catch (e) {
      console.error('Progress load error:', e);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleQuickAdaptive = () => {
    setHierarchyFilters({});
    setSelectedTags([]);
    setPracticeMode('free');
    setActiveTab('practice');
    showToast('מתחילים תרגול אדפטיבי', 'info');
  };

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
      {progressLoading ? (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <SkeletonCard height={140} />
        </div>
      ) : progressStats && (
        <div className="card card-elevated animate-fade-in" style={styles.heroStrip}>
          <div style={styles.heroTop}>
            <div>
              <h2 style={styles.heroGreeting}>שלום, מוכנים לתרגל?</h2>
              <p style={styles.heroSub}>המשיכו את הרצף והתקדמות השבועית</p>
            </div>
            <StreakBadge days={progressStats.streak?.current ?? 0} size="lg" />
          </div>
          <div style={styles.heroRings}>
            <ProgressRing
              value={progressStats.overall?.successRate ?? 0}
              label="הצלחה שבועית"
              size={96}
            />
            <ProgressRing
              value={progressStats.overall?.completionRate ?? 0}
              label="כיסוי מאגר"
              sublabel={`${progressStats.overall?.questionsAnswered ?? 0} / ${progressStats.overall?.totalQuestions ?? 0} שאלות`}
              size={96}
              color="var(--color-success)"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            style={styles.quickActionBtn}
            onClick={handleQuickAdaptive}
            aria-label="המשך תרגול אדפטיבי"
          >
            המשך תרגול אדפטיבי
          </button>
        </div>
      )}

      <div className="card card-elevated" style={styles.pageTop}>
        <h1 style={styles.pageTitle}>תרגול</h1>
        <div style={styles.headerActions}>
          <div className="tabs" role="tablist" aria-label="טאבים">
            <button
              className={`tab-btn ${activeTab === 'practice' ? 'active' : ''}`}
              onClick={() => { setActiveTab('practice'); setPracticeMode('create'); }}
              role="tab"
              aria-selected={activeTab === 'practice'}
              aria-controls="practice-panel"
              id="practice-tab"
            >
              תרגול
            </button>
            <button
              className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
              role="tab"
              aria-selected={activeTab === 'progress'}
              aria-controls="progress-panel"
              id="progress-tab"
            >
              התקדמות
            </button>
            <button
              className={`tab-btn ${activeTab === 'challenge' ? 'active' : ''}`}
              onClick={() => setActiveTab('challenge')}
              role="tab"
              aria-selected={activeTab === 'challenge'}
              aria-controls="challenge-panel"
              id="challenge-tab"
            >
              אתגר יומי
            </button>
            <button
              className={`tab-btn ${activeTab === 'ecg' ? 'active' : ''}`}
              onClick={() => setActiveTab('ecg')}
              role="tab"
              aria-selected={activeTab === 'ecg'}
              aria-controls="ecg-panel"
              id="ecg-tab"
            >
              אקג
            </button>
            <button
              className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('leaderboard')}
              role="tab"
              aria-selected={activeTab === 'leaderboard'}
              aria-controls="leaderboard-panel"
              id="leaderboard-tab"
            >
              טבלת מובילים
            </button>
          </div>
          {activeTab === 'practice' && practiceMode === 'free' && (
            <button
              type="button"
              className="btn btn-ghost"
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
            <div className="card card-elevated animate-fade-in" style={styles.createPanel} role="region" aria-labelledby="create-exam-heading">
              <h2 id="create-exam-heading" style={styles.createTitle}>צור מבחן</h2>
              <p style={styles.createSubtitle}>בחר קטגוריות וכמות שאלות לכל אחת, ואפשר גם להתאים לפי רמת קושי.</p>

              {!filterOptions ? (
                <div style={{ padding: 'var(--space-4) 0' }}>
                  <SkeletonCard height={280} />
                </div>
              ) : (
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

              {filterOptions && (
              <div style={styles.buttonRow}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartExam}
                  disabled={isStartingExam || !filterOptions}
                  aria-label="התחל מבחן"
                >
                  {isStartingExam ? 'מייצר מבחן...' : 'התחל מבחן'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={switchToFreePractice}
                  aria-label="תרגול חופשי"
                >
                  תרגול חופשי
                </button>
              </div>
              )}
            </div>
          ) : (
            <>
              {showFilters && (
                <div className="card" style={styles.filtersPanel} role="region" aria-label="סינון נושאים">
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

      {activeTab === 'challenge' && (
        <div role="tabpanel" aria-labelledby="challenge-tab" id="challenge-panel" style={{ paddingTop: 'var(--space-6)' }}>
          <DailyChallenge onPointsChanged={() => userId && loadProgress()} />
        </div>
      )}

      {activeTab === 'ecg' && (
        <div role="tabpanel" aria-labelledby="ecg-tab" id="ecg-panel" style={{ paddingTop: 'var(--space-6)' }}>
          <EcgUploadPanel />
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div role="tabpanel" aria-labelledby="leaderboard-tab" id="leaderboard-panel" style={{ paddingTop: 'var(--space-6)' }}>
          <Leaderboard currentUserId={userId} />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    backgroundColor: 'var(--color-bg)',
    minHeight: '100vh',
  },
  heroStrip: {
    margin: '0 0 var(--space-5)',
    padding: 'var(--space-6)',
    background: 'linear-gradient(135deg, var(--color-primary-bg) 0%, var(--color-bg-card) 60%)',
    border: '1px solid var(--mda-blue-border)',
  },
  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-5)',
  },
  heroGreeting: {
    margin: 0,
    fontSize: 'var(--font-size-xl)',
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  heroSub: {
    margin: 'var(--space-2) 0 0',
    color: 'var(--color-text-muted)',
    fontSize: 'var(--font-size-base)',
  },
  heroRings: {
    display: 'flex',
    justifyContent: 'center',
    gap: 'var(--space-8)',
    flexWrap: 'wrap',
    marginBottom: 'var(--space-5)',
  },
  quickActionBtn: {
    width: '100%',
    maxWidth: 420,
    margin: '0 auto',
    display: 'flex',
  },
  pageTop: {
    padding: 'var(--space-6) var(--space-6) var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 'var(--space-4)',
  },
  pageTitle: {
    margin: 0,
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  headerActions: {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filtersPanel: {
    padding: 'var(--space-5)',
    display: 'flex',
    gap: 'var(--space-5)',
    flexWrap: 'wrap',
    marginBottom: 'var(--space-5)',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 'min(200px, 100%)',
    flex: '1 1 200px',
  },
  hint: {
    margin: '0 0 10px 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
  },
  label: {
    marginBottom: '5px',
    fontWeight: 'var(--font-weight-bold)',
    fontSize: 'var(--font-size-base)',
  },
  select: {
    padding: 'var(--space-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-base)',
    direction: 'rtl',
    minHeight: '44px',
  },
  createPanel: {
    padding: 'var(--space-8) var(--space-6)',
    margin: 'var(--space-6) auto',
    maxWidth: 720,
  },
  createTitle: {
    margin: '0 0 var(--space-2) 0',
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  createSubtitle: {
    margin: '0 0 var(--space-6) 0',
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-2)',
    lineHeight: 1.5,
  },
  formSection: {
    marginBottom: 'var(--space-6)',
  },
  sectionTitle: {
    margin: '0 0 var(--space-3) 0',
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--color-text-2)',
  },
  checkboxGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
    gap: '10px var(--space-6)',
  },
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: 'var(--color-bg-hover)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: 'var(--font-size-base)',
  },
  numberInput: {
    width: 64,
    padding: '6px var(--space-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-base)',
    direction: 'rtl',
  },
  difficultyRow: {
    display: 'flex',
    gap: 'var(--space-6)',
    flexWrap: 'wrap',
  },
  diffLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 'var(--font-size-base)',
  },
  timeNote: {
    margin: 'var(--space-2) 0 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
  },
  timeCalc: {
    margin: 'var(--space-1) 0 0 0',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--color-text-2)',
  },
  buttonRow: {
    display: 'flex',
    gap: 'var(--space-3)',
    marginTop: 'var(--space-6)',
    flexWrap: 'wrap',
  },
};
