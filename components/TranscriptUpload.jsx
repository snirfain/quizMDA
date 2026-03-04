/**
 * Transcript Upload – upload SRT files, list transcripts, run match-all, generate questions
 * Hebrew: העלאת תמלילים
 */

import React, { useState, useEffect } from 'react';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { entities } from '../config/appConfig';

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    padding: 'var(--space-8) var(--space-6) 48px',
    maxWidth: 820,
    margin: '0 auto',
  },
  title: {
    margin: '0 0 var(--space-2) 0',
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  subtitle: {
    margin: '0 0 var(--space-6) 0',
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-2)',
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 'var(--space-6)',
    padding: 'var(--space-6)',
  },
  sectionTitle: {
    margin: '0 0 var(--space-4) 0',
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    color: 'var(--color-text)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  input: {
    display: 'block',
    marginBottom: 'var(--space-3)',
    padding: '10px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-base)',
    direction: 'rtl',
    width: '100%',
    boxSizing: 'border-box',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: 'var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  note: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    marginTop: 'var(--space-2)',
    lineHeight: 1.5,
  },
  badge: {
    display: 'inline-block',
    padding: '2px var(--space-2)',
    borderRadius: 'var(--radius-md)',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: 'var(--color-info-bg)',
    color: 'var(--color-info)',
  },
  addToBankCard: {
    border: '2px solid var(--mda-red)',
    backgroundColor: 'var(--mda-red-bg)',
    boxShadow: '0 2px 8px rgba(204,0,0,0.08)',
  },
};

const MIN_GENERATE = 1;
const MAX_GENERATE = 50;
const DEFAULT_COMPLETE_TO = 10;

export default function TranscriptUpload() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [generatedForName, setGeneratedForName] = useState(null);
  const [selectedForAdd, setSelectedForAdd] = useState(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [hierarchies, setHierarchies] = useState([]);
  const [selectedHierarchyId, setSelectedHierarchyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [completeToPerTranscript, setCompleteToPerTranscript] = useState({});
  const [selectedForBatch, setSelectedForBatch] = useState(new Set());
  const [batchCount, setBatchCount] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [transcriptToDelete, setTranscriptToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editFullText, setEditFullText] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const loadList = async (search = searchQuery) => {
    setLoading(true);
    try {
      const url = search.trim() ? `/api/transcripts?search=${encodeURIComponent(search.trim())}` : '/api/transcripts';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      showToast('שגיאה בטעינת רשימת התמלילים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => loadList(searchQuery), searchQuery ? 250 : 0);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadHierarchies = async () => {
    try {
      const all = await entities.Content_Hierarchy.find({});
      setHierarchies(Array.isArray(all) ? all : []);
      if (all?.length && !selectedHierarchyId) setSelectedHierarchyId(all[0].id || '');
    } catch (e) {
      console.error('Error loading hierarchies:', e);
    }
  };

  useEffect(() => {
    if (generatedQuestions.length > 0) loadHierarchies();
  }, [generatedQuestions.length]);

  const getCompleteTo = (t) => completeToPerTranscript[t._id] ?? DEFAULT_COMPLETE_TO;
  const setCompleteTo = (tid, value) => {
    const n = Math.min(MAX_GENERATE, Math.max(MIN_GENERATE, parseInt(value, 10) || DEFAULT_COMPLETE_TO));
    setCompleteToPerTranscript((prev) => ({ ...prev, [tid]: n }));
  };

  const getGenerateCount = (t) => {
    const completeTo = getCompleteTo(t);
    const current = t.questionCount ?? 0;
    return Math.max(0, Math.min(MAX_GENERATE, completeTo - current));
  };

  const toggleBatchSelect = (id) => {
    setSelectedForBatch((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllForBatch = () => setSelectedForBatch(new Set(list.map((t) => t._id)));
  const clearBatchSelection = () => setSelectedForBatch(new Set());

  const isRenderHost = typeof window !== 'undefined' && window.location?.hostname?.includes('onrender.com');

  const wakeServerIfNeeded = async () => {
    if (!isRenderHost) return;
    const maxAttempts = 10;
    const delayMs = 3000;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const r = await fetch('/api/health', { method: 'GET' });
        if (r.ok) {
          await new Promise((r) => setTimeout(r, 6000));
          return;
        }
      } catch (_) {}
      if (i < maxAttempts - 1) await new Promise((res) => setTimeout(res, delayMs));
    }
    await new Promise((r) => setTimeout(r, 6000));
  };

  const CHUNK_SIZE = 3;

  const callGenerateQuestions = async (body, retriesLeft = 2) => {
    const res = await fetch('/api/transcripts/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 503 && retriesLeft > 0) {
      const delay = retriesLeft === 2 ? 10000 : 20000;
      showToast(`השרת לא זמין. ניסיון חוזר בעוד ${delay / 1000} שניות...`, 'info');
      await new Promise((r) => setTimeout(r, delay));
      return callGenerateQuestions(body, retriesLeft - 1);
    }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const runChunkedGeneration = async (baseBody, totalWanted, transcriptNameLabel) => {
    const allQuestions = [];
    const seenTexts = new Set();
    let excludeQuestionTexts = [];
    const numChunks = Math.ceil(totalWanted / CHUNK_SIZE);
    for (let i = 0; i < numChunks; i++) {
      const want = i === numChunks - 1 ? totalWanted - i * CHUNK_SIZE : CHUNK_SIZE;
      if (want < 1) break;
      showToast(`יוצר שאלות חלק ${i + 1}/${numChunks}...`, 'info');
      const body = { ...baseBody, count: want, excludeQuestionTexts };
      const { res, data } = await callGenerateQuestions(body);
      if (!res.ok) {
        const msg = data.error || (res.status === 503 ? 'השרת לא זמין.' : 'יצירת שאלות נכשלה');
        showToast(msg, 'error');
        return { questions: allQuestions, failed: true };
      }
      const chunk = (data.questions || []).filter((q) => {
        const text = (q.question_text || '').trim();
        if (!text || seenTexts.has(text)) return false;
        seenTexts.add(text);
        return true;
      });
      allQuestions.push(...chunk);
      excludeQuestionTexts = excludeQuestionTexts.concat(chunk.map((q) => (q.question_text || '').trim()).filter(Boolean));
    }
    return { questions: allQuestions, failed: false };
  };

  const handleGenerateBatch = async () => {
    const ids = Array.from(selectedForBatch);
    if (ids.length === 0) {
      showToast('בחר לפחות תמליל אחד', 'warning');
      return;
    }
    const n = Math.min(MAX_GENERATE * 2, Math.max(1, parseInt(batchCount, 10) || 20));
    setGeneratingId('batch');
    setGeneratedQuestions([]);
    setGeneratedForName(null);
    try {
      await wakeServerIfNeeded();
      const baseBody = { transcriptIds: ids };
      const transcriptNameLabel = ids.length === 1 ? list.find((x) => x._id === ids[0])?.name : `${ids.length} תמלילים`;
      const { questions, failed } = await runChunkedGeneration(baseBody, n, transcriptNameLabel);
      setGeneratedQuestions(questions);
      setGeneratedForName(transcriptNameLabel);
      setSelectedForAdd(new Set(questions.map((_, i) => i)));
      setExpandedQuestions(new Set());
      if (questions.length > 0) {
        showToast(failed ? `נוצרו ${questions.length} שאלות (חלק נכשל). אשר נבחרות והוסף למאגר` : `נוצרו ${questions.length} שאלות – אשר נבחרות והוסף למאגר`, failed ? 'warning' : 'success');
        await loadList(searchQuery);
      } else if (!failed) showToast('לא נוצרו שאלות', 'warning');
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerate = async (t) => {
    const count = getGenerateCount(t);
    if (count < 1) {
      showToast('התמליל כבר מכיל מספיק שאלות לפי "השלמה ל־" שבחרת', 'warning');
      return;
    }
    setGeneratingId(t._id);
    setGeneratedQuestions([]);
    setGeneratedForName(null);
    try {
      await wakeServerIfNeeded();
      const baseBody = { transcriptId: t._id };
      const { questions, failed } = await runChunkedGeneration(baseBody, count, t.name);
      setGeneratedQuestions(questions);
      setGeneratedForName(t.name);
      setSelectedForAdd(new Set(questions.map((_, i) => i)));
      setExpandedQuestions(new Set());
      if (questions.length > 0) {
        showToast(failed ? `נוצרו ${questions.length} שאלות (חלק נכשל). אשר נבחרות והוסף למאגר` : `נוצרו ${questions.length} שאלות – אשר נבחרות והוסף למאגר`, failed ? 'warning' : 'success');
        await loadList(searchQuery);
      } else if (!failed) showToast('לא נוצרו שאלות', 'warning');
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  const selectedCount = selectedForAdd.size;
  const toggleExpanded = (index) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const getCorrectAnswerLabels = (q) => {
    const opts = q.options || [];
    const ca = q.correct_answer;
    if (!ca) return [];
    if (ca.value === 'true' || ca.value === 'false') {
      const fromOpt = opts.find((o) => String(o.value) === String(ca.value))?.label;
      return [fromOpt || (ca.value === 'true' ? 'נכון' : 'לא נכון')];
    }
    if (Array.isArray(ca.values)) return ca.values.map((v) => opts.find((o) => String(o.value) === String(v))?.label).filter(Boolean);
    const o = opts.find((opt) => String(opt.value) === String(ca.value));
    return o ? [o.label] : [];
  };
  const selectedHierarchyLabel = selectedHierarchyId && hierarchies.find((h) => h.id === selectedHierarchyId);
  const toggleSelectQuestion = (index) => {
    setSelectedForAdd((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const selectAllQuestions = () => setSelectedForAdd(new Set(generatedQuestions.map((_, i) => i)));
  const clearSelection = () => setSelectedForAdd(new Set());

  const handleAddToBank = async () => {
    if (!selectedHierarchyId || selectedCount === 0) {
      showToast('בחר יחידה ובחר לפחות שאלה אחת להוספה', 'warning');
      return;
    }
    const toAdd = generatedQuestions.filter((_, i) => selectedForAdd.has(i));
    setSaving(true);
    try {
      const payload = toAdd.map((q) => ({ ...q, hierarchy_id: selectedHierarchyId }));
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const created = Array.isArray(data) ? data : [data];
        showToast(`נוספו ${created.length} שאלות למאגר`, 'success');
        const remaining = generatedQuestions.filter((_, i) => !selectedForAdd.has(i));
        setGeneratedQuestions(remaining);
        setSelectedForAdd(new Set(remaining.map((_, i) => i)));
        setExpandedQuestions(new Set());
        if (remaining.length === 0) setGeneratedForName(null);
        await loadList();
      } else {
        showToast(data.error || 'הוספה למאגר נכשלה', 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const fileList = e.target?.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => f.name && f.name.toLowerCase().endsWith('.srt'));
    if (files.length === 0) {
      showToast('נא לבחור קבצי SRT', 'warning');
      e.target.value = '';
      return;
    }
    if (files.length !== fileList.length) {
      showToast(`הועלו רק קבצי SRT (${files.length} מתוך ${fileList.length})`, 'warning');
    }
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of files) {
        form.append('file', file);
      }
      form.append('filenames', JSON.stringify(files.map((f) => f.name)));
      const res = await fetch('/api/transcripts/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const count = data.uploaded ?? (data.id ? 1 : 0);
        const items = data.items || (data.id ? [data] : []);
        if (count > 1) {
          showToast(`הועלו ${count} תמלילים`, 'success');
        } else if (items[0]) {
          showToast(`הועלה: ${items[0].name}`, 'success');
        } else {
          showToast('הועלה', 'success');
        }
        await loadList(searchQuery);
      } else {
        showToast(data.error || 'העלאה נכשלה', 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const runMatchAll = async () => {
    setMatching(true);
    try {
      const res = await fetch('/api/transcripts/match-all', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`עודכנו ${data.updated || 0} שאלות מתוך ${data.total || 0}`, 'success');
      } else {
        showToast(data.error || 'הרצת התאמה נכשלה', 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setMatching(false);
    }
  };

  const handleDeleteTranscript = async () => {
    if (!transcriptToDelete) return;
    const id = transcriptToDelete._id;
    setTranscriptToDelete(null);
    try {
      const res = await fetch(`/api/transcripts/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('התמליל נמחק', 'success');
        loadList(searchQuery);
      } else {
        showToast(data.error || 'מחיקה נכשלה', 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    }
  };

  const openEdit = async (t) => {
    setEditingId(t._id);
    setEditName(t.name);
    setEditFullText('');
    setEditLoading(true);
    try {
      const res = await fetch(`/api/transcripts/${t._id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditName(data.name || t.name);
        setEditFullText(data.fullText || '');
      } else {
        showToast(data.error || 'טעינת תמליל נכשלה', 'error');
        setEditingId(null);
      }
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
      setEditingId(null);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editName.trim()) {
      showToast('יש להזין שם תמליל', 'warning');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/transcripts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), fullText: editFullText }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('התמליל עודכן', 'success');
        setEditingId(null);
        loadList(searchQuery);
      } else {
        showToast(data.error || 'עדכון נכשל', 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div style={styles.container} aria-label="העלאת תמלילים">
      <h1 style={styles.title}>העלאת תמלילים</h1>
      <p style={styles.subtitle}>
        העלה קבצי SRT, צור שאלות מתוך התמליל והוסף אותן למאגר. השאלות משמשות לתרגול חניכי קורסי פראמדיקים וסימולציות בחינה.
      </p>

      <div className="card" style={styles.section} role="region" aria-label="העלאת קובץ">
        <h2 style={styles.sectionTitle}>📤 העלאת קובץ SRT</h2>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="file"
            accept=".srt"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
            aria-label="בחר קבצי תמליל SRT (ניתן לבחור כמה)"
            style={{ ...styles.input, marginBottom: 0, cursor: uploading ? 'not-allowed' : 'pointer' }}
          />
        </label>
        <p style={styles.note}>ניתן לבחור קובץ אחד או רבים (עד 200). פורמט SRT בלבד.</p>
        {uploading && <LoadingSpinner />}
      </div>

      <div className="card" style={styles.section} role="region" aria-label="התאמת שאלות לתמלילים">
        <h2 style={styles.sectionTitle}>🔗 התאמת שאלות לתמלילים</h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={runMatchAll}
          disabled={matching || list.length === 0}
          aria-label="הרץ התאמה לכל השאלות"
        >
          {matching ? 'מריץ...' : 'הרץ התאמה לכל השאלות'}
        </button>
        <p style={styles.note}>
          עובר על כל השאלות במאגר, מוצא תמליל שמכיל את השאלה ומתייג בשם התמליל. שאלה שלא נמצא לה תמליל מתויגת &quot;לא נמצא בתמלול&quot;.
        </p>
      </div>

      <div className="card" style={styles.section} role="region" aria-label="רשימת תמלילים">
        <h2 style={styles.sectionTitle}>📄 תמלילים שהועלו ({list.length})</h2>
        <input
          type="search"
          placeholder="חיפוש לפי שם תמליל או תוכן..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="חיפוש תמלילים"
          style={{ ...styles.input, marginBottom: 16 }}
        />
        {list.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '12px 0', borderBottom: '1px solid #eee' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>צור שאלות מתמלילים מרובים / מכולם:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              כמות שאלות
              <input
                type="number"
                min={1}
                max={100}
                value={batchCount}
                onChange={(e) => setBatchCount(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 20)))}
                style={{ width: 56, padding: '6px 8px', ...styles.input }}
              />
            </label>
            <button type="button" className="btn btn-secondary" onClick={selectAllForBatch} aria-label="בחר כל התמלילים">
              בחר הכל
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearBatchSelection} aria-label="נקה בחירה">
              נקה
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>נבחרו: {selectedForBatch.size}</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateBatch}
              disabled={generatingId !== null || selectedForBatch.size === 0}
              aria-label="צור שאלות מתמלילים נבחרים"
            >
              {generatingId === 'batch' ? 'יוצר...' : `צור מתמלילים נבחרים (${selectedForBatch.size})`}
            </button>
          </div>
        )}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ul style={styles.list}>
            {list.length === 0 ? (
              <li style={{ ...styles.listItem, justifyContent: 'center', color: '#888' }}>
                אין תמלילים. העלה קובץ SRT בסעיף למעלה.
              </li>
            ) : (
              list.map((t) => (
                <li
                  key={t._id || t.name}
                  className="list-card card-interactive"
                  style={{
                    marginBottom: 'var(--space-3)',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    alignItems: 'center',
                    display: 'flex',
                    listStyle: 'none',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }} title="לבחירה ליצירה מרובה">
                    <input
                      type="checkbox"
                      checked={selectedForBatch.has(t._id)}
                      onChange={() => toggleBatchSelect(t._id)}
                      aria-label={`בחר לתמליל ${t.name} ליצירה מרובה`}
                    />
                    <span style={{ fontSize: 12, color: '#666' }}>ליצירה מרובה</span>
                  </label>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {t.originalFilename && <span>{t.originalFilename} · </span>}
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('he-IL') : ''}
                    </div>
                  </div>
                  <span style={styles.badge}>{t.questionCount ?? 0} שאלות</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEdit(t)}
                      disabled={editingId != null}
                      aria-label={`ערוך תמליל ${t.name}`}
                    >
                      ערוך
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setTranscriptToDelete(t)}
                      disabled={!!transcriptToDelete}
                      aria-label={`מחק תמליל ${t.name}`}
                    >
                      מחק
                    </button>
                    <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>השלמה ל־</span>
                      <input
                        type="number"
                        min={MIN_GENERATE}
                        max={MAX_GENERATE}
                        value={getCompleteTo(t)}
                        onChange={(e) => setCompleteTo(t._id, e.target.value)}
                        style={{ width: 52, padding: '6px 8px', margin: 0, ...styles.input }}
                        aria-label={`השלמה ל־ ${t.name}`}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleGenerate(t)}
                      disabled={generatingId !== null || getGenerateCount(t) < 1}
                      aria-label={`צור שאלות מתמליל ${t.name}`}
                    >
                      {generatingId === t._id ? 'יוצר...' : 'צור שאלות'}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {generatedQuestions.length > 0 && (
        <div className="card" style={{ ...styles.section, ...styles.addToBankCard }} role="region" aria-label="אישור והוספת שאלות למאגר">
          <h2 style={styles.sectionTitle}>
            ✅ נוצרו {generatedQuestions.length} שאלות {generatedForName ? `מתוך &quot;${generatedForName}&quot;` : ''}
          </h2>
          <p style={{ ...styles.note, marginBottom: 12 }}>סמן את השאלות שאיתן ברצונך להוסיף למאגר (אחת אחת או בקבוצה):</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={selectAllQuestions} aria-label="בחר הכל">
              בחר הכל
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearSelection} aria-label="נקה בחירה">
              נקה בחירה
            </button>
            <span style={{ alignSelf: 'center', fontSize: 14, color: '#666' }}>נבחרו: {selectedCount}</span>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 20, border: '1px solid #eee', borderRadius: 8, padding: 8, backgroundColor: '#fafafa' }}>
            {generatedQuestions.map((q, i) => {
              const expanded = expandedQuestions.has(i);
              const correctLabels = getCorrectAnswerLabels(q);
              const typeLabel = { single_choice: 'חד־ברירה', multi_choice: 'רב־ברירה', true_false: 'נכון/לא נכון', open_ended: 'פתוחה', ordering: 'סדר' }[q.question_type] || q.question_type;
              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 8,
                    borderRadius: 8,
                    backgroundColor: selectedForAdd.has(i) ? '#fff' : '#f0f0f0',
                    border: `1px solid ${selectedForAdd.has(i) ? '#CC0000' : '#e0e0e0'}`,
                    textAlign: 'right',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedForAdd.has(i)}
                        onChange={() => toggleSelectQuestion(i)}
                        aria-label={`אשר שאלה ${i + 1}`}
                      />
                      <span style={{ marginRight: 6 }}>בחר</span>
                    </label>
                    <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5, minWidth: 0 }}>
                      {q.question_text ? (q.question_text.length > 120 && !expanded ? q.question_text.slice(0, 120) + '…' : q.question_text) : '(ללא טקסט)'}
                    </span>
                    <span style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>{typeLabel}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={(e) => { e.preventDefault(); toggleExpanded(i); }}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'כווץ' : 'הרחב להצגה מלאה'}
                    >
                      {expanded ? '△ כווץ' : '▽ הצג מלא'}
                    </button>
                  </div>
                  {expanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee', fontSize: 14, lineHeight: 1.6 }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: '#333' }}>גזע (שאלה):</strong>
                        <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{q.question_text || '—'}</p>
                      </div>
                      {(q.options || []).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <strong style={{ color: '#333' }}>מסיחים (אפשרויות):</strong>
                          <ul style={{ margin: '4px 0 0 0', paddingRight: 20, listStyle: 'disc' }}>
                            {(q.options || []).map((opt, j) => (
                              <li key={j}>{opt.label}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {correctLabels.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <strong style={{ color: '#0a5f8c' }}>תשובה נכונה:</strong>
                          <p style={{ margin: '4px 0 0 0', color: '#0a5f8c' }}>{correctLabels.join(' · ')}</p>
                        </div>
                      )}
                      {q.explanation && (
                        <div style={{ marginBottom: 8 }}>
                          <strong style={{ color: '#333' }}>הסבר:</strong>
                          <p style={{ margin: '4px 0 0 0' }}>{q.explanation}</p>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#666' }}>
                        <span><strong>תגיות:</strong> {(q.tags && q.tags.length) ? q.tags.join(', ') : '—'}</span>
                        <span><strong>קטגוריה (לאחר הוספה):</strong> {selectedHierarchyLabel ? (selectedHierarchyLabel.category_name || selectedHierarchyLabel.topic_name || selectedHierarchyLabel.id) : '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ ...styles.note, marginBottom: 12 }}>יחידת תוכן להוספה:</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <select
              value={selectedHierarchyId}
              onChange={(e) => setSelectedHierarchyId(e.target.value)}
              style={{ ...styles.input, width: 'auto', minWidth: 200, margin: 0 }}
              aria-label="בחר יחידה"
            >
              {hierarchies.length === 0 && <option value="">טוען יחידות...</option>}
              {hierarchies.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.category_name || h.topic_name || h.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddToBank}
              disabled={saving || !selectedHierarchyId || selectedCount === 0}
              aria-label="הוסף למאגר"
            >
              {saving ? 'מוסיף...' : `הוסף ${selectedCount} למאגר`}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!transcriptToDelete}
        onClose={() => setTranscriptToDelete(null)}
        onConfirm={handleDeleteTranscript}
        title="מחיקת תמליל"
        message={transcriptToDelete ? `למחוק את התמליל "${transcriptToDelete.name}"? פעולה זו לא ניתנת לביטול.` : ''}
        confirmText="מחק"
        cancelText="ביטול"
        danger={true}
      />

      <Modal
        isOpen={!!editingId}
        onClose={() => !editSaving && setEditingId(null)}
        title="עריכת תמליל"
        size="lg"
        ariaLabel="עריכת תמליל"
      >
        <div style={{ padding: 8 }}>
          {editLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>שם התמליל</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ ...styles.input, marginBottom: 16 }}
                aria-label="שם התמליל"
              />
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>תוכן התמליל</label>
              <textarea
                value={editFullText}
                onChange={(e) => setEditFullText(e.target.value)}
                rows={14}
                style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit' }}
                aria-label="תוכן התמליל"
                dir="rtl"
              />
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                  {editSaving ? 'שומר...' : 'שמור'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)} disabled={editSaving}>
                  ביטול
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
