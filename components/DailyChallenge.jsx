/**
 * DailyChallenge — today's challenge (2 pts) plus an archive of past challenges
 * (1.5 pts). Each challenge can be solved once; results reveal the explanation.
 * Hebrew: אתגר יומי + ארכיון אתגרים.
 */
import React, { useEffect, useState } from 'react';
import { showToast } from './Toast';
import { SkeletonCard } from './Skeleton';

function ChallengeSolver({ challenge, onSolved }) {
  const [selected, setSelected] = useState(challenge.your_answer ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(
    challenge.solved
      ? {
          is_correct: challenge.is_correct,
          correct_answer: challenge.correct_answer,
          explanation: challenge.explanation,
          points_awarded: challenge.points_awarded,
        }
      : null,
  );

  const submit = async () => {
    if (selected === null || selected === undefined || String(selected) === '') {
      showToast('יש לבחור תשובה', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/challenges/${challenge.challenge_date}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: String(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'שמירת התשובה נכשלה');
      setResult(data);
      if (data.is_correct) {
        showToast(`כל הכבוד! זכית ב-${data.points_awarded} נקודות`, 'success');
      } else {
        showToast('התשובה שגויה — אבל למדת משהו חדש', 'info');
      }
      onSolved?.();
    } catch (e) {
      showToast(e?.message || 'שגיאה בשליחת התשובה', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.solver}>
      {challenge.media_url && (
        <img src={challenge.media_url} alt="תמונת האתגר" style={styles.media} />
      )}
      <p style={styles.question}>{challenge.question_text}</p>

      <div style={styles.options}>
        {(challenge.options || []).map((opt) => {
          const val = String(opt.value);
          const isSelected = String(selected) === val;
          const isCorrect = result && String(result.correct_answer) === val;
          const isWrongPick = result && isSelected && !result.is_correct;
          return (
            <label
              key={val}
              style={{
                ...styles.option,
                ...(isSelected && !result ? styles.optionSelected : {}),
                ...(isCorrect ? styles.optionCorrect : {}),
                ...(isWrongPick ? styles.optionWrong : {}),
              }}
            >
              <input
                type="radio"
                name={`challenge-${challenge.challenge_date}`}
                value={val}
                checked={isSelected}
                disabled={!!result}
                onChange={() => setSelected(val)}
                style={{ marginInlineEnd: 8 }}
              />
              {opt.label}
              {isCorrect && <span style={styles.markOk}> ✓</span>}
            </label>
          );
        })}
      </div>

      {result ? (
        <div style={{ ...styles.resultBox, ...(result.is_correct ? styles.resultOk : styles.resultBad) }}>
          <strong>{result.is_correct ? `תשובה נכונה! +${result.points_awarded} נק׳` : 'תשובה שגויה'}</strong>
          {result.explanation && <p style={styles.explanation}>{result.explanation}</p>}
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting} style={{ marginTop: 'var(--space-3)' }}>
          {submitting ? 'שולח...' : 'שלח תשובה'}
        </button>
      )}
    </div>
  );
}

export default function DailyChallenge({ onPointsChanged }) {
  const [today, setToday] = useState(undefined); // undefined=loading, null=none
  const [archive, setArchive] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    loadToday();
    loadArchive();
  }, []);

  const loadToday = async () => {
    try {
      const res = await fetch('/api/challenges/today', { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      setToday(data);
    } catch (e) {
      setToday(null);
    }
  };

  const loadArchive = async () => {
    try {
      const res = await fetch('/api/challenges/archive', { cache: 'no-store' });
      const data = res.ok ? await res.json() : [];
      setArchive(Array.isArray(data) ? data : []);
    } catch (e) {
      setArchive([]);
    }
  };

  const handleSolved = () => {
    loadToday();
    loadArchive();
    onPointsChanged?.();
  };

  return (
    <div style={styles.wrap} dir="rtl">
      <section>
        <h2 style={styles.heading}>האתגר היומי <span style={styles.pointsBadge}>2 נק׳</span></h2>
        {today === undefined ? (
          <SkeletonCard height={220} />
        ) : today === null ? (
          <div className="card" style={styles.empty}>אין אתגר זמין להיום. בדקו שוב מחר!</div>
        ) : (
          <div className="card card-elevated" style={styles.card}>
            <ChallengeSolver challenge={today} onSolved={handleSolved} />
          </div>
        )}
      </section>

      <section style={{ marginTop: 'var(--space-8)' }}>
        <h2 style={styles.heading}>ארכיון אתגרים <span style={{ ...styles.pointsBadge, background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>1.5 נק׳</span></h2>
        {archive === null ? (
          <SkeletonCard height={160} />
        ) : archive.length === 0 ? (
          <div className="card" style={styles.empty}>אין אתגרים קודמים בארכיון.</div>
        ) : (
          <div style={styles.archiveList}>
            {archive.map((ch) => {
              const isOpen = openId === ch.id;
              return (
                <div key={ch.id} className="card" style={styles.archiveItem}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : ch.id)}
                    style={styles.archiveHead}
                    aria-expanded={isOpen}
                  >
                    <span style={styles.archiveDate}>{ch.challenge_date}</span>
                    <span style={styles.archiveTitle}>{ch.question_text}</span>
                    {ch.solved ? (
                      <span style={{ ...styles.archiveStatus, color: ch.is_correct ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {ch.is_correct ? 'נפתר ✓' : 'נפתר ✗'}
                      </span>
                    ) : (
                      <span style={{ ...styles.archiveStatus, color: 'var(--color-text-muted)' }}>לפתרון</span>
                    )}
                    <span aria-hidden="true" style={styles.chev}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div style={styles.archiveBody}>
                      <ChallengeSolver challenge={ch} onSolved={handleSolved} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  wrap: { direction: 'rtl', maxWidth: 760, margin: '0 auto' },
  heading: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text)' },
  pointsBadge: { fontSize: 'var(--font-size-sm)', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  empty: { padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' },
  card: { padding: 'var(--space-6)' },
  solver: { display: 'flex', flexDirection: 'column' },
  media: { maxWidth: '100%', maxHeight: 280, borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', alignSelf: 'center' },
  question: { margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 },
  options: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  option: {
    display: 'flex', alignItems: 'center', padding: 'var(--space-3)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--color-bg-card)', color: 'var(--color-text)',
  },
  optionSelected: { borderColor: 'var(--color-primary)', background: 'var(--color-primary-bg)' },
  optionCorrect: { borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' },
  optionWrong: { borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' },
  markOk: { color: 'var(--color-success)', fontWeight: 800, marginInlineStart: 'auto' },
  resultBox: { marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' },
  resultOk: { background: 'var(--color-success-bg)', color: 'var(--color-text)' },
  resultBad: { background: 'var(--color-danger-bg)', color: 'var(--color-text)' },
  explanation: { margin: 'var(--space-2) 0 0', lineHeight: 1.6 },
  archiveList: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  archiveItem: { padding: 0, overflow: 'hidden' },
  archiveHead: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', padding: 'var(--space-3) var(--space-4)',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--color-text)',
  },
  archiveDate: { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  archiveTitle: { flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  archiveStatus: { fontSize: 'var(--font-size-sm)', fontWeight: 700, flexShrink: 0 },
  chev: { color: 'var(--color-text-muted)', fontSize: 12, flexShrink: 0 },
  archiveBody: { padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' },
};
