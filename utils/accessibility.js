/**
 * Accessibility Utilities
 * Screen reader announcements and accessibility helpers
 * Hebrew: כלי נגישות
 */

/**
 * Announce to screen reader
 */
let liveRegion = null;

function getLiveRegion() {
  if (!liveRegion && typeof document !== 'undefined') {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    `;
    document.body.appendChild(liveRegion);
  }
  return liveRegion;
}

export function announce(message, priority = 'polite') {
  const region = getLiveRegion();
  if (region) {
    region.setAttribute('aria-live', priority);
    region.textContent = '';
    // Force reflow
    void region.offsetHeight;
    region.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      if (region.textContent === message) {
        region.textContent = '';
      }
    }, 1000);
  }
}

/**
 * Announce error
 */
export function announceError(message) {
  announce(message, 'assertive');
}

/**
 * Get accessible name for element
 */
export function getAccessibleName(element) {
  if (!element) return '';

  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) return labelElement.textContent || labelElement.innerText;
  }

  // Check associated label
  const id = element.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent || label.innerText;
  }

  // Check text content
  const textContent = element.textContent || element.innerText;
  if (textContent && textContent.trim()) {
    return textContent.trim();
  }

  // Check alt text for images
  if (element.tagName === 'IMG') {
    return element.getAttribute('alt') || '';
  }

  // Check title
  const title = element.getAttribute('title');
  if (title) return title;

  return '';
}

/**
 * Check color contrast ratio
 */
export function getContrastRatio(color1, color2) {
  // Simplified contrast calculation
  // In production, use a proper color contrast library
  const luminance1 = getLuminance(color1);
  const luminance2 = getLuminance(color2);
  
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(color) {
  // Convert hex to RGB
  const rgb = hexToRgb(color);
  if (!rgb) return 0;

  // Calculate relative luminance
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    val = val / 255;
    return val <= 0.03928 
      ? val / 12.92 
      : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Check if contrast meets WCAG AA standards
 */
export function meetsContrastAA(foreground, background, largeText = false) {
  const ratio = getContrastRatio(foreground, background);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Set focus with announcement
 */
export function focusWithAnnounce(element, message) {
  if (element && typeof element.focus === 'function') {
    element.focus();
    if (message) {
      announce(message);
    }
  }
}

/**
 * Create accessible ID
 */
let idCounter = 0;
export function generateAccessibleId(prefix = 'id') {
  return `${prefix}-${++idCounter}`;
}

/**
 * Accessibility Settings Management
 * Hebrew: ניהול הגדרות נגישות
 */

const ACCESSIBILITY_SETTINGS_KEY = 'accessibilitySettings';

/**
 * Get accessibility settings from localStorage
 */
export function getAccessibilitySettings() {
  if (typeof window === 'undefined') {
    return {
      highContrast: false,
      largeText: false,
      reduceMotion: false
    };
  }

  try {
    const stored = localStorage.getItem(ACCESSIBILITY_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading accessibility settings:', error);
  }

  return {
    highContrast: false,
    largeText: false,
    reduceMotion: false
  };
}

/**
 * Save accessibility settings to localStorage
 */
export function setAccessibilitySettings(settings) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(ACCESSIBILITY_SETTINGS_KEY, JSON.stringify(settings));
    applyAccessibilitySettings(settings);
  } catch (error) {
    console.error('Error saving accessibility settings:', error);
  }
}

/**
 * Apply accessibility settings to DOM
 */
export function applyAccessibilitySettings(settings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;

  // High contrast
  if (settings.highContrast) {
    root.classList.add('high-contrast');
    body.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
    body.classList.remove('high-contrast');
  }

  // Large text
  if (settings.largeText) {
    root.classList.add('large-text');
    body.classList.add('large-text');
  } else {
    root.classList.remove('large-text');
    body.classList.remove('large-text');
  }

  // Reduce motion
  if (settings.reduceMotion) {
    root.classList.add('reduce-motion');
    body.classList.add('reduce-motion');
    root.style.setProperty('--motion-duration', '0s');
  } else {
    root.classList.remove('reduce-motion');
    body.classList.remove('reduce-motion');
    root.style.removeProperty('--motion-duration');
  }
}

/**
 * Initialize accessibility settings on page load
 */
export function initializeAccessibilitySettings() {
  const settings = getAccessibilitySettings();
  applyAccessibilitySettings(settings);
}
