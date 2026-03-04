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
      <div style={styles.container} className="page-container">
        <div className="card" style={styles.header}>
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
          <div className="card" style={styles.statCard}>
            <div style={styles.statValue}>{user.points || 0}</div>
            <div style={styles.statLabel}>נקודות</div>
          </div>
          <div className="card" style={styles.statCard}>
            <div style={styles.statValue}>{user.current_streak || 0}</div>
            <div style={styles.statLabel}>רצף ימים</div>
          </div>
          {progress && (
            <>
              <div className="card" style={styles.statCard}>
                <div style={styles.statValue}>
                  {progress.overall.successRate.toFixed(1)}%
                </div>
                <div style={styles.statLabel}>אחוז הצלחה</div>
              </div>
              <div className="card" style={styles.statCard}>
                <div style={styles.statValue}>
                  {progress.overall.questionsAnswered}
                </div>
                <div style={styles.statLabel}>שאלות נענו</div>
              </div>
            </>
          )}
        </div>

        <div style={styles.sections}>
          <div className="card" style={styles.section}>
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
    padding: 'var(--space-5)',
  },
  header: {
    display: 'flex',
    gap: 'var(--space-6)',
    alignItems: 'center',
    marginBottom: 'var(--space-10)',
    padding: 'var(--space-6)',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'var(--mda-red)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: 'var(--color-white)',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'bold',
    marginBottom: 'var(--space-2)',
    color: 'var(--color-text)',
  },
  role: {
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-text-muted)',
    marginBottom: 'var(--space-1)',
  },
  userId: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-muted)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 'var(--space-5)',
    marginBottom: 'var(--space-10)',
  },
  statCard: {
    padding: 'var(--space-6)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: 'var(--mda-red)',
    marginBottom: 'var(--space-2)',
  },
  statLabel: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-muted)',
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
  },
  section: {
    padding: 'var(--space-6)',
  },
  sectionTitle: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'bold',
    marginBottom: 'var(--space-5)',
    color: 'var(--color-text)',
  },
};
