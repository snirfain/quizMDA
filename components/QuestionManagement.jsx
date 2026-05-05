/**
 * Question Management Component (Instructor)
 * List, create, edit, delete questions
 * Hebrew: ניהול שאלות
 */

import React, { useState, useEffect, useRef } from 'react';
import { entities, appConfig } from '../config/appConfig';
import { getCurrentUser } from '../utils/auth';
import QuestionEditor from './QuestionEditor';
import QuestionImport from './QuestionImport';
import SearchBar from './SearchBar';
import LoadingSpinner from './LoadingSpinner';
import ConfirmDialog from './ConfirmDialog';
import { showToast } from './Toast';
import { permissions } from '../utils/permissions';
import PermissionGate from './PermissionGate';
import {
  getPendingQuestions,
  approveQuestion,
  rejectQuestion,
  requestRevision,
  bulkApproveQuestions,
  getReviewStatistics
} from '../workflows/questionReview';
import { reclassifyUnanalyzedQuestionsWithAI } from '../workflows/questionClassification';
import { MIN_ATTEMPTS_FOR_RATING } from '../workflows/difficultyEngine';
import { fixQuestionWithAI } from '../workflows/questionEnrich';
import {
  QUESTION_CATEGORIES,
  THINKING_LEVELS,
  TRAINING_LEVELS,
  QUESTION_STATUSES,
  PLACEHOLDER_SUBCATEGORIES_BY_CATEGORY,
} from '../shared/questionBankMetadata.js';
import { syncQuestionsFromServer } from '../mockEntities.js';

/** Custom dropdown for filters — avoids native select dropdown positioning issues in RTL. */
function FilterDropdown({ value, onChange, options, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  const label = options.find(o => o.value === value)?.label ?? value;
  return (
    <div ref={ref} style={{ position: 'relative', width: '160px', minWidth: '120px', flexShrink: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          fontSize: '14px',
          direction: 'rtl',
          textAlign: 'right',
          cursor: 'pointer',
          backgroundColor: '#fff',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span>{label}</span>
        <span style={{ opacity: 0.7 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            margin: 0,
            marginTop: '2px',
            padding: 0,
            listStyle: 'none',
            minWidth: '100%',
            maxHeight: '280px',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 1000,
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                borderBottom: '1px solid #f0f0f0',
                background: value === opt.value ? 'var(--mda-red-bg)' : 'transparent',
                color: value === opt.value ? 'var(--mda-red)' : 'var(--color-text)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = value === opt.value ? 'var(--mda-red-bg)' : '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = value === opt.value ? 'var(--mda-red-bg)' : 'transparent'; }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Training + thinking + success rate (rate shown only after ≥50 attempts). */
function QuestionStatsBadge({ trainingLevel, thinkingLevel, attempts, successRate }) {
  const tr = TRAINING_LEVELS.find((t) => t.value === trainingLevel)?.label ?? trainingLevel ?? '—';
  const th = THINKING_LEVELS.find((t) => t.value === thinkingLevel)?.label ?? thinkingLevel ?? '—';
  const below = attempts == null || attempts < MIN_ATTEMPTS_FOR_RATING;
  const rateLabel =
    below ? `<${MIN_ATTEMPTS_FOR_RATING} נס'` : successRate != null ? `${Number(successRate).toFixed(0)}%` : '—';
  const tooltip = `${tr} · ${th} · ${attempts ?? 0} ניסיונות`;
  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px',
        fontSize: '11px',
        lineHeight: 1.2,
        color: '#424242',
      }}
    >
      <span style={{ fontWeight: 600 }}>{tr}</span>
      <span style={{ opacity: 0.85 }}>{th}</span>
      <span style={{ color: '#1565c0', fontWeight: 600 }}>{rateLabel}</span>
    </span>
  );
}

function statusDisplayLabel(status) {
  if (status === 'suspended' || status === 'pending_review') return 'בבדיקה';
  const row = QUESTION_STATUSES.find((s) => s.value === status);
  return row?.label ?? status ?? '—';
}

export default function QuestionManagement() {
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'import', 'review', 'reports'
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    questionType: 'all',
    category: 'all',
    thinkingLevel: 'all',
    trainingLevel: 'all',
  });
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [fixWithAIState, setFixWithAIState] = useState({
    status: 'idle', // idle | loading | ready | error
    original: null,
    suggested: null,
    error: null,
  });
  const [bulkRewriteState, setBulkRewriteState] = useState({
    phase: 'idle', // idle | loading | review
    items: [],    // { original, suggested?, error? }[]
    progress: { current: 0, total: 0 },
  });
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // ── Bulk selection state ────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatusTarget, setBulkStatusTarget] = useState('');
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState('');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [userReports, setUserReports] = useState([]);
  const [pendingReportCount, setPendingReportCount] = useState(0);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [aiReclassifyProgress, setAiReclassifyProgress] = useState({ running: false, current: 0, total: 0, updated: 0 });
  const [isSyncingToServer, setIsSyncingToServer] = useState(false);
  const [isDeduping, setIsDeduping] = useState(false);
  const [loadSource, setLoadSource] = useState({ fromApi: false, count: 0 });

  useEffect(() => {
    loadUser();
    loadQuestions();
    loadReportCount();
    if (activeTab === 'review') {
      loadPendingQuestions();
      loadReviewStats();
    }
    if (activeTab === 'reports') {
      loadUserReports();
    }
  }, [activeTab]);

  useEffect(() => {
    filterQuestions();
  }, [searchQuery, filters, questions]);

  const loadQuestions = async (opts = {}) => {
    setIsLoading(true);
    try {
      if (opts?.showToastOnRefresh) {
        await syncQuestionsFromServer();
      } else if (typeof window !== 'undefined' && window.__quizMDA_syncPromise) {
        await window.__quizMDA_syncPromise;
      }
      const allQuestions = await entities.Question_Bank.find({}, { sort: { createdAt: -1 } });
      console.log(`[loadQuestions] ${allQuestions.length} questions from synced cache`);
      setQuestions(allQuestions);
      setFilteredQuestions(allQuestions);
      setLoadSource({ fromApi: true, count: allQuestions.length });
      if (opts?.showToastOnRefresh) {
        showToast(`נטענו ${allQuestions.length} שאלות`, 'success');
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      showToast('שגיאה בטעינת שאלות', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUser = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const loadPendingQuestions = async () => {
    try {
      // Pass empty filters — the review panel has its own filter controls.
      // The main list filters contain 'all' sentinel values that break the query.
      const result = await getPendingQuestions({});
      setPendingQuestions(result.questions);
    } catch (error) {
      console.error('Error loading pending questions:', error);
      showToast('שגיאה בטעינת שאלות ממתינות', 'error');
    }
  };

  const loadReviewStats = async () => {
    try {
      const stats = await getReviewStatistics();
      setReviewStats(stats);
    } catch (error) {
      console.error('Error loading review stats:', error);
    }
  };

  const loadUserReports = async () => {
    try {
      const res = await fetch('/api/reports?status=pending');
      if (res.ok) {
        const data = await res.json();
        setUserReports(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error loading reports:', e);
    }
  };

  const loadReportCount = async () => {
    try {
      const res = await fetch('/api/reports/count');
      if (res.ok) {
        const data = await res.json();
        setPendingReportCount(data.pending || 0);
      }
    } catch (_) {}
  };

  const handleReportReview = async (reportId, status, applyChanges, reviewNote) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewer_id: currentUser?.user_id,
          reviewer_name: currentUser?.full_name,
          review_note: reviewNote || '',
          apply_changes: applyChanges,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'שגיאה');
      showToast(status === 'approved' ? 'דיווח אושר — השאלה עודכנה' : status === 'rejected' ? 'דיווח נדחה' : 'דיווח עודכן', 'success');
      await loadUserReports();
      await loadReportCount();
      await loadQuestions();
    } catch (e) {
      showToast('שגיאה בעדכון דיווח: ' + e.message, 'error');
    }
  };

  const handleApprove = async (questionId) => {
    if (!currentUser) return;
    
    try {
      await approveQuestion(questionId, currentUser.user_id);
      showToast('שאלה אושרה בהצלחה', 'success');
      await loadPendingQuestions();
      await loadQuestions();
      await loadReviewStats();
    } catch (error) {
      showToast(`שגיאה באישור שאלה: ${error.message}`, 'error');
    }
  };

  const handleReject = async (questionId, reason) => {
    if (!currentUser) return;
    
    if (!reason || reason.trim().length === 0) {
      showToast('אנא ספק סיבת דחייה', 'error');
      return;
    }

    try {
      await rejectQuestion(questionId, reason, currentUser.user_id);
      showToast('שאלה נדחתה', 'success');
      await loadPendingQuestions();
      await loadQuestions();
      await loadReviewStats();
    } catch (error) {
      showToast(`שגיאה בדחיית שאלה: ${error.message}`, 'error');
    }
  };

  const handleRequestRevision = async (questionId, feedback) => {
    if (!currentUser) return;
    
    if (!feedback || feedback.trim().length === 0) {
      showToast('אנא ספק משוב לתיקון', 'error');
      return;
    }

    try {
      await requestRevision(questionId, feedback, currentUser.user_id);
      showToast('נשלחה בקשה לתיקון', 'success');
      await loadPendingQuestions();
      await loadQuestions();
      await loadReviewStats();
    } catch (error) {
      showToast(`שגיאה בבקשת תיקון: ${error.message}`, 'error');
    }
  };

  const syncQuestionsToServer = async () => {
    setIsSyncingToServer(true);
    try {
      // Collect from BOTH current state and localStorage to make sure nothing is missed
      let localQuestions = [];
      try { localQuestions = await entities.Question_Bank.find({}); } catch (_) {}
      const allSources = [...questions, ...localQuestions];
      const seenTexts = new Set();
      const unique = [];
      for (const q of allSources) {
        const key = (q.question_text || '').trim().toLowerCase();
        if (!key || seenTexts.has(key)) continue;
        seenTexts.add(key);
        unique.push(q);
      }
      if (unique.length === 0) {
        showToast('אין שאלות לסנכרן', 'warning');
        return;
      }
      const CHUNK = 100;
      const firstCat = QUESTION_CATEGORIES[0]?.value;
      const payload = unique.map((q) => ({
        category: q.category || firstCat,
        sub_category: (q.sub_category ?? '').trim() || 'תת־נושא א',
        thinking_level: q.thinking_level || 'Knowledge',
        training_level: q.training_level || 'A',
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options ?? [],
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        hint: q.hint,
        status: q.status ?? 'draft',
        media_attachment: q.media_attachment ?? null,
        media_bank_tag: q.media_bank_tag ?? null,
        total_attempts: q.total_attempts,
        total_success: q.total_success,
        success_rate: q.success_rate,
      }));
      let totalSynced = 0;
      let totalSkipped = 0;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const res = await fetch('/api/questions/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });
        if (res.ok) {
          const result = await res.json();
          totalSynced += result.synced || 0;
          totalSkipped += result.skipped || 0;
        } else if (res.status === 503) {
          showToast('השרת לא מחובר ל-MongoDB. ב-Render: בדוק ש-MONGODB_URI מוגדר ב-Environment, וב-MongoDB Atlas: Network Access → 0.0.0.0/0.', 'error');
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.error || 'שגיאת שרת', 'error');
          break;
        }
      }
      if (totalSynced > 0) {
        showToast(`סונכרנו ${totalSynced} שאלות חדשות לשרת (${totalSkipped} כבר קיימות)`, 'success');
        await loadQuestions();
      } else if (totalSkipped > 0) {
        showToast(`כל ${totalSkipped} השאלות כבר קיימות בשרת`, 'info');
      } else {
        showToast('לא סונכרנו שאלות — השרת לא מחובר למסד הנתונים', 'error');
      }
    } catch (e) {
      showToast('סנכרון לשרת נכשל: ' + (e?.message || ''), 'error');
    } finally {
      setIsSyncingToServer(false);
    }
  };

  const removeDuplicateQuestions = async () => {
    setIsDeduping(true);
    try {
      const res = await fetch('/api/questions/dedupe', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.removed != null) {
        showToast(`הוסרו ${data.removed} שאלות כפולות מהשרת`, 'success');
        await loadQuestions();
      } else {
        showToast(data.error || 'הסרת כפילויות נכשלה', 'error');
      }
    } catch (e) {
      showToast('שגיאה: ' + (e?.message || ''), 'error');
    } finally {
      setIsDeduping(false);
    }
  };

  const filterQuestions = () => {
    let filtered = [...questions];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.question_text?.toLowerCase().includes(query) ||
          q.category?.toLowerCase().includes(query) ||
          q.sub_category?.toLowerCase().includes(query),
      );
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter((q) => {
        if (filters.status === 'under_review') {
          return ['under_review', 'suspended', 'pending_review'].includes(q.status);
        }
        return q.status === filters.status;
      });
    }

    // Type filter
    if (filters.questionType !== 'all') {
      filtered = filtered.filter(q => q.question_type === filters.questionType);
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter((q) => q.category === filters.category);
    }

    if (filters.thinkingLevel !== 'all') {
      filtered = filtered.filter((q) => q.thinking_level === filters.thinkingLevel);
    }

    if (filters.trainingLevel !== 'all') {
      filtered = filtered.filter((q) => q.training_level === filters.trainingLevel);
    }

    setFilteredQuestions(filtered);
  };

  const handleDelete = async (questionId) => {
    try {
      await entities.Question_Bank.delete(questionId);
      showToast('שאלה נמחקה בהצלחה', 'success');
      await loadQuestions();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting question:', error);
      showToast('שגיאה במחיקת שאלה', 'error');
    }
  };

  const handleBulkDelete = async (questionIds) => {
    try {
      for (const id of questionIds) {
        await entities.Question_Bank.delete(id);
      }
      showToast(`${questionIds.length} שאלות נמחקו`, 'success');
      setSelectedIds(new Set());
      await loadQuestions();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      showToast('שגיאה במחיקה מרובה', 'error');
    }
  };

  const handleFixWithAIClick = async (question) => {
    const apiKey = appConfig?.openai?.getApiKey?.();
    if (!apiKey) {
      showToast('הגדר VITE_OPENAI_API_KEY ב-.env לשימוש בתיקון עם AI', 'error');
      return;
    }
    setFixWithAIState({ status: 'loading', original: question, suggested: null, error: null });
    try {
      const suggested = await fixQuestionWithAI(question, apiKey);
      setFixWithAIState({ status: 'ready', original: question, suggested, error: null });
    } catch (err) {
      setFixWithAIState({
        status: 'error',
        original: question,
        suggested: null,
        error: err.message || 'שגיאה בתיקון עם AI',
      });
      showToast(err.message || 'שגיאה בתיקון עם AI', 'error');
    }
  };

  const handleApproveFix = async () => {
    const { original, suggested } = fixWithAIState;
    if (!original?.id || !suggested) return;
    try {
      await entities.Question_Bank.update(original.id, {
        question_text: suggested.question_text,
        correct_answer: JSON.stringify({
          value: suggested.correct_answer?.value ?? '0',
          options: suggested.options,
        }),
        options: suggested.options,
        explanation: suggested.explanation || original.explanation || '',
        total_attempts: 0,
        total_success: 0,
        success_rate: null,
        status: 'active',
      });
      showToast('השאלה תוקנה ופורסמה. הסטטיסטיקות אופסו.', 'success');
      setFixWithAIState({ status: 'idle', original: null, suggested: null, error: null });
      await loadQuestions();
    } catch (err) {
      showToast('שגיאה בשמירת התיקון', 'error');
    }
  };

  const handleBulkRewriteStart = async () => {
    const apiKey = appConfig?.openai?.getApiKey?.();
    if (!apiKey) {
      showToast('הגדר VITE_OPENAI_API_KEY ב-.env', 'error');
      return;
    }
    const list = questions.length ? questions : [];
    if (list.length === 0) {
      showToast('אין שאלות במערכת', 'warning');
      return;
    }
    setBulkRewriteState({ phase: 'loading', items: [], progress: { current: 0, total: list.length } });
    const items = [];
    for (let i = 0; i < list.length; i++) {
      setBulkRewriteState(s => ({ ...s, progress: { current: i + 1, total: list.length } }));
      try {
        const suggested = await fixQuestionWithAI(list[i], apiKey);
        items.push({ original: list[i], suggested, error: null });
      } catch (err) {
        items.push({ original: list[i], suggested: null, error: err.message || 'שגיאה' });
      }
    }
    setBulkRewriteState({ phase: 'review', items, progress: { current: list.length, total: list.length } });
  };

  const handleBulkRewriteApproveOne = async (item) => {
    if (!item.original?.id || !item.suggested) return;
    try {
      await entities.Question_Bank.update(item.original.id, {
        question_text: item.suggested.question_text,
        correct_answer: JSON.stringify({
          value: item.suggested.correct_answer?.value ?? '0',
          options: item.suggested.options,
        }),
        options: item.suggested.options,
        explanation: item.suggested.explanation || item.original.explanation || '',
        category: item.original.category,
        sub_category: item.original.sub_category,
        thinking_level: item.original.thinking_level,
        training_level: item.original.training_level,
        total_attempts: 0,
        total_success: 0,
        success_rate: null,
        status: 'active',
      });
      setBulkRewriteState(s => {
        const next = s.items.filter(x => x.original.id !== item.original.id);
        return { ...s, items: next, phase: next.length === 0 ? 'idle' : s.phase };
      });
      showToast('שאלה אושרה ועודכנה', 'success');
      loadQuestions();
    } catch (err) {
      showToast('שגיאה בעדכון השאלה', 'error');
    }
  };

  const handleBulkRewriteApproveAll = async () => {
    const toApply = bulkRewriteState.items.filter(x => x.suggested && !x.error);
    for (const item of toApply) {
      try {
        await entities.Question_Bank.update(item.original.id, {
          question_text: item.suggested.question_text,
          correct_answer: JSON.stringify({
            value: item.suggested.correct_answer?.value ?? '0',
            options: item.suggested.options,
          }),
          options: item.suggested.options,
          explanation: item.suggested.explanation || item.original.explanation || '',
          category: item.original.category,
          sub_category: item.original.sub_category,
          thinking_level: item.original.thinking_level,
          training_level: item.original.training_level,
          total_attempts: 0,
          total_success: 0,
          success_rate: null,
          status: 'active',
        });
      } catch (_) {}
    }
    showToast(`אושרו ועודכנו ${toApply.length} שאלות`, 'success');
    setBulkRewriteState({ phase: 'idle', items: [], progress: { current: 0, total: 0 } });
    await loadQuestions();
  };

  const handleBulkRewriteRejectOne = (item) => {
    setBulkRewriteState(s => {
      const next = s.items.filter(x => x.original.id !== item.original.id);
      return { ...s, items: next, phase: next.length === 0 ? 'idle' : s.phase };
    });
  };

  // ── Bulk selection helpers ────────────────────────
  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        await entities.Question_Bank.update(id, { status: newStatus });
      }
      const bulkLabels = {
        active: 'הופעלו',
        draft: 'הוחזרו לטיוטה',
        under_review: 'סומנו כבבדיקה',
      };
      showToast(`${ids.length} שאלות ${bulkLabels[newStatus] ?? 'עודכנו'}`, 'success');
      setSelectedIds(new Set());
      await loadQuestions();
    } catch (error) {
      showToast('שגיאה בעדכון סטטוס מרובה', 'error');
    }
  };

  const handleBulkChangeCategory = async (categoryValue) => {
    if (!categoryValue) return;
    const ids = Array.from(selectedIds);
    const sub = PLACEHOLDER_SUBCATEGORIES_BY_CATEGORY[categoryValue]?.[0] ?? 'תת־נושא א';
    try {
      for (const id of ids) {
        await entities.Question_Bank.update(id, { category: categoryValue, sub_category: sub });
      }
      showToast(`${ids.length} שאלות עודכנו לפרק נבחר`, 'success');
      setSelectedIds(new Set());
      setBulkCategoryTarget('');
      await loadQuestions();
    } catch (error) {
      showToast('שגיאה בעדכון קטגוריה', 'error');
    }
  };

  const handleReclassifyAllByContent = async () => {
    if (!questions.length) {
      showToast('אין שאלות במערכת', 'info');
      return;
    }
    setIsReclassifying(true);
    try {
      const res = await fetch('/api/questions/recatalog', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Server error');
      await loadQuestions();
      showToast(
        data.message || 'קטלוג אוטומטי מהתמלול/היררכיה אינו בשימוש בסכמה החדשה — לא בוצעו שינויים במסמכים.',
        'info',
      );
    } catch (error) {
      showToast('שגיאה בקטלוג: ' + (error?.message || 'unknown'), 'error');
    } finally {
      setIsReclassifying(false);
    }
  };

  const handleReclassifyUnanalyzedWithAI = async () => {
    const apiKey = appConfig?.openai?.getApiKey?.();
    if (!apiKey) {
      showToast('הגדר VITE_OPENAI_API_KEY ב-.env', 'error');
      return;
    }
    setAiReclassifyProgress({ running: true, current: 0, total: 0, updated: 0 });
    try {
      const result = await reclassifyUnanalyzedQuestionsWithAI(entities, apiKey, (p) =>
        setAiReclassifyProgress(s => ({ ...s, ...p }))
      );
      await loadQuestions();
      if (result.totalProcessed === 0) {
        showToast('אין שאלות חדשות לסיווג (כולן כבר נותחו עם AI).', 'info');
      } else if (result.updated > 0) {
        showToast(`סווגו ${result.updated} שאלות לקטגוריה עם AI. ${result.errors ? `שגיאות: ${result.errors}` : ''}`, 'success');
      } else {
        showToast(`לא עודכנו שאלות. ${result.errors ? `שגיאות: ${result.errors}` : ''}`, 'info');
      }
    } catch (error) {
      showToast('שגיאה בסיווג עם AI: ' + (error?.message || 'unknown'), 'error');
    } finally {
      setAiReclassifyProgress({ running: false, current: 0, total: 0, updated: 0 });
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="טוען שאלות..." />;
  }

  return (
    <PermissionGate permission={permissions.QUESTION_CREATE}>
      <div style={styles.container}>
          <div style={styles.header}>
            <h1 style={styles.title}>ניהול שאלות</h1>
            {activeTab === 'list' && (
              <button
                style={styles.createButton}
                onClick={() => setEditingQuestion({})}
                aria-label="צור שאלה חדשה"
              >
                + שאלה חדשה
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={styles.tabs} role="tablist" aria-label="קטגוריות ניהול שאלות">
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'list' ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab('list')}
              role="tab"
              aria-selected={activeTab === 'list'}
              aria-controls="list-panel"
              id="list-tab"
            >
              רשימת שאלות
            </button>
            <PermissionGate permission={permissions.QUESTION_CREATE}>
              <button
                style={{
                  ...styles.tab,
                  ...(activeTab === 'import' ? styles.tabActive : {})
                }}
                onClick={() => setActiveTab('import')}
                role="tab"
                aria-selected={activeTab === 'import'}
                aria-controls="import-panel"
                id="import-tab"
              >
                ייבוא שאלות
              </button>
            </PermissionGate>
            <PermissionGate permission={permissions.QUESTION_APPROVE}>
              <button
                style={{
                  ...styles.tab,
                  ...(activeTab === 'review' ? styles.tabActive : {})
                }}
                onClick={() => setActiveTab('review')}
                role="tab"
                aria-selected={activeTab === 'review'}
                aria-controls="review-panel"
                id="review-tab"
              >
                בקרה על שאלות
                {reviewStats && reviewStats.pending > 0 && (
                  <span style={styles.badge}>{reviewStats.pending}</span>
                )}
              </button>
            </PermissionGate>
            <PermissionGate permission={permissions.QUESTION_APPROVE}>
              <button
                style={{
                  ...styles.tab,
                  ...(activeTab === 'reports' ? styles.tabActive : {})
                }}
                onClick={() => setActiveTab('reports')}
                role="tab"
                aria-selected={activeTab === 'reports'}
                aria-controls="reports-panel"
                id="reports-tab"
              >
                דיווחי משתמשים
                {pendingReportCount > 0 && (
                  <span style={styles.badge}>{pendingReportCount}</span>
                )}
              </button>
            </PermissionGate>
          </div>

          {/* Tab Panels */}
          {activeTab === 'list' && (
            <div role="tabpanel" aria-labelledby="list-tab" id="list-panel">

          {/* Source indicator + Refresh from server */}
          {activeTab === 'list' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '10px',
              padding: '8px 12px',
              background: loadSource.fromApi ? '#E8F5E9' : '#FFF3E0',
              borderRadius: '8px',
              border: `1px solid ${loadSource.fromApi ? '#81C784' : '#FFB74D'}`,
            }}>
              <span style={{ fontWeight: 600, color: loadSource.fromApi ? '#2E7D32' : '#E65100' }}>
                {loadSource.fromApi ? `מהשרת: ${loadSource.count} שאלות` : `ממכשיר: ${loadSource.count} שאלות`}
              </span>
              <button
                type="button"
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#1565C0',
                  color: '#fff',
                  cursor: isLoading ? 'wait' : 'pointer',
                  fontSize: '13px',
                }}
                onClick={() => loadQuestions({ showToastOnRefresh: true })}
                disabled={isLoading}
              >
                {isLoading ? 'טוען...' : 'רענן מהשרת'}
              </button>
            </div>
          )}

          {/* Search and Filters */}
          <div style={styles.filtersSection}>
            <SearchBar
              onSearch={setSearchQuery}
              placeholder="חפש שאלות..."
            />

            <div style={styles.filters}>
              <FilterDropdown
                ariaLabel="סינון לפי סטטוס"
                value={filters.status}
                onChange={(v) => setFilters({ ...filters, status: v })}
                options={[
                  { value: 'all', label: 'כל הסטטוסים' },
                  ...QUESTION_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                ]}
              />

              <div style={styles.filterSelectWrap}>
                <select
                  style={styles.filterSelect}
                  value={filters.questionType}
                  onChange={(e) => setFilters({ ...filters, questionType: e.target.value })}
                  aria-label="סינון לפי סוג שאלה"
                >
                  <option value="all">כל הסוגים</option>
                  <option value="single_choice">רב ברירה — תשובה אחת</option>
                  <option value="multi_choice">רב ברירה — מספר תשובות</option>
                  <option value="true_false">נכון / לא נכון</option>
                  <option value="open_ended">שאלה פתוחה</option>
                </select>
              </div>

              <div style={{ ...styles.filterSelectWrap, flex: '1 1 220px', minWidth: '200px', maxWidth: '100%' }}>
                <select
                  style={styles.filterSelect}
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  aria-label="סינון לפי פרק"
                >
                  <option value="all">כל הפרקים</option>
                  {QUESTION_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.filterSelectWrap}>
                <select
                  style={styles.filterSelect}
                  value={filters.thinkingLevel}
                  onChange={(e) => setFilters({ ...filters, thinkingLevel: e.target.value })}
                  aria-label="סינון לפי רמת חשיבה"
                >
                  <option value="all">כל רמות החשיבה</option>
                  {THINKING_LEVELS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.filterSelectWrap}>
                <select
                  style={styles.filterSelect}
                  value={filters.trainingLevel}
                  onChange={(e) => setFilters({ ...filters, trainingLevel: e.target.value })}
                  aria-label="סינון לפי רמת הכשרה"
                >
                  <option value="all">כל רמות ההכשרה</option>
                  {TRAINING_LEVELS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                style={{ ...styles.filterSelect, cursor: isReclassifying ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                onClick={handleReclassifyAllByContent}
                disabled={isReclassifying || !questions.length}
                aria-label="יישר קטגוריות לפי תוכן השאלות"
                title="מסווג מחדש את כל השאלות לקטגוריה המתאימה לפי מילות מפתח בתוכן"
              >
                {isReclassifying ? 'מסווג...' : '📂 יישר קטגוריות לפי תוכן'}
              </button>
              {questions.length > 0 && (
                <button
                  type="button"
                  style={{
                    ...styles.filterSelect,
                    cursor: isSyncingToServer ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    background: '#2e7d32',
                    color: '#fff',
                    border: 'none',
                  }}
                  onClick={syncQuestionsToServer}
                  disabled={isSyncingToServer}
                  aria-label="סנכרן את כל השאלות לשרת"
                  title={typeof window !== 'undefined' && window.__quizMDA_usingQuestionApi
                    ? 'שלח שוב את השאלות לשרת (שליחה חוזרת עלולה ליצור כפילויות)'
                    : 'שולח את השאלות שבמכשיר זה לשרת — יופיעו בכל המכשירים'}
                >
                  {isSyncingToServer ? 'מסנכרן...' : `☁️ סנכרן ${questions.length} שאלות לשרת`}
                </button>
              )}
              {questions.length > 0 && (
                <button
                  type="button"
                  style={{
                    ...styles.filterSelect,
                    cursor: isDeduping ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    background: '#7b1fa2',
                    color: '#fff',
                    border: 'none',
                  }}
                  onClick={removeDuplicateQuestions}
                  disabled={isDeduping}
                  aria-label="הסר שאלות כפולות מהשרת"
                  title="מוחק מהשרת שאלות עם טקסט זהה (משאיר אחת מכל כפילות)"
                >
                  {isDeduping ? 'מסיר כפילויות...' : '🗑️ הסר שאלות כפולות'}
                </button>
              )}
              <PermissionGate permission={permissions.QUESTION_APPROVE}>
                <button
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: aiReclassifyProgress.running ? '#9e9e9e' : '#1565c0',
                    color: '#fff',
                    cursor: aiReclassifyProgress.running ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                  disabled={aiReclassifyProgress.running || !questions.length}
                  onClick={handleReclassifyUnanalyzedWithAI}
                  title="מסווג רק שאלות שעדיין לא נותחו עם AI לקטגוריה הנכונה"
                >
                  {aiReclassifyProgress.running
                    ? `סיווג עם AI ${aiReclassifyProgress.current}/${aiReclassifyProgress.total} (עודכנו ${aiReclassifyProgress.updated})`
                    : '🤖 סווג קטגוריות עם AI (רק חדשות)'}
                </button>
                <button
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: bulkRewriteState.phase === 'loading' ? '#9e9e9e' : '#7b1fa2',
                    color: '#fff',
                    cursor: bulkRewriteState.phase === 'loading' ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                  disabled={bulkRewriteState.phase === 'loading' || questions.length === 0}
                  onClick={handleBulkRewriteStart}
                  title="כתיבה מחדש של כל השאלות עם AI והעברה לאישור"
                >
                  {bulkRewriteState.phase === 'loading'
                    ? `מעבד ${bulkRewriteState.progress.current}/${bulkRewriteState.progress.total}...`
                    : '✏️ כתיבה מחדש של כל השאלות עם AI'}
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* ── Bulk Actions Toolbar ── */}
          {selectedIds.size > 0 && (
            <div style={styles.bulkToolbar}>
              <span style={styles.bulkCount}>{selectedIds.size} שאלות נבחרו</span>

              {/* Bulk status */}
              <select
                value={bulkStatusTarget}
                onChange={e => setBulkStatusTarget(e.target.value)}
                style={styles.bulkSelect}
                aria-label="בחר סטטוס לשינוי מרובה"
              >
                <option value="">שנה סטטוס ל...</option>
                {QUESTION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                style={{ ...styles.bulkBtn, background: '#1976d2' }}
                disabled={!bulkStatusTarget}
                onClick={() => { handleBulkStatusChange(bulkStatusTarget); setBulkStatusTarget(''); }}
              >
                החל סטטוס
              </button>

              <select
                value={bulkCategoryTarget}
                onChange={(e) => setBulkCategoryTarget(e.target.value)}
                style={styles.bulkSelect}
                aria-label="הגדר פרק לשאלות נבחרות"
              >
                <option value="">הגדר פרק ל...</option>
                {QUESTION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                style={{ ...styles.bulkBtn, background: '#7b1fa2' }}
                disabled={!bulkCategoryTarget}
                onClick={() => handleBulkChangeCategory(bulkCategoryTarget)}
              >
                החל פרק
              </button>

              {/* Bulk delete */}
              <PermissionGate permission={permissions.QUESTION_DELETE}>
                <button
                  style={{ ...styles.bulkBtn, background: '#c62828' }}
                  onClick={() => setShowBulkDeleteConfirm(true)}
                >
                  🗑 מחק {selectedIds.size} שאלות
                </button>
              </PermissionGate>

              <button
                style={{ ...styles.bulkBtn, background: '#546e7a' }}
                onClick={() => setSelectedIds(new Set())}
              >
                בטל בחירה
              </button>
            </div>
          )}

          {questions.length > 0 &&
            (() => {
              const complete = questions.filter(
                (q) => q.category && q.sub_category && q.thinking_level && q.training_level,
              ).length;
              const pct = Math.round((complete / questions.length) * 100);
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px 16px',
                    marginBottom: '12px',
                    background: '#f5f5f5',
                    borderRadius: '10px',
                    fontSize: '14px',
                    direction: 'rtl',
                  }}
                >
                  <strong style={{ flexShrink: 0 }}>מטא־דאטה מלא:</strong>
                  <div
                    style={{
                      flex: 1,
                      height: '10px',
                      background: '#e0e0e0',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: '#4caf50',
                        borderRadius: '5px',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <span style={{ color: '#4caf50', fontWeight: 600 }}>
                    {complete} / {questions.length}
                  </span>
                  <span style={{ color: '#616161', fontWeight: 600 }}>{pct}%</span>
                </div>
              );
            })()}

          {/* Questions List */}
          <div style={styles.questionsList}>
            {filteredQuestions.length === 0 ? (
              <div style={styles.empty} role="status">
                {questions.length === 0 
                  ? 'אין שאלות במערכת' 
                  : 'לא נמצאו שאלות התואמות לסינון'}
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table} role="table" aria-label="רשימת שאלות">
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0}
                          ref={el => {
                            if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredQuestions.length;
                          }}
                          onChange={handleSelectAll}
                          aria-label="בחר הכל"
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ ...styles.th, width: '72px', textAlign: 'center' }}>מזהה</th>
                      <th style={styles.th}>שאלה</th>
                      <th style={styles.th}>סוג</th>
                      <th style={styles.th}>מדיה</th>
                      <th style={styles.th}>רמות</th>
                      <th style={styles.th}>סטטוס</th>
                      <th style={styles.th}>נושא</th>
                      <th style={styles.th}>אחוז הצלחה</th>
                      <th style={styles.th}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map((question) => {
                      let parsed = {};
                      try { parsed = JSON.parse(question.correct_answer || '{}'); } catch { /* empty */ }
                      // Check both parsed.options (regex parser) and question.options (AI parser)
                      const rawOpts = parsed.options || question.options || null;
                      const opts = rawOpts
                        ? rawOpts.map((o, i) => ({ value: String(o.value ?? i), label: o.label ?? o.text ?? String(o) }))
                        : null;
                      const correctVal = parsed.value != null ? String(parsed.value) : null;
                      const correctVals = parsed.values
                        ? parsed.values.map(String)
                        : (correctVal != null ? [correctVal] : []);
                      const isExpanded = expandedQuestionId === question.id;
                      const isSelected = selectedIds.has(question.id);
                      const categoryLabel = [question.category, question.sub_category].filter(Boolean).join(' / ') || '—';
                      const idShort = question.id ? String(question.id).slice(-10) : '—';

                      return (
                        <React.Fragment key={question.id}>
                          <tr
                            style={{
                              ...styles.tr,
                              background: isSelected ? '#e3f2fd' : undefined,
                            }}
                          >
                            {/* Checkbox cell */}
                            <td style={{ ...styles.td, textAlign: 'center', width: '40px' }}
                                onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectOne(question.id)}
                                aria-label={`בחר שאלה ${question.question_text?.substring(0, 30)}`}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>

                            <td
                              style={{ ...styles.td, textAlign: 'center', fontWeight: 600, color: '#616161', fontSize: '12px' }}
                              title={question.id}
                            >
                              {idShort}
                            </td>

                            <td
                              style={{ ...styles.td, cursor: 'pointer' }}
                              onClick={() => setExpandedQuestionId(id => id === question.id ? null : question.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && setExpandedQuestionId(id => id === question.id ? null : question.id)}
                              aria-expanded={isExpanded}
                            >
                              <div style={styles.questionText}>
                                {question.question_text?.substring(0, 100)}
                                {question.question_text?.length > 100 && '...'}
                              </div>
                              <span style={{ fontSize: '12px', color: '#757575' }}>
                                {isExpanded ? '▲ הצג פחות' : '▼ מסיחים ותשובה נכונה'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {question.question_type === 'single_choice' && 'רב ברירה — אחת'}
                              {question.question_type === 'multi_choice' && 'רב ברירה — כמה'}
                              {question.question_type === 'true_false' && 'נכון / לא נכון'}
                              {question.question_type === 'open_ended' && 'שאלה פתוחה'}
                            </td>
                            <td style={styles.td}>
                              {question.has_media ? (
                                <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 600 }}>יש</span>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#9e9e9e' }}>אין</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <QuestionStatsBadge
                                trainingLevel={question.training_level}
                                thinkingLevel={question.thinking_level}
                                attempts={question.total_attempts}
                                successRate={question.success_rate}
                              />
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.statusBadge,
                                ...(question.status === 'active' ? styles.statusActive :
                                    ['under_review', 'suspended', 'pending_review'].includes(question.status) ? styles.statusUnderReview :
                                    styles.statusDraft)
                              }}>
                                {statusDisplayLabel(question.status)}
                              </span>
                            </td>
                            <td style={styles.td}>{categoryLabel}</td>
                            <td style={styles.td}>
                              {question.total_attempts > 0 
                                ? `${question.success_rate?.toFixed(1)}%`
                                : '-'}
                            </td>
                            <td style={styles.td} onClick={e => e.stopPropagation()}>
                              <div style={styles.actions}>
                                <button
                                  style={styles.actionButton}
                                  onClick={() => setEditingQuestion(question)}
                                  aria-label="ערוך שאלה"
                                >
                                  ערוך
                                </button>
                                <button
                                  style={{ ...styles.actionButton, background: '#7b1fa2', color: '#fff' }}
                                  onClick={() => handleFixWithAIClick(question)}
                                  disabled={fixWithAIState.status === 'loading'}
                                  aria-label="תקן שאלה עם AI"
                                  title="שולח את השאלה לבינה מלאכותית לשיפור ניסוח ומסיחים"
                                >
                                  {fixWithAIState.status === 'loading' && fixWithAIState.original?.id === question.id ? '...' : 'תקן עם AI'}
                                </button>
                                <PermissionGate permission={permissions.QUESTION_DELETE}>
                                  <button
                                    style={{...styles.actionButton, ...styles.deleteButton}}
                                    onClick={() => setShowDeleteConfirm(question.id)}
                                    aria-label="מחק שאלה"
                                  >
                                    מחק
                                  </button>
                                </PermissionGate>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr style={styles.tr}>
                              <td colSpan={10} style={{ ...styles.td, padding: '12px 16px', background: '#fafafa', borderTop: 'none' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div>
                                    <strong style={{ marginBottom: '4px' }}>שאלה (מלא):</strong>
                                    <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', fontSize: '14px' }}>{question.question_text}</p>
                                  </div>
                                  {opts && opts.length > 0 ? (
                                    <>
                                      <strong style={{ marginBottom: '4px' }}>מסיחים ותשובה נכונה:</strong>
                                      {opts.map((opt, i) => {
                                        const correct = correctVals.includes(opt.value) || correctVals.includes(String(i));
                                        return (
                                          <div
                                            key={i}
                                            style={{
                                              padding: '8px 12px',
                                              borderRadius: '8px',
                                              background: correct ? '#e8f5e9' : '#fff',
                                              border: `1px solid ${correct ? '#66bb6a' : '#e0e0e0'}`,
                                              fontWeight: correct ? '700' : '400',
                                            }}
                                          >
                                            {correct && '✓ '}{opt.label}
                                            {correct && <span style={{ marginRight: '8px', color: '#2e7d32', fontSize: '12px' }}>(תשובה נכונה)</span>}
                                          </div>
                                        );
                                      })}
                                    </>
                                  ) : question.question_type === 'open_ended' && parsed.value ? (
                                    <><strong>תשובה נכונה:</strong> {parsed.value}</>
                                  ) : (
                                    <span style={{ color: '#757575' }}>אין מסיחים שמורים</span>
                                  )}
                                  {parsed.explanation && (
                                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fff8e1', borderRadius: '8px', border: '1px solid #ffe082', fontSize: '13px', color: '#5d4037' }}>
                                      💡 <strong>הסבר:</strong> {parsed.explanation}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bulk Delete Confirmation */}
          {showBulkDeleteConfirm && (
            <ConfirmDialog
              isOpen={true}
              onClose={() => setShowBulkDeleteConfirm(false)}
              onConfirm={() => { handleBulkDelete(Array.from(selectedIds)); setShowBulkDeleteConfirm(false); }}
              title="מחיקת שאלות מרובות"
              message={`האם אתה בטוח שברצונך למחוק ${selectedIds.size} שאלות? פעולה זו אינה הפיכה.`}
              confirmText={`מחק ${selectedIds.size} שאלות`}
              cancelText="ביטול"
              danger={true}
            />
          )}

          {/* Question Editor Modal */}
          {editingQuestion !== null && (
            <QuestionEditor
              question={editingQuestion}
              onSave={() => {
                setEditingQuestion(null);
                loadQuestions();
              }}
              onCancel={() => setEditingQuestion(null)}
            />
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <ConfirmDialog
              isOpen={true}
              onClose={() => setShowDeleteConfirm(null)}
              onConfirm={() => handleDelete(showDeleteConfirm)}
              title="מחיקת שאלה"
              message="האם אתה בטוח שברצונך למחוק שאלה זו?"
              confirmText="מחק"
              cancelText="ביטול"
              danger={true}
            />
          )}

          {/* Bulk rewrite — loading overlay */}
          {bulkRewriteState.phase === 'loading' && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
            >
              <div style={{ background: '#fff', padding: '24px 32px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LoadingSpinner size="md" />
                <span>כתיבה מחדש עם AI — {bulkRewriteState.progress.current} / {bulkRewriteState.progress.total}</span>
              </div>
            </div>
          )}

          {aiReclassifyProgress.running && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
            >
              <div style={{ background: '#fff', padding: '24px 32px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LoadingSpinner size="md" />
                <span>סיווג קטגוריות עם AI — {aiReclassifyProgress.current} / {aiReclassifyProgress.total} (עודכנו {aiReclassifyProgress.updated})</span>
              </div>
            </div>
          )}

          {/* Fix with AI — loading overlay */}
          {fixWithAIState.status === 'loading' && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
            >
              <div style={{ background: '#fff', padding: '24px 32px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LoadingSpinner size="md" />
                <span>מתקן שאלה עם AI...</span>
              </div>
            </div>
          )}

          {/* Fix with AI — approval modal (original vs suggested) */}
          {(fixWithAIState.status === 'ready' || fixWithAIState.status === 'error') && fixWithAIState.original && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '20px',
              }}
              onClick={() => fixWithAIState.status === 'error' && setFixWithAIState({ status: 'idle', original: null, suggested: null, error: null })}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  maxWidth: '900px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', fontWeight: 700, fontSize: '18px' }}>
                  תיקון שאלה עם AI
                </div>
                {fixWithAIState.status === 'error' && (
                  <div style={{ padding: '12px 20px', background: '#ffebee', color: '#c62828' }}>
                    {fixWithAIState.error}
                  </div>
                )}
                {fixWithAIState.status === 'ready' && fixWithAIState.suggested && (
                  <>
                    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                      <div style={{ flex: 1, padding: '20px', borderLeft: '1px solid #e0e0e0' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 600, color: '#666' }}>השאלה המקורית</div>
                        <p style={{ whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{fixWithAIState.original.question_text}</p>
                        {(() => {
                          let parsed = {};
                          try { parsed = JSON.parse(fixWithAIState.original.correct_answer || '{}'); } catch { /* empty */ }
                          const rawOpts = parsed.options || fixWithAIState.original.options || [];
                          const origOpts = rawOpts.map((o, i) => ({ value: String(o.value ?? i), label: o.label ?? o.text ?? String(o) }));
                          if (origOpts.length === 0) return null;
                          return (
                            <ul style={{ margin: 0, paddingRight: '20px' }}>
                              {origOpts.map((opt, i) => (
                                <li key={i} style={{ marginBottom: '6px' }}>
                                  {String(parsed.value) === String(opt.value) ? '✓ ' : ''}{opt.label}
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                      <div style={{ flex: 1, padding: '20px', background: '#f5f5f5' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 600, color: '#2e7d32' }}>השאלה המתוקנת (לאחר אישור תפורסם)</div>
                        <p style={{ whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{fixWithAIState.suggested.question_text}</p>
                        {fixWithAIState.suggested.options?.length > 0 && (
                          <ul style={{ margin: 0, paddingRight: '20px' }}>
                            {fixWithAIState.suggested.options.map((opt, i) => (
                              <li key={i} style={{ marginBottom: '6px' }}>
                                {String(fixWithAIState.suggested.correct_answer?.value) === String(opt.value) ? '✓ ' : ''}{opt.label}
                              </li>
                            ))}
                          </ul>
                        )}
                        {fixWithAIState.suggested.explanation && (
                          <div style={{ marginTop: '12px', padding: '10px', background: '#e8f5e9', borderRadius: '8px', fontSize: '13px' }}>
                            💡 {fixWithAIState.suggested.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                        onClick={() => setFixWithAIState({ status: 'idle', original: null, suggested: null, error: null })}
                      >
                        ביטול
                      </button>
                      <button
                        style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                        onClick={handleApproveFix}
                      >
                        אשר תיקון (פרסם + איפוס סטטיסטיקות)
                      </button>
                    </div>
                  </>
                )}
                {fixWithAIState.status === 'error' && (
                  <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                      onClick={() => setFixWithAIState({ status: 'idle', original: null, suggested: null, error: null })}
                    >
                      סגור
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* כתיבה מחדש של כל השאלות — מסך אישור */}
          {bulkRewriteState.phase === 'review' && bulkRewriteState.items.length > 0 && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '20px',
              }}
              onClick={() => {}}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  maxWidth: '1000px',
                  width: '100%',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '18px' }}>אישור כתיבה מחדש — {bulkRewriteState.items.length} שאלות</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                      onClick={() => setBulkRewriteState({ phase: 'idle', items: [], progress: { current: 0, total: 0 } })}
                    >
                      סגור
                    </button>
                    {bulkRewriteState.items.some(x => x.suggested) && (
                      <button
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                        onClick={handleBulkRewriteApproveAll}
                      >
                        אשר הכל
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ overflow: 'auto', flex: 1, padding: '16px' }}>
                  {bulkRewriteState.items.map((item, idx) => (
                    <div
                      key={item.original?.id || idx}
                      style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0', minHeight: '80px' }}>
                        <div style={{ flex: 1, padding: '12px', borderLeft: '1px solid #e0e0e0', background: '#fafafa' }}>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>מקור</div>
                          <div style={{ fontSize: '14px' }}>{item.original?.question_text?.slice(0, 200)}{(item.original?.question_text?.length || 0) > 200 ? '...' : ''}</div>
                        </div>
                        <div style={{ flex: 1, padding: '12px', background: '#fff' }}>
                          <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '4px' }}>לאחר כתיבה מחדש</div>
                          {item.error ? (
                            <div style={{ fontSize: '14px', color: '#c62828' }}>{item.error}</div>
                          ) : item.suggested ? (
                            <div style={{ fontSize: '14px' }}>{item.suggested.question_text?.slice(0, 200)}{(item.suggested.question_text?.length || 0) > 200 ? '...' : ''}</div>
                          ) : null}
                        </div>
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', borderRight: '1px solid #e0e0e0' }}>
                          {item.suggested ? (
                            <>
                              <button
                                style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                                onClick={() => handleBulkRewriteApproveOne(item)}
                              >
                                אשר
                              </button>
                              <button
                                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '13px' }}
                                onClick={() => handleBulkRewriteRejectOne(item)}
                              >
                                דחה
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#999' }}>לא ניתן לאשר</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
            </div>
          )}

          {activeTab === 'import' && (
            <div role="tabpanel" aria-labelledby="import-tab" id="import-panel">
              <QuestionImport
                onImportComplete={(results) => {
                  loadQuestions();
                  if (results.successful > 0) {
                    setActiveTab('list');
                  }
                }}
              />
            </div>
          )}

          {activeTab === 'review' && (
            <div role="tabpanel" aria-labelledby="review-tab" id="review-panel">
              <QuestionReviewPanel
                pendingQuestions={pendingQuestions}
                reviewStats={reviewStats}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestRevision={handleRequestRevision}
                onEdit={(question) => setEditingQuestion(question)}
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <div role="tabpanel" aria-labelledby="reports-tab" id="reports-panel">
              <UserReportReviewPanel
                reports={userReports}
                onReview={handleReportReview}
                onRefresh={loadUserReports}
              />
            </div>
          )}
      </div>
    </PermissionGate>
  );
}

function QuestionReviewPanel({
  pendingQuestions,
  reviewStats,
  onApprove,
  onReject,
  onRequestRevision,
  onEdit,
}) {
  const [inlineActions, setInlineActions] = useState({});
  const [inlineText, setInlineText]       = useState({});
  const [reviewSelectedIds, setReviewSelectedIds] = useState(new Set());
  const [isBulkApproving, setIsBulkApproving]     = useState(false);
  const [reviewSearch, setReviewSearch]   = useState('');
  const [reviewTypeFilter, setReviewTypeFilter] = useState('all');

  const toggleSelect = (id) =>
    setReviewSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleSelectAll = (visible) => {
    if (reviewSelectedIds.size === visible.length) setReviewSelectedIds(new Set());
    else setReviewSelectedIds(new Set(visible.map(q => q.id)));
  };

  const handleBulkApprove = async (visible) => {
    setIsBulkApproving(true);
    const ids = Array.from(reviewSelectedIds).filter(id => visible.some(q => q.id === id));
    let count = 0;
    for (const id of ids) { try { await onApprove(id); count++; } catch { /* skip */ } }
    setReviewSelectedIds(new Set());
    setIsBulkApproving(false);
    if (count > 0) showToast(`${count} שאלות אושרו`, 'success');
  };

  const toggleInline = (id, mode) => {
    setInlineActions(p => ({ ...p, [id]: p[id] === mode ? null : mode }));
    setInlineText(p => ({ ...p, [id]: p[id] || '' }));
  };

  const submitInline = (q, mode) => {
    const txt = (inlineText[q.id] || '').trim();
    if (!txt) return;
    if (mode === 'reject') onReject(q.id, txt);
    else onRequestRevision(q.id, txt);
    setInlineActions(p => ({ ...p, [q.id]: null }));
    setInlineText(p => ({ ...p, [q.id]: '' }));
  };

  const getOpts = (q) => {
    let parsed = {};
    try { parsed = typeof q.correct_answer === 'object' ? (q.correct_answer || {}) : JSON.parse(q.correct_answer || '{}'); } catch { /* empty */ }
    const rawOpts = parsed.options || q.options || null;
    const opts = rawOpts
      ? rawOpts.map((o, i) => ({ value: String(o.value ?? i), label: o.label ?? o.text ?? String(o) }))
      : null;
    const cv = parsed.value != null ? String(parsed.value) : null;
    const correctVals = parsed.values ? parsed.values.map(String) : (cv != null ? [cv] : []);
    return { opts, correctVals, explanation: parsed.explanation || q.explanation || '' };
  };

  const TYPE_LABELS = { single_choice: 'בחירה יחידה', multi_choice: 'בחירה מרובה', true_false: 'נכון/לא נכון', open_ended: 'שאלה פתוחה' };
  const TYPE_COLORS = { single_choice: '#1976d2', multi_choice: '#7b1fa2', true_false: '#388e3c', open_ended: '#f57c00' };

  const visible = pendingQuestions.filter(q => {
    const ms = !reviewSearch.trim() || q.question_text?.toLowerCase().includes(reviewSearch.toLowerCase());
    const mt = reviewTypeFilter === 'all' || q.question_type === reviewTypeFilter;
    return ms && mt;
  });

  return (
    <div style={{ direction: 'rtl' }}>

      {/* Stats */}
      {reviewStats && (
        <div style={rs.statsRow}>
          {[
            { v: reviewStats.pending,       l: 'ממתינות',  c: '#1976d2' },
            { v: reviewStats.approved,      l: 'אושרו',    c: '#2e7d32' },
            { v: reviewStats.rejected,      l: 'נדחו',     c: '#c62828' },
            { v: reviewStats.needsRevision, l: 'לתיקון',   c: '#e65100' },
          ].map(s => (
            <div key={s.l} style={rs.statChip}>
              <span style={{ ...rs.statNum, color: s.c }}>{s.v}</span>
              <span style={rs.statLbl}>{s.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={rs.filterBar}>
        <input
          type="text" placeholder="חפש שאלה..."
          value={reviewSearch} onChange={e => setReviewSearch(e.target.value)}
          style={rs.searchInput}
        />
        <select value={reviewTypeFilter} onChange={e => setReviewTypeFilter(e.target.value)} style={rs.typeSelect}>
          <option value="all">כל הסוגים</option>
          <option value="single_choice">בחירה יחידה</option>
          <option value="multi_choice">בחירה מרובה</option>
          <option value="true_false">נכון/לא נכון</option>
          <option value="open_ended">שאלה פתוחה</option>
        </select>
        <span style={rs.countBadge}>{visible.length} שאלות</span>
      </div>

      {/* Bulk toolbar */}
      {reviewSelectedIds.size > 0 && (
        <div style={{ ...styles.bulkToolbar, background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', marginBottom: '14px' }}>
          <span style={styles.bulkCount}>{reviewSelectedIds.size} נבחרו</span>
          <button style={{ ...styles.bulkBtn, background: '#43a047' }}
            onClick={() => handleBulkApprove(visible)} disabled={isBulkApproving}>
            {isBulkApproving ? 'מאשר...' : `✓ אשר ${reviewSelectedIds.size} שאלות`}
          </button>
          <button style={{ ...styles.bulkBtn, background: '#546e7a' }} onClick={() => setReviewSelectedIds(new Set())}>
            בטל בחירה
          </button>
        </div>
      )}

      {/* Select all row */}
      {visible.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#546e7a', marginBottom: '10px' }}>
          <input type="checkbox"
            checked={reviewSelectedIds.size === visible.length}
            ref={el => { if (el) el.indeterminate = reviewSelectedIds.size > 0 && reviewSelectedIds.size < visible.length; }}
            onChange={() => toggleSelectAll(visible)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          בחר הכל ({visible.length})
        </label>
      )}

      {/* Cards */}
      {visible.length === 0 ? (
        <div style={rs.empty}>
          {pendingQuestions.length === 0 ? '✅ אין שאלות ממתינות לאישור' : 'לא נמצאו שאלות התואמות לחיפוש'}
        </div>
      ) : (
        <div style={rs.cardList}>
          {visible.map((q, qi) => {
            const { opts, correctVals, explanation } = getOpts(q);
            const isSelected = reviewSelectedIds.has(q.id);
            const activeMode = inlineActions[q.id];
            const typeColor = TYPE_COLORS[q.question_type] || '#757575';

            return (
              <div key={q.id} style={{ ...rs.card, ...(isSelected ? rs.cardSelected : {}) }}>

                {/* Header */}
                <div style={rs.cardHeader}>
                  <div style={rs.cardHeaderLeft}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(q.id)}
                      style={{ width: '17px', height: '17px', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={rs.qIndex}>{qi + 1}</span>
                    <span style={{ ...rs.typeBadge, background: typeColor + '18', color: typeColor, border: `1px solid ${typeColor}40` }}>
                      {TYPE_LABELS[q.question_type] || q.question_type}
                    </span>
                    <QuestionStatsBadge
                      trainingLevel={q.training_level}
                      thinkingLevel={q.thinking_level}
                      attempts={q.total_attempts}
                      successRate={q.success_rate}
                    />
                    {(q.category || q.sub_category) && (
                      <span style={rs.hierBadge}>
                        {[q.category, q.sub_category].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </div>
                  <span style={rs.statusDraft}>ממתינה לאישור</span>
                </div>

                {/* Question text */}
                <p style={rs.questionText}>{q.question_text}</p>

                {/* Options */}
                {opts && opts.length > 0 ? (
                  <div style={rs.optionsList}>
                    {opts.map((opt, i) => {
                      const correct = correctVals.includes(opt.value) || correctVals.includes(String(i));
                      return (
                        <div key={i} style={{ ...rs.option, ...(correct ? rs.optionCorrect : {}) }}>
                          <span style={{ ...rs.optionDot, background: correct ? '#43a047' : '#e0e0e0', color: correct ? 'white' : '#757575' }}>
                            {correct ? '✓' : String.fromCharCode(0x05D0 + i)}
                          </span>
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {correct && <span style={rs.correctTag}>תשובה נכונה</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : q.question_type === 'true_false' ? (
                  <div style={rs.optionsList}>
                    {[{ value: 'true', label: 'נכון' }, { value: 'false', label: 'לא נכון' }].map((opt, i) => {
                      const correct = correctVals.includes(opt.value);
                      return (
                        <div key={i} style={{ ...rs.option, ...(correct ? rs.optionCorrect : {}) }}>
                          <span style={{ ...rs.optionDot, background: correct ? '#43a047' : '#e0e0e0', color: correct ? 'white' : '#757575' }}>
                            {correct ? '✓' : '○'}
                          </span>
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {correct && <span style={rs.correctTag}>תשובה נכונה</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={rs.noOptions}>אין אפשרויות שמורות</div>
                )}

                {/* Explanation */}
                {explanation && (
                  <div style={rs.explanation}>💡 <strong>הסבר:</strong> {explanation}</div>
                )}

                {/* Inline reject/revision input */}
                {activeMode && (
                  <div style={rs.inlineAction}>
                    <textarea autoFocus rows={3}
                      placeholder={activeMode === 'reject' ? 'סיבת דחייה...' : 'משוב לתיקון...'}
                      value={inlineText[q.id] || ''}
                      onChange={e => setInlineText(p => ({ ...p, [q.id]: e.target.value }))}
                      style={rs.inlineTextarea}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button style={{ ...rs.actionBtn, background: activeMode === 'reject' ? '#c62828' : '#e65100' }}
                        onClick={() => submitInline(q, activeMode)}
                        disabled={!(inlineText[q.id] || '').trim()}>
                        {activeMode === 'reject' ? '✗ אשר דחייה' : '🔄 שלח לתיקון'}
                      </button>
                      <button style={{ ...rs.actionBtn, background: '#546e7a' }} onClick={() => toggleInline(q.id, activeMode)}>
                        ביטול
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={rs.cardActions}>
                  <button style={{ ...rs.actionBtn, background: '#2e7d32', fontSize: '14px', padding: '10px 22px' }}
                    onClick={() => onApprove(q.id)}>
                    ✓ אישור
                  </button>
                  <button style={{ ...rs.actionBtn, background: '#1565c0' }} onClick={() => onEdit(q)}>
                    ✏ ערוך
                  </button>
                  <button style={{ ...rs.actionBtn, background: activeMode === 'revision' ? '#bf360c' : '#e65100' }}
                    onClick={() => toggleInline(q.id, 'revision')}>
                    🔄 בקש תיקון
                  </button>
                  <button style={{ ...rs.actionBtn, background: activeMode === 'reject' ? '#7f0000' : '#c62828' }}
                    onClick={() => toggleInline(q.id, 'reject')}>
                    ✗ דחייה
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Review panel local styles ──────────────────────────
const rs = {
  statsRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' },
  statChip: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'white', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e8ecf0' },
  statNum: { fontSize: '24px', fontWeight: '800' },
  statLbl: { fontSize: '13px', color: '#78909c', fontWeight: '500' },

  filterBar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' },
  searchInput: { flex: 1, minWidth: '200px', padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', direction: 'rtl', fontFamily: 'inherit' },
  typeSelect: { padding: '10px 12px', border: '1.5px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', direction: 'rtl', fontFamily: 'inherit', cursor: 'pointer', minWidth: '150px' },
  countBadge: { fontSize: '13px', color: '#546e7a', fontWeight: '600', background: '#f5f7fa', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e0e0e0' },

  empty: { padding: '60px 24px', textAlign: 'center', color: '#78909c', fontSize: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e8ecf0' },

  cardList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: { background: 'white', borderRadius: '14px', padding: '20px 22px', border: '1.5px solid #e8ecf0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardSelected: { borderColor: '#1976d2', boxShadow: '0 2px 12px rgba(25,118,210,0.18)', background: '#f3f8ff' },

  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' },
  cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  qIndex: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#1976d2', color: 'white', fontSize: '13px', fontWeight: '700', flexShrink: 0 },
  typeBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  diffBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2' },
  hierBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: '#f3e5f5', color: '#7b1fa2', border: '1px solid #e1bee7', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusDraft: { padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082' },

  questionText: { fontSize: '15px', fontWeight: '600', color: '#212121', lineHeight: '1.6', margin: '0 0 14px', padding: '12px 16px', background: '#f8f9ff', borderRadius: '10px', border: '1px solid #e8eaf6' },

  optionsList: { display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '12px' },
  option: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderRadius: '9px', background: '#fafafa', border: '1.5px solid #e0e0e0', fontSize: '14px', color: '#424242' },
  optionCorrect: { background: '#e8f5e9', border: '1.5px solid #66bb6a', fontWeight: '700', color: '#2e7d32' },
  optionDot: { width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 },
  correctTag: { marginRight: 'auto', fontSize: '12px', color: '#43a047', fontWeight: '600', background: '#c8e6c9', padding: '2px 8px', borderRadius: '10px' },

  noOptions: { padding: '8px 14px', color: '#9e9e9e', fontSize: '13px', fontStyle: 'italic', marginBottom: '10px' },
  explanation: { padding: '10px 14px', borderRadius: '9px', background: '#fff8e1', border: '1px solid #ffe082', fontSize: '13px', color: '#5d4037', marginBottom: '12px' },

  inlineAction: { padding: '14px', background: '#fafafa', borderRadius: '9px', border: '1.5px dashed #bdbdbd', marginBottom: '12px' },
  inlineTextarea: { width: '100%', padding: '10px', border: '1.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', direction: 'rtl', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },

  cardActions: { display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid #f0f0f0' },
  actionBtn: { padding: '8px 18px', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
};

/**
 * Panel for admin/manager to review user-submitted question reports.
 */
function UserReportReviewPanel({ reports, onReview, onRefresh }) {
  const [expandedId, setExpandedId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});

  if (reports.length === 0) {
    return (
      <div style={{ direction: 'rtl', textAlign: 'center', padding: '40px', color: '#888' }}>
        <p style={{ fontSize: '18px' }}>אין דיווחים ממתינים לבדיקה</p>
        <button onClick={onRefresh} style={{ marginTop: '12px', padding: '8px 20px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
          רענן
        </button>
      </div>
    );
  }

  const renderDiff = (label, original, suggested) => {
    if (suggested === undefined || suggested === original) return null;
    return (
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#555' }}>{label}:</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
          <span style={{ background: '#ffebee', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', textDecoration: 'line-through', color: '#c62828' }}>
            {typeof original === 'object' ? JSON.stringify(original) : (original || '(ריק)')}
          </span>
          <span style={{ fontSize: '13px', color: '#666' }}>→</span>
          <span style={{ background: '#e8f5e9', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', color: '#2e7d32' }}>
            {typeof suggested === 'object' ? JSON.stringify(suggested) : (suggested || '(ריק)')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>דיווחי משתמשים ({reports.length} ממתינים)</h3>
        <button onClick={onRefresh} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
          רענן
        </button>
      </div>

      {reports.map(report => {
        const isExpanded = expandedId === report.id;
        const suggested = report.suggested || {};
        const original = report.original || {};
        const hasChanges = !suggested._description_only && Object.keys(suggested).length > 0;

        return (
          <div key={report.id} style={{ marginBottom: '12px', border: '1px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
            {/* Header */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', background: isExpanded ? '#fafafa' : '#fff' }}
              onClick={() => setExpandedId(isExpanded ? null : report.id)}
            >
              <span style={{ fontSize: '18px' }}>{isExpanded ? '▾' : '▸'}</span>
              {report.question_id && (
                <span title={report.question_id} style={{ background: '#f0f0f0', padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>
                  id · {String(report.question_id).slice(-10)}
                </span>
              )}
              <span style={{ flex: 1, fontSize: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {original.question_text?.slice(0, 80) || '(ללא טקסט)'}
              </span>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {report.reporter_name || 'אנונימי'} · {new Date(report.createdAt).toLocaleDateString('he-IL')}
              </span>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0f0f0' }}>
                {/* Description */}
                {report.description && (
                  <div style={{ margin: '12px 0', padding: '10px 14px', background: '#fff3e0', borderRadius: '8px', fontSize: '14px', color: '#e65100' }}>
                    <strong>תיאור הבעיה:</strong> {report.description}
                  </div>
                )}

                {/* Diff view */}
                {hasChanges && (
                  <div style={{ margin: '12px 0' }}>
                    <h4 style={{ fontSize: '14px', margin: '0 0 8px', color: '#555' }}>שינויים מוצעים:</h4>
                    {renderDiff('טקסט השאלה', original.question_text, suggested.question_text)}
                    {renderDiff('הסבר', original.explanation, suggested.explanation)}
                    {renderDiff('רמז', original.hint, suggested.hint)}
                    {suggested.options && renderDiff('אפשרויות', JSON.stringify(original.options), JSON.stringify(suggested.options?.map(o => o.label ?? o)))}
                    {suggested.correct_answer && renderDiff('תשובה נכונה', original.correct_answer, suggested.correct_answer)}
                  </div>
                )}

                {!hasChanges && !report.description && (
                  <p style={{ color: '#999', fontSize: '13px', margin: '12px 0' }}>לא בוצעו שינויים ולא נכתב תיאור.</p>
                )}

                {/* Review note */}
                <textarea
                  value={reviewNotes[report.id] || ''}
                  onChange={e => setReviewNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                  placeholder="הערת מנהל (לא חובה)..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginTop: '8px', direction: 'rtl' }}
                />

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {hasChanges && (
                    <button
                      style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit' }}
                      onClick={() => onReview(report.id, 'approved', suggested, reviewNotes[report.id])}
                    >
                      אשר שינויים
                    </button>
                  )}
                  <button
                    style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #c62828', background: '#fff', color: '#c62828', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit' }}
                    onClick={() => onReview(report.id, 'rejected', null, reviewNotes[report.id])}
                  >
                    דחה
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    fontSize: 'clamp(22px, 5vw, 32px)',
    fontWeight: 'bold',
    margin: 0,
    color: '#212121'
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  filtersSection: {
    marginBottom: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  filters: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  filterSelectWrap: {
    position: 'relative',
    overflow: 'visible',
    width: '160px',
    minWidth: '120px',
    flexShrink: 1,
  },
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl',
    width: '100%',
    boxSizing: 'border-box',
    appearance: 'menulist',
    cursor: 'pointer',
    backgroundColor: '#fff'
  },
  questionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  empty: {
    padding: '60px 20px',
    textAlign: 'center',
    color: '#757575',
    fontSize: '16px'
  },
  tableContainer: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '16px',
    textAlign: 'right',
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    fontSize: '14px',
    borderBottom: '2px solid #e0e0e0'
  },
  tr: {
    borderBottom: '1px solid #f5f5f5',
    '&:hover': {
      backgroundColor: '#f9f9f9'
    }
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#212121'
  },
  questionText: {
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    wordBreak: 'break-word',
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  statusActive: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32'
  },
  statusSuspended: {
    backgroundColor: '#ffebee',
    color: '#c62828'
  },
  statusUnderReview: {
    backgroundColor: '#fff8e1',
    color: '#f57f17',
    border: '1px solid #ffcc80',
  },
  statusDraft: {
    backgroundColor: '#fff3e0',
    color: '#e65100'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  actionButton: {
    padding: '6px 12px',
    backgroundColor: '#f5f5f5',
    color: '#212121',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#e0e0e0'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  deleteButton: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    '&:hover': {
      backgroundColor: '#ffcdd2'
    }
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    borderBottom: '2px solid #e0e0e0',
    marginBottom: '24px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  tab: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#757575',
    marginBottom: '-2px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    '&:hover': {
      color: '#CC0000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px',
      borderRadius: '4px 4px 0 0'
    }
  },
  tabActive: {
    color: '#CC0000',
    borderBottom: '2px solid #CC0000',
    fontWeight: 'bold'
  },
  badge: {
    backgroundColor: '#f44336',
    color: '#FFFFFF',
    borderRadius: '10px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold',
    minWidth: '20px',
    textAlign: 'center'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
    gap: '12px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 'clamp(14px, 3vw, 24px)',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  statValue: {
    fontSize: 'clamp(24px, 5vw, 36px)',
    fontWeight: 'bold',
    color: '#CC0000',
    marginBottom: '6px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#757575'
  },
  approveButton: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    '&:hover': {
      backgroundColor: '#c8e6c9'
    }
  },
  rejectButton: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    '&:hover': {
      backgroundColor: '#ffcdd2'
    }
  },
  revisionButton: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    '&:hover': {
      backgroundColor: '#ffe0b2'
    }
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '10px',
    boxSizing: 'border-box',
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: 'clamp(16px, 4vw, 24px)',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  dialogTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#212121'
  },
  dialogText: {
    fontSize: '16px',
    marginBottom: '12px',
    color: '#212121'
  },
  dialogTextarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl',
    fontFamily: 'inherit',
    resize: 'vertical',
    marginBottom: '16px',
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  dialogButton: {
    padding: '10px 20px',
    backgroundColor: '#f5f5f5',
    color: '#212121',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#e0e0e0'
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed'
    }
  },
  dialogButtonPrimary: {
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    '&:hover:not(:disabled)': {
      backgroundColor: '#A50000'
    }
  },

  // ── Bulk actions toolbar ────────────────────────
  bulkToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
    borderRadius: '10px',
    marginBottom: '12px',
    boxShadow: '0 3px 12px rgba(26,35,126,0.25)',
    animation: 'slideDown 0.2s ease',
  },
  bulkCount: {
    color: 'white',
    fontWeight: '700',
    fontSize: '14px',
    marginLeft: '8px',
    background: 'rgba(255,255,255,0.15)',
    padding: '4px 12px',
    borderRadius: '20px',
  },
  bulkSelect: {
    padding: '7px 12px',
    borderRadius: '6px',
    border: '1.5px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.95)',
    fontSize: '13px',
    fontFamily: 'inherit',
    direction: 'rtl',
    cursor: 'pointer',
    minWidth: 'min(160px, 100%)',
    flex: '1 1 auto',
  },
  bulkBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s',
    whiteSpace: 'nowrap',
  },
};
