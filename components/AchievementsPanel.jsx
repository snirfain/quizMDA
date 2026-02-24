/**
 * Achievements Panel Component
 * Displays user achievements and badges
 * Hebrew: פאנל הישגים
 */

import React, { useState, useEffect } from 'react';
import { getUserBadges, getAchievementLabel } from '../workflows/gamification';

export default function AchievementsPanel({ userId }) {
  const [badges, setBadges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    setIsLoading(true);
    try {
      const userBadges = await getUserBadges(userId);
      setBadges(userBadges);
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>טוען הישגים...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>ההישגים שלי</h2>
      
      {badges.length === 0 ? (
        <div style={styles.empty}>
          <p>עדיין אין לך הישגים. המשך לתרגל כדי לזכות בהישגים!</p>
        </div>
      ) : (
        <div style={styles.badgesGrid}>
          {badges.map((badge, index) => (
            <div key={index} style={styles.badgeCard}>
              <div style={styles.badgeIcon}>
                {getBadgeEmoji(badge.type)}
              </div>
              <div style={styles.badgeInfo}>
                <div style={styles.badgeName}>
                  {getAchievementLabel(badge.type)}
                </div>
                <div style={styles.badgeDate}>
                  {new Date(badge.earnedDate).toLocaleDateString('he-IL')}
                </div>
                {badge.points > 0 && (
                  <div style={styles.badgePoints}>
                    +{badge.points} נקודות
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getBadgeEmoji(type) {
  const emojis = {
    streak_10: '🔥',
    streak_30: '💪',
    questions_100: '⭐',
    questions_500: '🌟',
    questions_1000: '👑',
    expert_topic: '🎓',
    fast_answer: '⚡',
    perfect_session: '💯',
    first_attempt: '🎯'
  };
  return emojis[type] || '🏆';
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
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#666'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333'
  },
  badgesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '15px'
  },
  badgeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '2px solid #e0e0e0',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  badgeIcon: {
    fontSize: '48px',
    marginBottom: '10px'
  },
  badgeInfo: {
    textAlign: 'center'
  },
  badgeName: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '5px',
    color: '#333'
  },
  badgeDate: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '5px'
  },
  badgePoints: {
    fontSize: '12px',
    color: '#4CAF50',
    fontWeight: 'bold'
  }
};
