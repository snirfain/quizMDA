/**
 * Question & Tag Statistics Dashboard (admin only)
 * Hebrew: לוח סטטיסטיקות שאלות ותיוגים
 *
 * Pulls every question from the bank and renders live, dynamic statistics:
 * totals, breakdowns by type / category / sub-category / thinking level /
 * training level / medical level / status / media. All numbers recompute
 * instantly as the admin changes the filters at the top — real data only.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { entities } from '../config/appConfig';
import LoadingSpinner from './LoadingSpinner';
import { showToast } from './Toast';
import {
  QUESTION_CATEGORIES,
  THINKING_LEVELS,
  TRAINING_LEVELS,
  MEDICAL_LEVELS,
  QUESTION_STATUSES,
  QUESTION_TYPES_UI,
  getSubcategoriesForCategory,
} from '../shared/questionBankMetadata.js';

const C = {
  primary: '#CC0000',
  text: '#212121',
  muted: '#757575',
  border: '#e6e6e6',
  bg: '#f7f8fa',
};

const PALETTE = ['#CC0000', '#1976d2', '#2e7d32', '#f57c00', '#6a1b9a', '#00838f', '#5d4037', '#c2185b'];

const labelOf = (list, value) => list.find((x) => x.value === value)?.label ?? value;

const ALL = '__all__';

export default function QuestionStatsDashboard() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const [filters, setFilters] = useState({
    category: ALL,
    subCategory: ALL,
    questionType: ALL,
    thinkingLevel: ALL,
    trainingLevel: ALL,
    medicalLevel: ALL,
    status: ALL,
    media: ALL, // ALL | with | without
    search: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const all = await entities.Question_Bank.find({}, { sort: { createdAt: -1 } });
      setQuestions(Array.isArray(all) ? all : []);
      setUpdatedAt(new Date());
    } catch (err) {
      console.error('[QuestionStatsDashboard] load failed:', err);
      showToast('טעינת השאלות נכשלה.', 'error');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'category') next.subCategory = ALL; // sub depends on category
      return next;
    });

  const resetFilters = () =>
    setFilters({
      category: ALL, subCategory: ALL, questionType: ALL, thinkingLevel: ALL,
      trainingLevel: ALL, medicalLevel: ALL, status: ALL, media: ALL, search: '',
    });

  // ── Apply filters (dynamic) ────────────────────────────────
  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return questions.filter((q) => {
      if (filters.category !== ALL && q.category !== filters.category) return false;
      if (filters.subCategory !== ALL && q.sub_category !== filters.subCategory) return false;
      if (filters.questionType !== ALL && q.question_type !== filters.questionType) return false;
      if (filters.thinkingLevel !== ALL && q.thinking_level !== filters.thinkingLevel) return false;
      if (filters.trainingLevel !== ALL && q.training_level !== filters.trainingLevel) return false;
      if (filters.medicalLevel !== ALL && !(Array.isArray(q.medical_levels) && q.medical_levels.includes(filters.medicalLevel))) return false;
      if (filters.status !== ALL && q.status !== filters.status) return false;
      if (filters.media === 'with' && !q.has_media) return false;
      if (filters.media === 'without' && q.has_media) return false;
      if (term && !(q.question_text || '').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [questions, filters]);

  // ── Aggregate breakdowns ───────────────────────────────────
  const stats = useMemo(() => {
    const total = filtered.length;

    const countBy = (accessor) => {
      const map = new Map();
      for (const q of filtered) {
        const v = accessor(q);
        const values = Array.isArray(v) ? (v.length ? v : ['—']) : [v ?? '—'];
        for (const key of values) {
          const k = key === '' || key == null ? '—' : key;
          map.set(k, (map.get(k) || 0) + 1);
        }
      }
      return map;
    };

    const toRows = (map, list) =>
      [...map.entries()]
        .map(([key, count]) => ({ key, label: list ? labelOf(list, key) : key, count }))
        .sort((a, b) => b.count - a.count);

    const byType = toRows(countBy((q) => q.question_type), QUESTION_TYPES_UI);
    const byStatus = toRows(countBy((q) => q.status), QUESTION_STATUSES);
    const byThinking = toRows(countBy((q) => q.thinking_level), THINKING_LEVELS);
    const byTraining = toRows(countBy((q) => q.training_level), TRAINING_LEVELS);
    const byMedical = toRows(countBy((q) => q.medical_levels), MEDICAL_LEVELS);
    const byCategory = toRows(countBy((q) => q.category));
    const bySub = toRows(countBy((q) => q.sub_category));
    const byMediaTag = toRows(countBy((q) => (q.media_bank_tag ? String(q.media_bank_tag) : null)))
      .filter((r) => r.key !== '—');

    const withMedia = filtered.filter((q) => q.has_media).length;
    const rollingCases = filtered.filter((q) => q.question_type === 'rolling_case').length;
    const distinctCategories = byCategory.filter((r) => r.key !== '—').length;
    const distinctSubs = bySub.filter((r) => r.key !== '—').length;

    return {
      total, withMedia, rollingCases, distinctCategories, distinctSubs,
      byType, byStatus, byThinking, byTraining, byMedical, byCategory, bySub, byMediaTag,
    };
  }, [filtered]);

  const exportCategoryCsv = () => {
    const rows = [['קטגוריה', 'מספר שאלות', 'אחוז'], ...stats.byCategory.map((r) => [
      r.label, r.count, stats.total ? `${((r.count / stats.total) * 100).toFixed(1)}%` : '0%',
    ])];
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `question-stats-by-category-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const subCategoryOptions = filters.category !== ALL ? getSubcategoriesForCategory(filters.category) : [];

  if (loading) {
    return <LoadingSpinner fullScreen message="טוען סטטיסטיקות שאלות..." />;
  }

  return (
    <div style={styles.page} dir="rtl">
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>סטטיסטיקות שאלות ותיוגים</h1>
          <p style={styles.subtitle}>
            לוח דינמי למנהל — כל המספרים מתעדכנים לפי הסינון. נתוני אמת ממאגר השאלות.
            {updatedAt && <span style={{ marginInlineStart: 8 }}>· עודכן: {updatedAt.toLocaleTimeString('he-IL')}</span>}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" onClick={load} style={styles.secondaryBtn}>רענן נתונים</button>
          <button type="button" onClick={exportCategoryCsv} style={styles.secondaryBtn}>ייצוא קטגוריות (CSV)</button>
        </div>
      </div>

      {/* ── Filters ── */}
      <section style={styles.filters}>
        <div style={styles.filterGrid}>
          <Field label="נושא">
            <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} style={styles.select}>
              <option value={ALL}>הכול</option>
              {QUESTION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="תת-נושא">
            <select
              value={filters.subCategory}
              onChange={(e) => setFilter('subCategory', e.target.value)}
              style={styles.select}
              disabled={filters.category === ALL}
            >
              <option value={ALL}>הכול</option>
              {subCategoryOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="סוג שאלה">
            <select value={filters.questionType} onChange={(e) => setFilter('questionType', e.target.value)} style={styles.select}>
              <option value={ALL}>הכול</option>
              {QUESTION_TYPES_UI.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="רמת חשיבה">
            <select value={filters.thinkingLevel} onChange={(e) => setFilter('thinkingLevel', e.target.value)} style={styles.select}>
              <option value={ALL}>הכול</option>
              {THINKING_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="רמת קושי (הכשרה)">
            <select value={filters.trainingLevel} onChange={(e) => setFilter('trainingLevel', e.target.value)} style={styles.select}>
              <option value={ALL}>הכול</option>
              {TRAINING_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="רמה רפואית">
            <select value={filters.medicalLevel} onChange={(e) => setFilter('medicalLevel', e.target.value)} style={styles.select}>
              <option value={ALL}>הכול</option>
              {MEDICAL_LEVELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="סטטוס">
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} style={styles.select}>
              <option value={ALL}>הכול</option>
              {QUESTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="מדיה">
            <select value={filters.media} onChange={(e) => setFilter('media', e.target.value)} style={styles.select}>
              <option value={ALL}>הכול</option>
              <option value="with">עם מדיה</option>
              <option value="without">בלי מדיה</option>
            </select>
          </Field>
          <Field label="חיפוש בטקסט">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="מילה בשאלה…"
              style={styles.input}
            />
          </Field>
        </div>
        <div style={styles.filterFooter}>
          <span style={styles.muted}>
            מציג <strong>{stats.total}</strong> מתוך <strong>{questions.length}</strong> שאלות
          </span>
          <button type="button" onClick={resetFilters} style={styles.linkBtn}>איפוס סינון</button>
        </div>
      </section>

      {/* ── KPI cards ── */}
      <section style={styles.kpiGrid}>
        <Kpi value={stats.total} label="שאלות (לאחר סינון)" sub={`מתוך ${questions.length} סה"כ`} />
        <Kpi value={stats.distinctCategories} label="נושאים בשימוש" sub={`מתוך ${QUESTION_CATEGORIES.length} פרקים`} />
        <Kpi value={stats.distinctSubs} label="תתי-נושא בשימוש" />
        <Kpi value={stats.rollingCases} label="שאלות מתגלגלות" />
        <Kpi
          value={`${stats.total ? ((stats.withMedia / stats.total) * 100).toFixed(0) : 0}%`}
          label="עם מדיה"
          sub={`${stats.withMedia} שאלות`}
        />
      </section>

      {/* ── Breakdown grid ── */}
      <div style={styles.breakdownGrid}>
        <BreakdownCard title="לפי סוג שאלה" rows={stats.byType} total={stats.total} color={PALETTE[0]} />
        <BreakdownCard title="לפי סטטוס" rows={stats.byStatus} total={stats.total} color={PALETTE[1]} />
        <BreakdownCard title="לפי רמת חשיבה" rows={stats.byThinking} total={stats.total} color={PALETTE[2]} />
        <BreakdownCard title="לפי רמת קושי (הכשרה)" rows={stats.byTraining} total={stats.total} color={PALETTE[3]} />
        <BreakdownCard title="לפי רמה רפואית" rows={stats.byMedical} total={stats.total} color={PALETTE[4]} note="שאלה יכולה להשתייך לכמה רמות" />
        <BreakdownCard title="תגיות מאגר מדיה" rows={stats.byMediaTag} total={stats.total} color={PALETTE[5]} emptyText="אין שאלות עם תגית מדיה" />
      </div>

      {/* ── Category table (full) ── */}
      <section style={styles.tableCard}>
        <h2 style={styles.cardTitle}>פירוט לפי נושא ({stats.byCategory.length})</h2>
        <div style={styles.tableWrap} className="responsive-table-cards table-wrap">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>נושא</th>
                <th style={{ ...styles.th, width: 120 }}>שאלות</th>
                <th style={{ ...styles.th, width: 90 }}>אחוז</th>
                <th style={{ ...styles.th, width: '40%' }}>התפלגות</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCategory.map((r) => {
                const pct = stats.total ? (r.count / stats.total) * 100 : 0;
                return (
                  <tr key={r.key}>
                    <td style={styles.td}>{r.label}</td>
                    <td style={{ ...styles.td, fontWeight: 700 }} data-label="שאלות">{r.count}</td>
                    <td style={styles.td} data-label="אחוז">{pct.toFixed(1)}%</td>
                    <td style={styles.td} data-label="התפלגות">
                      <div style={styles.barTrack}>
                        <div style={{ ...styles.barFill, width: `${pct}%`, background: C.primary }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {stats.byCategory.length === 0 && (
                <tr><td style={styles.td} colSpan={4}>אין נתונים לסינון הנוכחי.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Sub-category table (full) ── */}
      <section style={styles.tableCard}>
        <h2 style={styles.cardTitle}>פירוט לפי תת-נושא ({stats.bySub.length})</h2>
        <div style={styles.tableWrap} className="responsive-table-cards table-wrap">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>תת-נושא</th>
                <th style={{ ...styles.th, width: 120 }}>שאלות</th>
                <th style={{ ...styles.th, width: 90 }}>אחוז</th>
              </tr>
            </thead>
            <tbody>
              {stats.bySub.map((r) => (
                <tr key={r.key}>
                  <td style={styles.td}>{r.label}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }} data-label="שאלות">{r.count}</td>
                  <td style={styles.td} data-label="אחוז">{stats.total ? ((r.count / stats.total) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
              {stats.bySub.length === 0 && (
                <tr><td style={styles.td} colSpan={3}>אין נתונים לסינון הנוכחי.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────
function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function Kpi({ value, label, sub }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
      {sub && <div style={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

function BreakdownCard({ title, rows, total, color, note, emptyText }) {
  return (
    <div style={styles.breakCard}>
      <h3 style={styles.breakTitle}>{title}</h3>
      {note && <div style={styles.breakNote}>{note}</div>}
      {rows.length === 0 ? (
        <div style={styles.muted}>{emptyText || 'אין נתונים.'}</div>
      ) : (
        <div style={styles.breakList}>
          {rows.map((r) => {
            const pct = total ? (r.count / total) * 100 : 0;
            return (
              <div key={r.key} style={styles.breakRow}>
                <div style={styles.breakRowHead}>
                  <span style={styles.breakRowLabel} title={r.label}>{r.label}</span>
                  <span style={styles.breakRowCount}>{r.count} · {pct.toFixed(1)}%</span>
                </div>
                <div style={styles.barTrack}>
                  <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
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
  page: { maxWidth: 1400, margin: '0 auto', padding: '24px 16px', color: C.text },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 800, margin: 0 },
  subtitle: { color: C.muted, marginTop: 6, fontSize: 14, lineHeight: 1.6 },
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  secondaryBtn: { padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },

  filters: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: C.muted },
  select: { padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, background: '#fff', fontFamily: 'inherit', maxWidth: '100%' },
  input: { padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit' },
  filterFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 },
  linkBtn: { background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 14, fontWeight: 600, textDecoration: 'underline' },
  muted: { color: C.muted, fontSize: 13 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 },
  kpiCard: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, textAlign: 'center' },
  kpiValue: { fontSize: 36, fontWeight: 800, color: C.primary, lineHeight: 1.1 },
  kpiLabel: { fontSize: 14, fontWeight: 700, marginTop: 6 },
  kpiSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  breakdownGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 },
  breakCard: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 },
  breakTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 4px' },
  breakNote: { fontSize: 11, color: C.muted, marginBottom: 8 },
  breakList: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 },
  breakRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  breakRowHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  breakRowLabel: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' },
  breakRowCount: { fontSize: 12, color: C.muted, whiteSpace: 'nowrap' },

  barTrack: { height: 8, background: C.bg, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, transition: 'width 0.25s ease', minWidth: 2 },

  tableCard: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: 700, margin: '0 0 12px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'right', background: C.bg, fontWeight: 700, fontSize: 13, borderBottom: `2px solid ${C.border}` },
  td: { padding: '10px 12px', textAlign: 'right', fontSize: 13, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' },
};
