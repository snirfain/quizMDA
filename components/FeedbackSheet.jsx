/**
 * Slide-in bottom feedback sheet for practice results
 * Hebrew: גיליון משוב תחתון
 */

import React from 'react';
import Icon from './Icon';
import { sanitizeHtml } from '../utils/sanitize';

export default function FeedbackSheet({
  open,
  isCorrect,
  explanation,
  hint,
  onClose,
  onNext,
  onBookmark,
  bookmarked = false,
  nextLabel = 'שאלה הבאה',
}) {
  if (!open) return null;

  return (
    <>
      <div
        className="feedback-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="feedback-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-sheet-title"
      >
        <div className="feedback-sheet-handle" aria-hidden="true" />
        <div
          id="feedback-sheet-title"
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 800,
            color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {isCorrect ? 'תשובה נכונה' : 'תשובה שגויה'}
        </div>

        {explanation && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              הסבר רפואי
            </h3>
            <div
              style={{ lineHeight: 'var(--line-height)', color: 'var(--color-text-2)' }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(explanation) }}
            />
          </div>
        )}

        {hint && !isCorrect && (
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'var(--color-warning-bg)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              color: 'var(--color-warning)',
            }}
          >
            <strong>רמז: </strong>
            {hint}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {onBookmark && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBookmark}
              aria-label={bookmarked ? 'הסר סימנייה' : 'סמן שאלה'}
            >
              <Icon name="bookmark" size={18} />
              {bookmarked ? 'מסומן' : 'סמן שאלה'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            סגור
          </button>
          {onNext && (
            <button type="button" className="btn btn-primary" onClick={onNext} style={{ flex: 1 }}>
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
