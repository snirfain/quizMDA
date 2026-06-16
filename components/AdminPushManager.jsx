/**
 * AdminPushManager — manager/admin control panel.
 *  • Tab 1: schedule web-push notifications (timing, title, body) + history.
 *  • Tab 2: author the dedicated daily-challenge questions + archive list.
 * Hebrew: לוח בקרה לניהול התראות פוש ואתגרים יומיים.
 */
import React, { useEffect, useState } from 'react';
import { showToast } from './Toast';
import { SkeletonCard } from './Skeleton';

const PUSH_STATUS = {
  scheduled: { label: 'מתוזמן', color: 'var(--color-info)' },
  sent: { label: 'נשלח', color: 'var(--color-success)' },
  failed: { label: 'נכשל', color: 'var(--color-danger)' },
  cancelled: { label: 'בוטל', color: 'var(--color-text-muted)' },
};

function PushTab() {
  const [form, setForm] = useState({ title: '', body: '', url: '/', send_at: '' });
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/notifications/scheduled', { cache: 'no-store' });
      setList(res.ok ? await res.json() : []);
    } catch (_) {
      setList([]);
    }
  };

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('יש למלא כותרת ותוכן', 'warning');
      return;
    }
    setSaving(true);
    try {
      const send_at = form.send_at ? new Date(form.send_at).toISOString() : new Date().toISOString();
      const res = await fetch('/api/notifications/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title.trim(), body: form.body.trim(), url: form.url.trim() || '/', send_at }),
      });
      if (!res.ok) {
        const ed = await res.json().catch(() => ({}));
        throw new Error(ed.error || 'התזמון נכשל');
      }
      showToast('ההתראה תוזמנה בהצלחה', 'success');
      setForm({ title: '', body: '', url: '/', send_at: '' });
      load();
    } catch (e) {
      showToast(e?.message || 'שגיאה בתזמון', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    try {
      const res = await fetch(`/api/notifications/scheduled/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const ed = await res.json().catch(() => ({}));
        throw new Error(ed.error || 'הביטול נכשל');
      }
      showToast('ההתראה בוטלה', 'success');
      load();
    } catch (e) {
      showToast(e?.message || 'שגיאה בביטול', 'error');
    }
  };

  return (
    <div>
      <div className="card card-elevated" style={styles.formCard}>
        <h3 style={styles.formTitle}>תזמון התראה חדשה</h3>
        <label style={styles.label}>כותרת</label>
        <input style={styles.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="לדוגמה: אתגר חדש זמין!" />
        <label style={styles.label}>תוכן ההתראה</label>
        <textarea style={styles.textarea} rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="גוף ההודעה שתוצג למשתמשים" />
        <div style={styles.row2}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>קישור בלחיצה</label>
            <input style={styles.input} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="/practice" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>מועד שליחה (ריק = מיידי)</label>
            <input type="datetime-local" style={styles.input} value={form.send_at} onChange={(e) => setForm({ ...form, send_at: e.target.value })} />
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving} style={{ marginTop: 'var(--space-4)' }}>
          {saving ? 'שומר...' : 'תזמן התראה'}
        </button>
      </div>

      <h3 style={styles.listTitle}>התראות שתוזמנו</h3>
      {list === null ? (
        <SkeletonCard height={120} />
      ) : list.length === 0 ? (
        <p style={styles.muted}>אין התראות מתוזמנות.</p>
      ) : (
        <div style={styles.itemsCol}>
          {list.map((p) => {
            const st = PUSH_STATUS[p.status] || PUSH_STATUS.scheduled;
            return (
              <div key={p.id} className="card" style={styles.pushItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.pushHead}>
                    <strong style={styles.pushTitle}>{p.title}</strong>
                    <span style={{ ...styles.statusChip, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={styles.pushBody}>{p.body}</div>
                  <div style={styles.pushMeta}>
                    מועד: {new Date(p.send_at).toLocaleString('he-IL')}
                    {p.status === 'sent' && ` · נשלחו ${p.sent_count}, נכשלו ${p.failed_count}`}
                  </div>
                </div>
                {p.status === 'scheduled' && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => cancel(p.id)}>ביטול</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function emptyOptions() {
  return [
    { label: '' },
    { label: '' },
    { label: '' },
    { label: '' },
  ];
}

function ChallengeTab() {
  const [form, setForm] = useState({
    challenge_date: '',
    question_text: '',
    options: emptyOptions(),
    correct: '0',
    explanation: '',
    category: '',
  });
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/challenges/admin', { cache: 'no-store' });
      setList(res.ok ? await res.json() : []);
    } catch (_) {
      setList([]);
    }
  };

  const setOptionLabel = (i, label) => {
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? { label } : o)) }));
  };
  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, { label: '' }] }));
  const removeOption = (i) =>
    setForm((f) => {
      const options = f.options.filter((_, idx) => idx !== i);
      let correct = f.correct;
      if (Number(correct) >= options.length) correct = '0';
      return { ...f, options, correct };
    });

  const submit = async () => {
    const cleanOptions = form.options
      .map((o, i) => ({ value: String(i), label: o.label.trim() }))
      .filter((o) => o.label);
    if (!form.challenge_date) return showToast('יש לבחור תאריך', 'warning');
    if (!form.question_text.trim()) return showToast('יש למלא נוסח שאלה', 'warning');
    if (cleanOptions.length < 2) return showToast('יש להגדיר לפחות שתי אפשרויות', 'warning');
    if (Number(form.correct) >= cleanOptions.length) return showToast('בחר תשובה נכונה תקפה', 'warning');

    setSaving(true);
    try {
      const res = await fetch('/api/challenges/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_date: form.challenge_date,
          question_text: form.question_text.trim(),
          options: cleanOptions,
          correct_answer: String(form.correct),
          explanation: form.explanation.trim(),
          category: form.category.trim(),
        }),
      });
      if (!res.ok) {
        const ed = await res.json().catch(() => ({}));
        throw new Error(ed.error || 'השמירה נכשלה');
      }
      showToast('האתגר נשמר בהצלחה', 'success');
      setForm({ challenge_date: '', question_text: '', options: emptyOptions(), correct: '0', explanation: '', category: '' });
      load();
    } catch (e) {
      showToast(e?.message || 'שגיאה בשמירת האתגר', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      const res = await fetch(`/api/challenges/admin/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const ed = await res.json().catch(() => ({}));
        throw new Error(ed.error || 'המחיקה נכשלה');
      }
      showToast('האתגר נמחק', 'success');
      load();
    } catch (e) {
      showToast(e?.message || 'שגיאה במחיקה', 'error');
    }
  };

  return (
    <div>
      <div className="card card-elevated" style={styles.formCard}>
        <h3 style={styles.formTitle}>יצירת / עדכון אתגר יומי</h3>
        <div style={styles.row2}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>תאריך האתגר</label>
            <input type="date" style={styles.input} value={form.challenge_date} onChange={(e) => setForm({ ...form, challenge_date: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>קטגוריה (אופציונלי)</label>
            <input style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
        </div>
        <label style={styles.label}>נוסח השאלה</label>
        <textarea style={styles.textarea} rows={3} value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} />

        <label style={styles.label}>אפשרויות (סמן את הנכונה)</label>
        {form.options.map((o, i) => (
          <div key={i} style={styles.optionRow}>
            <input
              type="radio"
              name="correct-option"
              checked={String(form.correct) === String(i)}
              onChange={() => setForm({ ...form, correct: String(i) })}
              aria-label={`סמן אפשרות ${i + 1} כנכונה`}
            />
            <input
              style={{ ...styles.input, margin: 0, flex: 1 }}
              value={o.label}
              onChange={(e) => setOptionLabel(i, e.target.value)}
              placeholder={`אפשרות ${i + 1}`}
            />
            {form.options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} style={styles.removeOpt} aria-label="הסר אפשרות">✕</button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addOption} style={{ marginTop: 6 }}>+ הוסף אפשרות</button>

        <label style={styles.label}>הסבר (יוצג לאחר מענה)</label>
        <textarea style={styles.textarea} rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />

        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving} style={{ marginTop: 'var(--space-4)' }}>
          {saving ? 'שומר...' : 'שמירת אתגר'}
        </button>
      </div>

      <h3 style={styles.listTitle}>אתגרים קיימים</h3>
      {list === null ? (
        <SkeletonCard height={120} />
      ) : list.length === 0 ? (
        <p style={styles.muted}>עדיין לא נוצרו אתגרים.</p>
      ) : (
        <div style={styles.itemsCol}>
          {list.map((c) => (
            <div key={c.id} className="card" style={styles.pushItem}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.pushHead}>
                  <strong style={styles.pushTitle}>{c.challenge_date}</strong>
                  {c.category && <span style={styles.statusChip}>{c.category}</span>}
                </div>
                <div style={styles.pushBody}>{c.question_text}</div>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>מחיקה</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPushManager() {
  const [tab, setTab] = useState('push');
  return (
    <div style={styles.wrap} dir="rtl">
      <h1 style={styles.pageTitle}>ניהול התראות ואתגרים</h1>
      <div className="tabs" role="tablist" style={styles.tabs}>
        <button className={`tab-btn ${tab === 'push' ? 'active' : ''}`} onClick={() => setTab('push')} role="tab" aria-selected={tab === 'push'}>
          התראות מתוזמנות
        </button>
        <button className={`tab-btn ${tab === 'challenge' ? 'active' : ''}`} onClick={() => setTab('challenge')} role="tab" aria-selected={tab === 'challenge'}>
          אתגרים יומיים
        </button>
      </div>
      {tab === 'push' ? <PushTab /> : <ChallengeTab />}
    </div>
  );
}

const styles = {
  wrap: { direction: 'rtl', maxWidth: 820, margin: '0 auto' },
  pageTitle: { margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text)' },
  tabs: { display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' },
  formCard: { padding: 'var(--space-5)', marginBottom: 'var(--space-6)' },
  formTitle: { margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' },
  label: { display: 'block', fontWeight: 700, margin: 'var(--space-3) 0 6px', color: 'var(--color-text-2)', fontSize: 'var(--font-size-sm)' },
  input: {
    width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)', direction: 'rtl',
    background: 'var(--color-bg-card)', color: 'var(--color-text)', fontFamily: 'inherit',
  },
  textarea: {
    width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)', direction: 'rtl', resize: 'vertical',
    background: 'var(--color-bg-card)', color: 'var(--color-text)', fontFamily: 'inherit',
  },
  row2: { display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' },
  optionRow: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 6 },
  removeOpt: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16, padding: 4 },
  listTitle: { margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' },
  muted: { color: 'var(--color-text-muted)' },
  itemsCol: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  pushItem: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)' },
  pushHead: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 },
  pushTitle: { color: 'var(--color-text)' },
  statusChip: { fontSize: 'var(--font-size-sm)', fontWeight: 700, padding: '2px 8px', background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-full)' },
  pushBody: { color: 'var(--color-text-2)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pushMeta: { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 4 },
};
