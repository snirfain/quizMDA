/**
 * Navigation Bar Component
 * Main navigation with role-based items
 * Hebrew: סרגל ניווט
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { getNavigationItems, getCurrentPath } from '../utils/router';
import { navigateTo } from '../utils/router';
import { getCurrentUser, logout } from '../utils/auth';
import { getUserNotifications } from '../workflows/notifications';
import NotificationsPanel from './NotificationsPanel';
import Icon from './Icon';

export default function NavigationBar({ onMenuToggle, onCollapsedChange }) {
  const [navItems, setNavItems] = useState([]);
  const [user, setUser] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Collapse the inline links into a hamburger drawer ONLY when they would not
  // fit in the available space. This is measured live (below) instead of using
  // a fixed width breakpoint, so labels can never be clipped regardless of how
  // many items the user's role has or how wide the window is.
  const [isMobile, setIsMobile] = useState(false);
  const slotRef = useRef(null);     // available horizontal space for the links
  const measureRef = useRef(null);  // hidden copy at natural (uncollapsed) size

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

  // Measure whether the full-width labeled links fit; collapse if not.
  const measureFit = useCallback(() => {
    const slot = slotRef.current;
    const meas = measureRef.current;
    if (!slot || !meas) return;
    const available = slot.clientWidth;
    const needed = meas.scrollWidth;
    // Small buffer to avoid edge flicker; collapse when links would overflow.
    const next = needed > available - 2;
    setIsMobile((prev) => (prev === next ? prev : next));
  }, []);

  useLayoutEffect(() => {
    measureFit();
    const slot = slotRef.current;
    let ro;
    if (typeof ResizeObserver !== 'undefined' && slot) {
      ro = new ResizeObserver(() => measureFit());
      ro.observe(slot);
    }
    window.addEventListener('resize', measureFit);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measureFit);
    };
  }, [measureFit, navItems]);

  // Keep the layout (drawer) in sync with the measured collapse state.
  useEffect(() => {
    onCollapsedChange?.(isMobile);
  }, [isMobile, onCollapsedChange]);

  useEffect(() => {
    updatePath();
    loadNavigation();
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
      <div style={styles.container} className="nav-bar-container">
        {/* Logo/Brand */}
        <div style={styles.brand}>
          <a
            href={getRoleHome()}
            onClick={(e) => handleNavClick(e, getRoleHome())}
            style={styles.logo}
            aria-label="דף הבית"
          >
            <span style={styles.logoStar} aria-hidden="true">
              <Icon name="logo" size={26} strokeWidth={1.8} />
            </span>
            <span className="nav-brand-text">
              <span style={styles.logoText}>מד"א</span>
              <span style={styles.logoSub} className="nav-brand-sub">מגן דוד אדום</span>
            </span>
          </a>
        </div>

        {/* Desktop Navigation — lives in a flexible slot we can measure.
            The slot always occupies the central space (whether or not the
            links are shown), so its width is a stable measure of the room
            available for the inline links. */}
        <div ref={slotRef} style={styles.navSlot}>
          {!isMobile && (
            <ul style={styles.navList} className="nav-desktop-links" role="menubar">
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
                      title={item.label}
                    >
                      <span style={styles.navIcon} aria-hidden="true">
                        <Icon name={item.icon} size={18} />
                      </span>
                      <span className="nav-link-label">{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Hidden measurer: every item at its natural (bold, full-padding)
              size. We compare its width to the slot to decide if we must
              collapse. Aria-hidden + off-flow so it never affects layout. */}
          <ul ref={measureRef} style={styles.navMeasure} aria-hidden="true">
            {navItems.map((item) => (
              <li key={`m-${item.path}`}>
                <span style={{ ...styles.navLink, ...styles.navLinkActive }}>
                  <span style={styles.navIcon}>
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span>{item.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

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
            <span style={styles.icon} aria-hidden="true">
              <Icon name="bell" size={20} />
            </span>
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
              className="nav-user-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="תפריט משתמש"
              aria-expanded={showUserMenu}
              aria-haspopup="true"
            >
              <span style={styles.userName} className="nav-user-name">{user.full_name}</span>
              <span style={styles.userIcon} aria-hidden="true">
                <Icon name="user" size={18} />
              </span>
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
                  className="nav-user-menu-item"
                  role="menuitem"
                >
                  פרופיל
                </a>
                <a
                  href="/settings"
                  onClick={(e) => handleNavClick(e, '/settings')}
                  className="nav-user-menu-item"
                  role="menuitem"
                >
                  הגדרות
                </a>
                <a
                  href="/help"
                  onClick={(e) => handleNavClick(e, '/help')}
                  className="nav-user-menu-item"
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
                  className="nav-user-menu-item"
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
              type="button"
              style={styles.menuToggle}
              data-menu-toggle
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuToggle?.();
              }}
              aria-label="תפריט"
            >
              <span style={styles.menuIcon} aria-hidden="true">
                <Icon name="menu" size={24} />
              </span>
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
    backgroundColor: 'var(--mda-red)',
    color: 'var(--color-white)',
    boxShadow: 'var(--shadow-nav)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    direction: 'rtl',
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 var(--space-6)`,
    maxWidth: '1400px',
    margin: '0 auto',
    height: '60px',
    gap: 'var(--space-5)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    flexShrink: 0,
  },
  logo: {
    color: 'var(--color-white)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  logoStar: {
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
  navSlot: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  },
  navList: {
    display: 'flex',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    gap: '2px',
    width: '100%',
    minWidth: 0,
    justifyContent: 'center',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  navMeasure: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: 0,
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
    display: 'flex',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    gap: '2px',
    whiteSpace: 'nowrap',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-4)',
    color: 'rgba(255,255,255,0.88)',
    textDecoration: 'none',
    borderRadius: 'var(--radius-md)',
    transition: 'background var(--transition), color var(--transition)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    color: 'var(--color-white)',
    fontWeight: 700,
  },
  navIcon: {
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    flexShrink: 0,
  },
  iconButton: {
    position: 'relative',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-white)',
    padding: 'var(--space-2)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--transition)',
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    backgroundColor: '#FFCC00',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-full)',
    padding: '1px 5px',
    fontSize: '10px',
    fontWeight: 700,
    minWidth: '17px',
    textAlign: 'center',
    lineHeight: '14px',
  },
  userMenuContainer: {
    position: 'relative',
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: 'var(--color-white)',
    padding: '7px var(--space-4)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    transition: 'background var(--transition)',
  },
  userName: {
    display: 'block',
    maxWidth: '130px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  userMenu: {
    position: 'absolute',
    top: 'calc(100% + var(--space-2))',
    left: 0,
    backgroundColor: 'var(--color-white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: '210px',
    padding: 'var(--space-2) 0',
    zIndex: 1001,
    border: '1px solid var(--color-border)',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '11px var(--space-5)',
    color: 'var(--color-text)',
    textDecoration: 'none',
    textAlign: 'right',
    fontSize: 'var(--font-size-base)',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'background var(--transition)',
  },
  menuDivider: {
    border: 'none',
    borderTop: '1px solid var(--color-border)',
    margin: 'var(--space-2) 0',
  },
  menuToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
    border: 'none',
    color: 'var(--color-white)',
    padding: 'var(--space-2) 10px',
    borderRadius: 'var(--radius-md)',
    fontSize: '22px',
    cursor: 'pointer',
  },
  menuIcon: {
    display: 'block',
  },
  notificationsPanel: {
    position: 'absolute',
    top: 'calc(100% + var(--space-2))',
    left: 'var(--space-4)',
    right: 'var(--space-4)',
    maxWidth: '400px',
    marginLeft: 'auto',
    backgroundColor: 'var(--color-white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--color-border)',
    maxHeight: '420px',
    overflowY: 'auto',
    zIndex: 1001,
  },
  notificationsPlaceholder: {
    padding: 'var(--space-5)',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
  },
};
