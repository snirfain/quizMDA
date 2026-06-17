/**
 * QuestionReportModal — trainee flags a question as problematic and suggests corrections.
 * Editable: question_text, options, correct_answer, explanation, hint, question_type.
 * Not editable: סטטוס ושדות מטא־דאטה מהמערכת.
 * Hebrew: דיווח על בעיה בשאלה
 */
import React, { useState, useMemo } from 'react';
import { getCurrentUser } from '../utils/auth';
import { showToast } from './Toast';

const TYPE_LABELS = {
  single_choice: 'בחירה יחידה',
  multi_choice: 'בחירה מרובה',
  true_false: 'נכון/לא נכון',
  open_ended: 'שאלה פתוחה',
};

function parseOptions(question) {
  const raw = question.options;
  if (Array.isArray(raw) && raw.length > 0) {
    if (typeof raw[0] === 'string') return raw.slice();
    return raw.map(o => o.label ?? o.text ?? '');
  }
  try {
    const ca = typeof question.correct_answer === 'string' ? JSON.parse(question.correct_answer) : question.correct_answer;
    if (ca?.options?.length) return ca.options.map(o => o.label ?? o.text ?? '');
  } catch (_) {}
  return [];
}

function parseCorrectValue(question) {
  try {
    const ca = typeof question.correct_answer === 'string' ? JSON.parse(question.correct_answer) : question.correct_answer;
    if (question.question_type === 'multi_choice') return ca?.values?.map(String) ?? [];
    return ca?.value != null ? String(ca.value) : (question.correct_answer ?? '');
  } catch (_) {
    return question.correct_answer ?? '';
  }
}

export default function QuestionReportModal({ question, onClose }) {
  const opts = useMemo(() => parseOptions(question), [question]);
  const correctVal = useMemo(() => parseCorrectValue(question), [question]);

  const [questionText, setQuestionText] = useState(question.question_text ?? '');
  const [options, setOptions] = useState(opts);
  const [correctAnswer, setCorrectAnswer] = useState(correctVal);
  const [explanation, setExplanation] = useState(question.explanation ?? '');
  const [hint, setHint] = useState(question.hint ?? '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOptionChange = (idx, val) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const handleSubmit = async () => {
    const suggested = {};
    if (questionText !== (question.question_text ?? '')) suggested.question_text = questionText;
    if (explanation !== (question.explanation ?? '')) suggested.explanation = explanation;
    if (hint !== (question.hint ?? '')) suggested.hint = hint;

    const origOpts = opts;
    const optsChanged = options.length !== origOpts.length || options.some((o, i) => o !== origOpts[i]);
    if (optsChanged) {
      suggested.options = options.map((label, idx) => ({ value: String(idx), label }));
    }

    if (JSON.stringify(correctAnswer) !== JSON.stringify(correctVal)) {
      if (question.question_type === 'multi_choice') {
        suggested.correct_answer = JSON.stringify({ values: correctAnswer, options: (suggested.options ?? options).map((l, i) => ({ value: String(i), label: typeof l === 'string' ? l : l.label })) });
      } else if (question.question_type === 'open_ended') {
        suggested.correct_answer = correctAnswer;
      } else {
        suggested.correct_answer = JSON.stringify({ value: correctAnswer, options: (suggested.options ?? options).map((l, i) => ({ value: String(i), label: typeof l === 'string' ? l : l.label })) });
      }
    }

    if (Object.keys(suggested).length === 0 && !description.trim()) {
      showToast('לא בוצעו שינויים ולא נכתב תיאור', 'error');
      return;
    }

    setSaving(true);
    try {
      const user = await getCurrentUser();
      const original = {
        question_text: question.question_text,
        options: origOpts,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        hint: question.hint,
      };
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id || question._id,
          reporter_id: user?.user_id ?? 'anonymous',
          reporter_name: user?.full_name ?? '',
          original,
          suggested: Object.keys(suggested).length > 0 ? suggested : { _description_only: true },
          description: description.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'שגיאה בשליחה');
      showToast('הדיווח נשלח בהצלחה — תודה!', 'success');
      onClose?.({ reported: true });
    } catch (err) {
      console.error('Report submit error:', err);
      showToast('שגיאה בשליחת הדיווח', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isChoice = question.question_type === 'single_choice' || question.question_type === 'multi_choice';

  return (
    <div style={overlay} onClick={() => onClose?.({ reported: false })}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontWeight: 700, fontSize: '18px' }}>דיווח על בעיה בשאלה</span>
          {(question.id || question._id) && (
            <span style={serialBadge} title={String(question.id ?? question._id)}>
              מזהה · {String(question.id ?? question._id).slice(-10)}
            </span>
          )}
          <button style={closeBtn} onClick={() => onClose?.({ reported: false })} aria-label="סגור">✕</button>
        </div>

        <div style={body}>
          {/* Description */}
          <label style={labelStyle}>תאר את הבעיה:</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="מה הבעיה בשאלה?"
            rows={3}
            style={textareaStyle}
          />

          <div style={divider} />
          <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px' }}>
            ניתן לתקן את השאלה — השינויים יועברו לאישור מנהל:
          </p>

          {/* Question text */}
          <label style={labelStyle}>טקסט השאלה:</label>
          <textarea
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            rows={3}
            style={textareaStyle}
          />

          {/* Options */}
          {isChoice && options.length > 0 && (
            <>
              <label style={labelStyle}>אפשרויות:</label>
              {options.map((opt, idx) => {
                const isSingle = question.question_type === 'single_choice';
                const isChecked = isSingle
                  ? correctAnswer === String(idx)
                  : Array.isArray(correctAnswer) && correctAnswer.includes(String(idx));
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <input
                      type={isSingle ? 'radio' : 'checkbox'}
                      name="report-correct"
                      checked={isChecked}
                      onChange={() => {
                        if (isSingle) {
                          setCorrectAnswer(String(idx));
                        } else {
                          const cur = Array.isArray(correctAnswer) ? correctAnswer : [];
                          setCorrectAnswer(isChecked ? cur.filter(a => a !== String(idx)) : [...cur, String(idx)]);
                        }
                      }}
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={e => handleOptionChange(idx, e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                );
              })}
            </>
          )}

          {question.question_type === 'true_false' && (
            <>
              <label style={labelStyle}>תשובה נכונה:</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                {['true', 'false'].map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="report-tf" checked={correctAnswer === v} onChange={() => setCorrectAnswer(v)} />
                    {v === 'true' ? 'נכון' : 'לא נכון'}
                  </label>
                ))}
              </div>
            </>
          )}

          {question.question_type === 'open_ended' && (
            <>
              <label style={labelStyle}>תשובה נכונה:</label>
              <textarea
                value={typeof correctAnswer === 'string' ? correctAnswer : ''}
                onChange={e => setCorrectAnswer(e.target.value)}
                rows={2}
                style={textareaStyle}
              />
            </>
          )}

          {/* Explanation */}
          <label style={labelStyle}>הסבר:</label>
          <textarea
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            rows={2}
            style={textareaStyle}
          />

          {/* Hint */}
          <label style={labelStyle}>רמז:</label>
          <input type="text" value={hint} onChange={e => setHint(e.target.value)} style={inputStyle} />
        </div>

        <div style={footer}>
          <button style={cancelBtn} onClick={() => onClose?.({ reported: false })}>ביטול</button>
          <button style={submitBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? 'שולח...' : 'שלח דיווח'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── styles ─── */
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10000, padding: '10px', boxSizing: 'border-box',
};
const modal = {
  background: '#fff', borderRadius: '14px', maxWidth: '560px', width: '100%',
  maxHeight: '92vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 40px rgba(0,0,0,0.25)', direction: 'rtl',
};
const header = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '16px 20px', borderBottom: '1px solid #eee',
};
const serialBadge = {
  fontSize: '13px', background: '#f0f0f0', padding: '2px 10px',
  borderRadius: '12px', color: '#555', fontWeight: 600,
};
const closeBtn = {
  marginRight: 'auto', background: 'transparent', border: 'none',
  fontSize: '20px', cursor: 'pointer', color: '#999',
};
const body = {
  padding: '16px 20px', overflowY: 'auto', flex: 1,
};
const footer = {
  display: 'flex', gap: '10px', justifyContent: 'flex-end',
  padding: '12px 20px', borderTop: '1px solid #eee',
};
const labelStyle = { fontSize: '13px', fontWeight: 600, color: '#333', display: 'block', marginBottom: '4px', marginTop: '10px' };
const textareaStyle = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #ddd',
  borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit',
  resize: 'vertical', boxSizing: 'border-box', direction: 'rtl',
};
const inputStyle = {
  flex: 1, padding: '8px 12px', border: '1.5px solid #ddd',
  borderRadius: '8px', fontSize: '14px', direction: 'rtl',
};
const divider = { height: '1px', background: '#eee', margin: '14px 0' };
const cancelBtn = {
  padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc',
  background: '#fff', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit',
};
const submitBtn = {
  padding: '10px 24px', borderRadius: '8px', border: 'none',
  background: '#CC0000', color: '#fff', cursor: 'pointer',
  fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
};
