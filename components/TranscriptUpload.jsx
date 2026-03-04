/**
 * Transcript Upload – upload SRT files, list transcripts, run match-all, generate questions
 * Hebrew: העלאת תמלילים
 */

import React, { useState, useEffect } from 'react';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import { entities } from '../config/appConfig';

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    padding: '32px 24px 48px',
    maxWidth: 820,
    margin: '0 auto',
    fontFamily: "'Heebo', 'Assistant', sans-serif",
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: '0 0 28px 0',
    fontSize: 15,
    color: '#555',
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 28,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #eee',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    display: 'block',
    marginBottom: 12,
    padding: '10px 12px',
    border: '1px solid #ccc',
    borderRadius: 8,
    fontSize: 14,
    direction: 'rtl',
    width: '100%',
    boxSizing: 'border-box',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: 8,
    transition: 'background-color 0.2s, opacity 0.2s',
  },
  buttonSecondary: {
    padding: '10px 20px',
    backgroundColor: '#5a5a5a',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    marginLeft: 8,
    transition: 'background-color 0.2s, opacity 0.2s',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: '14px 16px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    transition: 'background-color 0.15s',
  },
  note: {
    fontSize: 13,
    color: '#666',
    marginTop: 10,
    lineHeight: 1.5,
  },
  transcriptCard: {
    padding: 16,
    borderRadius: 10,
    border: '1px solid #e8e8e8',
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    backgroundColor: '#e8f4fc',
    color: '#0a5f8c',
  },
  addToBankCard: {
    padding: 24,
    borderRadius: 12,
    border: '2px solid #CC0000',
    backgroundColor: '#fffaf9',
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
  const [hierarchies, setHierarchies] = useState([]);
  const [selectedHierarchyId, setSelectedHierarchyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [completeToPerTranscript, setCompleteToPerTranscript] = useState({});

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transcripts', { cache: 'no-store' });
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
    loadList();
  }, []);

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
      const res = await fetch('/api/transcripts/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptId: t._id, count }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const questions = data.questions || [];
        setGeneratedQuestions(questions);
        setGeneratedForName(data.transcriptName || t.name);
        showToast(`נוצרו ${questions.length} שאלות`, 'success');
        await loadList();
      } else {
        showToast(data.error || 'יצירת שאלות נכשלה', 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleAddToBank = async () => {
    if (!selectedHierarchyId || generatedQuestions.length === 0) {
      showToast('בחר יחידה (היררכיה) או וודא שיש שאלות להוספה', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = generatedQuestions.map((q) => ({ ...q, hierarchy_id: selectedHierarchyId }));
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const created = Array.isArray(data) ? data : [data];
        showToast(`נוספו ${created.length} שאלות למאגר`, 'success');
        setGeneratedQuestions([]);
        setGeneratedForName(null);
        setSelectedHierarchyId('');
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
    const file = e.target?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.srt')) {
      showToast('נא לבחור קובץ SRT', 'warning');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/transcripts/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`הועלה: ${data.name || file.name}`, 'success');
        await loadList();
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

  return (
    <div style={styles.container} aria-label="העלאת תמלילים">
      <h1 style={styles.title}>העלאת תמלילים</h1>
      <p style={styles.subtitle}>
        העלה קבצי SRT, צור שאלות מתוך התמליל והוסף אותן למאגר. השאלות משמשות לתרגול חניכי קורסי פראמדיקים וסימולציות בחינה.
      </p>

      <div style={styles.section} role="region" aria-label="העלאת קובץ">
        <h2 style={styles.sectionTitle}>📤 העלאת קובץ SRT</h2>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="file"
            accept=".srt"
            onChange={handleFileChange}
            disabled={uploading}
            aria-label="בחר קובץ תמליל SRT"
            style={{ ...styles.input, marginBottom: 0, cursor: uploading ? 'not-allowed' : 'pointer' }}
          />
        </label>
        <p style={styles.note}>כל תמליל בקובץ נפרד. פורמט SRT בלבד.</p>
        {uploading && <LoadingSpinner />}
      </div>

      <div style={styles.section} role="region" aria-label="התאמת שאלות לתמלילים">
        <h2 style={styles.sectionTitle}>🔗 התאמת שאלות לתמלילים</h2>
        <button
          type="button"
          style={styles.buttonSecondary}
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

      <div style={styles.section} role="region" aria-label="רשימת תמלילים">
        <h2 style={styles.sectionTitle}>📄 תמלילים שהועלו ({list.length})</h2>
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
                  style={{
                    ...styles.transcriptCard,
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                    display: 'flex',
                    listStyle: 'none',
                  }}
                >
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {t.originalFilename && <span>{t.originalFilename} · </span>}
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('he-IL') : ''}
                    </div>
                  </div>
                  <span style={styles.badge}>{t.questionCount ?? 0} שאלות</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
                      style={styles.button}
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
        <div style={{ ...styles.section, ...styles.addToBankCard }} role="region" aria-label="הוספת שאלות למאגר">
          <h2 style={styles.sectionTitle}>
            ✅ נוצרו {generatedQuestions.length} שאלות {generatedForName ? `מתוך &quot;${generatedForName}&quot;` : ''}
          </h2>
          <p style={{ ...styles.note, marginBottom: 16 }}>בחר יחידת תוכן והוסף את השאלות למאגר:</p>
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
              style={styles.button}
              onClick={handleAddToBank}
              disabled={saving || !selectedHierarchyId}
              aria-label="הוסף למאגר"
            >
              {saving ? 'מוסיף...' : `הוסף ${generatedQuestions.length} למאגר`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
