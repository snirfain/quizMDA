/**
 * Leaderboard Component
 * Displays top users by points
 * Hebrew: טבלת לידרים
 */

import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../workflows/gamification';

export default function Leaderboard({ userId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeframe, setTimeframe] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [timeframe]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await getLeaderboard(timeframe, 50);
      setLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRank = () => {
    const userIndex = leaderboard.findIndex(u => u.userId === userId);
    return userIndex >= 0 ? userIndex + 1 : null;
  };

  if (isLoading) {
    return <div style={styles.loading}>טוען טבלת לידרים...</div>;
  }

  const userRank = getUserRank();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>טבלת לידרים</h2>
        <select
          style={styles.timeframeSelect}
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
        >
          <option value="all">כל הזמנים</option>
          <option value="month">חודש אחרון</option>
          <option value="week">שבוע אחרון</option>
        </select>
      </div>

      {userRank && (
        <div style={styles.userRank}>
          <span>המיקום שלך: #{userRank}</span>
        </div>
      )}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div style={styles.rankCol}>מיקום</div>
          <div style={styles.nameCol}>שם</div>
          <div style={styles.pointsCol}>
            {timeframe === 'all' ? 'נקודות' : 'נקודות השבוע/חודש'}
          </div>
          <div style={styles.streakCol}>רצף</div>
        </div>
        {leaderboard.map((user, index) => (
          <div
            key={user.userId}
            style={{
              ...styles.tableRow,
              ...(user.userId === userId ? styles.userRow : {})
            }}
          >
            <div style={styles.rankCol}>
              {index === 0 && '🥇'}
              {index === 1 && '🥈'}
              {index === 2 && '🥉'}
              {!['🥇', '🥈', '🥉'].includes(index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '') && `#${index + 1}`}
            </div>
            <div style={styles.nameCol}>{user.name}</div>
            <div style={styles.pointsCol}>
              {timeframe === 'all' ? user.totalPoints : user.recentPoints}
            </div>
            <div style={styles.streakCol}>{user.streak} ימים</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    fontSize: '16px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0
  },
  timeframeSelect: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    direction: 'rtl'
  },
  userRank: {
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    marginBottom: '15px',
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#1976d2'
  },
  table: {
    display: 'flex',
    flexDirection: 'column'
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 120px 80px',
    gap: '10px',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '14px',
    marginBottom: '8px'
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 120px 80px',
    gap: '10px',
    padding: '12px',
    borderBottom: '1px solid #eee',
    fontSize: '14px'
  },
  userRow: {
    backgroundColor: '#e3f2fd',
    fontWeight: 'bold'
  },
  rankCol: {
    textAlign: 'center',
    fontSize: '16px'
  },
  nameCol: {
    fontWeight: '500'
  },
  pointsCol: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#CC0000'
  },
  streakCol: {
    textAlign: 'center',
    color: '#666'
  }
};
