/**
 * SyncIndicator — חיווי עדין בזמן סנכרון בנק השאלות מהשרת ל-IndexedDB.
 * מאזין לאירוע quizMDA:questions-sync שנורה מ-mockEntities.js ומציג
 * "מסתנכרן מול פרוטוקולי מד״א (X / N שאלות)...".
 */
import React, { useEffect, useRef, useState } from 'react';
import { SYNC_EVENT } from '../mockEntities';

const nf = new Intl.NumberFormat('he-IL');

// Inject the spinner keyframes once.
if (typeof document !== 'undefined' && !document.getElementById('sync-indicator-kf')) {
  const el = document.createElement('style');
  el.id = 'sync-indicator-kf';
  el.textContent = '@keyframes mdaSyncSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(el);
}

export default function SyncIndicator() {
  const [status, setStatus] = useState(
    (typeof window !== 'undefined' && window.__quizMDA_syncStatus) || null
  );
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const onSync = (e) => {
      const detail = e.detail || {};
      setStatus(detail);
      if (detail.phase === 'start' || detail.phase === 'progress') {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setVisible(true);
      } else if (detail.phase === 'done') {
        // Show a brief confirmation, then fade out.
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setVisible(false), 2500);
      } else if (detail.phase === 'error') {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setVisible(false), 4000);
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    // If a sync is already in progress when we mount, reflect it.
    if (status && (status.phase === 'start' || status.phase === 'progress')) setVisible(true);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible || !status) return null;

  const loaded = nf.format(status.loaded || 0);
  const total = status.total ? nf.format(status.total) : null;
  const isError = status.phase === 'error';
  const isDone = status.phase === 'done';

  let text;
  if (isError) {
    text = 'הסנכרון נכשל — נעשה שימוש בנתונים השמורים במכשיר';
  } else if (isDone) {
    text = `הסנכרון הושלם · ${loaded} שאלות`;
  } else {
    text = total
      ? `מסתנכרן מול פרוטוקולי מד״א (${loaded} / ${total} שאלות)...`
      : `מסתנכרן מול פרוטוקולי מד״א (${loaded} שאלות)...`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        insetInlineStart: '50%',
        transform: 'translateX(50%)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: '92vw',
        padding: '10px 16px',
        borderRadius: 999,
        background: isError ? '#c62828' : 'var(--color-bg-card, #fff)',
        color: isError ? '#fff' : 'var(--color-text, #1a1a1a)',
        border: `1px solid ${isError ? '#c62828' : 'var(--color-border, #e0e0e0)'}`,
        boxShadow: '0 6px 24px rgba(0,0,0,0.16)',
        fontSize: 14,
        fontWeight: 600,
        direction: 'rtl',
      }}
    >
      {!isError && !isDone && (
        <span
          aria-hidden="true"
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid var(--color-border, #ccc)',
            borderTopColor: 'var(--color-primary, #1565c0)',
            animation: 'mdaSyncSpin 0.8s linear infinite',
            flexShrink: 0,
          }}
        />
      )}
      {isDone && <span aria-hidden="true">✅</span>}
      <span>{text}</span>
    </div>
  );
}
