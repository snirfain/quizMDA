/**
 * Main Layout Component
 * Wraps all pages with consistent layout
 * Hebrew: פריסה ראשית
 */

import React, { useState, useEffect } from 'react';
import NavigationBar from './NavigationBar';
import AppSidebar from './AppSidebar';
import BottomNav, { getBottomNavItems } from './BottomNav';
import Icon from './Icon';
import Breadcrumbs from './Breadcrumbs';
import ErrorBoundary from './ErrorBoundary';
import SkipLink from './SkipLink';
import { getCurrentUser, logout } from '../utils/auth';
import { getNavigationItems, navigateTo, getCurrentPath } from '../utils/router';

export default function MainLayout({ children, showBreadcrumbs = true, currentPath = null }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  // The NavigationBar measures whether its inline links fit and reports the
  // collapse state here. When the links are shown inline (not collapsed) the
  // hamburger is gone, so any open drawer must close to stay consistent.
  const handleCollapsedChange = (collapsed) => {
    if (!collapsed) setMobileMenuOpen(false);
  };

  const loadUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  const handleMenuToggle = (open) => {
    setMobileMenuOpen(typeof open === 'boolean' ? open : (prev) => !prev);
  };

  const navItems = user ? getNavigationItems(user.role) : [];
  const activePath = currentPath || getCurrentPath();

  // Account / personal pages — always available from the drawer so the menu
  // covers every destination in the app, not just the role's primary links.
  const accountItems = [
    { path: '/profile', label: 'הפרופיל שלי', icon: 'user' },
    { path: '/settings', label: 'הגדרות', icon: 'settings' },
    { path: '/help', label: 'עזרה ותמיכה', icon: 'help' },
  ];

  const handleNavClick = (e, path) => {
    e.preventDefault();
    navigateTo(path);
    setMobileMenuOpen(false);
  };

  const handleLogout = (e) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    try {
      logout();
      window.dispatchEvent(new CustomEvent('userLogout'));
      navigateTo('/login');
      setTimeout(() => { window.location.href = '/login'; }, 50);
    } catch {
      window.location.href = '/login';
    }
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        mobileMenuOpen &&
        !e.target.closest('[data-mobile-menu]') &&
        !e.target.closest('[data-menu-toggle]')
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [mobileMenuOpen]);

  const bottomItems = user ? getBottomNavItems(navItems, user.role) : [];

  return (
    <ErrorBoundary>
      <div className="app-shell" style={styles.layout} dir="rtl">
        <SkipLink />

        <header className="app-topbar" style={styles.header} role="banner">
          <NavigationBar
            onMenuToggle={handleMenuToggle}
            onCollapsedChange={handleCollapsedChange}
          />
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div 
            style={styles.mobileOverlay}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Sidebar — opens from the same side as the hamburger icon
            (start/left in this RTL layout) so the icon and the panel match.
            Rendered whenever open; the toggle only appears below the collapse
            breakpoint, so this can't show on desktop. */}
        {mobileMenuOpen && (
          <aside
            style={styles.mobileSidebar}
            data-mobile-menu
            role="navigation"
            aria-label="תפריט ניווט"
          >
            <div style={styles.drawerHeader}>
              <span style={styles.drawerTitle}>תפריט ניווט</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                style={styles.drawerClose}
                aria-label="סגור תפריט"
              >
                <Icon name="close" size={22} />
              </button>
            </div>

            {user && (
              <div style={styles.drawerUser}>
                <span style={styles.drawerAvatar} aria-hidden="true">
                  <Icon name="user" size={18} />
                </span>
                <span style={styles.drawerUserName}>{user.full_name}</span>
              </div>
            )}

            <nav style={styles.drawerSection} aria-label="עמודים ראשיים">
              <p style={styles.drawerSectionLabel}>ניווט</p>
              <ul style={styles.drawerList}>
                {navItems.map((item) => {
                  const isActive = activePath === item.path;
                  return (
                    <li key={item.path}>
                      <a
                        href={item.path}
                        onClick={(e) => handleNavClick(e, item.path)}
                        className="nav-mobile-link"
                        aria-current={isActive ? 'page' : undefined}
                        style={{ ...styles.drawerLink, ...(isActive ? styles.drawerLinkActive : {}) }}
                      >
                        <Icon name={item.icon} size={20} />
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <nav style={styles.drawerSection} aria-label="החשבון שלי">
              <p style={styles.drawerSectionLabel}>החשבון שלי</p>
              <ul style={styles.drawerList}>
                {accountItems.map((item) => {
                  const isActive = activePath === item.path;
                  return (
                    <li key={item.path}>
                      <a
                        href={item.path}
                        onClick={(e) => handleNavClick(e, item.path)}
                        className="nav-mobile-link"
                        aria-current={isActive ? 'page' : undefined}
                        style={{ ...styles.drawerLink, ...(isActive ? styles.drawerLinkActive : {}) }}
                      >
                        <Icon name={item.icon} size={20} />
                        {item.label}
                      </a>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{ ...styles.drawerLink, ...styles.drawerLogout }}
                  >
                    <Icon name="logout" size={20} />
                    התנתקות
                  </button>
                </li>
              </ul>
            </nav>
          </aside>
        )}

        <div className="app-body">
          {user && (
            <AppSidebar
              navItems={navItems}
              accountItems={accountItems}
              onNavClick={handleNavClick}
            />
          )}

          <div className="app-main-with-sidebar app-main-pad-bottom">
            <main
              style={styles.main}
              id="main-content"
              role="main"
              aria-label="תוכן ראשי"
            >
              {showBreadcrumbs && <Breadcrumbs currentPath={currentPath} />}
              <div style={styles.content}>{children}</div>
            </main>

            <footer className="app-footer" style={styles.footer} role="contentinfo">
          <div style={styles.footerContent}>
            <p style={styles.footerText}>
              מערכת למידה ותרגול מד"א © {new Date().getFullYear()}
            </p>
            <nav style={styles.footerNav} aria-label="ניווט תחתון">
              <button
                type="button"
                onClick={() => navigateTo('/help')}
                style={{ ...styles.footerLink, background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="עזרה"
              >
                עזרה
              </button>
              <span style={styles.footerSeparator} aria-hidden="true">|</span>
              <button
                type="button"
                onClick={() => navigateTo('/settings')}
                style={{ ...styles.footerLink, background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="הגדרות"
              >
                הגדרות
              </button>
            </nav>
          </div>
            </footer>
          </div>
        </div>

        {user && (
          <BottomNav
            items={bottomItems}
            onMore={() => handleMenuToggle(true)}
            onNav={handleNavClick}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

const styles = {
  layout: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-bg)',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: 'var(--mda-red)',
  },
  mobileOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 999,
  },
  mobileSidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '300px',
    maxWidth: '85vw',
    backgroundColor: 'var(--color-bg-card)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 1001,
    padding: 'var(--space-4) var(--space-4) var(--space-6)',
    overflowY: 'auto',
    animation: 'drawerSlideInLeft 0.22s ease-out',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 'var(--space-3)',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: 'var(--space-3)',
  },
  drawerTitle: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  drawerClose: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    padding: 'var(--space-1)',
    borderRadius: 'var(--radius-md)',
  },
  drawerUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: 'var(--color-bg)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 'var(--space-4)',
  },
  drawerAvatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--mda-red)',
    color: 'var(--color-white)',
    flexShrink: 0,
  },
  drawerUserName: {
    fontWeight: 700,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  drawerSection: {
    marginBottom: 'var(--space-4)',
  },
  drawerSectionLabel: {
    margin: '0 0 var(--space-2)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  drawerList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  drawerLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    width: '100%',
    padding: '11px var(--space-3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    textDecoration: 'none',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'right',
    fontFamily: 'inherit',
  },
  drawerLinkActive: {
    backgroundColor: 'var(--color-primary-bg)',
    color: 'var(--color-primary)',
    fontWeight: 700,
  },
  drawerLogout: {
    color: 'var(--mda-red)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  content: {
    flex: 1,
    padding: 'var(--space-6) var(--space-5)',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  footer: {
    backgroundColor: 'var(--color-footer-bg)',
    color: 'var(--color-footer-text)',
    padding: '22px var(--space-6)',
    marginTop: 'auto',
  },
  footerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
  },
  footerText: {
    margin: 0,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
  },
  footerNav: {
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'center',
  },
  footerLink: {
    color: 'var(--color-footer-text)',
    textDecoration: 'none',
    fontSize: 'var(--font-size-sm)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'color var(--transition)',
  },
  footerSeparator: {
    color: 'var(--color-text-muted)',
  },
};
