/**
 * AI File Ingestion
 * Hebrew: קליטת קובץ שאלות עם AI
 *
 * Upload a question file (xlsx/csv) where each row has a question and an
 * "answers" cell (options separated by " || ", correct one tagged "(Correct)").
 * The system fixes spelling, classifies category / sub-category / thinking level,
 * adds explanations, randomizes option order, and saves to the bank.
 */

import React, { useRef, useState } from 'react';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import QuestionReviewEditor from './QuestionReviewEditor';
import { entities, appConfig } from '../config/appConfig';
import { navigateTo } from '../utils/router';
import {
  TRAINING_LEVELS,
  MEDICAL_LEVELS,
  QUESTION_STATUSES,
  QUESTION_CATEGORIES,
} from '../shared/questionBankMetadata.js';
import { parseIngestFile, buildRawQuestions, tagAndCorrectQuestions } from '../workflows/aiFileIngest';
import { toCanonicalQuestionPayload } from '../workflows/chapterQuestionGen';

const C = {
  primary: '#2196F3',
  border: '#e0e0e0',
  bg: '#f7f9fc',
  text: '#333',
  muted: '#777',
  ok: '#4CAF50',
  err: '#f44336',
};

export default function AiFileIngest() {
  const [fileName, setFileName] = useState('');
  const [rawQuestions, setRawQuestions] = useState([]);
  const [parseInfo, setParseInfo] = useState(null); // { total, skipped, single, multi }
  const [parsing, setParsing] = useState(false);

  const [trainingLevel, setTrainingLevel] = useState('A');
  const [medicalLevels, setMedicalLevels] = useState([]);
  const [status, setStatus] = useState('under_review');
  const [fallbackCategory, setFallbackCategory] = useState(QUESTION_CATEGORIES[0]?.value || '');

  const [tagging, setTagging] = useState(false);
  const [progress, setProgress] = useState('');
  const [providerNote, setProviderNote] = useState('');
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');

  const fileRef = useRef(null);
  const apiKeyMissing = !appConfig.openai?.getApiKey?.();

  const toggleMedicalLevel = (val) =>
    setMedicalLevels((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));

  // ── File select & structural parse ─────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResults([]);
    setWarnings([]);
    setParseInfo(null);
    setFileName(file.name);
    try {
      const { records } = await parseIngestFile(file);
      const { questions, skipped } = buildRawQuestions(records);
      setRawQuestions(questions);
      setParseInfo({
        total: questions.length,
        skipped,
        single: questions.filter((q) => q.question_type === 'single_choice').length,
        multi: questions.filter((q) => q.question_type === 'multi_choice').length,
      });
      if (!questions.length) {
        showToast('לא זוהו שאלות תקינות בקובץ. בדקו שהעמודות הן question_text ו-answers.', 'error');
      } else {
        showToast(`זוהו ${questions.length} שאלות מהקובץ.`, 'success');
      }
    } catch (err) {
      console.error('[AiFileIngest] parse failed:', err);
      showToast(`שגיאה בקריאת הקובץ: ${err.message}`, 'error');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── AI tag + correct ───────────────────────────────────────
  const handleTag = async () => {
    if (apiKeyMissing) {
      showToast('מפתח OpenAI אינו מוגדר (VITE_OPENAI_API_KEY).', 'error');
      return;
    }
    if (!rawQuestions.length) {
      showToast('העלו קובץ עם שאלות קודם.', 'error');
      return;
    }
    setTagging(true);
    setResults([]);
    setWarnings([]);
    setProgress(`מעבד ${rawQuestions.length} שאלות…`);
    setProviderNote('');

    try {
      const { questions, warnings: warns } = await tagAndCorrectQuestions(rawQuestions, {
        defaults: {
          training_level: trainingLevel,
          medical_levels: medicalLevels,
          status,
          category: fallbackCategory,
        },
        onProgress: (done, total) => setProgress(`מתקן ומתייג עם AI — ${done}/${total} מנות…`),
        onProviderEvent: (ev) => {
          if (ev.stage === 'attempt') setProviderNote(`פונה ל-${ev.provider}…`);
          if (ev.stage === 'failure') setProviderNote(`שגיאת ${ev.provider}: ${ev.message}`);
        },
      });
      // Seed per-question medical levels + status (global defaults) so every
      // field is editable in the review step.
      const seeded = questions.map((q) => ({
        ...q,
        medical_levels: q.medical_levels && q.medical_levels.length ? q.medical_levels : medicalLevels,
        status: q.status || status,
      }));
      setResults(seeded);
      setWarnings(warns || []);
      showToast(`${seeded.length} שאלות תוקנו ותויגו. סקרו, ערכו ואשרו.`, 'success');
    } catch (err) {
      console.error('[AiFileIngest] tagging failed:', err);
      showToast(err.message || 'התיוג נכשל.', 'error');
    } finally {
      setTagging(false);
      setProgress('');
    }
  };

  // ── Save to bank (manual approval) ─────────────────────────
  const handleSave = async (chosenArg) => {
    const chosen = (chosenArg || results).filter((r) => r.include);
    if (!chosen.length) {
      showToast('בחרו לפחות שאלה אחת לשמירה.', 'error');
      return;
    }
    setSaving(true);
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < chosen.length; i++) {
      const q = chosen[i];
      try {
        const payload = toCanonicalQuestionPayload(q, {
          category: q.category,
          subCategory: q.sub_category,
          status,
          medicalLevels,
        });
        await entities.Question_Bank.create(payload);
        ok += 1;
      } catch (err) {
        console.error('[AiFileIngest] save failed:', err);
        failed += 1;
      }
      if (i % 10 === 0 || i === chosen.length - 1) {
        setSaveProgress(`נשמרו ${ok}/${chosen.length}…`);
      }
    }
    setSaving(false);
    setSaveProgress('');
    if (ok) {
      showToast(`${ok} שאלות נשמרו למאגר.`, 'success');
      setResults((prev) => prev.filter((r) => !r.include));
    }
    if (failed) showToast(`${failed} שאלות לא נשמרו.`, 'error');
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={styles.page} dir="rtl">
      <div style={styles.header}>
        <h1 style={styles.title}>קליטת קובץ שאלות עם AI</h1>
        <p style={styles.subtitle}>
          העלו קובץ (Excel/CSV) שבו כל שורה היא שאלה ועמודת תשובות (אפשרויות מופרדות ב-<code>||</code>,
          הנכונה מסומנת <code>(Correct)</code>). המערכת תתקן שגיאות כתיב, תסווג נושא/תת-נושא/רמת חשיבה,
          תוסיף הסבר, תערבב את סדר התשובות ותשמור למאגר.
        </p>
      </div>

      {apiKeyMissing && (
        <div style={{ ...styles.banner, background: '#fff3e0', color: '#e65100', borderColor: '#ffb74d' }}>
          ⚠️ מפתח OpenAI אינו מוגדר (VITE_OPENAI_API_KEY). תיקון ותיוג עם AI לא יעבדו עד שיוגדר.
        </div>
      )}

      {/* File upload */}
      <section style={styles.card}>
        <label style={styles.label}>קובץ שאלות (Excel / CSV)</label>
        <div style={styles.uploadRow}>
          <button type="button" style={styles.secondaryBtn} onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? 'קורא…' : 'בחר קובץ'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          {fileName && <span style={styles.muted}>{fileName}</span>}
        </div>
        {parseInfo && (
          <div style={styles.parseInfo}>
            זוהו <strong>{parseInfo.total}</strong> שאלות
            {' '}(<span>{parseInfo.single} תשובה אחת</span>, <span>{parseInfo.multi} כמה תשובות</span>)
            {parseInfo.skipped > 0 && <span> · {parseInfo.skipped} שורות דולגו (ללא תשובה נכונה/אפשרויות)</span>}
          </div>
        )}
      </section>

      {/* Defaults */}
      <section style={styles.card}>
        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>רמת קושי (הכשרה) — תחול על כל השאלות</label>
            <select style={styles.select} value={trainingLevel} onChange={(e) => setTrainingLevel(e.target.value)}>
              {TRAINING_LEVELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>סטטוס לשמירה</label>
            <select style={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              {QUESTION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>רמות רפואיות (אופציונלי)</label>
            <div style={styles.chipRow}>
              {MEDICAL_LEVELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleMedicalLevel(m.value)}
                  style={{ ...styles.chip, ...(medicalLevels.includes(m.value) ? styles.chipActive : {}) }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={styles.label}>נושא ברירת מחדל (אם ה-AI לא יזהה)</label>
            <select style={styles.select} value={fallbackCategory} onChange={(e) => setFallbackCategory(e.target.value)}>
              {QUESTION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Tag action */}
      <div style={styles.actionsRow}>
        <button
          type="button"
          onClick={handleTag}
          disabled={tagging || apiKeyMissing || !rawQuestions.length}
          style={{ ...styles.primaryBtn, opacity: tagging || apiKeyMissing || !rawQuestions.length ? 0.6 : 1 }}
        >
          {tagging ? 'מעבד…' : 'תקן, תייג ושמור עם AI'}
        </button>
        {tagging && (
          <span style={styles.progress}>
            <LoadingSpinner size="sm" /> {progress} {providerNote}
          </span>
        )}
      </div>
      {rawQuestions.length > 60 && !tagging && results.length === 0 && (
        <div style={styles.note}>
          שים לב: עיבוד {rawQuestions.length} שאלות מבוצע במנות ויכול לקחת כמה דקות (קריאות רבות ל-OpenAI).
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ ...styles.banner, background: '#fff8e1', color: '#8a6d00', borderColor: '#ffe082' }}>
          {warnings.length} מנות נכשלו בתיוג ונשמרו עם תגיות ברירת מחדל. ניתן לערוך אותן בניהול שאלות.
        </div>
      )}

      {/* Results — fully editable review; nothing saves until you approve */}
      {results.length > 0 && (
        <>
          <QuestionReviewEditor
            questions={results}
            onChange={setResults}
            onSave={handleSave}
            saving={saving}
            saveLabel={saving ? (saveProgress || 'שומר…') : undefined}
            title="שאלות מוכנות — ערכו ואשרו"
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
  subtitle: { color: C.muted, marginTop: 8, lineHeight: 1.7 },
  banner: { padding: '12px 16px', borderRadius: 8, border: '1px solid', marginBottom: 16, fontSize: 14, lineHeight: 1.6 },
  card: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 600, margin: 0 },
  label: { display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 },
  uploadRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  parseInfo: { marginTop: 12, padding: '10px 12px', borderRadius: 8, background: C.bg, fontSize: 14, lineHeight: 1.6 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 12 },
  select: { width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '7px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  chipActive: { background: C.primary, color: '#fff', borderColor: C.primary },
  actionsRow: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 8 },
  primaryBtn: { padding: '12px 28px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 },
  secondaryBtn: { padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.primary}`, background: '#f1f8ff', color: C.primary, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  progress: { display: 'inline-flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 14 },
  note: { color: C.muted, fontSize: 13, marginBottom: 12 },
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
  subTag: { marginTop: 8, fontSize: 13, color: C.muted },
  explanation: { marginTop: 8, padding: '8px 12px', borderRadius: 6, background: '#fffde7', color: '#827717', fontSize: 13, lineHeight: 1.6 },
  linkBtn: { background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 14, fontWeight: 600, textDecoration: 'underline' },
};
