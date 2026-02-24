/**
 * Tag Filter Component
 * Filter questions by tags with multi-select support
 * Hebrew: סינון לפי תגיות
 */

import React, { useState, useEffect } from 'react';
import { announce } from '../utils/accessibility';

export default function TagFilter({ 
  tags = [], 
  selectedTags = [], 
  onToggle, 
  multiSelect = true,
  showSearch = true,
  placeholder = 'חפש תגית...'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter tags based on search query
  const filteredTags = tags.filter(tag =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTagClick = (tag) => {
    if (onToggle) {
      onToggle(tag);
    }
    announce(`תגית ${tag} ${selectedTags.includes(tag) ? 'הוסרה' : 'נבחרה'}`);
  };

  const handleSelectAll = () => {
    if (onToggle) {
      filteredTags.forEach(tag => {
        if (!selectedTags.includes(tag)) {
          onToggle(tag);
        }
      });
    }
    announce('נבחרו כל התגיות');
  };

  const handleClearAll = () => {
    if (onToggle) {
      selectedTags.forEach(tag => {
        if (filteredTags.includes(tag)) {
          onToggle(tag);
        }
      });
    }
    announce('בוטלה בחירת כל התגיות');
  };

  // Keyboard navigation
  const handleKeyDown = (e, tag) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTagClick(tag);
    }
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div style={styles.container} role="group" aria-label="סינון לפי תגיות">
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={styles.toggleButton}
          aria-expanded={isExpanded}
          aria-controls="tag-filter-list"
          aria-label={isExpanded ? 'סגור סינון תגיות' : 'פתח סינון תגיות'}
        >
          <span style={styles.toggleIcon}>{isExpanded ? '▼' : '▶'}</span>
          <span>סינון לפי תגיות</span>
          {selectedTags.length > 0 && (
            <span style={styles.badge} aria-label={`${selectedTags.length} תגיות נבחרו`}>
              {selectedTags.length}
            </span>
          )}
        </button>
      </div>

      {isExpanded && (
        <div id="tag-filter-list" style={styles.content}>
          {showSearch && (
            <div style={styles.searchContainer}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                style={styles.searchInput}
                aria-label="חיפוש תגיות"
              />
            </div>
          )}

          {filteredTags.length > 0 && (
            <div style={styles.actions}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={styles.actionButton}
                aria-label="בחר כל התגיות"
              >
                בחר הכל
              </button>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={styles.actionButton}
                  aria-label="בטל בחירה"
                >
                  בטל בחירה
                </button>
              )}
            </div>
          )}

          <div style={styles.tagsList} role="listbox" aria-multiselectable={multiSelect}>
            {filteredTags.length === 0 ? (
              <div style={styles.emptyState} role="status" aria-live="polite">
                {searchQuery ? 'לא נמצאו תגיות התואמות לחיפוש' : 'אין תגיות זמינות'}
              </div>
            ) : (
              filteredTags.map((tag, index) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    onKeyDown={(e) => handleKeyDown(e, tag)}
                    style={{
                      ...styles.tagButton,
                      ...(isSelected ? styles.tagButtonSelected : {})
                    }}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`תגית ${tag}, ${isSelected ? 'נבחרה' : 'לא נבחרה'}`}
                    tabIndex={0}
                  >
                    <span style={styles.checkbox} aria-hidden="true">
                      {isSelected ? '✓' : ''}
                    </span>
                    <span>{tag}</span>
                  </button>
                );
              })
            )}
          </div>

          {selectedTags.length > 0 && (
            <div style={styles.selectedTags} role="status" aria-live="polite">
              <strong>תגיות נבחרות:</strong>
              <div style={styles.selectedTagsList}>
                {selectedTags.map(tag => (
                  <span key={tag} style={styles.selectedTag}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      style={styles.removeTagButton}
                      aria-label={`הסר תגית ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  header: {
    marginBottom: '12px'
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#212121',
    textAlign: 'right',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      borderColor: '#CC0000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  toggleIcon: {
    fontSize: '12px',
    color: '#757575'
  },
  badge: {
    marginRight: 'auto',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  content: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e0e0e0'
  },
  searchContainer: {
    marginBottom: '12px'
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '14px',
    direction: 'rtl',
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderColor: '#CC0000'
    }
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap'
  },
  actionButton: {
    padding: '6px 12px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#212121',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#e0e0e0'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px'
  },
  tagButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #e0e0e0',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#212121',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#e3f2fd',
      borderColor: '#CC0000',
      transform: 'translateY(-1px)'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  tagButtonSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#CC0000',
    color: '#1976d2',
    fontWeight: '500'
  },
  checkbox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid #CC0000',
    backgroundColor: '#FFFFFF',
    color: '#CC0000',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: '#757575',
    fontSize: '14px'
  },
  selectedTags: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e0e0e0'
  },
  selectedTagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px'
  },
  selectedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #CC0000',
    borderRadius: '20px',
    fontSize: '14px',
    color: '#1976d2'
  },
  removeTagButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#1976d2',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: '1',
    padding: '0',
    marginRight: '4px',
    '&:hover': {
      color: '#f44336'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderRadius: '2px'
    }
  }
};
