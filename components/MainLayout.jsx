/**
 * Main Layout Component
 * Wraps all pages with consistent layout
 * Hebrew: פריסה ראשית
 */

import React, { useState, useEffect } from 'react';
import NavigationBar from './NavigationBar';
import Breadcrumbs from './Breadcrumbs';
import ErrorBoundary from './ErrorBoundary';
import SkipLink from './SkipLink';
import { getCurrentUser } from '../utils/auth';
import { getNavigationItems, navigateTo } from '../utils/router';

export default function MainLayout({ children, showBreadcrumbs = true, currentPath = null }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    loadUser();
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const checkMobile = () => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (!mobile) {
      setMobileMenuOpen(false);
    }
  };

  const loadUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  const handleMenuToggle = (open) => {
    setMobileMenuOpen(typeof open === 'boolean' ? open : (prev) => !prev);
  };

  const navItems = user ? getNavigationItems(user.role) : [];

  const handleNavClick = (e, path) => {
    e.preventDefault();
    navigateTo(path);
    setMobileMenuOpen(false);
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileMenuOpen && !e.target.closest('[data-mobile-menu]')) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [mobileMenuOpen]);

  return (
    <ErrorBoundary>
      <div style={styles.layout} dir="rtl">
        <SkipLink />
        
        {/* Header */}
        <header style={styles.header} role="banner">
          <NavigationBar 
            onMenuToggle={handleMenuToggle}
          />
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && isMobile && (
          <div 
            style={styles.mobileOverlay}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Sidebar */}
        {isMobile && mobileMenuOpen && (
          <aside
            style={styles.mobileSidebar}
            data-mobile-menu
            role="navigation"
            aria-label="תפריט ניווט"
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {navItems.map((item) => (
                <li key={item.path} style={{ marginBottom: '8px' }}>
                  <a
                    href={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      color: '#1A1A1A',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontWeight: 500,
                      fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
                      fontSize: '15px',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Main Content */}
        <main 
          style={styles.main}
          id="main-content"
          role="main"
          aria-label="תוכן ראשי"
        >
          {/* Breadcrumbs */}
          {showBreadcrumbs && <Breadcrumbs currentPath={currentPath} />}

          {/* Page Content */}
          <div style={styles.content}>
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer style={styles.footer} role="contentinfo">
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
    </ErrorBoundary>
  );
}

const styles = {
  layout: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--panel-bg, #f4f6fb)',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: '#CC0000',
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
    right: 0,
    bottom: 0,
    width: '280px',
    backgroundColor: '#FFFFFF',
    boxShadow: '-3px 0 16px rgba(0,0,0,0.12)',
    zIndex: 1001,
    padding: '24px 16px',
    overflowY: 'auto',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  content: {
    flex: 1,
    padding: '24px 20px',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
  },
  footer: {
    backgroundColor: '#1A1A1A',
    color: '#CCCCCC',
    padding: '22px 24px',
    marginTop: 'auto',
    fontFamily: "'Heebo', 'Assistant', 'Arial Hebrew', Arial, sans-serif",
  },
  footerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  footerText: {
    margin: 0,
    fontSize: '13px',
    color: '#AAAAAA',
  },
  footerNav: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  footerLink: {
    color: '#CCCCCC',
    textDecoration: 'none',
    fontSize: '13px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  footerSeparator: {
    color: '#444444',
  }
};
