/**
 * Profile Page
 * User profile display and edit
 * Hebrew: עמוד פרופיל
 */

import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../utils/auth';
import { getUserProgress } from '../workflows/userProgress';
import { getUserBadges } from '../workflows/gamification';
import AchievementsPanel from '../components/AchievementsPanel';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [badges, setBadges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      if (currentUser) {
        const [progressData, userBadges] = await Promise.all([
          getUserProgress(currentUser.user_id),
          getUserBadges(currentUser.user_id)
        ]);
        setProgress(progressData);
        setBadges(userBadges);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="טוען פרופיל..." />;
  }

  if (!user) {
    return <div>יש להתחבר</div>;
  }

  return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.avatar}>
            <span style={styles.avatarText}>
              {user.full_name.charAt(0)}
            </span>
          </div>
          <div style={styles.info}>
            <h1 style={styles.name}>{user.full_name}</h1>
            <p style={styles.role}>
              {user.role === 'trainee' ? 'מתאמן' : 
               user.role === 'instructor' ? 'מדריך' : 'מנהל'}
            </p>
            <p style={styles.userId}>תעודת זהות: {user.user_id}</p>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{user.points || 0}</div>
            <div style={styles.statLabel}>נקודות</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{user.current_streak || 0}</div>
            <div style={styles.statLabel}>רצף ימים</div>
          </div>
          {progress && (
            <>
              <div style={styles.statCard}>
                <div style={styles.statValue}>
                  {progress.overall.successRate.toFixed(1)}%
                </div>
                <div style={styles.statLabel}>אחוז הצלחה</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>
                  {progress.overall.questionsAnswered}
                </div>
                <div style={styles.statLabel}>שאלות נענו</div>
              </div>
            </>
          )}
        </div>

        <div style={styles.sections}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>הישגים</h2>
            <AchievementsPanel userId={user.user_id} />
          </div>
        </div>
      </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px'
  },
  header: {
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
    marginBottom: '40px',
    padding: '30px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#CC0000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  avatarText: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#212121'
  },
  role: {
    fontSize: '16px',
    color: '#757575',
    marginBottom: '4px'
  },
  userId: {
    fontSize: '14px',
    color: '#9E9E9E'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '40px'
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
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121'
  }
};
