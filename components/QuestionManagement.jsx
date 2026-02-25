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
import TagFilter from './TagFilter';
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
import { reclassifyAllQuestionsByContent, reclassifyUnanalyzedQuestionsWithAI } from '../workflows/questionClassification';
import { getDifficultyDisplay, MIN_ATTEMPTS_FOR_RATING } from '../workflows/difficultyEngine';
import { fixQuestionWithAI } from '../workflows/questionEnrich';

/** Small reusable badge component for difficulty */
function DifficultyBadge({ level, attempts, successRate }) {
  const unrated = !level;
  const belowThreshold = !attempts || attempts < MIN_ATTEMPTS_FOR_RATING;
  const d = getDifficultyDisplay(level);
  const rateStr = successRate != null ? `${successRate}% נכון` : '';
  const attStr  = attempts != null ? `${attempts} ניסיונות` : '';
  const tooltip = unrated
    ? belowThreshold
      ? `לא מדורג — נדרשות ${MIN_ATTEMPTS_FOR_RATING} תשובות לפחות (${attStr})`
      : 'לא מדורג'
    : [d.label, rateStr, attStr].filter(Boolean).join(' · ');
  return (
    <span title={tooltip} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
      color: d.color, background: d.bg, border: `1px solid ${d.border}`,
      whiteSpace: 'nowrap',
    }}>
      {d.label}
      {!unrated && successRate != null && (
        <span style={{ marginRight: '4px', fontWeight: 400, opacity: 0.75 }}>
          {` ${successRate}%`}
        </span>
      )}
    </span>
  );
}

export default function QuestionManagement() {
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'import', 'review'
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    questionType: 'all',
    difficulty: 'all',
    hierarchyId: null
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
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
  const [hierarchies, setHierarchies] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // ── Bulk selection state ────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatusTarget, setBulkStatusTarget] = useState('');
  const [bulkHierarchyTarget, setBulkHierarchyTarget] = useState('');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [aiReclassifyProgress, setAiReclassifyProgress] = useState({ running: false, current: 0, total: 0, updated: 0 });
  const [isSyncingToServer, setIsSyncingToServer] = useState(false);
  const hasAutoReclassified = useRef(false);

  useEffect(() => {
    loadUser();
    loadQuestions();
    loadHierarchies();
    if (activeTab === 'review') {
      loadPendingQuestions();
      loadReviewStats();
    }
  }, [activeTab]);

  // Once per session: reclassify all questions by content (fix "כולן מבואות")
  useEffect(() => {
    if (hasAutoReclassified.current || !hierarchies.length || !questions.length || activeTab !== 'list') return;
    hasAutoReclassified.current = true;
    let cancelled = false;
    (async () => {
      setIsReclassifying(true);
      try {
        const result = await reclassifyAllQuestionsByContent(entities);
        if (cancelled) return;
        if (result.updated > 0) {
          await loadQuestions();
          showToast(`יושרו קטגוריות לפי תוכן: עודכנו ${result.updated} שאלות.`, 'success');
        }
      } catch (e) {
        if (!cancelled) showToast('יישור קטגוריות נכשל: ' + (e?.message || ''), 'error');
      } finally {
        if (!cancelled) setIsReclassifying(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hierarchies.length, questions.length, activeTab]);

  useEffect(() => {
    filterQuestions();
  }, [searchQuery, filters, questions, selectedTags]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      let allQuestions = [];
      try {
        const res = await fetch('/api/questions');
        // #region agent log
        if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H1_H2_H4',location:'QuestionManagement.jsx:loadQuestions:afterFetch',message:'GET /api/questions response',data:{status:res.status,ok:res.ok},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            allQuestions = data;
            if (typeof window !== 'undefined') window.__quizMDA_usingQuestionApi = true;
            // #region agent log
            if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H1_H4',location:'QuestionManagement.jsx:loadQuestions:fromApi',message:'using API data',data:{count:data.length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          }
        }
      } catch (e) {
        // #region agent log
        if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H2',location:'QuestionManagement.jsx:loadQuestions:fetchCatch',message:'fetch failed',data:{err:String(e?.message||e)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      if (allQuestions.length === 0) {
        allQuestions = await entities.Question_Bank.find({}, {
          sort: { createdAt: -1 }
        });
        if (typeof window !== 'undefined') window.__quizMDA_usingQuestionApi = false;
        // #region agent log
        if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H2',location:'QuestionManagement.jsx:loadQuestions:fallback',message:'using localStorage fallback',data:{count:allQuestions.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      setQuestions(allQuestions);
      const tagsSet = new Set();
      allQuestions.forEach(q => {
        if (q.tags && Array.isArray(q.tags)) {
          q.tags.forEach(tag => tagsSet.add(tag));
        }
      });
      setAvailableTags(Array.from(tagsSet).sort());
      setFilteredQuestions(allQuestions);
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

  const loadHierarchies = async () => {
    try {
      const allHierarchies = await entities.Content_Hierarchy.find({});
      setHierarchies(allHierarchies);
    } catch (error) {
      console.error('Error loading hierarchies:', error);
    }
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
    if (!questions.length) return;
    setIsSyncingToServer(true);
    const CHUNK = 100;
    const payload = questions.map(q => ({
      hierarchy_id: q.hierarchy_id,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options ?? [],
      correct_answer: q.correct_answer,
      difficulty_level: q.difficulty_level ?? 5,
      explanation: q.explanation,
      hint: q.hint,
      tags: q.tags ?? [],
      status: q.status ?? 'active',
    }));
    let synced = 0;
    // #region agent log
    if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H3',location:'QuestionManagement.jsx:syncQuestionsToServer:start',message:'sync start',data:{totalQuestions:payload.length,chunkSize:CHUNK},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });
        if (res.status === 200 || res.status === 201) synced += chunk.length;
        // #region agent log
        if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H3',location:'QuestionManagement.jsx:syncQuestionsToServer:chunk',message:'chunk result',data:{chunkIndex:Math.floor(i/CHUNK),status:res.status,syncedSoFar:synced},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (res.status === 503 || res.status === 500) {
          const msg = res.status === 503
            ? 'השרת לא מחובר ל-MongoDB. ב-Render: בדוק ש-MONGODB_URI מוגדר ב-Environment, וב-MongoDB Atlas אפשר גישה מ-Network Access (0.0.0.0/0).'
            : (await res.json().catch(() => ({}))).error || 'שגיאת שרת';
          showToast(msg, 'error');
          break;
        }
      }
      // #region agent log
      if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H3',location:'QuestionManagement.jsx:syncQuestionsToServer:done',message:'sync done',data:{totalPayload:payload.length,synced},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (synced > 0) {
        showToast(`סונכרנו ${synced} שאלות לשרת — יופיעו בכל המכשירים`, 'success');
        await loadQuestions();
      } else if (synced === 0 && payload.length > 0) {
        showToast('לא סונכרנו שאלות — השרת לא מחובר למסד הנתונים', 'error');
      }
      if (synced > 0 && synced < payload.length) showToast(`${payload.length - synced} שאלות לא סונכרנו`, 'warning');
    } catch (e) {
      showToast('סנכרון לשרת נכשל: ' + (e?.message || ''), 'error');
    } finally {
      setIsSyncingToServer(false);
    }
  };

  const filterQuestions = () => {
    let filtered = [...questions];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q => 
        q.question_text?.toLowerCase().includes(query) ||
        q.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(q => q.status === filters.status);
    }

    // Type filter
    if (filters.questionType !== 'all') {
      filtered = filtered.filter(q => q.question_type === filters.questionType);
    }

    // Difficulty filter (label-based: קל / בינוני / קשה / unrated)
    if (filters.difficulty !== 'all') {
      filtered = filtered.filter(q => {
        if (filters.difficulty === 'unrated') return !q.difficulty_level;
        return q.difficulty_level === filters.difficulty;
      });
    }

    // Hierarchy filter
    if (filters.hierarchyId) {
      filtered = filtered.filter(q => q.hierarchy_id === filters.hierarchyId);
    }

    // Tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(q => {
        if (!q.tags || !Array.isArray(q.tags)) return false;
        return selectedTags.some(tag => q.tags.includes(tag));
      });
    }

    setFilteredQuestions(filtered);
  };

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
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
      const label = newStatus === 'active' ? 'הופעלו' : newStatus === 'draft' ? 'הוחזרו לטיוטה' : 'הושעו';
      showToast(`${ids.length} שאלות ${label}`, 'success');
      setSelectedIds(new Set());
      await loadQuestions();
    } catch (error) {
      showToast('שגיאה בעדכון סטטוס מרובה', 'error');
    }
  };

  const handleBulkChangeHierarchy = async (hierarchyId) => {
    if (!hierarchyId) return;
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        await entities.Question_Bank.update(id, { hierarchy_id: hierarchyId });
      }
      showToast(`${ids.length} שאלות הועברו לנושא חדש`, 'success');
      setSelectedIds(new Set());
      setBulkHierarchyTarget('');
      await loadQuestions();
    } catch (error) {
      showToast('שגיאה בעדכון נושא', 'error');
    }
  };

  const handleReclassifyAllByContent = async () => {
    if (!questions.length) {
      showToast('אין שאלות במערכת', 'info');
      return;
    }
    setIsReclassifying(true);
    try {
      const result = await reclassifyAllQuestionsByContent(entities);
      await loadQuestions();
      if (result.updated > 0) {
        showToast(`עודכנו ${result.updated} שאלות לקטגוריה לפי תוכן. דולגו ${result.skipped}.`, 'success');
      } else if (result.skipped === questions.length) {
        showToast('כל השאלות כבר מסווגות או ללא התאמה. לא בוצעו שינויים.', 'info');
      } else {
        showToast(`דולגו ${result.skipped} שאלות. ${result.errors ? `שגיאות: ${result.errors}` : ''}`, 'info');
      }
    } catch (error) {
      showToast('שגיאה ביישור קטגוריות: ' + (error?.message || 'unknown'), 'error');
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
          </div>

          {/* Tab Panels */}
          {activeTab === 'list' && (
            <div role="tabpanel" aria-labelledby="list-tab" id="list-panel">

          {/* Search and Filters */}
          <div style={styles.filtersSection}>
            <SearchBar
              onSearch={setSearchQuery}
              placeholder="חפש שאלות..."
            />

            {availableTags.length > 0 && (
              <TagFilter
                tags={availableTags}
                selectedTags={selectedTags}
                onToggle={handleTagToggle}
                multiSelect={true}
              />
            )}

            <div style={styles.filters}>
              <select
                style={styles.filterSelect}
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                aria-label="סינון לפי סטטוס"
              >
                <option value="all">כל הסטטוסים</option>
                <option value="active">פעיל</option>
                <option value="draft">טיוטה</option>
                <option value="pending_review">לבדיקה</option>
                <option value="suspended">מושעה</option>
              </select>

              <select
                style={styles.filterSelect}
                value={filters.questionType}
                onChange={(e) => setFilters({ ...filters, questionType: e.target.value })}
                aria-label="סינון לפי סוג שאלה"
              >
                <option value="all">כל הסוגים</option>
                <option value="single_choice">בחירה יחידה</option>
                <option value="multi_choice">בחירה מרובה</option>
                <option value="true_false">נכון/לא נכון</option>
                <option value="open_ended">שאלה פתוחה</option>
              </select>

              <select
                style={styles.filterSelect}
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                aria-label="סינון לפי קושי"
              >
                <option value="all">כל רמות הקושי</option>
                <option value="קל">קל (95–100%)</option>
                <option value="בינוני">בינוני (80–94%)</option>
                <option value="קשה">קשה (70–79%)</option>
                <option value="unrated">לא מדורג (פחות מ-50 ניסיונות)</option>
              </select>

              <select
                style={styles.filterSelect}
                value={filters.hierarchyId || ''}
                onChange={(e) => setFilters({ ...filters, hierarchyId: e.target.value || null })}
                aria-label="סינון לפי נושא"
              >
                <option value="">כל הנושאים</option>
                {hierarchies.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.category_name} - {h.topic_name}
                  </option>
                ))}
              </select>

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
                <option value="active">פעיל</option>
                <option value="draft">טיוטה</option>
                <option value="pending_review">לבדיקה</option>
                <option value="suspended">מושעה</option>
              </select>
              <button
                style={{ ...styles.bulkBtn, background: '#1976d2' }}
                disabled={!bulkStatusTarget}
                onClick={() => { handleBulkStatusChange(bulkStatusTarget); setBulkStatusTarget(''); }}
              >
                החל סטטוס
              </button>

              {/* Bulk move to hierarchy */}
              {hierarchies.length > 0 && (
                <>
                  <select
                    value={bulkHierarchyTarget}
                    onChange={e => setBulkHierarchyTarget(e.target.value)}
                    style={styles.bulkSelect}
                    aria-label="העבר לנושא"
                  >
                    <option value="">העבר לנושא...</option>
                    {hierarchies.map(h => (
                      <option key={h.id} value={h.id}>{h.category_name} — {h.topic_name}</option>
                    ))}
                  </select>
                  <button
                    style={{ ...styles.bulkBtn, background: '#7b1fa2' }}
                    disabled={!bulkHierarchyTarget}
                    onClick={() => handleBulkChangeHierarchy(bulkHierarchyTarget)}
                  >
                    העבר נושא
                  </button>
                </>
              )}

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
                      <th style={styles.th}>שאלה</th>
                      <th style={styles.th}>סוג</th>
                      <th style={styles.th}>קושי</th>
                      <th style={styles.th}>סטטוס</th>
                      <th style={styles.th}>קטגוריה</th>
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
                      const hierarchy = question.hierarchy || hierarchies.find(h => h.id === question.hierarchy_id);
                      const categoryLabel = hierarchy
                        ? [hierarchy.category_name, hierarchy.topic_name].filter(Boolean).join(' / ') || '-'
                        : '-';

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
                              {question.question_type === 'single_choice' && 'בחירה יחידה'}
                              {question.question_type === 'multi_choice' && 'בחירה מרובה'}
                              {question.question_type === 'true_false' && 'נכון/לא נכון'}
                              {question.question_type === 'open_ended' && 'שאלה פתוחה'}
                            </td>
                            <td style={styles.td}>
                              <DifficultyBadge level={question.difficulty_level} attempts={question.total_attempts} successRate={question.success_rate} />
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.statusBadge,
                                ...(question.status === 'active' ? styles.statusActive :
                                    question.status === 'suspended' ? styles.statusSuspended :
                                    question.status === 'pending_review' ? { background: '#fff3e0', color: '#e65100', border: '1px solid #ffb74d' } :
                                    styles.statusDraft)
                              }}>
                                {question.status === 'active' && 'פעיל'}
                                {question.status === 'suspended' && 'מושעה'}
                                {question.status === 'pending_review' && 'לבדיקה'}
                                {question.status === 'draft' && 'טיוטה'}
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
                              <td colSpan={8} style={{ ...styles.td, padding: '12px 16px', background: '#fafafa', borderTop: 'none' }}>
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
              hierarchies={hierarchies}
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
                hierarchies={hierarchies}
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
                    <DifficultyBadge level={q.difficulty_level} attempts={q.total_attempts} successRate={q.success_rate} />
                    {q.hierarchy && (
                      <span style={rs.hierBadge}>{q.hierarchy.category_name} / {q.hierarchy.topic_name}</span>
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

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px'
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
    fontSize: '32px',
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
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl',
    minWidth: '150px'
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
    whiteSpace: 'nowrap'
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
    gap: '8px',
    borderBottom: '2px solid #e0e0e0',
    marginBottom: '30px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#757575',
    marginBottom: '-2px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: '24px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#CC0000',
    marginBottom: '8px'
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
    zIndex: 2000
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto'
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
    minWidth: '160px',
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
