/**
 * Book Content Library
 * Hebrew: מאגר תוכן ספר רפואת החירום
 *
 * Stores the full emergency-medicine textbook as a searchable knowledge base.
 * Content is entered per chapter (matching the existing question categories), so
 * the system can both verify whether a question's content appears in the book and
 * catalog/tag questions by chapter + sub-topic. Large volumes are chunked and
 * stored server-side (MongoDB), so this page requires the server to be connected.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { showToast } from './Toast';
import PermissionGate from './PermissionGate';
import { permissions } from '../utils/permissions';
import {
  QUESTION_CATEGORIES,
  getSubcategoriesForCategory,
} from '../shared/questionBankMetadata.js';
import {
  ingestBookChapter,
  getBookSummary,
  searchBook,
  clearBookCategory,
} from '../workflows/bookContent';

const nf = new Intl.NumberFormat('he-IL');

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch (_) {
    return '—';
  }
}

const styles = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px', direction: 'rtl' },
  title: { fontSize: 26, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' },
  subtitle: { color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.6 },
  tabs: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tab: (active) => ({
    padding: '10px 20px',
    borderRadius: 10,
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-primary)' : 'var(--color-bg-card)',
    color: active ? '#fff' : 'var(--color-text)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 15,
  }),
  card: {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 18,
  },
  label: { display: 'block', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, fontSize: 14 },
  field: { marginBottom: 16 },
  select: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
    color: 'var(--color-text)', fontSize: 14,
  },
  textarea: {
    width: '100%', minHeight: 280, padding: 12, borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
    color: 'var(--color-text)', fontSize: 14, lineHeight: 1.7, resize: 'vertical',
    fontFamily: 'inherit',
  },
  btn: (variant) => ({
    padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 15,
    background: variant === 'danger' ? '#c62828' : 'var(--color-primary)',
    color: '#fff',
  }),
  btnGhost: {
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-2)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid var(--color-border)',
    color: 'var(--color-text-muted)', fontWeight: 700, whiteSpace: 'nowrap',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' },
  statRow: { display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 },
  stat: { background: 'var(--color-primary-bg)', borderRadius: 12, padding: '12px 18px', minWidth: 140 },
  statNum: { fontSize: 24, fontWeight: 800, color: 'var(--color-primary-dark)' },
  statLabel: { fontSize: 13, color: 'var(--color-text-2)' },
  notice: {
    background: '#fff3e0', border: '1px solid #ffb74d', color: '#7a4a00',
    borderRadius: 10, padding: '12px 16px', marginBottom: 16, lineHeight: 1.6,
  },
  snippet: {
    background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8,
    padding: 12, margin: '8px 0', lineHeight: 1.7, color: 'var(--color-text)', whiteSpace: 'pre-wrap',
  },
  chip: {
    display: 'inline-block', background: 'var(--color-primary-bg)', color: 'var(--color-primary-dark)',
    borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, marginInlineStart: 6,
  },
};

const categoryOptions = QUESTION_CATEGORIES.map((c) => c.value);

export default function BookContentLibrary() {
  const [tab, setTab] = useState('add');
  const [summary, setSummary] = useState({ categories: [], total_chunks: 0, total_chars: 0 });
  const [loading, setLoading] = useState(true);
  const [serverDown, setServerDown] = useState(false);

  // Add-content form
  const firstCat = categoryOptions[0] || '';
  const [category, setCategory] = useState(firstCat);
  const [subTopic, setSubTopic] = useState('');
  const [text, setText] = useState('');
  const [replaceCategory, setReplaceCategory] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search
  const [query, setQuery] = useState('');
  const [searchCat, setSearchCat] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const subTopicOptions = useMemo(() => getSubcategoriesForCategory(category), [category]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBookSummary();
      setSummary(data || { categories: [], total_chunks: 0, total_chars: 0 });
      setServerDown(false);
    } catch (err) {
      setServerDown(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const charCount = text.length;

  const handleSave = async () => {
    if (text.trim().length < 40) {
      showToast('הדבק לפחות 40 תווים של תוכן', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await ingestBookChapter({
        category,
        subTopic: subTopic.trim(),
        text,
        replaceCategory,
      });
      showToast(
        `נשמרו ${nf.format(res.chunks_created)} קטעים (${nf.format(res.char_count)} תווים) לפרק "${category}"`,
        'success'
      );
      setText('');
      await loadSummary();
    } catch (err) {
      showToast('שמירה נכשלה: ' + (err?.message || 'שגיאה'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (query.trim().length < 2) {
      showToast('הזן לפחות 2 תווים לחיפוש', 'error');
      return;
    }
    setSearching(true);
    try {
      const data = await searchBook({ query: query.trim(), category: searchCat, limit: 25 });
      setResults(data);
    } catch (err) {
      showToast('החיפוש נכשל: ' + (err?.message || 'שגיאה'), 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleClear = async (cat) => {
    if (!window.confirm(`למחוק את כל תוכן הספר עבור הפרק "${cat}"? פעולה זו אינה הפיכה.`)) return;
    try {
      const res = await clearBookCategory(cat);
      showToast(`נמחקו ${nf.format(res.deleted)} קטעים מהפרק "${cat}"`, 'success');
      await loadSummary();
    } catch (err) {
      showToast('מחיקה נכשלה: ' + (err?.message || 'שגיאה'), 'error');
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>מאגר תוכן הספר</h1>
      <p style={styles.subtitle}>
        כאן יושב כל החומר של ספר רפואת החירום עליו מבוססות השאלות. הזן את תוכן הספר לפי פרקים
        (הפרקים תואמים לנושאים שכבר קיימים במערכת). המאגר מאפשר לבדוק האם שאלה מופיעה בספר,
        ומשמש את המערכת לקטלוג ותיוג שאלות לפי הנושא ותת-הנושא הנכונים.
      </p>

      {serverDown && (
        <div style={styles.notice}>
          לא ניתן להתחבר למאגר התוכן בשרת. עמוד זה דורש חיבור לשרת ולמסד הנתונים (MongoDB).
          ודא שהשרת פעיל ונסה לרענן.
        </div>
      )}

      <div style={styles.statRow}>
        <div style={styles.stat}>
          <div style={styles.statNum}>{nf.format(summary.total_chars || 0)}</div>
          <div style={styles.statLabel}>תווים במאגר</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNum}>{nf.format(summary.total_chunks || 0)}</div>
          <div style={styles.statLabel}>קטעים</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNum}>{nf.format((summary.categories || []).length)}</div>
          <div style={styles.statLabel}>פרקים עם תוכן</div>
        </div>
      </div>

      <div style={styles.tabs}>
        <button style={styles.tab(tab === 'add')} onClick={() => setTab('add')}>הוספת תוכן</button>
        <button style={styles.tab(tab === 'browse')} onClick={() => setTab('browse')}>עיון וחיפוש</button>
      </div>

      {tab === 'add' && (
        <PermissionGate
          permission={permissions.BOOK_CONTENT_MANAGE}
          fallback={<div style={styles.notice}>אין לך הרשאה להוספת תוכן. ניתן לעיין ולחפש בלשונית "עיון וחיפוש".</div>}
        >
          <div style={styles.card}>
            <div style={styles.field}>
              <label style={styles.label}>פרק (נושא)</label>
              <select
                style={styles.select}
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSubTopic(''); }}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>תת-נושא (אופציונלי)</label>
              <input
                style={styles.select}
                list="book-subtopics"
                value={subTopic}
                onChange={(e) => setSubTopic(e.target.value)}
                placeholder="בחר או הקלד תת-נושא"
              />
              <datalist id="book-subtopics">
                {subTopicOptions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                תוכן הפרק (טקסט חי)
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, marginInlineStart: 8 }}>
                  {nf.format(charCount)} תווים
                </span>
              </label>
              <textarea
                style={styles.textarea}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="הדבק כאן את תוכן הפרק מהספר. ניתן להדביק כמויות גדולות מאוד של טקסט — הוא יחולק אוטומטית לקטעים לאחזור."
              />
            </div>

            <div style={styles.field}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--color-text)' }}>
                <input
                  type="checkbox"
                  checked={replaceCategory}
                  onChange={(e) => setReplaceCategory(e.target.checked)}
                />
                החלף את התוכן הקיים של פרק זה (אם לא מסומן — התוכן יתווסף לקיים)
              </label>
            </div>

            <button style={styles.btn()} onClick={handleSave} disabled={saving}>
              {saving ? 'שומר...' : 'שמור תוכן לפרק'}
            </button>
          </div>
        </PermissionGate>
      )}

      {tab === 'browse' && (
        <>
          <div style={styles.card}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 280px' }}>
                <label style={styles.label}>חיפוש בתוכן הספר</label>
                <input
                  style={styles.select}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="הקלד מילה או ביטוי לבדיקה האם הוא מופיע בספר"
                />
              </div>
              <div style={{ flex: '0 1 240px' }}>
                <label style={styles.label}>סינון לפי פרק</label>
                <select style={styles.select} value={searchCat} onChange={(e) => setSearchCat(e.target.value)}>
                  <option value="">כל הפרקים</option>
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button style={styles.btn()} type="submit" disabled={searching}>
                {searching ? 'מחפש...' : 'חפש'}
              </button>
            </form>

            {results && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: 'var(--color-text-2)', marginBottom: 8 }}>
                  נמצאו {nf.format(results.total_matches || 0)} התאמות עבור "{results.query}"
                  {results.total_matches > (results.results?.length || 0) && ` (מוצגות ${results.results.length} הראשונות)`}
                </div>
                {(results.results || []).map((r) => (
                  <div key={r.id} style={styles.snippet}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={styles.chip}>{r.category}</span>
                      {r.sub_topic && <span style={styles.chip}>{r.sub_topic}</span>}
                    </div>
                    {r.snippet}
                  </div>
                ))}
                {results.total_matches === 0 && (
                  <div style={{ color: 'var(--color-text-muted)' }}>לא נמצאו התאמות — ייתכן שהתוכן אינו מופיע בספר.</div>
                )}
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--color-text)' }}>תוכן לפי פרקים</h3>
            {loading ? (
              <div style={{ color: 'var(--color-text-muted)' }}>טוען...</div>
            ) : (summary.categories || []).length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)' }}>עדיין לא הוזן תוכן. עבור ללשונית "הוספת תוכן".</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>פרק</th>
                      <th style={styles.th}>תווים</th>
                      <th style={styles.th}>קטעים</th>
                      <th style={styles.th}>עודכן</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.categories.map((c) => (
                      <tr key={c.category}>
                        <td style={styles.td}>{c.category}</td>
                        <td style={styles.td}>{nf.format(c.chars || 0)}</td>
                        <td style={styles.td}>{nf.format(c.chunks || 0)}</td>
                        <td style={styles.td}>{formatDate(c.updatedAt)}</td>
                        <td style={styles.td}>
                          <PermissionGate permission={permissions.BOOK_CONTENT_DELETE}>
                            <button style={styles.btnGhost} onClick={() => handleClear(c.category)}>
                              מחק תוכן
                            </button>
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
