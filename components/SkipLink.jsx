/**
 * Skip Link Component
 * Accessibility: Skip to main content
 * Hebrew: קישור דילוג
 */

import React from 'react';

export default function SkipLink() {
  const handleClick = (e) => {
    e.preventDefault();
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      style={styles.skipLink}
      className="skip-link"
      aria-label="דלג לתוכן ראשי"
    >
      דלג לתוכן ראשי
    </a>
  );
}

const styles = {
  skipLink: {
    position: 'absolute',
    top: '-40px',
    right: '0',
    backgroundColor: '#CC0000',
    color: '#FFFFFF',
    padding: '12px 20px',
    textDecoration: 'none',
    zIndex: 10000,
    borderRadius: '0 0 4px 4px',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'top 0.2s ease',
    '&:focus': {
      top: '0',
      outline: '3px solid #FFFFFF',
      outlineOffset: '2px'
    }
  }
};
