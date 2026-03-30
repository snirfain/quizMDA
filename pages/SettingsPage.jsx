/**
 * Settings Page
 * User settings and preferences
 * Hebrew: עמוד הגדרות
 */

import React, { useState, useEffect } from 'react';
import { getCurrentUser, setCurrentUser } from '../utils/auth';
import { entities } from '../config/appConfig';
import FormField from '../components/FormField';
import PermissionGate from '../components/PermissionGate';
import { permissions, isRoleAtLeast, ROLE_LABELS } from '../utils/permissions';
import { showToast } from '../components/Toast';
import { 
  getAccessibilitySettings, 
  setAccessibilitySettings,
  applyAccessibilitySettings 
} from '../utils/accessibility';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  };

  if (isLoading) {
    return <div>טוען...</div>;
  }

  if (!user) {
    return <div>יש להתחבר</div>;
  }

  return (
      <div style={styles.container}>
        <h1 style={styles.title}>הגדרות</h1>

        <div className="tabs" style={styles.tabsWrap} role="tablist" aria-label="קטגוריות הגדרות">
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            role="tab"
            aria-selected={activeTab === 'profile'}
            aria-controls="profile-panel"
            id="profile-tab"
          >
            פרופיל
          </button>
          <button
            className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
            role="tab"
            aria-selected={activeTab === 'notifications'}
            aria-controls="notifications-panel"
            id="notifications-tab"
          >
            התראות
          </button>
          <button
            className={`tab-btn ${activeTab === 'accessibility' ? 'active' : ''}`}
            onClick={() => setActiveTab('accessibility')}
            role="tab"
            aria-selected={activeTab === 'accessibility'}
            aria-controls="accessibility-panel"
            id="accessibility-tab"
          >
            נגישות
          </button>
          {isRoleAtLeast(user?.role, 'instructor') && (
            <button
              className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
              role="tab"
              aria-selected={activeTab === 'courses'}
              aria-controls="courses-panel"
              id="courses-tab"
            >
              קורסים
            </button>
          )}
          <PermissionGate permission={permissions.SYSTEM_SETTINGS}>
            <button
              className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => setActiveTab('system')}
              role="tab"
              aria-selected={activeTab === 'system'}
              aria-controls="system-panel"
              id="system-tab"
            >
              הגדרות מערכת
            </button>
          </PermissionGate>
        </div>

        <div style={styles.content}>
          {activeTab === 'profile' && (
            <div
              id="profile-panel"
              role="tabpanel"
              aria-labelledby="profile-tab"
              style={styles.panel}
            >
              <ProfileSettings user={user} />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div
              id="notifications-panel"
              role="tabpanel"
              aria-labelledby="notifications-tab"
              style={styles.panel}
            >
              <NotificationSettings user={user} />
            </div>
          )}

          {activeTab === 'accessibility' && (
            <div
              id="accessibility-panel"
              role="tabpanel"
              aria-labelledby="accessibility-tab"
              style={styles.panel}
            >
              <AccessibilitySettings user={user} />
            </div>
          )}

          {activeTab === 'courses' && isRoleAtLeast(user?.role, 'instructor') && (
            <div
              id="courses-panel"
              role="tabpanel"
              aria-labelledby="courses-tab"
              style={styles.panel}
            >
              <InstructorCourseSettings user={user} onUserUpdate={(u) => { setUser(u); setCurrentUser(u); }} />
            </div>
          )}

          {activeTab === 'system' && (
            <PermissionGate permission={permissions.SYSTEM_SETTINGS}>
              <div
                id="system-panel"
                role="tabpanel"
                aria-labelledby="system-tab"
                style={styles.panel}
              >
                <SystemSettings user={user} />
              </div>
            </PermissionGate>
          )}
        </div>
      </div>
  );
}

function ProfileSettings({ user }) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUserState] = useState(user);
  
  // Update local state when user prop changes
  useEffect(() => {
    setFullName(user.full_name || '');
    setCurrentUserState(user);
  }, [user.full_name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      showToast('אנא הזן שם מלא', 'error');
      return;
    }

    if (fullName === currentUser.full_name) {
      showToast('לא בוצעו שינויים', 'info');
      return;
    }

    setIsSaving(true);
    try {
      // Update user in database
      let updatedUser;
      if (entities.Users && typeof entities.Users.update === 'function') {
        updatedUser = await entities.Users.update(user.user_id, {
          full_name: fullName.trim()
        });
      } else if (typeof window !== 'undefined' && window.mockEntities && window.mockEntities.Users) {
        updatedUser = await window.mockEntities.Users.update(user.user_id, {
          full_name: fullName.trim()
        });
      }
      
      // Fallback if update didn't return user
      if (!updatedUser) {
        updatedUser = { ...currentUser, full_name: fullName.trim() };
      }

      // Update localStorage FIRST - this ensures getCurrentUser returns updated value
      setCurrentUser(updatedUser);
      
      // Update local state
      setCurrentUserState(updatedUser);

      // Notify App.jsx to update state
      window.dispatchEvent(new CustomEvent('userUpdated', { 
        detail: updatedUser
      }));

      showToast('הפרופיל עודכן בהצלחה', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('שגיאה בעדכון הפרופיל', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>הגדרות פרופיל</h2>
      <form style={styles.form} onSubmit={handleSubmit} noValidate>
        <FormField
          label="שם מלא"
          name="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={isSaving}
        />
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </form>
    </div>
  );
}

function NotificationSettings({ user }) {
  const [dailyReminder, setDailyReminder] = useState(true);
  const [achievementNotifications, setAchievementNotifications] = useState(true);

  return (
    <div>
      <h2 style={styles.sectionTitle}>הגדרות התראות</h2>
      <div style={styles.form}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={dailyReminder}
            onChange={(e) => setDailyReminder(e.target.checked)}
            style={styles.checkbox}
            aria-label="תזכורת יומית"
          />
          <span>תזכורת יומית לתרגול</span>
        </label>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={achievementNotifications}
            onChange={(e) => setAchievementNotifications(e.target.checked)}
            style={styles.checkbox}
            aria-label="התראות הישגים"
          />
          <span>התראות על הישגים חדשים</span>
        </label>
        <button type="button" className="btn btn-primary">
          שמור שינויים
        </button>
      </div>
    </div>
  );
}

function AccessibilitySettings({ user }) {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load saved settings
    const settings = getAccessibilitySettings();
    setHighContrast(settings.highContrast || false);
    setLargeText(settings.largeText || false);
    setReduceMotion(settings.reduceMotion || false);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings = {
        highContrast,
        largeText,
        reduceMotion
      };
      
      setAccessibilitySettings(settings);
      showToast('הגדרות הנגישות נשמרו בהצלחה', 'success');
    } catch (error) {
      console.error('Error saving accessibility settings:', error);
      showToast('שגיאה בשמירת הגדרות נגישות', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (setting, value) => {
    if (setting === 'highContrast') {
      setHighContrast(value);
    } else if (setting === 'largeText') {
      setLargeText(value);
    } else if (setting === 'reduceMotion') {
      setReduceMotion(value);
    }
    
    // Apply immediately for better UX
    const settings = {
      highContrast: setting === 'highContrast' ? value : highContrast,
      largeText: setting === 'largeText' ? value : largeText,
      reduceMotion: setting === 'reduceMotion' ? value : reduceMotion
    };
    applyAccessibilitySettings(settings);
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>הגדרות נגישות</h2>
      <div style={styles.form}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(e) => handleToggle('highContrast', e.target.checked)}
            style={styles.checkbox}
            aria-label="ניגודיות גבוהה"
          />
          <span>ניגודיות גבוהה</span>
        </label>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={largeText}
            onChange={(e) => handleToggle('largeText', e.target.checked)}
            style={styles.checkbox}
            aria-label="טקסט גדול"
          />
          <span>טקסט גדול</span>
        </label>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => handleToggle('reduceMotion', e.target.checked)}
            style={styles.checkbox}
            aria-label="הפחתת תנועה"
          />
          <span>הפחתת תנועה ואנימציות</span>
        </label>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );
}

function SystemSettings({ user }) {
  return (
    <div>
      <h2 style={styles.sectionTitle}>הגדרות מערכת</h2>
      <p>הגדרות מערכת למנהלים בלבד</p>
    </div>
  );
}

const styles = {
  container: {
    direction: 'rtl',
    maxWidth: '900px',
    margin: '0 auto',
    padding: 'var(--space-6)',
  },
  title: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'bold',
    marginBottom: 'var(--space-6)',
    color: 'var(--color-text)',
  },
  tabsWrap: {
    marginBottom: 'var(--space-6)',
  },
  content: {
    minHeight: '400px'
  },
  panel: {
    padding: '20px 0'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#212121'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '600px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '12px',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    }
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
};

/**
 * Instructor Course Settings — manage instructor_courses list and view trainees per course.
 */
function InstructorCourseSettings({ user, onUserUpdate }) {
  const [courses, setCourses] = useState(user?.instructor_courses || []);
  const [newCourse, setNewCourse] = useState('');
  const [saving, setSaving] = useState(false);
  const [trainees, setTrainees] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loadingTrainees, setLoadingTrainees] = useState(false);

  const handleAddCourse = () => {
    const val = newCourse.trim();
    if (!val) return;
    if (courses.includes(val)) { showToast('קורס כבר קיים', 'info'); return; }
    setCourses([...courses, val]);
    setNewCourse('');
  };

  const handleRemoveCourse = (c) => {
    setCourses(courses.filter(x => x !== c));
    if (selectedCourse === c) { setSelectedCourse(null); setTrainees([]); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.user_id}/courses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה');
      const updated = { ...user, instructor_courses: courses };
      onUserUpdate(updated);
      showToast('קורסים נשמרו בהצלחה', 'success');
    } catch (err) {
      showToast('שגיאה: ' + (err?.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadTrainees = async (courseNum) => {
    setSelectedCourse(courseNum);
    setLoadingTrainees(true);
    try {
      const res = await fetch(`/api/users/by-course/${encodeURIComponent(courseNum)}`);
      const data = await res.json();
      setTrainees(Array.isArray(data) ? data : []);
    } catch (_) {
      setTrainees([]);
    } finally {
      setLoadingTrainees(false);
    }
  };

  const roleLabel = ROLE_LABELS[user?.role] || user?.role;

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>ניהול קורסים</h2>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
        דרגה: <strong style={{ color: '#1565c0' }}>{roleLabel}</strong>
      </p>
      {user?.course_number && (
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
          מספר קורס אישי: <strong>{user.course_number}</strong>
        </p>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
          קורסים שאני מדריך:
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            value={newCourse}
            onChange={(e) => setNewCourse(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCourse())}
            placeholder="מספר קורס חדש"
            style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', direction: 'ltr' }}
          />
          <button onClick={handleAddCourse} style={{ padding: '10px 20px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            הוסף
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {courses.map((c) => (
            <div key={c} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', background: selectedCourse === c ? '#e3f2fd' : '#f5f5f5',
              borderRadius: '20px', fontSize: '14px', cursor: 'pointer',
              border: selectedCourse === c ? '2px solid #1565c0' : '1px solid #e0e0e0',
            }}>
              <span onClick={() => loadTrainees(c)} style={{ cursor: 'pointer', fontWeight: 600 }}>{c}</span>
              <button onClick={() => handleRemoveCourse(c)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '16px', padding: 0 }}>
                ✕
              </button>
            </div>
          ))}
          {courses.length === 0 && <span style={{ color: '#999', fontSize: '14px' }}>לא הוגדרו קורסים</span>}
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '10px 28px', background: '#e53935', color: '#fff', border: 'none',
          borderRadius: '8px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: '14px',
        }}>
          {saving ? 'שומר...' : 'שמור קורסים'}
        </button>
      </div>

      {selectedCourse && (
        <div style={{ marginTop: '24px', padding: '16px', background: '#fafafa', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            חניכים בקורס {selectedCourse}
          </h3>
          {loadingTrainees ? (
            <p style={{ color: '#999' }}>טוען...</p>
          ) : trainees.length === 0 ? (
            <p style={{ color: '#999' }}>אין חניכים רשומים בקורס זה</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ textAlign: 'right', padding: '8px' }}>שם</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>אימייל</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>נקודות</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>רצף</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>דרגה</th>
                </tr>
              </thead>
              <tbody>
                {trainees.map((t) => (
                  <tr key={t.user_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{t.full_name}</td>
                    <td style={{ padding: '8px', direction: 'ltr', textAlign: 'right' }}>{t.email || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{t.points || 0}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{t.current_streak || 0}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '10px', background: '#e3f2fd', color: '#1565c0' }}>
                        {ROLE_LABELS[t.role] || t.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
