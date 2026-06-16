/**
 * ConsentGate — a hard bottom banner shown to signed-in users who have not yet
 * accepted the cookies + Terms-of-Service consent. Persists to localStorage
 * (to avoid re-prompting) and records it on the user's profile in the DB.
 * Hebrew: באנר הסכמת קוקיז ותנאי שימוש (GDPR/TOS).
 */
import React, { useEffect, useState } from 'react';

const CONSENT_KEY = 'quizmda_consent_v1';

export default function ConsentGate({ user }) {
  const [needed, setNeeded] = useState(false);
  const [cookies, setCookies] = useState(false);
  const [tos, setTos] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setNeeded(false);
      return;
    }
    let localOk = false;
    try {
      localOk = localStorage.getItem(CONSENT_KEY) === '1';
    } catch (_) {
      /* ignore */
    }
    const profileOk = user.tos_accepted === true && user.cookies_accepted === true;
    if (profileOk && !localOk) {
      try {
        localStorage.setItem(CONSENT_KEY, '1');
      } catch (_) {
        /* ignore */
      }
    }
    setNeeded(!localOk && !profileOk);
  }, [user]);

  const accept = async () => {
    if (!cookies || !tos) return;
    setSaving(true);
    try {
      localStorage.setItem(CONSENT_KEY, '1');
    } catch (_) {
      /* ignore */
    }
    // Best-effort DB record; the local flag already prevents re-prompting.
    try {
      await fetch('/api/users/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tos_accepted: true, cookies_accepted: true }),
      });
    } catch (_) {
      /* ignore network errors — local consent stands */
    }
    setSaving(false);
    setNeeded(false);
  };

  if (!needed) return null;

  return (
    <>
      <div style={styles.scrim} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label="הסכמת שימוש" dir="rtl" style={styles.banner}>
        <div style={styles.content}>
          <h2 style={styles.title}>פרטיות ותנאי שימוש</h2>
          <p style={styles.lead}>כדי להמשיך, יש לאשר את התנאים הבאים:</p>

          <label style={styles.check}>
            <input type="checkbox" checked={cookies} onChange={(e) => setCookies(e.target.checked)} />
            <span>אני מאשר/ת שימוש בקוקיז לצורך חוויית הלמידה</span>
          </label>
          <label style={styles.check}>
            <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} />
            <span>
              אני מסכים/ה ל
              <a href="/help" style={styles.link}>תנאי השימוש ומדיניות הפרטיות</a>
              {' '}של quizMDA
            </span>
          </label>

          <div style={styles.actions}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={accept}
              disabled={!cookies || !tos || saving}
            >
              {saving ? 'שומר...' : 'אישור והמשך'}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

const styles = {
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4900,
  },
  banner: {
    position: 'fixed', insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, zIndex: 5000,
    background: 'var(--color-bg-card)', borderTop: '3px solid var(--color-primary)',
    boxShadow: '0 -8px 28px rgba(0,0,0,0.25)', padding: 'var(--space-5) var(--space-4) calc(env(safe-area-inset-bottom, 0px) + var(--space-5))',
    direction: 'rtl',
  },
  content: { maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  title: { margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text)' },
  lead: { margin: '0 0 var(--space-2)', color: 'var(--color-text-muted)' },
  check: { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', color: 'var(--color-text)', fontSize: 'var(--font-size-base)', cursor: 'pointer', lineHeight: 1.5 },
  link: { color: 'var(--color-primary)', fontWeight: 600 },
  actions: { marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-start' },
};
