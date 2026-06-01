/**
 * QuestionReviewEditor — shared editable review for ALL import/generation flows.
 * Hebrew: עריכת שאלות לפני אישור
 *
 * Renders one fully-editable card per draft question so the user can change
 * EVERY element before approving: type, text, category, sub-category, thinking
 * level, training level, medical levels, status, options (labels + which is
 * correct), and explanation / model answer. Nothing is saved automatically —
 * the parent provides an explicit "save" action via onSave.
 *
 * Draft question shape (also produced by the AI flows):
 *   {
 *     id, include, question_type, question_text,
 *     options: [{ label, isCorrect }],   // choice / true_false
 *     model_answer,                       // open_ended
 *     category, sub_category, thinking_level, training_level,
 *     medical_levels: string[], explanation, status
 *   }
 */

import React, { useMemo, useState } from 'react';
import {
  QUESTION_CATEGORIES,
  THINKING_LEVELS,
  TRAINING_LEVELS,
  MEDICAL_LEVELS,
  QUESTION_STATUSES,
  getSubcategoriesForCategory,
} from '../shared/questionBankMetadata.js';

const C = {
  primary: '#2196F3',
  border: '#e0e0e0',
  bg: '#f7f9fc',
  text: '#333',
  muted: '#777',
  ok: '#2e7d32',
  okBg: '#e8f5e9',
  err: '#f44336',
};

const EDITOR_TYPES = [
  { value: 'single_choice', label: 'רב ברירה — תשובה אחת' },
  { value: 'multi_choice', label: 'רב ברירה — כמה תשובות' },
  { value: 'true_false', label: 'נכון / לא נכון' },
  { value: 'open_ended', label: 'שאלה פתוחה' },
];

const PAGE_SIZE = 20;

/** Transform a draft's options when its question_type changes. */
function optionsForType(prev, type) {
  if (type === 'open_ended') return prev.options || [];
  if (type === 'true_false') {
    return [
      { label: 'נכון', isCorrect: true },
      { label: 'לא נכון', isCorrect: false },
    ];
  }
  let opts = Array.isArray(prev.options) && prev.options.length >= 2
    ? prev.options.map((o) => ({ label: o.label, isCorrect: !!o.isCorrect }))
    : [
        { label: '', isCorrect: true },
        { label: '', isCorrect: false },
        { label: '', isCorrect: false },
        { label: '', isCorrect: false },
      ];
  if (type === 'single_choice') {
    // Keep only the first correct option as the single answer.
    let seen = false;
    opts = opts.map((o) => {
      if (o.isCorrect && !seen) { seen = true; return o; }
      return { ...o, isCorrect: false };
    });
    if (!seen && opts.length) opts[0].isCorrect = true;
  }
  return opts;
}

export default function QuestionReviewEditor({
  questions,
  onChange,
  onSave,
  saving = false,
  saveLabel,
  title = 'סקירה ועריכה לפני אישור',
}) {
  const [page, setPage] = useState(0);

  const selectedCount = useMemo(() => questions.filter((q) => q.include).length, [questions]);
  const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = questions.slice(start, start + PAGE_SIZE);

  const update = (id, patch) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const updateOptions = (id, mapper) => {
    const q = questions.find((x) => x.id === id);
    if (!q) return;
    update(id, { options: mapper(q.options || []) });
  };

  const setAllInclude = (val) => onChange(questions.map((q) => ({ ...q, include: val })));
  const removeQuestion = (id) => onChange(questions.filter((q) => q.id !== id));

  const handleTypeChange = (q, type) => {
    update(q.id, { question_type: type, options: optionsForType(q, type) });
  };

  const handleCategoryChange = (q, category) => {
    const subs = getSubcategoriesForCategory(category);
    update(q.id, { category, sub_category: subs[0] || '' });
  };

  const toggleMedical = (q, val) => {
    const cur = Array.isArray(q.medical_levels) ? q.medical_levels : [];
    update(q.id, {
      medical_levels: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val],
    });
  };

  return (
    <section style={styles.wrap}>
      <div style={styles.head}>
        <h2 style={styles.title}>{title} ({questions.length})</h2>
        <div style={styles.headActions}>
          <button type="button" onClick={() => setAllInclude(true)} style={styles.linkBtn}>בחר הכל</button>
          <button type="button" onClick={() => setAllInclude(false)} style={styles.linkBtn}>נקה</button>
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(questions.filter((q) => q.include))}
              disabled={saving || selectedCount === 0}
              style={{ ...styles.primaryBtn, opacity: saving || selectedCount === 0 ? 0.6 : 1 }}
            >
              {saving ? 'שומר…' : (saveLabel || `אשר ושמור נבחרות (${selectedCount})`)}
            </button>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div style={styles.pager}>
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} style={styles.pagerBtn}>‹ הקודם</button>
          <span style={styles.muted}>שאלות {start + 1}–{Math.min(start + PAGE_SIZE, questions.length)} מתוך {questions.length}</span>
          <button type="button" onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} style={styles.pagerBtn}>הבא ›</button>
        </div>
      )}

      <div style={styles.list}>
        {visible.map((q, vi) => {
          const subs = getSubcategoriesForCategory(q.category);
          const idxLabel = start + vi + 1;
          const isChoice = q.question_type === 'single_choice' || q.question_type === 'multi_choice' || q.question_type === 'true_false';
          return (
            <article key={q.id} style={{ ...styles.card, borderColor: q.include ? C.primary : C.border }}>
              <div style={styles.cardHead}>
                <label style={styles.includeLabel}>
                  <input type="checkbox" checked={!!q.include} onChange={() => update(q.id, { include: !q.include })} />
                  <span style={styles.qNum}>#{idxLabel}</span>
                </label>
                <div style={styles.headRight}>
                  <select value={q.question_type} onChange={(e) => handleTypeChange(q, e.target.value)} style={styles.selectSm}>
                    {EDITOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removeQuestion(q.id)} style={styles.removeBtn} title="הסר שאלה">✕</button>
                </div>
              </div>

              <label style={styles.fieldLabel}>טקסט השאלה</label>
              <textarea
                value={q.question_text}
                onChange={(e) => update(q.id, { question_text: e.target.value })}
                style={styles.textarea}
                rows={2}
              />

              <div style={styles.grid}>
                <div>
                  <label style={styles.fieldLabel}>נושא</label>
                  <select value={q.category || ''} onChange={(e) => handleCategoryChange(q, e.target.value)} style={styles.select}>
                    <option value="">— בחר —</option>
                    {QUESTION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>תת-נושא</label>
                  <select value={q.sub_category || ''} onChange={(e) => update(q.id, { sub_category: e.target.value })} style={styles.select}>
                    <option value="">— בחר —</option>
                    {subs.map((s) => <option key={s} value={s}>{s}</option>)}
                    {q.sub_category && !subs.includes(q.sub_category) && (
                      <option value={q.sub_category}>{q.sub_category} (מותאם)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>רמת חשיבה</label>
                  <select value={q.thinking_level || ''} onChange={(e) => update(q.id, { thinking_level: e.target.value })} style={styles.select}>
                    {THINKING_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>רמת קושי (הכשרה)</label>
                  <select value={q.training_level || ''} onChange={(e) => update(q.id, { training_level: e.target.value })} style={styles.select}>
                    {TRAINING_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>סטטוס</label>
                  <select value={q.status || 'under_review'} onChange={(e) => update(q.id, { status: e.target.value })} style={styles.select}>
                    {QUESTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>רמות רפואיות</label>
                  <div style={styles.chipRow}>
                    {MEDICAL_LEVELS.map((m) => {
                      const on = (q.medical_levels || []).includes(m.value);
                      return (
                        <button key={m.value} type="button" onClick={() => toggleMedical(q, m.value)} style={{ ...styles.chip, ...(on ? styles.chipOn : {}) }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Options / model answer */}
              {q.question_type === 'open_ended' ? (
                <>
                  <label style={styles.fieldLabel}>תשובת מופת</label>
                  <textarea
                    value={q.model_answer || ''}
                    onChange={(e) => update(q.id, { model_answer: e.target.value })}
                    style={styles.textarea}
                    rows={2}
                  />
                </>
              ) : (
                <>
                  <label style={styles.fieldLabel}>
                    אפשרויות {q.question_type === 'multi_choice' ? '(סמן/י את כל הנכונות)' : '(בחר/י את הנכונה)'}
                  </label>
                  <div style={styles.optList}>
                    {(q.options || []).map((opt, oi) => (
                      <div key={oi} style={{ ...styles.optRow, ...(opt.isCorrect ? styles.optRowCorrect : {}) }}>
                        <input
                          type={q.question_type === 'multi_choice' ? 'checkbox' : 'radio'}
                          name={`correct-${q.id}`}
                          checked={!!opt.isCorrect}
                          onChange={() => {
                            if (q.question_type === 'multi_choice') {
                              updateOptions(q.id, (opts) => opts.map((o, i) => (i === oi ? { ...o, isCorrect: !o.isCorrect } : o)));
                            } else {
                              updateOptions(q.id, (opts) => opts.map((o, i) => ({ ...o, isCorrect: i === oi })));
                            }
                          }}
                          title="סמן כתשובה נכונה"
                        />
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => updateOptions(q.id, (opts) => opts.map((o, i) => (i === oi ? { ...o, label: e.target.value } : o)))}
                          disabled={q.question_type === 'true_false'}
                          style={styles.optInput}
                          placeholder={`אפשרות ${oi + 1}`}
                        />
                        {q.question_type !== 'true_false' && (q.options || []).length > 2 && (
                          <button
                            type="button"
                            onClick={() => updateOptions(q.id, (opts) => opts.filter((_, i) => i !== oi))}
                            style={styles.optRemove}
                            title="הסר אפשרות"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {q.question_type !== 'true_false' && (
                    <button
                      type="button"
                      onClick={() => updateOptions(q.id, (opts) => [...opts, { label: '', isCorrect: false }])}
                      style={styles.addOptBtn}
                    >
                      + הוסף אפשרות
                    </button>
                  )}
                </>
              )}

              <label style={styles.fieldLabel}>הסבר</label>
              <textarea
                value={q.explanation || ''}
                onChange={(e) => update(q.id, { explanation: e.target.value })}
                style={styles.textarea}
                rows={2}
              />
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={styles.pager}>
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} style={styles.pagerBtn}>‹ הקודם</button>
          <span style={styles.muted}>עמוד {safePage + 1} / {totalPages}</span>
          <button type="button" onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} style={styles.pagerBtn}>הבא ›</button>
        </div>
      )}

      {onSave && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => onSave(questions.filter((q) => q.include))}
            disabled={saving || selectedCount === 0}
            style={{ ...styles.primaryBtn, opacity: saving || selectedCount === 0 ? 0.6 : 1 }}
          >
            {saving ? 'שומר…' : (saveLabel || `אשר ושמור נבחרות (${selectedCount})`)}
          </button>
        </div>
      )}
    </section>
  );
}

const styles = {
  wrap: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 700, margin: 0 },
  headActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  pager: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, margin: '10px 0' },
  pagerBtn: { padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { border: '2px solid', borderRadius: 10, padding: 14, background: '#fff' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 },
  includeLabel: { display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  qNum: { fontWeight: 700, color: C.muted },
  headRight: { display: 'flex', alignItems: 'center', gap: 8 },
  removeBtn: { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.err, cursor: 'pointer', fontSize: 14 },
  fieldLabel: { display: 'block', fontWeight: 600, fontSize: 13, margin: '10px 0 4px', color: C.text },
  textarea: { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 6 },
  select: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: '#fff' },
  selectSm: { padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: '#fff' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { padding: '5px 10px', borderRadius: 16, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  chipOn: { background: C.primary, color: '#fff', borderColor: C.primary },
  optList: { display: 'flex', flexDirection: 'column', gap: 6 },
  optRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: C.bg },
  optRowCorrect: { background: C.okBg },
  optInput: { flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit' },
  optRemove: { width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.err, cursor: 'pointer', fontSize: 13 },
  addOptBtn: { marginTop: 6, padding: '7px 14px', borderRadius: 8, border: `1px dashed ${C.primary}`, background: '#f1f8ff', color: C.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  primaryBtn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700 },
  linkBtn: { background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 14, fontWeight: 600, textDecoration: 'underline' },
  muted: { color: C.muted, fontSize: 13 },
};
