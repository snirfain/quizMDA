/**
 * Floating Accessibility Button Component
 * Hebrew: כפתור נגישות צף
 * 
 * According to Israeli accessibility law, accessibility settings should be easily accessible
 * via a floating button on all pages
 */

import React, { useState } from 'react';
import { navigateTo } from '../utils/router';
import { getAccessibilitySettings, applyAccessibilitySettings } from '../utils/accessibility';

export default function FloatingAccessibilityButton() {
  const [showMenu, setShowMenu] = useState(false);
  const [settings, setSettings] = useState(() => getAccessibilitySettings());

  const handleToggle = (setting) => {
    const newSettings = {
      ...settings,
      [setting]: !settings[setting]
    };
    setSettings(newSettings);
    applyAccessibilitySettings(newSettings);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessibilitySettings', JSON.stringify(newSettings));
    }
  };

  const handleOpenSettings = () => {
    navigateTo('/settings');
    setShowMenu(false);
  };

  return (
    <div style={styles.container}>
      {showMenu && (
        <div style={styles.menu} role="dialog" aria-label="תפריט נגישות">
          <div style={styles.menuHeader}>
            <h3 style={styles.menuTitle}>הגדרות נגישות</h3>
            <button
              style={styles.closeButton}
              onClick={() => setShowMenu(false)}
              aria-label="סגור תפריט נגישות"
            >
              ✕
            </button>
          </div>
          
          <div style={styles.menuContent}>
            <label style={styles.menuItem}>
              <input
                type="checkbox"
                checked={settings.highContrast || false}
                onChange={() => handleToggle('highContrast')}
                style={styles.checkbox}
              />
              <span>ניגודיות גבוהה</span>
            </label>
            
            <label style={styles.menuItem}>
              <input
                type="checkbox"
                checked={settings.largeText || false}
                onChange={() => handleToggle('largeText')}
                style={styles.checkbox}
              />
              <span>טקסט גדול</span>
            </label>
            
            <label style={styles.menuItem}>
              <input
                type="checkbox"
                checked={settings.reduceMotion || false}
                onChange={() => handleToggle('reduceMotion')}
                style={styles.checkbox}
              />
              <span>הפחתת תנועה</span>
            </label>
            
            <button
              style={styles.settingsButton}
              onClick={handleOpenSettings}
            >
              הגדרות נוספות
            </button>
          </div>
        </div>
      )}
      
      <button
        style={styles.button}
        onClick={() => setShowMenu(!showMenu)}
        aria-label="הגדרות נגישות"
        aria-expanded={showMenu}
        aria-haspopup="true"
      >
        <span style={styles.icon} aria-hidden="true">♿</span>
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    left: '20px',
    bottom: '20px',
    zIndex: 9999,
    direction: 'ltr' // Button is on left side, so LTR for proper positioning
  },
  button: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: '#A50000',
      transform: 'scale(1.1)',
      boxShadow: '0 6px 16px rgba(0,0,0,0.4)'
    },
    '&:focus': {
      outline: '3px solid #FFFFFF',
      outlineOffset: '2px'
    }
  },
  icon: {
    display: 'block'
  },
  menu: {
    position: 'absolute',
    bottom: '80px',
    left: '0',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    minWidth: '280px',
    maxWidth: '320px',
    direction: 'rtl',
    overflow: 'hidden'
  },
  menuHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f5f5f5'
  },
  menuTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#212121'
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#757575',
    padding: '4px 8px',
    '&:hover': {
      color: '#212121'
    }
  },
  menuContent: {
    padding: '12px'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '16px',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    }
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  settingsButton: {
    width: '100%',
    marginTop: '12px',
    padding: '12px',
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
  }
};
