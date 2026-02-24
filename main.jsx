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

// Initialize accessibility settings on page load
initializeAccessibilitySettings();

// Apply global styles
const globalStyles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  html, body {
    direction: rtl;
    text-align: right;
    font-family: 'Arial Hebrew', 'Arial', 'Helvetica', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #212121;
    background-color: #f5f5f5;
    min-height: 100vh;
  }
  
  #root {
    min-height: 100vh;
  }
  
  *:focus-visible {
    outline: 3px solid #CC0000;
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
