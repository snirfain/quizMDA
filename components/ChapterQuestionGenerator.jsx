/**
 * Chapter Question Generator
 * Hebrew: מחולל שאלות מתוך פרק ספר (AI)
 *
 * Paste a book chapter, define how many questions of each difficulty /
 * thinking-level / type you want, and OpenAI returns relevant questions grounded
 * in the chapter. Review the results and save the ones you like to the bank.
 */

import React, { useMemo, useState } from 'react';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import QuestionReviewEditor from './QuestionReviewEditor';
import { entities, appConfig } from '../config/appConfig';
import { navigateTo } from '../utils/router';
import {
  QUESTION_CATEGORIES,
  THINKING_LEVELS,
  TRAINING_LEVELS,
  MEDICAL_LEVELS,
  QUESTION_STATUSES,
  getSubcategoriesForCategory,
} from '../shared/questionBankMetadata.js';
import {
  generateQuestionsFromChapter,
  toCanonicalQuestionPayload,
  GENERATOR_QUESTION_TYPES,
  MAX_PER_ROW,
} from '../workflows/chapterQuestionGen';

const C = {
  primary: '#2196F3',
  border: '#e0e0e0',
  bg: '#f7f9fc',
  text: '#333',
  muted: '#777',
  ok: '#4CAF50',
  warn: '#ff9800',
  err: '#f44336',
};

const TYPE_LABEL = Object.fromEntries(GENERATOR_QUESTION_TYPES.map((t) => [t.value, t.label]));

let _rowSeq = 0;
function newRow(overrides = {}) {
  _rowSeq += 1;
  return {
    rowId: `row_${_rowSeq}`,
    count: 5,
    question_type: 'single_choice',
    training_level: 'A',
    thinking_level: 'Knowledge',
    ...overrides,
  };
}

export default function ChapterQuestionGenerator() {
  const firstCat = QUESTION_CATEGORIES[0]?.value || '';
  const [chapterText, setChapterText] = useState('');
  const [category, setCategory] = useState(firstCat);
  const [subCategory, setSubCategory] = useState(getSubcategoriesForCategory(firstCat)[0] || '');
  const [medicalLevels, setMedicalLevels] = useState([]);
  const [status, setStatus] = useState('under_review');
  const [specs, setSpecs] = useState([newRow()]);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [providerNote, setProviderNote] = useState('');
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);

  const subCategories = useMemo(() => getSubcategoriesForCategory(category), [category]);
  const apiKeyMissing = !appConfig.openai?.getApiKey?.();

  const totalRequested = specs.reduce((s, r) => s + (Number(r.count) || 0), 0);

  // ── Spec row handlers ──────────────────────────────────────
  const updateRow = (rowId, patch) =>
    setSpecs((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const addRow = () => setSpecs((prev) => [...prev, newRow()]);
  const removeRow = (rowId) =>
    setSpecs((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));

  const onCategoryChange = (val) => {
    setCategory(val);
    setSubCategory(getSubcategoriesForCategory(val)[0] || '');
  };

  const toggleMedicalLevel = (val) =>
    setMedicalLevels((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));

  // ── Generate ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (apiKeyMissing) {
      showToast('מפתח OpenAI אינו מוגדר (VITE_OPENAI_API_KEY).', 'error');
      return;
    }
    if (chapterText.trim().length < 40) {
      showToast('הדביקו תוכן פרק מהותי לפני יצירה.', 'error');
      return;
    }
    setGenerating(true);
    setResults([]);
    setWarnings([]);
    setProgress('מתחיל…');
    setProviderNote('');

    try {
      const cleanSpecs = specs.map((r) => ({
        count: Math.max(1, Math.min(MAX_PER_ROW, Number(r.count) || 1)),
        question_type: r.question_type,
        training_level: r.training_level,
        thinking_level: r.thinking_level,
      }));

      const { questions, warnings: warns } = await generateQuestionsFromChapter({
        chapterText,
        specs: cleanSpecs,
        category,
        subCategory,
        onProgress: (p) => {
          const typeName = TYPE_LABEL[p.spec.question_type] || p.spec.question_type;
          if (p.stage === 'spec') {
            setProgress(`שורה ${p.current}/${p.total} — ${typeName}: מייצר ${p.target} שאלות…`);
          } else if (p.stage === 'batch') {
            setProgress(`שורה ${p.current}/${p.total} — ${typeName}: ${p.collected}/${p.target} שאלות…`);
          } else if (p.stage === 'spec-done') {
            setProgress(`שורה ${p.current}/${p.total} — ${typeName}: הופקו ${p.produced}/${p.target}.`);
          }
        },
        onProviderEvent: (e) => {
          if (e.stage === 'attempt') setProviderNote(`פונה ל-${e.provider}…`);
          if (e.stage === 'failure') setProviderNote(`שגיאת ${e.provider}: ${e.message}`);
        },
      });

      // Seed per-question tags from the form so each one is fully editable in
      // the review step (category/sub/medical/status are global defaults here).
      const seeded = questions.map((q) => ({
        ...q,
        category: q.category || category,
        sub_category: q.sub_category || subCategory,
        medical_levels: q.medical_levels || medicalLevels,
        status: q.status || status,
      }));
      setResults(seeded);
      setWarnings(warns || []);
      showToast(`נוצרו ${seeded.length} שאלות. סקרו, ערכו ואשרו את הרצויות.`, 'success');
    } catch (err) {
      console.error('[ChapterQuestionGenerator] generate failed:', err);
      showToast(err.message || 'יצירת השאלות נכשלה.', 'error');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  // ── Save selected (manual approval; nothing auto-approves) ──
  const handleSaveSelected = async (chosenArg) => {
    const chosen = (chosenArg || results).filter((r) => r.include);
    if (!chosen.length) {
      showToast('בחרו לפחות שאלה אחת לשמירה.', 'error');
      return;
    }
    setSaving(true);
    let ok = 0;
    const failed = [];

    for (const genQ of chosen) {
      try {
        // Per-question fields (edited in the review step) take precedence.
        const payload = toCanonicalQuestionPayload(genQ, { category, subCategory, status, medicalLevels });
        await entities.Question_Bank.create(payload);
        ok += 1;
      } catch (err) {
        console.error('[ChapterQuestionGenerator] save failed:', err);
        failed.push(genQ.question_text.slice(0, 40));
      }
    }

    setSaving(false);
    if (ok) {
      showToast(`${ok} שאלות נשמרו למאגר.`, 'success');
      const savedIds = new Set(chosen.map((q) => q.id));
      setResults((prev) => prev.filter((r) => !savedIds.has(r.id)));
    }
    if (failed.length) {
      showToast(`${failed.length} שאלות לא נשמרו. נסו שוב.`, 'error');
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={styles.page} dir="rtl">
      <div style={styles.header}>
        <h1 style={styles.title}>מחולל שאלות מתוך פרק (AI)</h1>
        <p style={styles.subtitle}>
          הדביקו פרק מתוך ספר, הגדירו כמה שאלות מכל רמת קושי, רמת חשיבה וסוג — והמערכת תפיק שאלות
          רלוונטיות באמצעות OpenAI. סקרו ושמרו את השאלות הרצויות למאגר.
        </p>
      </div>

      {apiKeyMissing && (
        <div style={{ ...styles.banner, background: '#fff3e0', color: '#e65100', borderColor: '#ffb74d' }}>
          ⚠️ מפתח OpenAI אינו מוגדר (VITE_OPENAI_API_KEY). יצירת שאלות לא תעבוד עד שיוגדר.
        </div>
      )}

      {/* Chapter input */}
      <section style={styles.card}>
        <label style={styles.label}>תוכן הפרק</label>
        <textarea
          style={styles.textarea}
          value={chapterText}
          onChange={(e) => setChapterText(e.target.value)}
          placeholder="הדביקו כאן את תוכן הפרק מהספר…"
          rows={12}
        />
        <div style={styles.charCount}>{chapterText.trim().length.toLocaleString('he-IL')} תווים</div>
      </section>

      {/* Classification + metadata */}
      <section style={styles.card}>
        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>נושא (פרק)</label>
            <select style={styles.select} value={category} onChange={(e) => onCategoryChange(e.target.value)}>
              {QUESTION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>תת-נושא</label>
            <select style={styles.select} value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
              {subCategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>סטטוס לשמירה</label>
            <select style={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              {QUESTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>רמות רפואיות (אופציונלי)</label>
            <div style={styles.chipRow}>
              {MEDICAL_LEVELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleMedicalLevel(m.value)}
                  style={{
                    ...styles.chip,
                    ...(medicalLevels.includes(m.value) ? styles.chipActive : {}),
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Spec rows */}
      <section style={styles.card}>
        <div style={styles.cardHead}>
          <h2 style={styles.cardTitle}>בקשת שאלות</h2>
          <span style={styles.muted}>סה"כ מבוקש: {totalRequested}</span>
        </div>

        <div style={styles.specHeaderRow}>
          <span style={{ flex: '0 0 80px' }}>כמות</span>
          <span style={{ flex: 2 }}>סוג שאלה</span>
          <span style={{ flex: 2 }}>רמת קושי (הכשרה)</span>
          <span style={{ flex: 2 }}>רמת חשיבה</span>
          <span style={{ flex: '0 0 40px' }} />
        </div>

        {specs.map((row) => (
          <div key={row.rowId} style={styles.specRow}>
            <input
              type="number"
              min={1}
              max={MAX_PER_ROW}
              value={row.count}
              onChange={(e) => updateRow(row.rowId, { count: e.target.value })}
              style={{ ...styles.select, flex: '0 0 80px' }}
            />
            <select
              value={row.question_type}
              onChange={(e) => updateRow(row.rowId, { question_type: e.target.value })}
              style={{ ...styles.select, flex: 2 }}
            >
              {GENERATOR_QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={row.training_level}
              onChange={(e) => updateRow(row.rowId, { training_level: e.target.value })}
              style={{ ...styles.select, flex: 2 }}
            >
              {TRAINING_LEVELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={row.thinking_level}
              onChange={(e) => updateRow(row.rowId, { thinking_level: e.target.value })}
              style={{ ...styles.select, flex: 2 }}
            >
              {THINKING_LEVELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(row.rowId)}
              disabled={specs.length <= 1}
              style={{ ...styles.iconBtn, opacity: specs.length <= 1 ? 0.4 : 1 }}
              title="הסר שורה"
            >
              ✕
            </button>
          </div>
        ))}

        <button type="button" onClick={addRow} style={styles.addBtn}>+ הוסף שורת בקשה</button>
      </section>

      {/* Generate action */}
      <div style={styles.actionsRow}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || apiKeyMissing}
          style={{ ...styles.primaryBtn, opacity: generating || apiKeyMissing ? 0.6 : 1 }}
        >
          {generating ? 'מייצר…' : 'צור שאלות'}
        </button>
        {generating && (
          <span style={styles.progress}>
            <LoadingSpinner size="sm" /> {progress} {providerNote}
          </span>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ ...styles.banner, background: '#fff8e1', color: '#8a6d00', borderColor: '#ffe082' }}>
          {warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <QuestionReviewEditor
            questions={results}
            onChange={setResults}
            onSave={handleSaveSelected}
            saving={saving}
            title="שאלות שנוצרו — ערכו ואשרו"
          />
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button type="button" onClick={() => navigateTo('/instructor/questions')} style={styles.linkBtn}>
              מעבר לניהול שאלות ←
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '24px 16px', color: C.text },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { color: C.muted, marginTop: 8, lineHeight: 1.6 },
  banner: { padding: '12px 16px', borderRadius: 8, border: '1px solid', marginBottom: 16, fontSize: 14, lineHeight: 1.6 },
  card: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 600, margin: 0 },
  label: { display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 },
  charCount: { textAlign: 'left', color: C.muted, fontSize: 12, marginTop: 4 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 12 },
  select: { width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '7px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  chipActive: { background: C.primary, color: '#fff', borderColor: C.primary },
  specHeaderRow: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: C.muted, fontWeight: 600, padding: '0 4px 6px' },
  specRow: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 },
  iconBtn: { flex: '0 0 40px', height: 38, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 16, color: C.err },
  addBtn: { marginTop: 4, padding: '9px 16px', borderRadius: 8, border: `1px dashed ${C.primary}`, background: '#f1f8ff', color: C.primary, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  actionsRow: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
  primaryBtn: { padding: '12px 28px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 },
  progress: { display: 'inline-flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 14 },
  muted: { color: C.muted, fontSize: 13 },
  resultsList: { display: 'flex', flexDirection: 'column', gap: 12 },
  qCard: { border: '2px solid', borderRadius: 10, padding: 14, background: '#fff' },
  qHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  includeLabel: { display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  qNum: { fontWeight: 700, color: C.muted },
  badges: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  badge: { padding: '3px 10px', borderRadius: 12, background: '#e3f2fd', color: '#1565c0', fontSize: 12, fontWeight: 600 },
  qText: { fontSize: 16, fontWeight: 600, lineHeight: 1.6, margin: '0 0 10px' },
  optList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  optItem: { padding: '8px 12px', borderRadius: 6, background: C.bg, fontSize: 14 },
  optCorrect: { background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 },
  modelAnswer: { padding: '10px 12px', borderRadius: 6, background: '#e8f5e9', color: '#2e7d32', fontSize: 14, lineHeight: 1.6 },
  explanation: { marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#fffde7', color: '#827717', fontSize: 13, lineHeight: 1.6 },
  linkBtn: { background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 14, fontWeight: 600, textDecoration: 'underline' },
};
