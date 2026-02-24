/**
 * Bookmarks List Component
 * Display user bookmarks
 * Hebrew: רשימת סימניות
 */

import React, { useState, useEffect } from 'react';
import { getBookmarks, deleteNote } from '../workflows/userNotes';
import { getCurrentUser } from '../utils/auth';
import { navigateTo } from '../utils/router';
import LoadingSpinner from './LoadingSpinner';
import SearchBar from './SearchBar';
import { showToast } from './Toast';
export default function BookmarksList() {
  const [bookmarks, setBookmarks] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, []);

  useEffect(() => {
    filterBookmarks();
  }, [searchQuery, bookmarks]);

  const loadBookmarks = async () => {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      const userBookmarks = await getBookmarks(user.user_id);
      setBookmarks(userBookmarks);
      setFilteredBookmarks(userBookmarks);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      showToast('שגיאה בטעינת סימניות', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filterBookmarks = () => {
    if (!searchQuery.trim()) {
      setFilteredBookmarks(bookmarks);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = bookmarks.filter(bookmark => {
      const questionText = bookmark.question?.question_text || '';
      return questionText.toLowerCase().includes(query);
    });
    setFilteredBookmarks(filtered);
  };

  const handleRemoveBookmark = async (noteId) => {
    try {
      const user = await getCurrentUser();
      await deleteNote(noteId, user.user_id);
      showToast('סימניה הוסרה', 'success');
      await loadBookmarks();
    } catch (error) {
      console.error('Error removing bookmark:', error);
      showToast('שגיאה בהסרת סימניה', 'error');
    }
  };

  const handleViewQuestion = (questionId) => {
    navigateTo(`/practice?question=${questionId}`);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="טוען סימניות..." />;
  }

  return (
    <div style={styles.container}>
        <h1 style={styles.title}>סימניות</h1>

        <div style={styles.searchSection}>
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="חפש בסימניות..."
          />
        </div>

        <div style={styles.content}>
          {filteredBookmarks.length === 0 ? (
            <div style={styles.empty} role="status">
              {bookmarks.length === 0 
                ? 'אין סימניות' 
                : 'לא נמצאו סימניות התואמות לחיפוש'}
            </div>
          ) : (
            <div style={styles.bookmarksList} role="list">
              {filteredBookmarks.map((bookmark) => (
                <div
                  key={bookmark.note_id}
                  style={styles.bookmarkItem}
                  role="listitem"
                >
                  <div style={styles.bookmarkContent}>
                    <h3 style={styles.questionTitle}>
                      {bookmark.question?.question_text?.substring(0, 100) || 'שאלה'}
                      {bookmark.question?.question_text?.length > 100 && '...'}
                    </h3>
                    {bookmark.note_text && (
                      <p style={styles.noteText}>{bookmark.note_text}</p>
                    )}
                    <div style={styles.meta}>
                      <span style={styles.date}>
                        נוצר: {new Date(bookmark.created_at).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  </div>
                  <div style={styles.actions}>
                    <button
                      style={styles.viewButton}
                      onClick={() => handleViewQuestion(bookmark.question_id)}
                      aria-label="צפה בשאלה"
                    >
                      צפה
                    </button>
                    <button
                      style={styles.removeButton}
                      onClick={() => handleRemoveBookmark(bookmark.note_id)}
                      aria-label="הסר סימניה"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#212121'
  },
  searchSection: {
    marginBottom: '30px'
  },
  content: {
    minHeight: '400px'
  },
  bookmarksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  bookmarkItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start'
  },
  bookmarkContent: {
    flex: 1,
    minWidth: 0
  },
  questionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#212121',
    lineHeight: 1.4
  },
  noteText: {
    fontSize: '14px',
    color: '#757575',
    marginBottom: '8px',
    lineHeight: 1.6
  },
  meta: {
    fontSize: '12px',
    color: '#9E9E9E'
  },
  date: {
    display: 'block'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0
  },
  viewButton: {
    padding: '8px 16px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  removeButton: {
    padding: '8px 12px',
    backgroundColor: '#f44336',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#D32F2F'
    },
    '&:focus': {
      outline: '2px solid #f44336',
      outlineOffset: '2px'
    }
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#757575',
    fontSize: '16px'
  }
};
