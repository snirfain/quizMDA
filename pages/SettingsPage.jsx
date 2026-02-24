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
import { permissions } from '../utils/permissions';
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

        <div style={styles.tabs} role="tablist" aria-label="קטגוריות הגדרות">
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'profile' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('profile')}
            role="tab"
            aria-selected={activeTab === 'profile'}
            aria-controls="profile-panel"
            id="profile-tab"
          >
            פרופיל
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'notifications' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('notifications')}
            role="tab"
            aria-selected={activeTab === 'notifications'}
            aria-controls="notifications-panel"
            id="notifications-tab"
          >
            התראות
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'accessibility' ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab('accessibility')}
            role="tab"
            aria-selected={activeTab === 'accessibility'}
            aria-controls="accessibility-panel"
            id="accessibility-tab"
          >
            נגישות
          </button>
          <PermissionGate permission={permissions.SYSTEM_SETTINGS}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'system' ? styles.tabActive : {})
              }}
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
        <button 
          type="submit" 
          style={{
            ...styles.saveButton,
            ...(isSaving ? styles.saveButtonDisabled : {})
          }}
          disabled={isSaving}
        >
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
        <button type="button" style={styles.saveButton}>
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
        <button 
          type="button" 
          style={{
            ...styles.saveButton,
            ...(isSaving ? styles.saveButtonDisabled : {})
          }}
          onClick={handleSave}
          disabled={isSaving}
        >
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
    maxWidth: '1000px',
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
    marginBottom: '30px',
    flexWrap: 'wrap'
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
      outlineOffset: '2px',
      borderRadius: '4px 4px 0 0'
    }
  },
  tabActive: {
    color: '#CC0000',
    borderBottom: '2px solid #CC0000',
    fontWeight: 'bold'
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
  saveButton: {
    padding: '12px 24px',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    '&:hover': {
      backgroundColor: '#A50000'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '2px'
    }
  },
  saveButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    '&:hover': {
      backgroundColor: '#CC0000'
    }
  }
};
