/**
 * RollingCasePreview — sequential flow simulator for rolling-case questions.
 *
 * For instructors/managers: walks the case exactly as a student would experience
 * it. Starts at branch "b1", renders the branch's stem and distractors as buttons,
 * evaluates the chosen answer against the branch's correct_answer, then follows the
 * matching transition (always / is_correct / is_incorrect / answer_equals / score_*)
 * to the next branch. A leaf branch (no outgoing transition) ends the case.
 *
 * RTL + Hebrew, themed via the app's CSS variables (light/dark aware).
 */
import React, { useMemo, useState, useCallback } from 'react';
import { scoreBranchAnswer, resolveNextBranch } from '../workflows/rollingCaseEngine';

const BRANCH_TYPE_LABELS = {
  single_choice: 'בחירה יחידה',
  multi_choice: 'בחירה מרובה',
  true_false: 'נכון / לא נכון',
};

function getBranches(rollingCase) {
  return Array.isArray(rollingCase?.branches) ? rollingCase.branches : [];
}

function getTransitions(rollingCase) {
  return Array.isArray(rollingCase?.transitions) ? rollingCase.transitions : [];
}

/** First branch to show: prefer "b1", else the first branch in the list. */
function getStartBranchId(rollingCase) {
  const branches = getBranches(rollingCase);
  if (branches.length === 0) return null;
  const b1 = branches.find((b) => String(b?.id) === 'b1');
  return b1 ? 'b1' : String(branches[0].id);
}

export default function RollingCasePreview({ rollingCase }) {
  const branches = useMemo(() => getBranches(rollingCase), [rollingCase]);
  const transitions = useMemo(() => getTransitions(rollingCase), [rollingCase]);
  const startId = useMemo(() => getStartBranchId(rollingCase), [rollingCase]);

  const [currentId, setCurrentId] = useState(startId);
  const [selectedMulti, setSelectedMulti] = useState([]);
  const [answer, setAnswer] = useState(null); // the value(s) the user committed
  const [stepIndex, setStepIndex] = useState(1);

  const currentBranch = useMemo(
    () => branches.find((b) => String(b?.id) === String(currentId)) || null,
    [branches, currentId],
  );

  const outgoing = useMemo(
    () => transitions.filter((t) => String(t?.from_branch_id) === String(currentId)),
    [transitions, currentId],
  );

  const isLeaf = outgoing.length === 0;
  const answered = answer !== null;

  const score = answered && currentBranch ? scoreBranchAnswer(currentBranch, answer) : 0;
  const isCorrect = score >= 0.999;

  const nextBranchId = useMemo(() => {
    if (!answered || !currentBranch) return null;
    const matches = resolveNextBranch(rollingCase, currentId, answer, score);
    return matches.length > 0 ? matches[0] : null;
  }, [answered, currentBranch, rollingCase, currentId, answer, score]);

  const reset = useCallback(() => {
    setCurrentId(startId);
    setSelectedMulti([]);
    setAnswer(null);
    setStepIndex(1);
  }, [startId]);

  const commitAnswer = useCallback((value) => {
    setAnswer(value);
  }, []);

  const toggleMulti = useCallback((value) => {
    setSelectedMulti((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const goNext = useCallback(() => {
    if (nextBranchId == null) return;
    setCurrentId(String(nextBranchId));
    setSelectedMulti([]);
    setAnswer(null);
    setStepIndex((i) => i + 1);
  }, [nextBranchId]);

  if (!rollingCase || branches.length === 0) {
    return (
      <div style={styles.empty} dir="rtl">
        אין מבנה תקין לשאלה מתגלגלת להצגה.
      </div>
    );
  }

  if (!currentBranch) {
    return (
      <div style={styles.empty} dir="rtl">
        לא נמצא הענף המבוקש ({String(currentId)}). 
        <button type="button" onClick={reset} style={styles.resetBtn}>אתחל מקרה מחדש</button>
      </div>
    );
  }

  const branchType = currentBranch.question_type;

  return (
    <div style={styles.wrap} dir="rtl">
      <div style={styles.header}>
        <span style={styles.stepBadge}>שלב {stepIndex}</span>
        <span style={styles.branchId}>ענף: {String(currentBranch.id)}</span>
        <span style={styles.typeBadge}>{BRANCH_TYPE_LABELS[branchType] || branchType}</span>
      </div>

      <div style={styles.stem}>{currentBranch.question_text || '—'}</div>

      {/* Options */}
      {branchType === 'true_false' && (
        <div style={styles.optionsCol}>
          {[
            { value: 'true', label: 'נכון' },
            { value: 'false', label: 'לא נכון' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => commitAnswer(opt.value)}
              disabled={answered}
              style={optionStyle(answered, answer === opt.value, currentBranch, opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {branchType === 'single_choice' && (
        <div style={styles.optionsCol}>
          {(currentBranch.options || []).map((opt, idx) => {
            const value = String(opt?.value ?? idx);
            return (
              <button
                key={value}
                type="button"
                onClick={() => commitAnswer(value)}
                disabled={answered}
                style={optionStyle(answered, answer === value, currentBranch, value)}
              >
                {opt?.label ?? opt?.text ?? value}
              </button>
            );
          })}
        </div>
      )}

      {branchType === 'multi_choice' && (
        <div style={styles.optionsCol}>
          {(currentBranch.options || []).map((opt, idx) => {
            const value = String(opt?.value ?? idx);
            const selected = selectedMulti.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => !answered && toggleMulti(value)}
                disabled={answered}
                style={optionStyle(answered, selected, currentBranch, value, true)}
              >
                <span style={styles.checkbox}>{selected ? '✓' : ''}</span>
                {opt?.label ?? opt?.text ?? value}
              </button>
            );
          })}
          {!answered && (
            <button
              type="button"
              onClick={() => commitAnswer([...selectedMulti])}
              disabled={selectedMulti.length === 0}
              style={{ ...styles.primaryBtn, opacity: selectedMulti.length === 0 ? 0.5 : 1 }}
            >
              אישור תשובה
            </button>
          )}
        </div>
      )}

      {/* Feedback after answering */}
      {answered && (
        <div style={{ ...styles.feedback, ...(isCorrect ? styles.feedbackOk : styles.feedbackBad) }}>
          <strong>{isCorrect ? 'תשובה נכונה ✓' : 'תשובה שגויה ✗'}</strong>
          {branchType === 'multi_choice' && (
            <span style={styles.partialNote}> (ניקוד חלקי: {Math.round(score * 100)}%)</span>
          )}
          {currentBranch.explanation && (
            <div style={styles.explanation}>{currentBranch.explanation}</div>
          )}
        </div>
      )}

      {/* Flow controls */}
      {answered && (
        <div style={styles.controls}>
          {isLeaf ? (
            <div style={styles.endNotice}>
              הגעת לסוף זרימת המקרה — אין מעברים נוספים מענף זה. 🏁
            </div>
          ) : nextBranchId != null ? (
            <button type="button" onClick={goNext} style={styles.primaryBtn}>
              המשך לשלב הבא ←
            </button>
          ) : (
            <div style={styles.endNotice}>
              אין מעבר מוגדר התואם לתשובה זו — בדוק את הגדרת המעברים של הענף.
            </div>
          )}
          <button type="button" onClick={reset} style={styles.resetBtn}>
            אתחל מקרה מחדש
          </button>
        </div>
      )}

      {!answered && (
        <div style={styles.controls}>
          <button type="button" onClick={reset} style={styles.resetBtn}>
            אתחל מקרה מחדש
          </button>
        </div>
      )}
    </div>
  );
}

/** Highlight the chosen option, and after answering color it by correctness. */
function optionStyle(answered, isSelected, branch, value, isMulti = false) {
  const base = { ...styles.optionBtn };
  if (!answered) {
    if (isSelected) {
      base.borderColor = 'var(--mda-red, #CC0000)';
      base.background = 'var(--mda-red-bg, #FFF5F5)';
    }
    return base;
  }
  // After answering: mark the correct answer(s) green, a wrong pick red.
  const correctValues = isMulti
    ? (branch?.correct_answer?.values || []).map(String)
    : [String(branch?.correct_answer?.value ?? branch?.correct_answer ?? '')];
  const isCorrectOption = correctValues.includes(String(value));
  if (isCorrectOption) {
    base.borderColor = 'var(--color-success, #2E7D32)';
    base.background = 'var(--color-success-bg, #E8F5E9)';
    base.color = 'var(--color-success, #2E7D32)';
  } else if (isSelected) {
    base.borderColor = 'var(--color-danger, #C62828)';
    base.background = 'var(--color-danger-bg, #FFEBEE)';
    base.color = 'var(--color-danger, #C62828)';
  } else {
    base.opacity = 0.7;
  }
  base.cursor = 'default';
  return base;
}

const styles = {
  wrap: {
    border: '1px solid var(--color-border, #E0E0E0)',
    borderRadius: 'var(--radius-lg, 12px)',
    background: 'var(--color-bg-card, #FFFFFF)',
    color: 'var(--color-text, #1A1A1A)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  stepBadge: {
    background: 'var(--mda-red, #CC0000)',
    color: 'var(--color-text-white, #FFFFFF)',
    borderRadius: 'var(--radius-full, 999px)',
    padding: '2px 12px',
    fontSize: '13px',
    fontWeight: 700,
  },
  branchId: {
    fontSize: '12px',
    color: 'var(--color-text-muted, #767676)',
  },
  typeBadge: {
    marginInlineStart: 'auto',
    fontSize: '12px',
    color: 'var(--color-text-2, #4A4A4A)',
    border: '1px solid var(--color-border, #E0E0E0)',
    borderRadius: 'var(--radius-sm, 4px)',
    padding: '2px 8px',
  },
  stem: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: 1.6,
    color: 'var(--color-text, #1A1A1A)',
    whiteSpace: 'pre-wrap',
  },
  optionsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optionBtn: {
    textAlign: 'right',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md, 8px)',
    border: '1.5px solid var(--color-border, #E0E0E0)',
    background: 'var(--color-bg-card, #FFFFFF)',
    color: 'var(--color-text, #1A1A1A)',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'var(--transition, 0.18s ease)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  checkbox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1.5px solid var(--color-border-mid, #CCCCCC)',
    fontSize: '13px',
    fontWeight: 700,
    flexShrink: 0,
  },
  primaryBtn: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-md, 8px)',
    border: 'none',
    background: 'var(--mda-red, #CC0000)',
    color: 'var(--color-text-white, #FFFFFF)',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  resetBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-md, 8px)',
    border: '1.5px solid var(--color-border-mid, #CCCCCC)',
    background: 'transparent',
    color: 'var(--color-text-2, #4A4A4A)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  feedback: {
    borderRadius: 'var(--radius-md, 8px)',
    padding: '10px 14px',
    fontSize: '14px',
  },
  feedbackOk: {
    background: 'var(--color-success-bg, #E8F5E9)',
    color: 'var(--color-success, #2E7D32)',
  },
  feedbackBad: {
    background: 'var(--color-danger-bg, #FFEBEE)',
    color: 'var(--color-danger, #C62828)',
  },
  partialNote: {
    fontWeight: 400,
  },
  explanation: {
    marginTop: '6px',
    fontSize: '13px',
    color: 'var(--color-text-2, #4A4A4A)',
    lineHeight: 1.5,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  endNotice: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-info, #1565C0)',
    background: 'var(--color-info-bg, #E3F2FD)',
    borderRadius: 'var(--radius-md, 8px)',
    padding: '10px 14px',
    flex: 1,
  },
  empty: {
    padding: '16px',
    color: 'var(--color-text-muted, #767676)',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
};
