/**
 * Main Entry Point
 * Hebrew: נקודת כניסה ראשית
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './mockEntities.js';
import './entities/Question_Versions.js';
import './styles/globalStyles.js';
import './styles/responsive.css';
import { initializeAccessibilitySettings } from './utils/accessibility';
import { initTheme } from './utils/theme';
import { installApiInterceptor } from './utils/apiClient';
import { registerServiceWorker } from './utils/serviceWorker';

// Attach auth token + audit tag to all /api requests before anything fetches.
installApiInterceptor();

// Register the PWA service worker (robust, no-op in dev / unsupported browsers).
registerServiceWorker();

// Theme before paint to avoid flash
initTheme();

// Initialize accessibility settings on page load
initializeAccessibilitySettings();

// Minimal global reset – body/typography from index.html + global.css
const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  #root { min-height: 100vh; }
  *:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
