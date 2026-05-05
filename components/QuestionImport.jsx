/**
 * Question Import Component — Smart Edition
 * Supports: free-text paste, Word/PDF upload, CSV/JSON
 * Hebrew: ייבוא שאלות חכם
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  importQuestionsFromCSV,
  importQuestionsFromJSON,
  importQuestionsFromMoodleExcel,
  previewQuestions,
  parseCSV,
  parseJSON,
  parseMoodleExcel,
  extractTextFromFile,
  parseQuestionsWithAI,
  bulkCreateQuestions,
} from '../workflows/questionImport';
import {
  detectEnrichmentType,
  ENRICH_GENERATE,
  ENRICH_IDENTIFY_ANSWER,
  ENRICH_NONE,
} from '../workflows/questionEnrich';
import { parseTextQuestions, getTypeLabel, getTypeColor } from '../utils/questionParser';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import { entities, appConfig } from '../config/appConfig';
import { QUESTION_CATEGORIES, THINKING_LEVELS, TRAINING_LEVELS } from '../shared/questionBankMetadata.js';

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
  const [enrichProgress, setEnrichProgress] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [dragOver, setDragOver]             = useState(false);
  // Multi-file upload
  const [uploadedFiles, setUploadedFiles]   = useState([]);   // [{id,name,status,text,questions,progress,error}]
  const [isAnalyzingFiles, setAnalyzingFiles] = useState(false);
  const [editingIdx, setEditingIdx]         = useState(null);
  const [editDraft, setEditDraft]           = useState({});

  // CSV/JSON/Excel state (kept from original; Excel added without replacing)
  const [csvType, setCsvType]           = useState('csv');
  const [csvContent, setCsvContent]     = useState('');
  const [csvXlsxBuffer, setCsvXlsxBuffer] = useState(null);  // ArrayBuffer for Moodle Excel
  const [csvPreview, setCsvPreview]     = useState(null);

  const [defaultCategory, setDefaultCategory] = useState(QUESTION_CATEGORIES[0]?.value ?? '');

  const fileInputRef = useRef(null);

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
        });
        const questions = result.questions || result;
        const usedFallback = result.usedFallback === true;
        const tagged = (Array.isArray(questions) ? questions : []).map(q => ({ ...q, _sourceFile: entry.name, _usedFallback: usedFallback }));
        setUploadedFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'done', questions: tagged, progress: null } : f
        ));
        return { questions: tagged, usedFallback };
      } catch (err) {
        setUploadedFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, status: 'error', error: err.message, progress: null } : f
        ));
        return { questions: [], usedFallback: false };
      }
    });

    // Run in batches of CONCURRENT
    for (let i = 0; i < tasks.length; i += CONCURRENT) {
      const batch = tasks.slice(i, i + CONCURRENT);
      const batchResults = await Promise.all(batch.map(t => t()));
      results.push(...batchResults.flat());
    }

    const allQuestions = results.flatMap(r => (r && r.questions) || []);
    const anyFallback = results.some(r => r && r.usedFallback);
    if (allQuestions.length === 0) {
      showToast('לא זוהו שאלות בקבצים שנבחרו', 'warning');
    } else {
      setParsed(allQuestions);
      showToast(
        anyFallback
          ? `זוהו ${allQuestions.length} שאלות מ-${readyFiles.length} קבצים (חלק בניתוח גיבוי — ה-AI לא זיהה שאלות)`
          : `זוהו ${allQuestions.length} שאלות מ-${readyFiles.length} קבצים`,
        anyFallback ? 'warning' : 'success'
      );
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
        // #region agent log
        fetch('http://127.0.0.1:7348/ingest/e2bebe2c-443b-45ce-b67f-21266df27271',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b92899'},body:JSON.stringify({sessionId:'b92899',runId:'post-fix',hypothesisId:'H10',location:'components/QuestionImport.jsx:analyzeWithRegex:jsonBypass',message:'Bypassed regex parser for pasted JSON array',data:{count:jsonQs.length,firstCategory:jsonQs[0]?.category??null,firstSubCategory:jsonQs[0]?.sub_category??null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7348/ingest/e2bebe2c-443b-45ce-b67f-21266df27271',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b92899'},body:JSON.stringify({sessionId:'b92899',runId:'post-fix',hypothesisId:'H10',location:'components/QuestionImport.jsx:analyzeWithAI:jsonBypass',message:'Bypassed AI parser for pasted JSON array',data:{count:jsonQs.length,firstCategory:jsonQs[0]?.category??null,firstSubCategory:jsonQs[0]?.sub_category??null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
      });
      const questions = result.questions || result;
      const usedFallback = result.usedFallback === true;
      setParsed(Array.isArray(questions) ? questions : []);
      const n = (Array.isArray(questions) ? questions : []).length;
      if (usedFallback) {
        showToast(`ה-AI לא זיהה שאלות; זוהו ${n} שאלות בניתוח גיבוי (ללא AI)`, 'warning');
      } else {
        showToast(`ה-AI זיהה ${n} שאלות`, 'success');
      }
    } catch (err) {
      showToast(`שגיאה בניתוח AI: ${err.message}`, 'error');
    } finally {
      setAnalyzing(false);
      setAiProgress(null);
    }
  };

  // ── Editing a question in preview ────────────────────
  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditDraft({ ...parsedQuestions[idx] });
  };
  const cancelEdit = () => { setEditingIdx(null); setEditDraft({}); };
  const saveEdit = () => {
    const updated = [...parsedQuestions];
    updated[editingIdx] = { ...editDraft };
    setParsed(updated);
    setEditingIdx(null);
    setEditDraft({});
  };
  const removeQuestion = (idx) => {
    setParsed(parsedQuestions.filter((_, i) => i !== idx));
  };

  // ── Import ────────────────────────────────────────────
  const handleImportParsed = async () => {
    if (!parsedQuestions?.length) return;
    setImporting(true);
    setProgress(null);
    setEnrichProgress(null);

    const needsEnrichment = parsedQuestions.some((q) => detectEnrichmentType(q) !== ENRICH_NONE);
    if (needsEnrichment) {
      showToast('מעשיר שאלות חסרות מסיחים / תשובות עם AI...', 'info');
    }

    try {
      const results = await bulkCreateQuestions(parsedQuestions, {
        validate: false,
        skipInvalid: true,
        enrich: true,
        skipDuplicates,
        defaultCategory: defaultCategory || undefined,
        onProgress: (p) => setProgress({ ...p, total: p.total }),
        onEnrichProgress: (p) => setEnrichProgress(p),
      });

      const splitMsg = results.split > 0
        ? ` (${results.split} פוצלו ל-2 יישויות)`
        : '';
      const enrichMsg = results.enriched > 0
        ? ` | ${results.enriched} הועשרו ע"י AI`
        : '';
      const dupMsg = results.duplicates > 0
        ? ` | ${results.duplicates} דומות דולגו`
        : '';

      showToast(`יובאו ${results.successful} שאלות בהצלחה${splitMsg}${enrichMsg}${dupMsg}`, 'success');
      if (results.failed > 0) showToast(`${results.failed} נכשלו`, 'warning');

      setParsed(null);
      setRawText('');
      setUploadedFiles([]);
      if (onImportComplete) onImportComplete(results);
    } catch (err) {
      showToast(`שגיאה בייבוא: ${err.message}`, 'error');
    } finally {
      setImporting(false);
      setProgress(null);
      setEnrichProgress(null);
    }
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

  const handleCsvImport = async () => {
    if (csvType === 'xlsx') {
      if (!csvXlsxBuffer) return;
      setImporting(true);
      try {
        const results = await importQuestionsFromMoodleExcel(csvXlsxBuffer, {
          validate: true,
          skipInvalid: true,
          onProgress: setProgress,
          defaultCategory: defaultCategory || undefined,
        });
        showToast(`יובאו ${results.successful} שאלות`, 'success');
        setCsvXlsxBuffer(null);
        setCsvPreview(null);
        if (onImportComplete) onImportComplete(results);
      } catch (err) {
        showToast(`שגיאה: ${err.message}`, 'error');
      } finally {
        setImporting(false);
        setProgress(null);
      }
      return;
    }

    if (!csvContent) return;
    setImporting(true);
    try {
      const csvOpts = { validate: true, skipInvalid: true, onProgress: setProgress, defaultCategory: defaultCategory || undefined };
      const results =
        csvType === 'csv'
          ? await importQuestionsFromCSV(csvContent, csvOpts)
          : await importQuestionsFromJSON(csvContent, csvOpts);
      showToast(`יובאו ${results.successful} שאלות`, 'success');
      setCsvContent('');
      setCsvPreview(null);
      if (onImportComplete) onImportComplete(results);
    } catch (err) {
      showToast(`שגיאה: ${err.message}`, 'error');
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <div style={s.container}>
      <h2 style={s.title}>📥 ייבוא שאלות חכם</h2>
      <p style={s.subtitle}>הדבק שאלות, העלה קובץ Word/PDF, או ייבא CSV — המערכת תנתח אוטומטית</p>

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
            לשימוש במפתח OpenAI (ניתוח מדויק עם בינה מלאכותית) לחץ על <strong>ניתוח חכם עם AI</strong>. הכפתור &quot;נתח שאלות (מהיר)&quot; לא שולח ל-AI.
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
          {(!appConfig?.openai?.getApiKey || !appConfig.openai.getApiKey()) && (
            <div style={{
              padding: '10px 14px', marginBottom: '12px', background: '#FFF3E0',
              border: '1px solid #FFB74D', borderRadius: '8px', fontSize: '13px', color: '#E65100',
            }}>
              לניתוח קבצים עם AI יש להגדיר <code style={{ background: '#FFE0B2', padding: '2px 6px', borderRadius: '4px' }}>VITE_OPENAI_API_KEY</code> בקובץ <code>.env</code>.
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
            onClick={handleCsvImport}
            disabled={!csvPreview?.valid || isImporting || (csvType === 'xlsx' && !csvXlsxBuffer)}
            style={{ ...s.importBtn, ...(!csvPreview?.valid || isImporting || (csvType === 'xlsx' && !csvXlsxBuffer) ? s.btnDisabled : {}) }}
          >
            {isImporting ? 'מייבא...' : `ייבוא ${csvPreview?.valid || 0} שאלות`}
          </button>
        </div>
      )}

      {/* ══════════ PARSED QUESTIONS PREVIEW ══════════ */}
      {parsedQuestions && (
        <div style={s.previewSection}>
          {/* ── Duplicate summary banner ───────────────────── */}
          {(() => {
            const dupCount   = parsedQuestions.filter(q => q._duplicateFlag).length;
            const intDupCount = parsedQuestions.filter(q => q._internalDuplicate).length;
            if (dupCount + intDupCount === 0) return null;
            return (
              <div style={{
                background: '#FFF8E1', border: '1px solid #FFB300', borderRadius: '10px',
                padding: '12px 16px', marginBottom: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#E65100' }}>
                      {dupCount + intDupCount} שאלות דומות זוהו
                    </strong>
                    <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>
                      {dupCount > 0 && `${dupCount} דומות לשאלות קיימות במערכת · `}
                      {intDupCount > 0 && `${intDupCount} כפולות בתוך הקובץ`}
                    </div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={e => setSkipDuplicates(e.target.checked)}
                    style={{ accentColor: '#E65100', width: '15px', height: '15px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#E65100' }}>דלג על שאלות דומות בייבוא</span>
                </label>
              </div>
            );
          })()}

          <div style={s.previewHeader}>
            <h3 style={s.previewTitle}>
              תצוגה מקדימה — {parsedQuestions.length} שאלות זוהו
              {(() => {
                const files = [...new Set(parsedQuestions.map(q => q._sourceFile).filter(Boolean))];
                return files.length > 1
                  ? <span style={{ fontSize: '14px', fontWeight: 400, color: '#888', marginRight: '8px' }}>
                      מ-{files.length} קבצים
                    </span>
                  : files.length === 1
                  ? <span style={{ fontSize: '13px', fontWeight: 400, color: '#888', marginRight: '8px' }}>
                      מ-{files[0]}
                    </span>
                  : null;
              })()}
            </h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', flexWrap: 'wrap' }}>
              <span>פרק ברירת מחדל (כשלא צוין בקובץ):</span>
              <select
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e0e0e0', maxWidth: '100%', flex: '1 1 240px' }}
              >
                {QUESTION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              <strong>חשוב:</strong> לחץ על &quot;ייבוא&quot; כדי לשמור את השאלות. בלי לחיצה — השאלות לא נשמרות ונעלמות ברענון או במכשיר אחר.
              {typeof window !== 'undefined' && !window.__quizMDA_usingQuestionApi && (
                <span style={{ display: 'block', marginTop: '4px', color: '#E65100' }}>
                  כרגע השאלות נשמרות במכשיר זה בלבד. לסינכרון בין מכשירים — הרץ את השרת עם MongoDB (ראה README).
                </span>
              )}
            </p>
            <button
              onClick={handleImportParsed}
              disabled={parsedQuestions.length === 0 || isImporting}
              style={{ ...s.importBtn, ...(parsedQuestions.length === 0 || isImporting ? s.btnDisabled : {}) }}
            >
              {isImporting ? <LoadingSpinner size="sm" /> : `✅ ייבוא ${parsedQuestions.length} שאלות`}
            </button>
          </div>

          {/* Enrichment progress — phase 1 */}
          {isImporting && enrichProgress && !importProgress && (
            <div style={s.enrichBanner}>
              <div style={s.enrichBannerRow}>
                <LoadingSpinner size="sm" />
                <strong>העשרת שאלות ע"י AI</strong>
                <span style={s.enrichCount}>
                  {enrichProgress.current}/{enrichProgress.total}
                </span>
              </div>
              <div style={s.enrichDetail}>
                {enrichProgress.enrichType === ENRICH_GENERATE && (
                  <span style={s.enrichTagGenerate}>⚡ יוצר מסיחים + שאלה רב-ברירה</span>
                )}
                {enrichProgress.enrichType === ENRICH_IDENTIFY_ANSWER && (
                  <span style={s.enrichTagIdentify}>🎯 מזהה תשובה נכונה</span>
                )}
                {enrichProgress.enrichType === 'none' && (
                  <span style={s.enrichTagOk}>✓ שאלה מלאה</span>
                )}
                {enrichProgress.questionText && (
                  <span style={s.enrichQText}>{enrichProgress.questionText}…</span>
                )}
              </div>
              <div style={s.progressBarTrack}>
                <div style={{
                  ...s.progressBarFill,
                  background: '#CC6600',
                  width: `${Math.round((enrichProgress.current / enrichProgress.total) * 100)}%`,
                }} />
              </div>
            </div>
          )}

          {/* Save progress — phase 2 */}
          {isImporting && importProgress && (
            <div style={s.progressBar}>
              <div style={{
                ...s.progressFill,
                width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`
              }} />
              <span style={s.progressText}>
                שומר: {importProgress.current}/{importProgress.total} | ✅ {importProgress.success} ❌ {importProgress.failed}
              </span>
            </div>
          )}

          <div style={s.questionList}>
            {parsedQuestions.map((q, idx) => (
              editingIdx === idx
                ? <QuestionEditCard key={idx} draft={editDraft} setDraft={setEditDraft} onSave={saveEdit} onCancel={cancelEdit} />
                : <QuestionPreviewCard key={idx} idx={idx} q={q} onEdit={() => startEdit(idx)} onRemove={() => removeQuestion(idx)} />
            ))}
          </div>
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

function QuestionPreviewCard({ idx, q, onEdit, onRemove }) {
  const [expanded, setExpanded] = React.useState(false);

  let parsed = {};
  try {
    const raw = q.correct_answer || '{}';
    parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
  } catch { /* empty */ }

  // AI returns options as top-level q.options; regex parser stores them inside correct_answer
  const rawOptions = parsed.options || q.options || null;

  // Normalize options to {value, label} shape regardless of source
  const normalizedOptions = rawOptions
    ? rawOptions.map((o, i) => ({
        value: String(o.value ?? i),
        label: o.label ?? o.text ?? String(o),
      }))
    : null;

  const correctVal  = parsed.value != null ? String(parsed.value) : null;
  const correctVals = parsed.values
    ? parsed.values.map(String)
    : (correctVal != null ? [correctVal] : []);

  // For true_false, build synthetic options
  const displayOptions = normalizedOptions || (
    q.question_type === 'true_false'
      ? [{ value: 'true', label: 'נכון' }, { value: 'false', label: 'לא נכון' }]
      : null
  );

  // Match by index OR by text (handles AI returning either form)
  const isCorrect = (opt, optIdx) => {
    if (correctVals.length === 0) return false;
    // match by value string
    if (correctVals.includes(opt.value) || correctVals.includes(String(optIdx))) return true;
    // match by label text (when AI returns text answer instead of index)
    return correctVals.some(cv =>
      opt.label.includes(cv) || cv.includes(opt.label)
    );
  };

  // Detect enrichment needed for this question (before saving)
  const enrichType = detectEnrichmentType(q);

  return (
    <div style={{
           ...s.qCard, flexDirection: 'column', gap: '10px', cursor: 'pointer',
           ...(q._duplicateFlag || q._internalDuplicate
             ? { borderColor: '#FFB300', borderWidth: '2px', background: '#FFFDE7' }
             : {}),
         }}
         onClick={() => setExpanded(e => !e)}>

      {/* Duplicate warning strip */}
      {(q._duplicateFlag || q._internalDuplicate) && q._similarTo && (
        <div style={{
          background: '#FFF8E1', borderRadius: '8px', padding: '8px 12px',
          display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px',
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <div>
            <strong style={{ color: '#E65100' }}>
              {q._internalDuplicate ? 'כפולה בתוך הקובץ' : 'דומה לשאלה קיימת'} — {q._similarTo.similarity}% דמיון
            </strong>
            <div style={{ color: '#555', marginTop: '3px', lineHeight: 1.4 }}>
              <em>"{(q._similarTo.question_text || '').slice(0, 110)}{q._similarTo.question_text?.length > 110 ? '...' : ''}"</em>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={s.qCardLeft}>
          <span style={s.qNum}>{idx + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={s.qText}>{q.question_text}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <Pill label={getTypeLabel(q.question_type)} color={getTypeColor(q.question_type)} />
              {displayOptions && <Pill label={`${displayOptions.length} אפשרויות`} color="#546e7a" />}
              {q._sourceFile && (
                <span style={{ fontSize: '11px', color: '#888', background: '#f5f5f5', borderRadius: '10px', padding: '1px 8px', border: '1px solid #e0e0e0' }}>
                  📄 {q._sourceFile.length > 24 ? q._sourceFile.slice(0, 22) + '…' : q._sourceFile}
                </span>
              )}
              {(q._duplicateFlag || q._internalDuplicate) && (
                <span style={{
                  background: '#FFF3CD', color: '#856404', border: '1px solid #FFDA6A',
                  borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 600,
                }}>⚠️ {q._internalDuplicate ? 'כפולה פנימית' : `דומה ${q._similarTo?.similarity}%`}</span>
              )}
              {enrichType === ENRICH_GENERATE && (
                <span title="אין מסיחים — AI יצור 4 אפשרויות ויפצל לשאלה פתוחה + רב-ברירה" style={{
                  background: '#FFF3E0', color: '#E65100', border: '1px solid #FFCC80',
                  borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 600,
                }}>⚡ יופצל → פתוחה + רב-ברירה</span>
              )}
              {enrichType === ENRICH_IDENTIFY_ANSWER && (
                <span title="אין תשובה נכונה מסומנת — AI יזהה אותה" style={{
                  background: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9',
                  borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 600,
                }}>🎯 AI יזהה תשובה נכונה</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onEdit}   style={s.iconBtn('edit')}>✏️</button>
          <button onClick={onRemove} style={s.iconBtn('remove')}>🗑️</button>
          <button style={s.iconBtn('expand')} onClick={() => setExpanded(e => !e)}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded: options + correct answer */}
      {expanded && displayOptions && (
        <div style={{ paddingRight: '40px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {displayOptions.map((opt, i) => {
            const correct = isCorrect(opt, i);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: correct ? '#e8f5e9' : '#fafafa',
                border: `1.5px solid ${correct ? '#66bb6a' : '#e0e0e0'}`,
                fontWeight: correct ? '700' : '400',
                color: correct ? '#2e7d32' : '#424242',
                fontSize: '14px',
              }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: '700',
                  background: correct ? '#43a047' : '#e0e0e0',
                  color: correct ? 'white' : '#757575',
                }}>
                  {correct ? '✓' : String.fromCharCode(0x05D0 + i) /* א ב ג ד */}
                </span>
                {opt.label}
                {correct && <span style={{ marginRight: 'auto', fontSize: '12px', color: '#43a047' }}>← תשובה נכונה</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Open-ended correct answer */}
      {expanded && q.question_type === 'open_ended' && parsed.value && (
        <div style={{
          paddingRight: '40px', padding: '10px 12px 10px 40px',
          background: '#e8f5e9', borderRadius: '8px',
          border: '1.5px solid #66bb6a', fontSize: '14px', color: '#2e7d32',
        }}>
          <strong>תשובה נכונה: </strong>{parsed.value}
        </div>
      )}

      {expanded && q.hint && (
        <div style={{ paddingRight: '40px', fontSize: '13px', color: '#f57c00' }}>
          💡 <strong>רמז:</strong> {q.hint}
        </div>
      )}
    </div>
  );
}

function QuestionEditCard({ draft, setDraft, onSave, onCancel }) {
  return (
    <div style={{ ...s.qCard, background: '#e3f2fd', flexDirection: 'column', gap: '12px' }}>
      <label style={s.editLabel}>טקסט השאלה</label>
      <textarea
        value={draft.question_text || ''}
        onChange={e => setDraft({ ...draft, question_text: e.target.value })}
        style={{ ...s.editInput, height: '70px' }}
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={s.editLabel}>סוג שאלה</label>
          <select value={draft.question_type || 'open_ended'}
            onChange={e => setDraft({ ...draft, question_type: e.target.value })}
            style={s.editInput}>
            <option value="single_choice">בחירה יחידה</option>
            <option value="multi_choice">בחירה מרובה</option>
            <option value="true_false">נכון/לא נכון</option>
            <option value="open_ended">פתוחה</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={s.editLabel}>רמת חשיבה</label>
          <select
            value={draft.thinking_level || 'Knowledge'}
            onChange={(e) => setDraft({ ...draft, thinking_level: e.target.value })}
            style={s.editInput}
          >
            {THINKING_LEVELS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label style={s.editLabel}>רמת הכשרה</label>
          <select
            value={draft.training_level || 'A'}
            onChange={(e) => setDraft({ ...draft, training_level: e.target.value })}
            style={s.editInput}
          >
            {TRAINING_LEVELS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onSave}   style={{ ...btnBase, background: '#388e3c' }}>💾 שמור</button>
        <button onClick={onCancel} style={{ ...btnBase, background: '#757575' }}>ביטול</button>
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
