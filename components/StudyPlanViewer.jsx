/**
 * Study Plan Viewer Component (Trainee)
 * View and enroll in study plans
 * Hebrew: צפייה בתוכניות לימוד
 */

import React, { useState, useEffect } from 'react';
import { getAvailablePlans, getUserPlans, enrollUser } from '../workflows/studyPlans';
import { getCurrentUser } from '../utils/auth';
import { navigateTo } from '../utils/router';
import StudyPlanCard from './StudyPlanCard';
import LoadingSpinner from './LoadingSpinner';
import { showToast } from './Toast';
export default function StudyPlanViewer() {
  const [availablePlans, setAvailablePlans] = useState([]);
  const [userPlans, setUserPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-plans');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      const [available, enrolled] = await Promise.all([
        getAvailablePlans(),
        getUserPlans(user.user_id)
      ]);
      setAvailablePlans(available);
      setUserPlans(enrolled);
    } catch (error) {
      console.error('Error loading plans:', error);
      showToast('שגיאה בטעינת תוכניות לימוד', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async (planId) => {
    try {
      const user = await getCurrentUser();
      await enrollUser(user.user_id, planId);
      showToast('נרשמת בהצלחה לתוכנית', 'success');
      await loadPlans();
    } catch (error) {
      console.error('Error enrolling:', error);
      showToast('שגיאה בהרשמה לתוכנית', 'error');
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="טוען תוכניות לימוד..." />;
  }

  return (
    <div style={styles.container}>
        <h1 style={styles.title}>תוכניות לימוד</h1>

        <div style={styles.tabs} role="tablist">
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'my-plans' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('my-plans')}
            role="tab"
            aria-selected={activeTab === 'my-plans'}
          >
            התוכניות שלי ({userPlans.length})
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'available' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('available')}
            role="tab"
            aria-selected={activeTab === 'available'}
          >
            תוכניות זמינות ({availablePlans.length})
          </button>
        </div>

        <div style={styles.content}>
          {activeTab === 'my-plans' && (
            <div style={styles.plansGrid}>
              {userPlans.length === 0 ? (
                <div style={styles.empty}>אין תוכניות לימוד פעילות</div>
              ) : (
                userPlans.map((plan) => (
                  <StudyPlanCard
                    key={plan.plan_id}
                    plan={plan}
                    isEnrolled={true}
                    progress={plan.progress}
                    onView={() => navigateTo(`/study-plans/${plan.plan_id}`)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'available' && (
            <div style={styles.plansGrid}>
              {availablePlans.length === 0 ? (
                <div style={styles.empty}>אין תוכניות זמינות</div>
              ) : (
                availablePlans.map((plan) => {
                  const isEnrolled = userPlans.some(p => p.plan_id === plan.plan_id);
                  return (
                    <StudyPlanCard
                      key={plan.plan_id}
                      plan={plan}
                      isEnrolled={isEnrolled}
                      onEnroll={() => handleEnroll(plan.plan_id)}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#212121'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    borderBottom: '2px solid #e0e0e0',
    marginBottom: '30px'
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
    '&:hover': {
      color: '#CC0000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  tabActive: {
    color: '#CC0000',
    borderBottomColor: '#CC0000',
    fontWeight: 'bold'
  },
  content: {
    minHeight: '400px'
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#757575',
    fontSize: '16px'
  }
};
