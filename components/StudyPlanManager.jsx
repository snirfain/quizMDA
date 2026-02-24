/**
 * Study Plan Manager Component (Instructor)
 * Create and manage study plans
 * Hebrew: ניהול תוכניות לימוד
 */

import React, { useState, useEffect } from 'react';
import { createStudyPlan, getAvailablePlans } from '../workflows/studyPlans';
import { entities } from '../config/appConfig';
import { getCurrentUser } from '../utils/auth';
import StudyPlanCard from './StudyPlanCard';
import FormField from './FormField';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { showToast } from './Toast';

export default function StudyPlanManager() {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categories: [],
    topics: [],
    daily_goal: 10
  });
  const [hierarchies, setHierarchies] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);

  useEffect(() => {
    loadPlans();
    loadHierarchies();
  }, []);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const allPlans = await getAvailablePlans();
      setPlans(allPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
      showToast('שגיאה בטעינת תוכניות', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHierarchies = async () => {
    try {
      const allHierarchies = await entities.Content_Hierarchy.find({});
      setHierarchies(allHierarchies);
      
      // Extract unique categories and topics
      const categories = [...new Set(allHierarchies.map(h => h.category_name))];
      const topics = [...new Set(allHierarchies.map(h => h.topic_name))];
      
      setSelectedCategories(categories);
      setSelectedTopics(topics);
    } catch (error) {
      console.error('Error loading hierarchies:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const user = await getCurrentUser();
      
      await createStudyPlan(user.user_id, {
        ...formData,
        categories: selectedCategories,
        topics: selectedTopics
      });

      showToast('תוכנית נוצרה בהצלחה', 'success');
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        categories: [],
        topics: [],
        daily_goal: 10
      });
      await loadPlans();
    } catch (error) {
      console.error('Error creating plan:', error);
      showToast('שגיאה ביצירת תוכנית', 'error');
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="טוען תוכניות..." />;
  }

  return (
    <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>ניהול תוכניות לימוד</h1>
          <button
            style={styles.createButton}
            onClick={() => setShowCreateModal(true)}
            aria-label="צור תוכנית חדשה"
          >
            + תוכנית חדשה
          </button>
        </div>

        <div style={styles.plansGrid}>
          {plans.length === 0 ? (
            <div style={styles.empty}>אין תוכניות לימוד</div>
          ) : (
            plans.map((plan) => (
              <StudyPlanCard
                key={plan.plan_id}
                plan={plan}
                isEnrolled={false}
              />
            ))
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <Modal
            isOpen={true}
            onClose={() => setShowCreateModal(false)}
            title="יצירת תוכנית לימוד חדשה"
            size="lg"
          >
            <div style={styles.form}>
              <FormField
                label="כותרת"
                name="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <FormField
                label="תיאור"
                name="description"
                type="textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />

              <FormField
                label="יעד יומי (מספר שאלות)"
                name="daily_goal"
                type="number"
                value={formData.daily_goal}
                onChange={(e) => setFormData({ ...formData, daily_goal: parseInt(e.target.value) })}
                min={1}
                required
              />

              <div style={styles.actions}>
                <button
                  style={styles.cancelButton}
                  onClick={() => setShowCreateModal(false)}
                >
                  ביטול
                </button>
                <button
                  style={styles.saveButton}
                  onClick={handleCreate}
                  disabled={!formData.title}
                >
                  צור תוכנית
                </button>
              </div>
            </div>
          </Modal>
        )}
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
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#757575',
    fontSize: '16px',
    gridColumn: '1 / -1'
  },
  form: {
    direction: 'rtl',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#FFFFFF',
    color: '#212121',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    }
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    '&:hover:not(:disabled)': {
      backgroundColor: '#A50000'
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed'
    }
  }
};
