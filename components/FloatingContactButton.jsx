/**
 * FloatingContactButton — floating envelope icon that opens a contact / bug-report form.
 * Hebrew: כפתור יצירת קשר צף
 */
import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../utils/auth';
import { showToast } from './Toast';

export default function FloatingContactButton() {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    getCurrentUser().then(u => {
      if (u) {
        setFullName(u.full_name || '');
        setEmail(u.email || '');
        setUserId(u.user_id || null);
      }
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !message.trim()) {
      showToast('יש למלא את כל השדות', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          message: message.trim(),
          user_id: userId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'שגיאה בשליחה');
      }
      showToast('הפנייה נשלחה בהצלחה — תודה!', 'success');
      setMessage('');
      setOpen(false);
    } catch (err) {
      showToast('שגיאה בשליחת הפנייה: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Form modal */}
      {open && (
        <div style={styles.backdrop} onClick={() => setOpen(false)}>
          <div style={styles.card} onClick={e => e.stopPropagation()}>
            <div style={styles.header}>
              <span style={styles.title}>יצירת קשר</span>
              <button style={styles.closeBtn} onClick={() => setOpen(false)} aria-label="סגור">✕</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>שם מלא</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={styles.input}
                required
              />

              <label style={styles.label}>דוא״ל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
                dir="ltr"
                required
              />

              <label style={styles.label}>תיאור הבעיה / פנייה</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                style={styles.textarea}
                placeholder="תאר/י את הבעיה או הפנייה..."
                required
              />

              <button type="submit" style={styles.submitBtn} disabled={sending}>
                {sending ? 'שולח...' : 'שלח פנייה'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        style={styles.fab}
        onClick={() => setOpen(!open)}
        aria-label="יצירת קשר — דווח על בעיה"
        aria-expanded={open}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 4 12 13 2 4" />
        </svg>
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    right: '14px',
    bottom: '14px',
    zIndex: 9998,
    direction: 'rtl',
  },
  fab: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    backgroundColor: '#1565c0',
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 14px rgba(21,101,192,0.45)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
    padding: '16px',
  },
  card: {
    background: '#fff',
    borderRadius: '14px',
    maxWidth: '460px',
    width: '100%',
    boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #eee',
    background: '#f5f9ff',
  },
  title: {
    fontWeight: 700,
    fontSize: '18px',
    color: '#1565c0',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#999',
  },
  form: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
    marginTop: '6px',
  },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    direction: 'rtl',
  },
  textarea: {
    padding: '10px 12px',
    border: '1.5px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    direction: 'rtl',
  },
  submitBtn: {
    marginTop: '10px',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: '#1565c0',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
