/**
 * Question Import Component — Smart Edition
 * Supports: free-text paste, Word/PDF upload, CSV/JSON
 * Hebrew: ייבוא שאלות חכם
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  previewQuestions,
  parseCSV,
  parseJSON,
  parseMoodleExcel,
  extractTextFromFile,
  parseQuestionsWithAI,
} from '../workflows/questionImport';
import { parseTextQuestions } from '../utils/questionParser';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import QuestionReviewEditor from './QuestionReviewEditor';
import { entities, appConfig } from '../config/appConfig';
import { toCanonicalQuestionPayload } from '../workflows/chapterQuestionGen';
import { QUESTION_CATEGORIES, THINKING_LEVELS, TRAINING_LEVELS } from '../shared/questionBankMetadata.js';

const DEFAULT_THINKING = THINKING_LEVELS[0]?.value || 'remember_understand';
const DEFAULT_TRAINING = TRAINING_LEVELS[0]?.value || 'A';

/**
 * Convert a parsed/AI question (native import shape) into the editable draft
 * shape consumed by QuestionReviewEditor. Tags identified by the AI during
 * analysis are carried through; missing ones fall back to sane defaults so the
 * user can review and approve every field.
 */
function toReviewDraft(q, idx) {
  let parsed = {};
  try {
    const raw = q.correct_answer ?? '{}';
    parsed = typeof raw === 'object' && raw !== null ? raw : JSON.parse(raw);
  } catch { /* not JSON */ }

  const type = q.question_type || 'single_choice';
  let options = [];
  let model_answer = '';

  if (type === 'open_ended') {
    const v = parsed.value ?? q.model_answer ?? q.correct_answer ?? '';
    model_answer = typeof v === 'string' ? v : '';
  } else if (type === 'true_false') {
    const cv = parsed.values
      ? parsed.values.map(String)
      : (parsed.value != null ? [String(parsed.value)] : []);
    const trueCorrect = cv.length
      ? cv.some((v) => v === 'true' || v === '0' || v === 'נכון')
      : true;
    options = [
      { label: 'נכון', isCorrect: trueCorrect },
      { label: 'לא נכון', isCorrect: !trueCorrect },
    ];
  } else {
    const rawOptions = parsed.options || q.options || [];
    const norm = rawOptions.map((o, i) => ({
      value: String(o?.value ?? i),
      label: o?.label ?? o?.text ?? String(o ?? ''),
    }));
    const correctVal = parsed.value != null ? String(parsed.value) : null;
    const correctVals = parsed.values
      ? parsed.values.map(String)
      : (correctVal != null ? [correctVal] : []);
    const isCorrect = (opt, i) => {
      if (!correctVals.length) return false;
      if (correctVals.includes(opt.value) || correctVals.includes(String(i))) return true;
      return correctVals.some((cv) => opt.label.includes(cv) || cv.includes(opt.label));
    };
    options = norm.map((o, i) => ({ label: o.label, isCorrect: !!isCorrect(o, i) }));
  }

  return {
    id: q.id || `imp-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    include: true,
    question_type: type,
    question_text: q.question_text || '',
    options,
    model_answer,
    category: q.category || '',
    sub_category: q.sub_category || '',
    thinking_level: q.thinking_level || DEFAULT_THINKING,
    training_level: q.training_level || DEFAULT_TRAINING,
    medical_levels: Array.isArray(q.medical_levels) ? q.medical_levels : [],
    explanation: q.explanation || q.hint || '',
    status: q.status || 'under_review',
  };
}

const TABS = [
  { id: 'text',    label: '📋 הדבקת טקסט',      desc: 'הדבק שאלות בפורמט חופשי' },
  { id: 'file',    label: '📁 קובץ Word / PDF',   desc: 'גרור או בחר קובץ' },
  { id: 'csv',     label: '🗂️ CSV / JSON',        desc: 'ייבוא מובנה' },
];

export default function QuestionImport({ onImportComplete }) {
  const [activeTab, setActiveTab]           = useState('text');
  const [rawText, setRawText]               = useState('');
  const [parsedQuestions, setParsed]        = useState(null);   // array after analysis
  const [isAnalyzing, setAnalyzing]         = useState(false);
  const [aiProgress, setAiProgress]         = useState(null);   // { done, total } during AI analysis
  const [isImporting, setImporting]         = useState(false);
  const [importProgress, setProgress]       = useState(null);
  const [dragOver, setDragOver]             = useState(false);
  // Multi-file upload
  const [uploadedFiles, setUploadedFiles]   = useState([]);   // [{id,name,status,text,questions,progress,error}]
  const [isAnalyzingFiles, setAnalyzingFiles] = useState(false);
  // Editable review drafts (derived from parsedQuestions; nothing auto-saves)
  const [reviewDrafts, setReviewDrafts]     = useState([]);

  // CSV/JSON/Excel state (kept from original; Excel added without replacing)
  const [csvType, setCsvType]           = useState('csv');
  const [csvContent, setCsvContent]     = useState('');
  const [csvXlsxBuffer, setCsvXlsxBuffer] = useState(null);  // ArrayBuffer for Moodle Excel
  const [csvPreview, setCsvPreview]     = useState(null);
  const [llmRuntime, setLlmRuntime]     = useState({ provider: '', fallbackUsed: false, lastError: '' });

  const [defaultCategory, setDefaultCategory] = useState(QUESTION_CATEGORIES[0]?.value ?? '');

  const fileInputRef = useRef(null);

  const handleProviderEvent = useCallback((event) => {
    if (!event) return;
    if (event.stage === 'success') {
      setLlmRuntime((prev) => ({ ...prev, provider: event.provider, fallbackUsed: !!event.isFallback, lastError: '' }));
    }
    if (event.stage === 'failure') {
      setLlmRuntime((prev) => ({ ...prev, lastError: `${event.provider}: ${event.message || 'שגיאה לא ידועה'}` }));
    }
  }, []);

  // ── Multi-file Drag & Drop ───────────────────────────
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) await processFiles(files);
  }, []);

  const handleFilePick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await processFiles(files);
    e.target.value = '';   // allow re-selecting same files
  };

  const removeUploadedFile = (id) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  /**
   * Extract text from multiple files in parallel.
   * Each file gets its own status entry so the UI can reflect per-file progress.
   */
  const processFiles = async (files) => {
    setParsed(null);
    // Add all files as "pending" first so UI shows them immediately
    const newEntries = files.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      name: file.name,
      status: 'extracting',   // extracting | ready | error
      text: '',
      questions: [],
      progress: null,
      error: null,
    }));
    setUploadedFiles(prev => [...prev, ...newEntries]);

    // Extract text in parallel
    await Promise.all(newEntries.map(async (entry, i) => {
      try {
        const text = await extractTextFromFile(files[i]);
        setUploadedFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'ready', text } : f
        ));
      } catch (err) {
        setUploadedFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'error', error: err.message } : f
        ));
      }
    }));
  };

  /**
   * Run AI analysis on all ready files in parallel.
   * Each file is analysed independently; results are merged into parsedQuestions.
   */
  const analyzeAllFiles = async () => {
    const readyFiles = uploadedFiles.filter(f => f.status === 'ready' && f.text);
    if (!readyFiles.length) { showToast('אין קבצים מוכנים לניתוח', 'error'); return; }

    setAnalyzingFiles(true);
    setParsed(null);

    // Reset per-file progress
    setUploadedFiles(prev => prev.map(f =>
      f.status === 'ready' ? { ...f, status: 'analyzing', questions: [], progress: null } : f
    ));

    // Analyse each file; allow up to 3 concurrent file analyses
    const CONCURRENT = 3;
    const results = [];

    const tasks = readyFiles.map(entry => async () => {
      try {
        const result = await parseQuestionsWithAI(entry.text, (done, total) => {
          setUploadedFiles(prev => prev.map(f =>
            f.id === entry.id ? { ...f, progress: { done, total } } : f
          ));
        }, handleProviderEvent);
        const questions = result.questions || result;
        const tagged = (Array.isArray(questions) ? questions : []).map(q => ({ ...q, _sourceFile: entry.name }));
        setUploadedFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'done', questions: tagged, progress: null } : f
        ));
        return { questions: tagged };
      } catch (err) {
        setUploadedFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'error', error: err.message, progress: null } : f
        ));
        return { questions: [] };
      }
    });

    // Run in batches of CONCURRENT
    for (let i = 0; i < tasks.length; i += CONCURRENT) {
      const batch = tasks.slice(i, i + CONCURRENT);
      const batchResults = await Promise.all(batch.map(t => t()));
      results.push(...batchResults.flat());
    }

    const allQuestions = results.flatMap(r => (r && r.questions) || []);
    if (allQuestions.length === 0) {
      showToast('לא זוהו שאלות בקבצים שנבחרו', 'warning');
    } else {
      setParsed(allQuestions);
      showToast(`זוהו ${allQuestions.length} שאלות מ-${readyFiles.length} קבצים`, 'success');
    }
    setAnalyzingFiles(false);
  };

  // ── Analysis ─────────────────────────────────────────
  const analyzeWithRegex = () => {
    if (!rawText.trim()) { showToast('אין טקסט לניתוח', 'error'); return; }
    // If user pasted full JSON array, preserve metadata fields as-is.
    try {
      const jsonQs = parseJSON(rawText);
      if (Array.isArray(jsonQs) && jsonQs.length > 0) {
        setParsed(jsonQs);
        showToast(`זוהו ${jsonQs.length} שאלות מ-JSON`, 'success');
        return;
      }
    } catch (_) {}
    const questions = parseTextQuestions(rawText);
    if (questions.length === 0) {
      showToast('לא זוהו שאלות. נסה לפרמט את הטקסט עם מספור (1. 2. ...)', 'warning');
    } else {
      setParsed(questions);
      showToast(`זוהו ${questions.length} שאלות`, 'success');
    }
  };

  const analyzeWithAI = async () => {
    if (!rawText.trim()) { showToast('אין טקסט לניתוח', 'error'); return; }
    // If user pasted full JSON array, skip AI parsing to avoid dropping category/sub_category metadata.
    try {
      const jsonQs = parseJSON(rawText);
      if (Array.isArray(jsonQs) && jsonQs.length > 0) {
        setParsed(jsonQs);
        showToast(`זוהו ${jsonQs.length} שאלות מ-JSON`, 'success');
        return;
      }
    } catch (_) {}
    setAnalyzing(true);
    setAiProgress(null);
    try {
      const result = await parseQuestionsWithAI(rawText, (done, total) => {
        setAiProgress({ done, total });
      }, handleProviderEvent);
      const questions = result.questions || result;
      const providersInfo = Array.isArray(result.providersTried) && result.providersTried.length
        ? ` (${result.providersTried.join(' -> ')})`
        : '';
      setParsed(Array.isArray(questions) ? questions : []);
      const n = (Array.isArray(questions) ? questions : []).length;
      showToast(`ה-AI זיהה ${n} שאלות${providersInfo}`, 'success');
    } catch (err) {
      showToast(`שגיאה בניתוח AI: ${err.message}`, 'error');
    } finally {
      setAnalyzing(false);
      setAiProgress(null);
    }
  };

  // ── Build editable drafts whenever a fresh analysis lands ──
  useEffect(() => {
    if (Array.isArray(parsedQuestions)) {
      setReviewDrafts(parsedQuestions.map(toReviewDraft));
    } else {
      setReviewDrafts([]);
    }
  }, [parsedQuestions]);

  // ── Save reviewed questions (manual approval; no auto-save) ──
  const handleSaveReviewed = async (chosenArg) => {
    const chosen = (chosenArg || reviewDrafts).filter((q) => q.include);
    if (!chosen.length) {
      showToast('בחרו לפחות שאלה אחת לשמירה.', 'error');
      return;
    }
    setImporting(true);
    setProgress({ current: 0, total: chosen.length, success: 0, failed: 0 });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < chosen.length; i++) {
      try {
        const payload = toCanonicalQuestionPayload(chosen[i], { category: defaultCategory });
        await entities.Question_Bank.create(payload);
        success += 1;
      } catch (err) {
        console.error('[QuestionImport] save failed:', err);
        failed += 1;
      }
      setProgress({ current: i + 1, total: chosen.length, success, failed });
    }

    setImporting(false);
    setProgress(null);
    if (success) {
      showToast(`יובאו ${success} שאלות בהצלחה.`, 'success');
      const savedIds = new Set(chosen.map((q) => q.id));
      const remaining = reviewDrafts.filter((q) => !savedIds.has(q.id));
      setReviewDrafts(remaining);
      if (!remaining.length) {
        setParsed(null);
        setRawText('');
        setUploadedFiles([]);
      }
      if (onImportComplete) onImportComplete({ successful: success, failed });
    }
    if (failed) showToast(`${failed} שאלות לא נשמרו.`, 'warning');
  };

  // ── Load CSV/JSON/Excel parse results into the editable review ──
  const loadCsvToReview = () => {
    const qs = csvPreview?.details?.map((d) => d.question) || [];
    if (!qs.length) {
      showToast('אין שאלות תקינות לטעינה.', 'error');
      return;
    }
    setParsed(qs);
    showToast('השאלות נטענו לעריכה — ערכו ואשרו לפני שמירה.', 'info');
  };

  // ── CSV/JSON/Excel Import (Excel added without replacing CSV/JSON) ─────────────────
  const handleCsvFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (csvType === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target.result;
        setCsvContent('');
        setCsvXlsxBuffer(buffer);
        try {
          const qs = parseMoodleExcel(buffer);
          setCsvPreview(previewQuestions(qs));
        } catch (err) {
          showToast(`שגיאה: ${err.message}`, 'error');
          setCsvPreview(null);
          setCsvXlsxBuffer(null);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      setCsvXlsxBuffer(null);
      setCsvContent(content);
      try {
        const qs = csvType === 'csv' ? parseCSV(content) : parseJSON(content);
        setCsvPreview(previewQuestions(qs));
      } catch (err) {
        showToast(`שגיאה: ${err.message}`, 'error');
        setCsvPreview(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <div style={s.container}>
      <h2 style={s.title}>📥 ייבוא שאלות חכם</h2>
      <p style={s.subtitle}>הדבק שאלות, העלה קובץ Word/PDF, או ייבא CSV — המערכת תנתח אוטומטית</p>
      {(llmRuntime.provider || llmRuntime.lastError) && (
        <div style={{
          marginBottom: '14px',
          padding: '10px 12px',
          borderRadius: '8px',
          border: `1px solid ${llmRuntime.lastError ? '#ef9a9a' : '#90caf9'}`,
          background: llmRuntime.lastError ? '#ffebee' : '#e3f2fd',
          color: llmRuntime.lastError ? '#c62828' : '#0d47a1',
          fontSize: '13px',
        }}>
          {llmRuntime.provider && (
            <div>
              ספק פעיל: <strong>OpenAI</strong>
            </div>
          )}
          {llmRuntime.lastError && <div>כשל ספק: {llmRuntime.lastError}</div>}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={s.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setParsed(null); setRawText(''); setCsvContent(''); setCsvXlsxBuffer(null); setCsvPreview(null); setUploadedFiles([]); }}
            style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ TAB: FREE TEXT ══════════ */}
      {activeTab === 'text' && (
        <div>
          <textarea
            value={rawText}
            onChange={e => { setRawText(e.target.value); setParsed(null); }}
            placeholder={TEXT_PLACEHOLDER}
            style={s.textarea}
            rows={14}
            disabled={isAnalyzing || isImporting}
          />
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            המערכת משתמשת ב-<strong>OpenAI</strong>. הכפתור &quot;נתח שאלות (מהיר)&quot; לא שולח ל-AI.
          </p>
          <AnalysisButtons
            onRegex={analyzeWithRegex}
            onAI={analyzeWithAI}
            isAnalyzing={isAnalyzing}
            hasText={!!rawText.trim()}
          />
          <AiProgressBar progress={aiProgress} isActive={isAnalyzing} />
        </div>
      )}

      {/* ══════════ TAB: FILE ══════════ */}
      {activeTab === 'file' && (
        <div>
          {!appConfig?.openai?.getApiKey?.() && (
            <div style={{
              padding: '10px 14px', marginBottom: '12px', background: '#FFF3E0',
              border: '1px solid #FFB74D', borderRadius: '8px', fontSize: '13px', color: '#E65100',
            }}>
              לניתוח קבצים עם AI יש להגדיר את המפתח <code style={{ background: '#FFE0B2', padding: '2px 6px', borderRadius: '4px' }}>VITE_OPENAI_API_KEY</code> בקובץ <code>.env</code>.
            </div>
          )}
          {/* Drop zone */}
          <div
            style={{ ...s.dropzone, ...(dragOver ? s.dropzoneActive : {}) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilePick}
            />
            <div style={s.dropIcon}>📂</div>
            <p style={s.dropText}>גרור קבצים לכאן או לחץ לבחירה</p>
            <p style={s.dropHint}>PDF, Word (.docx, .doc), TXT — ניתן לבחור כמה קבצים בו-זמנית</p>
          </div>

          {/* File list */}
          {uploadedFiles.length > 0 && (
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {uploadedFiles.map(f => (
                <FileStatusRow
                  key={f.id}
                  file={f}
                  onRemove={() => removeUploadedFile(f.id)}
                />
              ))}
            </div>
          )}

          {/* Analyze button */}
          {uploadedFiles.some(f => f.status === 'ready' || f.status === 'analyzing') && (
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={analyzeAllFiles}
                disabled={isAnalyzingFiles || !uploadedFiles.some(f => f.status === 'ready')}
                style={{
                  ...btnBase,
                  background: isAnalyzingFiles ? '#aaa' : '#CC0000',
                  cursor: isAnalyzingFiles ? 'not-allowed' : 'pointer',
                }}
              >
                {isAnalyzingFiles
                  ? <><LoadingSpinner size="sm" /> מנתח...</>
                  : `✨ נתח ${uploadedFiles.filter(f => f.status === 'ready').length} קבצים עם AI`}
              </button>
              {uploadedFiles.filter(f => f.status === 'done').length > 0 && (
                <span style={{ fontSize: '13px', color: '#388e3c', fontWeight: 600 }}>
                  ✅ {uploadedFiles.filter(f => f.status === 'done').reduce((s, f) => s + f.questions.length, 0)} שאלות זוהו
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: CSV/JSON/Excel ══════════ */}
      {activeTab === 'csv' && (
        <div>
          <div style={s.csvTypeRow}>
            {['csv', 'json', 'xlsx'].map(t => (
              <label key={t} style={s.radioLabel}>
                <input
                  type="radio"
                  value={t}
                  checked={csvType === t}
                  onChange={() => {
                    setCsvType(t);
                    setCsvContent('');
                    setCsvXlsxBuffer(null);
                    setCsvPreview(null);
                  }}
                />
                {t === 'xlsx' ? 'Excel (Moodle)' : t.toUpperCase()}
              </label>
            ))}
          </div>

          <input
            type="file"
            accept={csvType === 'csv' ? '.csv' : csvType === 'json' ? '.json' : '.xlsx,.xls'}
            onChange={handleCsvFileSelect}
            style={s.fileInput}
          />

          {csvType !== 'xlsx' && (
            <textarea
              value={csvContent}
              onChange={e => {
                setCsvContent(e.target.value);
                try {
                  const qs = csvType === 'csv' ? parseCSV(e.target.value) : parseJSON(e.target.value);
                  setCsvPreview(previewQuestions(qs));
                } catch { setCsvPreview(null); }
              }}
              placeholder={csvType === 'csv' ? 'הדבק CSV כאן...' : 'הדבק JSON כאן...'}
              style={{ ...s.textarea, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}
              rows={8}
            />
          )}
          {csvType === 'xlsx' && (
            <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', marginBottom: '8px' }}>
            קובץ Excel עם עמודות <strong>question_text</strong> ו־<strong>answers</strong>. בתשובות: מסיחים מופרדים ב־<code>||</code>, התשובה הנכונה מסומנת <code>(Correct)</code>.
          </p>
          )}

          {csvPreview && (
            <div style={s.csvStats}>
              <Pill label={`סה"כ: ${csvPreview.total}`} color="#1976d2" />
              <Pill label={`תקינות: ${csvPreview.valid}`} color="#388e3c" />
              {csvPreview.invalid > 0 && <Pill label={`לא תקינות: ${csvPreview.invalid}`} color="#c62828" />}
            </div>
          )}

          <button
            onClick={loadCsvToReview}
            disabled={!csvPreview?.total || isImporting}
            style={{ ...s.importBtn, ...(!csvPreview?.total || isImporting ? s.btnDisabled : {}) }}
          >
            {`טען ${csvPreview?.total || 0} שאלות לעריכה ואישור`}
          </button>
        </div>
      )}

      {/* ══════════ EDITABLE REVIEW (manual approval) ══════════ */}
      {parsedQuestions && reviewDrafts.length > 0 && (
        <div style={s.previewSection}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', flexWrap: 'wrap' }}>
              <span>פרק ברירת מחדל (כשלא נבחר בשאלה):</span>
              <select
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e0e0e0', maxWidth: '100%', flex: '1 1 240px' }}
              >
                {QUESTION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>

          <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
            <strong>שימו לב:</strong> ערכו כל שדה לפי הצורך (נושא, תת-נושא, ניסוח, אפשרויות ותשובה נכונה, תיוגים והסבר) ואז אשרו ושמרו. שום שאלה לא נשמרת אוטומטית.
          </p>

          {isImporting && importProgress && (
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }} />
              <span style={s.progressText}>
                שומר: {importProgress.current}/{importProgress.total} | ✅ {importProgress.success} ❌ {importProgress.failed}
              </span>
            </div>
          )}

          <QuestionReviewEditor
            questions={reviewDrafts}
            onChange={setReviewDrafts}
            onSave={handleSaveReviewed}
            saving={isImporting}
            title="שאלות שזוהו — ערכו ואשרו"
          />
        </div>
      )}

      {/* ══════════ FORMAT GUIDE ══════════ */}
      {!parsedQuestions && activeTab !== 'csv' && (
        <div style={s.guide}>
          <strong style={{ color: '#1565c0' }}>📖 פורמט מומלץ לניתוח אוטומטי:</strong>
          <pre style={s.guideCode}>{FORMAT_GUIDE}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────

/**
 * One row in the multi-file upload list.
 * Shows file name, extraction/analysis status, per-file chunk progress,
 * question count once done, and a remove button.
 */
function FileStatusRow({ file, onRemove }) {
  const STATUS_ICON = {
    extracting: '⏳',
    ready:      '📄',
    analyzing:  '🔍',
    done:       '✅',
    error:      '❌',
  };
  const STATUS_COLOR = {
    extracting: '#78909c',
    ready:      '#1565C0',
    analyzing:  '#6A1B9A',
    done:       '#2E7D32',
    error:      '#C62828',
  };
  const icon  = STATUS_ICON[file.status]  || '📄';
  const color = STATUS_COLOR[file.status] || '#333';
  const pct   = file.progress
    ? Math.round((file.progress.done / file.progress.total) * 100)
    : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '6px',
      background: '#fff', border: `1.5px solid ${color}40`,
      borderRadius: '10px', padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
        <span style={{
          flex: 1, fontWeight: 600, fontSize: '14px', color,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file.name}
        </span>
        {file.status === 'done' && file.questions.length > 0 && (
          <span style={{ fontSize: '12px', background: '#E8F5E9', color: '#2E7D32', padding: '2px 10px', borderRadius: '12px', fontWeight: 600 }}>
            {file.questions.length} שאלות
          </span>
        )}
        {file.status === 'error' && (
          <span style={{ fontSize: '11px', color: '#C62828', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file.error}
          </span>
        )}
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#aaa', flexShrink: 0 }}
          title="הסר קובץ"
        >✕</button>
      </div>

      {/* Chunk progress bar during AI analysis */}
      {file.status === 'analyzing' && file.progress && (
        <div>
          <div style={{ height: '5px', background: '#E1BEE7', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: 'linear-gradient(90deg, #9C27B0, #CC0000)',
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: '11px', color: '#7B1FA2', marginTop: '3px' }}>
            chunk {file.progress.done}/{file.progress.total}
          </div>
        </div>
      )}
      {file.status === 'analyzing' && !file.progress && (
        <div style={{ fontSize: '11px', color: '#7B1FA2' }}>מכין ניתוח...</div>
      )}
      {file.status === 'extracting' && (
        <div style={{ fontSize: '11px', color: '#78909c' }}>מחלץ טקסט...</div>
      )}
    </div>
  );
}

function AnalysisButtons({ onRegex, onAI, isAnalyzing, hasText }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
      <button onClick={onRegex} disabled={!hasText || isAnalyzing}
        style={{ ...btnBase, background: '#546e7a' }}>
        {isAnalyzing ? <LoadingSpinner size="sm" /> : '🔍 נתח שאלות (מהיר)'}
      </button>
      <button onClick={onAI} disabled={!hasText || isAnalyzing}
        style={{ ...btnBase, background: '#CC0000' }}>
        {isAnalyzing ? <LoadingSpinner size="sm" /> : '✨ ניתוח חכם עם AI'}
      </button>
      <span style={{ fontSize: '13px', color: '#888', alignSelf: 'center' }}>
        מהיר = regex · AI = מדויק יותר, מקביל, מזהה יותר שאלות
      </span>
    </div>
  );
}

function AiProgressBar({ progress, isActive }) {
  if (!isActive || !progress) return null;
  const pct = progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
  return (
    <div style={{
      marginTop: '12px', background: '#F3E5F5', border: '1px solid #CE93D8',
      borderRadius: '10px', padding: '12px 16px', display: 'flex',
      flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#6A1B9A' }}>
        <span>✨ מנתח עם AI במקביל...</span>
        <span>{progress.done}/{progress.total} חלקים ({pct}%)</span>
      </div>
      <div style={{ height: '8px', background: '#E1BEE7', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, #9C27B0, #CC0000)',
          borderRadius: '4px', transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: '12px', color: '#7B1FA2' }}>
        {progress.done < progress.total
          ? `מעבד ${progress.total - progress.done} חלקים נוספים במקביל...`
          : 'מסיים...'}
      </div>
    </div>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px',
      borderRadius: '20px', fontSize: '12px', fontWeight: '600',
      background: color + '18', color, border: `1px solid ${color}40`,
    }}>
      {label}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────

const btnBase = {
  padding: '10px 20px', border: 'none', borderRadius: '8px',
  color: 'white', fontWeight: '700', fontSize: '14px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
  fontFamily: 'inherit',
};

const s = {
  container: { direction: 'rtl', padding: '24px', maxWidth: '920px', margin: '0 auto' },
  title: { fontSize: '26px', fontWeight: '800', color: '#1a1a2e', marginBottom: '6px' },
  subtitle: { fontSize: '14px', color: '#78909c', marginBottom: '24px' },

  tabs: { display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #e0e0e0' },
  tab: {
    padding: '12px 22px', border: 'none', background: 'transparent',
    fontSize: '14px', fontWeight: '600', color: '#78909c', cursor: 'pointer',
    borderBottom: '3px solid transparent', marginBottom: '-2px', fontFamily: 'inherit',
    transition: 'color 0.2s',
  },
  tabActive: { color: '#1976d2', borderBottom: '3px solid #1976d2' },

  textarea: {
    width: '100%', padding: '14px', border: '2px solid #e0e0e0', borderRadius: '12px',
    fontSize: '14px', lineHeight: '1.6', direction: 'rtl', boxSizing: 'border-box',
    fontFamily: 'inherit', resize: 'vertical', background: '#fafafa',
  },

  dropzone: {
    border: '2.5px dashed #b0bec5', borderRadius: '16px', padding: '48px 24px',
    textAlign: 'center', cursor: 'pointer', background: '#fafafa',
    transition: 'all 0.2s',
  },
  dropzoneActive: { borderColor: '#1976d2', background: '#e3f2fd' },
  dropIcon: { fontSize: '48px', marginBottom: '12px' },
  dropText: { fontSize: '16px', fontWeight: '600', color: '#455a64', margin: '0 0 6px' },
  dropHint: { fontSize: '13px', color: '#90a4ae', margin: 0 },

  csvTypeRow: { display: 'flex', gap: '20px', marginBottom: '16px' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' },
  fileInput: { display: 'block', marginBottom: '14px', fontSize: '14px' },
  csvStats: { display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '14px 0' },

  importBtn: {
    ...btnBase, background: 'linear-gradient(135deg, #1b5e20, #388e3c)',
    padding: '12px 28px', fontSize: '15px',
    boxShadow: '0 3px 12px rgba(56,142,60,0.35)',
  },
  btnDisabled: { background: '#cfd8dc', boxShadow: 'none', cursor: 'not-allowed', opacity: 0.7 },

  previewSection: { marginTop: '28px' },
  previewHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  previewTitle: { fontSize: '18px', fontWeight: '800', color: '#1a1a2e', margin: 0 },

  /* ── enrichment banner ──────────────────────────────── */
  enrichBanner: {
    background: 'linear-gradient(135deg, #FFF8E1, #FFF3E0)',
    border: '1px solid #FFB300',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '12px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  enrichBannerRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    fontWeight: 700, fontSize: '14px', color: '#E65100',
  },
  enrichCount: {
    marginRight: 'auto', fontSize: '13px', color: '#888', fontWeight: 400,
  },
  enrichDetail: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  enrichTagGenerate: {
    background: '#FF6F00', color: '#fff', borderRadius: '12px',
    padding: '2px 10px', fontSize: '12px', fontWeight: 600,
  },
  enrichTagIdentify: {
    background: '#1565C0', color: '#fff', borderRadius: '12px',
    padding: '2px 10px', fontSize: '12px', fontWeight: 600,
  },
  enrichTagOk: {
    background: '#2E7D32', color: '#fff', borderRadius: '12px',
    padding: '2px 10px', fontSize: '12px', fontWeight: 600,
  },
  enrichQText: {
    fontSize: '12px', color: '#555', fontStyle: 'italic',
    maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  progressBarTrack: {
    width: '100%', height: '6px', background: '#FFE0B2',
    borderRadius: '3px', overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', borderRadius: '3px', transition: 'width 0.3s ease',
  },
  /* ── save progress bar ───────────────────────────────── */
  progressBar: {
    width: '100%', height: '28px', background: '#e0e0e0', borderRadius: '14px',
    overflow: 'hidden', position: 'relative', marginBottom: '16px',
  },
  progressFill: { height: '100%', background: '#388e3c', transition: 'width 0.3s ease' },
  progressText: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '600', color: '#1a1a2e',
  },

  questionList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  qCard: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '14px 16px', background: 'white', borderRadius: '12px',
    border: '1px solid #e8ecf0', gap: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  qCardLeft: { display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1, minWidth: 0 },
  qNum: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#1976d2', color: 'white', fontSize: '13px', fontWeight: '700', flexShrink: 0,
  },
  qText: { margin: 0, fontSize: '14px', color: '#212121', lineHeight: '1.5' },
  iconBtn: (type) => ({
    border: 'none',
    background: type === 'edit' ? '#e3f2fd' : type === 'remove' ? '#ffebee' : '#f5f5f5',
    borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '15px',
  }),

  editLabel: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#546e7a', marginBottom: '5px' },
  editInput: {
    width: '100%', padding: '9px 12px', border: '1px solid #cfd8dc',
    borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit',
    direction: 'rtl', boxSizing: 'border-box',
  },

  guide: {
    marginTop: '24px', padding: '18px', background: '#e8f5e9',
    borderRadius: '12px', border: '1px solid #c8e6c9',
  },
  guideCode: {
    marginTop: '10px', background: '#f1f8e9', padding: '14px',
    borderRadius: '8px', fontSize: '13px', direction: 'ltr', textAlign: 'left',
    whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#37474f',
    overflowX: 'auto',
  },
};

const TEXT_PLACEHOLDER = `הדבק כאן שאלות בפורמט חופשי, למשל:

1. מהו מספר הלחיצות בהחייאה למבוגר?
א. 15
ב. 30
ג. 50
ד. 100
תשובה נכונה: ב

2. האם יש לבצע בדיקת דופק לפני תחילת החייאה? (נכון/לא נכון)
תשובה: לא נכון

3. מה הם הסימנים המדאיגים בחולה עם כאב חזה? (בחר את כל התשובות הנכונות)
א. הזעה קרה
ב. קוצר נשימה
ג. כאב מקרין לזרוע
ד. רעב`;

const FORMAT_GUIDE = `1. שאלת בחירה יחידה:
   1. טקסט השאלה?
   א. אפשרות 1
   ב. אפשרות 2
   תשובה נכונה: א

2. שאלת נכון/לא נכון:
   2. האמירה נכונה? (נכון/לא נכון)
   תשובה: נכון

3. שאלת בחירה מרובה (כתוב "בחר את כל התשובות"):
   3. אלו סימנים מדאיגים? (בחר את כל התשובות הנכונות)
   א. סימן 1
   ב. סימן 2
   תשובה: א, ב

4. שאלה פתוחה:
   4. הסבר את תהליך ההחייאה.`;
