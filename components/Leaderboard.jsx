/**
 * Leaderboard — national, per-user ranking by personal points.
 * Top 3 receive gold/silver/bronze medals. Responsive + RTL + dark/light.
 * Hebrew: טבלת מובילים ארצית — תחרות אישית.
 */
import React, { useEffect, useState } from 'react';
import { SkeletonCard } from './Skeleton';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const MEDAL_COLORS = {
  1: { bg: 'linear-gradient(135deg, #FFF4CC 0%, #FFE08A 100%)', border: '#E6B800', text: '#7A5C00' },
  2: { bg: 'linear-gradient(135deg, #F2F4F7 0%, #D9DEE6 100%)', border: '#AEB6C2', text: '#4A4A4A' },
  3: { bg: 'linear-gradient(135deg, #FBE6D4 0%, #EBC09A 100%)', border: '#C98A52', text: '#7A4A1E' },
};

export default function Leaderboard({ currentUserId = null }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/leaderboard', { cache: 'no-store' });
        if (!res.ok) throw new Error('שגיאת שרת');
        const data = await res.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) {
          setError('טעינת טבלת המובילים נכשלה');
          setRows([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (rows === null) {
    return (
      <div style={styles.wrap}>
        <SkeletonCard height={320} />
      </div>
    );
  }

  return (
    <div style={styles.wrap} dir="rtl">
      <div style={styles.header}>
        <h2 style={styles.title}>טבלת מובילים ארצית</h2>
        <p style={styles.subtitle}>תחרות אישית — כל המשתמשים במערכת, מדורגים לפי נקודות</p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {rows.length === 0 ? (
        <div style={styles.empty}>אין עדיין נתונים להצגה. צברו נקודות כדי להופיע בטבלה!</div>
      ) : (
        <>
          {/* Podium for the top 3 */}
          <div style={styles.podium}>
            {rows.slice(0, 3).map((r) => {
              const c = MEDAL_COLORS[r.rank];
              const isMe = currentUserId && r.user_id === currentUserId;
              return (
                <div
                  key={r.user_id || r.rank}
                  style={{
                    ...styles.podiumCard,
                    background: c.bg,
                    border: `2px solid ${c.border}`,
                    ...(r.rank === 1 ? styles.podiumFirst : {}),
                    ...(isMe ? styles.meOutline : {}),
                  }}
                >
                  <div style={styles.medal} aria-hidden="true">{MEDALS[r.rank]}</div>
                  <div style={{ ...styles.podiumName, color: c.text }}>
                    {r.full_name}{isMe ? ' (אתה)' : ''}
                  </div>
                  <div style={{ ...styles.podiumPoints, color: c.text }}>{r.points} נק׳</div>
                  <div style={styles.podiumStreak}>🔥 {r.current_streak} ימים</div>
                </div>
              );
            })}
          </div>

          {/* The rest of the list */}
          <ol style={styles.list}>
            {rows.slice(3).map((r) => {
              const isMe = currentUserId && r.user_id === currentUserId;
              return (
                <li
                  key={r.user_id || r.rank}
                  style={{ ...styles.row, ...(isMe ? styles.rowMe : {}) }}
                >
                  <span style={styles.rank}>{r.rank}</span>
                  <span style={styles.name}>
                    {r.full_name}{isMe ? ' (אתה)' : ''}
                  </span>
                  <span style={styles.streak}>🔥 {r.current_streak}</span>
                  <span style={styles.points}>{r.points} נק׳</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: { direction: 'rtl', maxWidth: 760, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 'var(--space-5)' },
  title: { margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text)' },
  subtitle: { margin: 'var(--space-2) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)' },
  error: {
    background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
    padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', textAlign: 'center',
  },
  empty: {
    textAlign: 'center', padding: 'var(--space-10) var(--space-4)',
    color: 'var(--color-text-muted)', fontSize: 'var(--font-size-lg)',
  },
  podium: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 'var(--space-3)', marginBottom: 'var(--space-5)', alignItems: 'stretch',
  },
  podiumCard: {
    borderRadius: 'var(--radius-lg)', padding: 'var(--space-5) var(--space-3)',
    textAlign: 'center', boxShadow: 'var(--shadow-md)',
    display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center',
  },
  podiumFirst: { transform: 'scale(1.03)' },
  meOutline: { outline: '3px solid var(--color-primary)', outlineOffset: 2 },
  medal: { fontSize: 40, lineHeight: 1 },
  podiumName: { fontWeight: 800, fontSize: 'var(--font-size-lg)' },
  podiumPoints: { fontWeight: 700, fontSize: 'var(--font-size-base)' },
  podiumStreak: { color: 'var(--color-text-2)', fontSize: 'var(--font-size-sm)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    padding: '10px var(--space-4)', background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
  },
  rowMe: { borderColor: 'var(--color-primary)', background: 'var(--color-primary-bg)' },
  rank: {
    width: 30, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-full)',
    fontWeight: 700, color: 'var(--color-text-2)', fontSize: 'var(--font-size-sm)',
  },
  name: { flex: 1, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  streak: { color: 'var(--color-text-2)', fontSize: 'var(--font-size-sm)' },
  points: { fontWeight: 800, color: 'var(--color-primary)', minWidth: 64, textAlign: 'left' },
};
