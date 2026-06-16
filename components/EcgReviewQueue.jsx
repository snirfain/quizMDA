/**
 * EcgReviewQueue — instructor review queue for trainee ECG submissions.
 * Shows image, the trainee's interpretation and tags; the instructor can edit
 * tags, write medical feedback, and approve/reject.
 * Hebrew: תור אישורי אקג למדריך.
 */
import React, { useEffect, useState } from 'react';
import { showToast } from './Toast';
import { SkeletonCard } from './Skeleton';

const FILTERS = [
  { key: 'pending', label: 'ממתינים' },
  { key: 'approved', label: 'אושרו' },
  { key: 'rejected', label: 'נדחו' },
  { key: 'all', label: 'הכל' },
];

export default function EcgReviewQueue() {
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState(null);
  const [drafts, setDrafts] = useState({}); // id -> { notes, tags, newTag, busy }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const load = async () => {
    setItems(null);
    try {
      const res = await fetch(`/api/ecg-submissions?status=${filter}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('שגיאת שרת');
      const list = await res.json();
      setItems(Array.isArray(list) ? list : []);
      const d = {};
      (list || []).forEach((s) => {
        d[s.id] = { notes: s.reviewer_notes || '', tags: [...(s.tags || [])], newTag: '', busy: false };
      });
      setDrafts(d);
    } catch (e) {
      showToast('טעינת תור האקג נכשלה', 'error');
      setItems([]);
    }
  };

  const patchDraft = (id, patch) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const addTag = (id) => {
    const d = drafts[id];
    const t = (d?.newTag || '').trim();
    if (!t) return;
    if (!d.tags.includes(t)) patchDraft(id, { tags: [...d.tags, t], newTag: '' });
    else patchDraft(id, { newTag: '' });
  };

  const removeTag = (id, tag) => patchDraft(id, { tags: drafts[id].tags.filter((t) => t !== tag) });

  const review = async (id, status) => {
    const d = drafts[id];
    if (status === 'rejected' && !d.notes.trim()) {
      showToast('נא לכתוב משוב לפני דחייה', 'warning');
      return;
    }
    patchDraft(id, { busy: true });
    try {
      const res = await fetch(`/api/ecg-submissions/${id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewer_notes: d.notes, tags: d.tags }),
      });
      if (!res.ok) {
        const ed = await res.json().catch(() => ({}));
        throw new Error(ed.error || 'העדכון נכשל');
      }
      showToast(status === 'approved' ? 'ההגשה אושרה' : 'ההגשה נדחתה', 'success');
      load();
    } catch (e) {
      showToast(e?.message || 'שגיאה בעדכון', 'error');
      patchDraft(id, { busy: false });
    }
  };

  return (
    <div style={styles.wrap} dir="rtl">
      <div style={styles.filterBar}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            style={{ ...styles.filterBtn, ...(filter === f.key ? styles.filterBtnActive : {}) }}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <SkeletonCard height={260} />
      ) : items.length === 0 ? (
        <div style={styles.empty}>אין הגשות בתצוגה זו.</div>
      ) : (
        <div style={styles.grid}>
          {items.map((s) => {
            const d = drafts[s.id] || { notes: '', tags: [], newTag: '', busy: false };
            return (
              <div key={s.id} className="card card-elevated" style={styles.card}>
                <a href={s.image_url} target="_blank" rel="noreferrer" style={styles.imgLink}>
                  <img src={s.image_url} alt="אקג שהוגש" style={styles.img} />
                </a>
                <div style={styles.body}>
                  <div style={styles.metaRow}>
                    <span style={styles.user}>{s.user_name || s.user_id}</span>
                    <span style={styles.date}>{new Date(s.createdAt).toLocaleDateString('he-IL')}</span>
                  </div>

                  <div style={styles.block}>
                    <span style={styles.blockLabel}>הפיענוח של החניך</span>
                    <p style={styles.interp}>{s.user_interpretation}</p>
                  </div>

                  <div style={styles.block}>
                    <span style={styles.blockLabel}>תגיות</span>
                    <div style={styles.tags}>
                      {d.tags.map((t) => (
                        <span key={t} style={styles.tag}>
                          {t}
                          <button type="button" onClick={() => removeTag(s.id, t)} style={styles.tagX} aria-label={`הסר ${t}`}>✕</button>
                        </span>
                      ))}
                    </div>
                    <div style={styles.addTagRow}>
                      <input
                        type="text"
                        value={d.newTag}
                        onChange={(e) => patchDraft(s.id, { newTag: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(s.id))}
                        placeholder="הוסף תגית..."
                        style={styles.addTagInput}
                      />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTag(s.id)}>הוסף</button>
                    </div>
                  </div>

                  <div style={styles.block}>
                    <label style={styles.blockLabel} htmlFor={`notes-${s.id}`}>משוב רפואי</label>
                    <textarea
                      id={`notes-${s.id}`}
                      value={d.notes}
                      onChange={(e) => patchDraft(s.id, { notes: e.target.value })}
                      rows={3}
                      placeholder="כתבו משוב לחניך..."
                      style={styles.textarea}
                    />
                  </div>

                  {s.status !== 'pending' && (
                    <div style={styles.prevStatus}>
                      סטטוס נוכחי: <strong>{s.status === 'approved' ? 'אושר' : 'נדחה'}</strong>
                    </div>
                  )}

                  <div style={styles.actions}>
                    <button type="button" className="btn btn-primary" disabled={d.busy} onClick={() => review(s.id, 'approved')}>
                      אישור
                    </button>
                    <button type="button" className="btn btn-danger" disabled={d.busy} onClick={() => review(s.id, 'rejected')}>
                      דחייה
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { direction: 'rtl' },
  filterBar: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' },
  filterBtn: {
    padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-mid)',
    background: 'var(--color-bg-card)', color: 'var(--color-text-2)', cursor: 'pointer', fontWeight: 600,
  },
  filterBtnActive: { background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderColor: 'var(--color-primary)' },
  empty: { textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-lg)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 'var(--space-4)' },
  card: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  imgLink: { display: 'block' },
  img: { width: '100%', height: 200, objectFit: 'cover', background: 'var(--color-bg-hover)', display: 'block' },
  body: { padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' },
  metaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  user: { fontWeight: 700, color: 'var(--color-text)' },
  date: { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' },
  block: { display: 'flex', flexDirection: 'column', gap: 6 },
  blockLabel: { fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' },
  interp: { margin: 0, color: 'var(--color-text)', whiteSpace: 'pre-wrap' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
    background: 'var(--color-primary-bg)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-sm)', fontWeight: 600,
  },
  tagX: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, padding: 0, lineHeight: 1 },
  addTagRow: { display: 'flex', gap: 'var(--space-2)' },
  addTagInput: {
    flex: 1, padding: '6px var(--space-2)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', direction: 'rtl', background: 'var(--color-bg-card)', color: 'var(--color-text)',
  },
  textarea: {
    width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', fontFamily: 'inherit', direction: 'rtl', resize: 'vertical',
    background: 'var(--color-bg-card)', color: 'var(--color-text)',
  },
  prevStatus: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-2)' },
  actions: { display: 'flex', gap: 'var(--space-2)' },
};
