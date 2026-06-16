/**
 * EcgUploadPanel — trainee uploads an ECG image, writes their interpretation,
 * and tags it (multi-select with inline "create new tag"). Lists past submissions.
 * Hebrew: העלאת אקג, פיענוח ותיוג להגשה לבדיקת מדריך.
 */
import React, { useEffect, useRef, useState } from 'react';
import { showToast } from './Toast';

const STATUS_META = {
  pending: { label: 'ממתין לבדיקה', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  approved: { label: 'אושר', bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  rejected: { label: 'נדחה', bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
};

export default function EcgUploadPanel() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [interpretation, setInterpretation] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mySubs, setMySubs] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadTags();
    loadMySubmissions();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadTags = async () => {
    try {
      const res = await fetch('/api/ecg-submissions/tags', { cache: 'no-store' });
      if (res.ok) {
        const tags = await res.json();
        if (Array.isArray(tags)) setAvailableTags(tags);
      }
    } catch (e) {
      console.error('ECG tags load error:', e);
    }
  };

  const loadMySubmissions = async () => {
    try {
      const res = await fetch('/api/ecg-submissions/mine', { cache: 'no-store' });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) setMySubs(list);
      }
    } catch (e) {
      console.error('ECG mine load error:', e);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('יש להעלות קובץ תמונה בלבד', 'warning');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addNewTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (!availableTags.includes(t)) setAvailableTags((prev) => [...prev, t]);
    if (!selectedTags.includes(t)) setSelectedTags((prev) => [...prev, t]);
    setNewTag('');
  };

  const handleNewTagKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewTag();
    }
  };

  const resetForm = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setInterpretation('');
    setSelectedTags([]);
    setNewTag('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!file) {
      showToast('יש להעלות תמונת אקג', 'warning');
      return;
    }
    if (!interpretation.trim()) {
      showToast('יש למלא את שדה "הפיענוח שלי"', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      // 1) Upload the image to Cloudinary via the existing media endpoint.
      const fd = new FormData();
      fd.append('file', file);
      const upRes = await fetch('/api/upload-media', { method: 'POST', body: fd });
      if (!upRes.ok) {
        const ed = await upRes.json().catch(() => ({}));
        throw new Error(ed.error || ed.details || 'העלאת התמונה נכשלה');
      }
      const { url } = await upRes.json();
      if (!url) throw new Error('לא התקבל קישור לתמונה');

      // 2) Create the submission.
      const subRes = await fetch('/api/ecg-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: url,
          user_interpretation: interpretation.trim(),
          tags: selectedTags,
        }),
      });
      if (!subRes.ok) {
        const ed = await subRes.json().catch(() => ({}));
        throw new Error(ed.error || 'שמירת ההגשה נכשלה');
      }

      showToast('האקג נשלח לבדיקת מדריך בהצלחה', 'success');
      resetForm();
      loadMySubmissions();
      loadTags();
    } catch (e) {
      showToast(e?.message || 'שגיאה בשליחת האקג', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrap} dir="rtl">
      <div className="card card-elevated" style={styles.card}>
        <h2 style={styles.title}>העלאת אקג לבדיקה</h2>
        <p style={styles.subtitle}>העלו תמונת אקג, כתבו את הפיענוח שלכם ותייגו — מדריך יבדוק וייתן משוב.</p>

        {/* Image upload */}
        <label style={styles.fieldLabel}>תמונת אקג <span style={styles.req}>*</span></label>
        <div
          style={styles.dropZone}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          aria-label="העלאת תמונת אקג"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="תצוגה מקדימה של האקג" style={styles.preview} />
          ) : (
            <div style={styles.dropHint}>
              <span style={{ fontSize: 32 }}>📈</span>
              <span>לחצו לבחירת תמונת אקג</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Interpretation */}
        <label htmlFor="ecg-interp" style={styles.fieldLabel}>הפיענוח שלי <span style={styles.req}>*</span></label>
        <textarea
          id="ecg-interp"
          value={interpretation}
          onChange={(e) => setInterpretation(e.target.value)}
          placeholder="תארו את הקצב, מרווחים, ממצאים חריגים והאבחנה שלכם..."
          rows={5}
          style={styles.textarea}
        />

        {/* Tags */}
        <label style={styles.fieldLabel}>תגיות</label>
        {availableTags.length > 0 && (
          <div style={styles.tagCloud}>
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{ ...styles.tagChip, ...(active ? styles.tagChipActive : {}) }}
                  aria-pressed={active}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
        <div style={styles.newTagRow}>
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleNewTagKey}
            placeholder="הוספת תגית חדשה..."
            style={styles.newTagInput}
            aria-label="הוספת תגית חדשה"
          />
          <button type="button" className="btn btn-secondary" onClick={addNewTag} disabled={!newTag.trim()}>
            הוסף תגית
          </button>
        </div>
        {selectedTags.length > 0 && (
          <div style={styles.selectedRow}>
            <span style={styles.selectedLabel}>נבחרו:</span>
            {selectedTags.map((t) => (
              <span key={t} style={styles.selectedTag}>
                {t}
                <button type="button" onClick={() => toggleTag(t)} style={styles.removeTag} aria-label={`הסר ${t}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ marginTop: 'var(--space-5)' }}
        >
          {submitting ? 'שולח...' : 'שלח לבדיקה'}
        </button>
      </div>

      {/* My submissions */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <h3 style={styles.sectionHeading}>ההגשות שלי</h3>
        {mySubs.length === 0 ? (
          <p style={styles.muted}>עדיין לא הגשת אקג לבדיקה.</p>
        ) : (
          <div style={styles.subsGrid}>
            {mySubs.map((s) => {
              const meta = STATUS_META[s.status] || STATUS_META.pending;
              return (
                <div key={s.id} className="card" style={styles.subCard}>
                  <img src={s.image_url} alt="אקג שהוגש" style={styles.subImg} />
                  <div style={styles.subBody}>
                    <span style={{ ...styles.badge, background: meta.bg, color: meta.color }}>{meta.label}</span>
                    <p style={styles.subInterp}>{s.user_interpretation}</p>
                    {s.tags?.length > 0 && (
                      <div style={styles.subTags}>
                        {s.tags.map((t) => <span key={t} style={styles.miniTag}>{t}</span>)}
                      </div>
                    )}
                    {s.reviewer_notes && (
                      <div style={styles.feedback}>
                        <strong>משוב המדריך:</strong> {s.reviewer_notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { direction: 'rtl', maxWidth: 760, margin: '0 auto' },
  card: { padding: 'var(--space-6)' },
  title: { margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text)' },
  subtitle: { margin: '0 0 var(--space-5)', color: 'var(--color-text-muted)' },
  fieldLabel: { display: 'block', fontWeight: 700, margin: 'var(--space-4) 0 var(--space-2)', color: 'var(--color-text-2)' },
  req: { color: 'var(--color-danger)' },
  dropZone: {
    border: '2px dashed var(--color-border-mid)', borderRadius: 'var(--radius-lg)',
    minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', background: 'var(--color-bg-hover)', overflow: 'hidden', padding: 'var(--space-3)',
  },
  dropHint: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)' },
  preview: { maxWidth: '100%', maxHeight: 320, borderRadius: 'var(--radius-md)' },
  textarea: {
    width: '100%', padding: 'var(--space-3)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)', fontFamily: 'inherit',
    direction: 'rtl', resize: 'vertical', background: 'var(--color-bg-card)', color: 'var(--color-text)',
  },
  tagCloud: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-3)' },
  tagChip: {
    padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-mid)',
    background: 'var(--color-bg-card)', color: 'var(--color-text-2)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
  },
  tagChipActive: { background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderColor: 'var(--color-primary)' },
  newTagRow: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' },
  newTagInput: {
    flex: '1 1 200px', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)', direction: 'rtl',
    background: 'var(--color-bg-card)', color: 'var(--color-text)',
  },
  selectedRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 'var(--space-3)' },
  selectedLabel: { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' },
  selectedTag: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
    background: 'var(--color-primary-bg)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-sm)', fontWeight: 600,
  },
  removeTag: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, lineHeight: 1, padding: 0 },
  sectionHeading: { margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' },
  muted: { color: 'var(--color-text-muted)' },
  subsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 'var(--space-4)' },
  subCard: { overflow: 'hidden', padding: 0 },
  subImg: { width: '100%', height: 160, objectFit: 'cover', display: 'block', background: 'var(--color-bg-hover)' },
  subBody: { padding: 'var(--space-4)' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' },
  subInterp: { margin: '0 0 var(--space-2)', color: 'var(--color-text)', fontSize: 'var(--font-size-base)', whiteSpace: 'pre-wrap' },
  subTags: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-2)' },
  miniTag: { padding: '2px 8px', background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-full)', fontSize: 12, color: 'var(--color-text-2)' },
  feedback: {
    marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-info-bg)',
    borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text)',
  },
};
