/**
 * Question Notes Component
 * Add/edit notes and bookmarks for questions
 * Hebrew: הערות לשאלה
 */

import React, { useState, useEffect } from 'react';
import { getUserNotes, createNote, updateNote, toggleBookmark } from '../workflows/userNotes';
import { getCurrentUser } from '../utils/auth';
import FormField from './FormField';
import { showToast } from './Toast';
import { announce } from '../utils/accessibility';

export default function QuestionNotes({ questionId, onNoteChange }) {
  const [note, setNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadNote();
  }, [questionId]);

  const loadNote = async () => {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      const userNote = await getUserNotes(user.user_id, questionId);
      
      if (userNote) {
        setNote(userNote);
        setNoteText(userNote.note_text || '');
        setIsBookmarked(userNote.is_bookmark || false);
      } else {
        setNote(null);
        setNoteText('');
        setIsBookmarked(false);
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNote = async () => {
    setIsSaving(true);
    try {
      const user = await getCurrentUser();
      
      if (note) {
        await updateNote(note.note_id, user.user_id, noteText);
        showToast('הערה עודכנה', 'success');
        announce('הערה עודכנה');
      } else {
        await createNote(user.user_id, questionId, noteText, isBookmarked);
        showToast('הערה נוצרה', 'success');
        announce('הערה נוצרה');
      }
      
      await loadNote();
      if (onNoteChange) onNoteChange();
    } catch (error) {
      console.error('Error saving note:', error);
      showToast('שגיאה בשמירת הערה', 'error');
      announceError('שגיאה בשמירת הערה');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBookmark = async () => {
    try {
      const user = await getCurrentUser();
      await toggleBookmark(user.user_id, questionId);
      setIsBookmarked(!isBookmarked);
      showToast(isBookmarked ? 'סימניה הוסרה' : 'סימניה נוספה', 'success');
      announce(isBookmarked ? 'סימניה הוסרה' : 'סימניה נוספה');
      await loadNote();
      if (onNoteChange) onNoteChange();
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      showToast('שגיאה בשינוי סימניה', 'error');
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>טוען הערות...</div>;
  }

  return (
    <div style={styles.container} role="region" aria-label="הערות לשאלה">
      <div style={styles.header}>
        <h3 style={styles.title}>הערות שלי</h3>
        <button
          style={{
            ...styles.bookmarkButton,
            ...(isBookmarked ? styles.bookmarkButtonActive : {})
          }}
          onClick={handleToggleBookmark}
          aria-label={isBookmarked ? 'הסר סימניה' : 'הוסף סימניה'}
          aria-pressed={isBookmarked}
        >
          {isBookmarked ? '🔖' : '🔖'}
        </button>
      </div>

      <FormField
        label="הערה"
        name="noteText"
        type="textarea"
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="הוסף הערה לשאלה זו..."
        rows={4}
      />

      <div style={styles.actions}>
        <button
          style={styles.saveButton}
          onClick={handleSaveNote}
          disabled={isSaving}
          aria-label="שמור הערה"
        >
          {isSaving ? 'שומר...' : 'שמור הערה'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginTop: '20px'
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#757575'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
    color: '#212121'
  },
  bookmarkButton: {
    backgroundColor: 'transparent',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '20px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  bookmarkButtonActive: {
    backgroundColor: '#fff9c4',
    borderColor: '#ffc107'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px'
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover:not(:disabled)': {
      backgroundColor: '#A50000'
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  }
};
