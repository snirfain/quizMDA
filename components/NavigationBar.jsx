/**
 * Navigation Bar Component
 * Main navigation with role-based items
 * Hebrew: סרגל ניווט
 */

import React, { useState, useEffect } from 'react';
import { getNavigationItems, getCurrentPath } from '../utils/router';
import { navigateTo } from '../utils/router';
import { getCurrentUser, logout } from '../utils/auth';
import { getUserNotifications } from '../workflows/notifications';
import NotificationsPanel from './NotificationsPanel';

export default function NavigationBar({ onMenuToggle }) {
  const [navItems, setNavItems] = useState([]);
  const [user, setUser] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  const updatePath = () => setCurrentPath(getCurrentPath());

  const loadNavigation = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      setNavItems(getNavigationItems(currentUser.role));
      try {
        const notifications = await getUserNotifications(currentUser.user_id, true);
        setUnreadCount(notifications.length);
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
    }
  };

  useEffect(() => {
    updatePath();
    loadNavigation();
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('popstate', updatePath);
    const handleUserUpdate = async (e) => {
      const updatedUser = e.detail || await getCurrentUser();
      setUser(updatedUser);
      if (updatedUser) {
        setNavItems(getNavigationItems(updatedUser.role));
        try {
          const notifications = await getUserNotifications(updatedUser.user_id, true);
          setUnreadCount(notifications.length);
        } catch (err) {
          console.error('Error loading notifications:', err);
        }
      }
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    window.addEventListener('userLogin', handleUserUpdate);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('userUpdated', handleUserUpdate);
      window.removeEventListener('userLogin', handleUserUpdate);
    };
  }, []);

  const getRoleHome = () => {
    if (!user) return '/';
    const paths = { trainee: '/practice', instructor: '/instructor', admin: '/manager' };
    return paths[user.role] || '/';
  };

  const handleNavClick = (e, path) => {
    e.preventDefault();
    navigateTo(path);
    setShowNotifications(false);
    setShowUserMenu(false);
    if (onMenuToggle) onMenuToggle(false);
  };

  const handleLogout = () => {
    try {
      logout();
      setShowUserMenu(false);
      window.dispatchEvent(new CustomEvent('userLogout'));
      navigateTo('/login');
      setTimeout(() => { window.location.href = '/login'; }, 50);
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  if (!user) {
    return null;
  }

  return (
    <nav 
      style={styles.nav}
      role="navigation"
      aria-label="ניווט ראשי"
    >
      <div style={styles.container}>
        {/* Logo/Brand */}
        <div style={styles.brand}>
          <a
            href={getRoleHome()}
            onClick={(e) => handleNavClick(e, getRoleHome())}
            style={styles.logo}
            aria-label="דף הבית"
          >
            <span style={styles.logoStar} aria-hidden="true">✡</span>
            <span>
              <span style={styles.logoText}>מד"א</span>
              <span style={styles.logoSub}>מגן דוד אדום</span>
            </span>
          </a>
        </div>

        {/* Desktop Navigation */}
        {!isMobile && (
          <ul style={styles.navList} role="menubar">
            {navItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <li key={item.path} role="none">
                  <a
                    href={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    style={{
                      ...styles.navLink,
                      ...(isActive ? styles.navLinkActive : {})
                    }}
                    role="menuitem"
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                  >
                    <span style={styles.navIcon} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        {/* Right side actions */}
        <div style={styles.actions}>
          {/* Notifications */}
          <button
            style={styles.iconButton}
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={`התראות${unreadCount > 0 ? ` (${unreadCount} לא נקראו)` : ''}`}
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <span style={styles.icon} aria-hidden="true">🔔</span>
            {unreadCount > 0 && (
              <span style={styles.badge} aria-label={`${unreadCount} התראות לא נקראו`}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div style={styles.userMenuContainer}>
            <button
              style={styles.userButton}
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="תפריט משתמש"
              aria-expanded={showUserMenu}
              aria-haspopup="true"
            >
              <span style={styles.userName}>{user.full_name}</span>
              <span style={styles.userIcon} aria-hidden="true">👤</span>
            </button>

            {showUserMenu && (
              <div 
                style={styles.userMenu}
                role="menu"
                aria-label="תפריט משתמש"
              >
                <a
                  href="/profile"
                  onClick={(e) => handleNavClick(e, '/profile')}
                  style={styles.menuItem}
                  role="menuitem"
                >
                  פרופיל
                </a>
                <a
                  href="/settings"
                  onClick={(e) => handleNavClick(e, '/settings')}
                  style={styles.menuItem}
                  role="menuitem"
                >
                  הגדרות
                </a>
                <a
                  href="/help"
                  onClick={(e) => handleNavClick(e, '/help')}
                  style={styles.menuItem}
                  role="menuitem"
                >
                  עזרה
                </a>
                <hr style={styles.menuDivider} />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLogout();
                  }}
                  style={styles.menuItem}
                  role="menuitem"
                  type="button"
                >
                  התנתק
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          {isMobile && (
            <button
              style={styles.menuToggle}
              onClick={() => onMenuToggle?.()}
              aria-label="תפריט"
              aria-expanded="false"
            >
              <span style={styles.menuIcon} aria-hidden="true">☰</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications Panel */}
      {showNotifications && user && (
        <div 
          style={styles.notificationsPanel}
          role="dialog"
          aria-label="התראות"
          aria-modal="true"
        >
          <NotificationsPanel
            userId={user.user_id}
            onClose={() => setShowNotifications(false)}
          />
        </div>
      )}
    </nav>
  );
}

const styles = {
  nav: {
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    direction: 'rtl',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    maxWidth: '1400px',
    margin: '0 auto',
    height: '60px',
    gap: '20px'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  logo: {
    color: '#FFFFFF',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoStar: {
    fontSize: '28px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  logoText: {
    fontSize: '22px',
    fontWeight: 900,
    letterSpacing: '0.5px',
    lineHeight: 1,
  },
  logoSub: {
    fontSize: '11px',
    fontWeight: 400,
    opacity: 0.85,
    lineHeight: 1,
    display: 'block',
    marginTop: '1px',
  },
  navList: {
    display: 'flex',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    gap: '2px',
    flex: 1,
    justifyContent: 'center'
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    color: 'rgba(255,255,255,0.88)',
    textDecoration: 'none',
    borderRadius: '6px',
    transition: 'background 0.15s ease',
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    color: '#FFFFFF',
    fontWeight: 700,
  },
  navIcon: {
    fontSize: '15px',
    lineHeight: 1,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  iconButton: {
    position: 'relative',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  },
  icon: {
    display: 'block'
  },
  badge: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    backgroundColor: '#FFCC00',
    color: '#1A1A1A',
    borderRadius: '10px',
    padding: '1px 5px',
    fontSize: '10px',
    fontWeight: 700,
    minWidth: '17px',
    textAlign: 'center',
    lineHeight: '14px',
  },
  userMenuContainer: {
    position: 'relative'
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#FFFFFF',
    padding: '7px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background 0.15s',
  },
  userName: {
    display: 'block',
    maxWidth: '130px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userIcon: {
    fontSize: '17px'
  },
  userMenu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
    minWidth: '210px',
    padding: '8px 0',
    zIndex: 1001,
    border: '1px solid #ECECEC',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '11px 18px',
    color: '#1A1A1A',
    textDecoration: 'none',
    textAlign: 'right',
    fontSize: '14px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f5f5f5'
    },
    '&:focus': {
      outline: '2px solid #CC0000',
      outlineOffset: '-2px'
    }
  },
  menuDivider: {
    border: 'none',
    borderTop: '1px solid #ECECEC',
    margin: '6px 0'
  },
  menuToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
    border: 'none',
    color: '#FFFFFF',
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '22px',
    cursor: 'pointer',
  },
  menuIcon: {
    display: 'block'
  },
  notificationsPanel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: '16px',
    right: '16px',
    maxWidth: '400px',
    marginLeft: 'auto',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
    border: '1px solid #ECECEC',
    maxHeight: '420px',
    overflowY: 'auto',
    zIndex: 1001
  },
  notificationsPlaceholder: {
    padding: '20px',
    textAlign: 'center',
    color: '#888888'
  }
};
