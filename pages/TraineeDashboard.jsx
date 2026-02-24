/**
 * Trainee Dashboard Page
 * Main entry point for trainees
 * Hebrew: מסך מתאמן
 */

import React, { useState, useEffect } from 'react';
import TraineePracticeSession from '../components/TraineePracticeSession';
import UserProgressDashboard from '../components/UserProgressDashboard';
import TagFilter from '../components/TagFilter';
import { getFilterOptions } from '../workflows/testGenerator';
import { entities } from '../config/appConfig';

export default function TraineeDashboard({ userId }) {
  const [hierarchyFilters, setHierarchyFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null);
  const [activeTab, setActiveTab] = useState('practice'); // 'practice' or 'progress'
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  React.useEffect(() => {
    loadFilterOptions();
    loadAvailableTags();
  }, []);

  const loadAvailableTags = async () => {
    try {
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
              onClick={() => setActiveTab('practice')}
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
          {activeTab === 'practice' && (
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
  }
};
