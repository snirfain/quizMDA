/**
 * Focus Management Utilities
 * Focus trap, restoration, and management
 * Hebrew: ניהול פוקוס
 */

/**
 * Focus trap for modals and dialogs
 */
export function trapFocus(element) {
  if (!element) return null;

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  const focusableElements = Array.from(element.querySelectorAll(focusableSelectors));
  
  if (focusableElements.length === 0) return null;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTab = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab (backward)
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab (forward)
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  element.addEventListener('keydown', handleTab);
  
  // Focus first element
  firstElement.focus();

  return () => {
    element.removeEventListener('keydown', handleTab);
  };
}

/**
 * Save current focus
 */
let savedFocus = null;

export function saveFocus() {
  savedFocus = document.activeElement;
}

/**
 * Restore saved focus
 */
export function restoreFocus() {
  if (savedFocus && typeof savedFocus.focus === 'function') {
    savedFocus.focus();
    savedFocus = null;
  }
}

/**
 * Focus element safely
 */
export function focusElement(element, options = {}) {
  if (!element) return false;

  const { preventScroll = false } = options;

  try {
    if (typeof element.focus === 'function') {
      element.focus({ preventScroll });
      return true;
    }
  } catch (error) {
    console.error('Error focusing element:', error);
  }

  return false;
}

/**
 * Get focusable elements in container
 */
export function getFocusableElements(container) {
  if (!container) return [];

  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  return Array.from(container.querySelectorAll(selectors));
}

/**
 * Focus first focusable element
 */
export function focusFirst(container) {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    return focusElement(elements[0]);
  }
  return false;
}

/**
 * Focus last focusable element
 */
export function focusLast(container) {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    return focusElement(elements[elements.length - 1]);
  }
  return false;
}

/**
 * Check if element is focusable
 */
export function isFocusable(element) {
  if (!element) return false;

  // Check if element is visible
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  // Check tabindex
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex === '-1') return false;

  // Check if element type is focusable
  const tagName = element.tagName.toLowerCase();
  const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];
  
  if (focusableTags.includes(tagName)) {
    // Check if disabled
    if (element.disabled) return false;
    return true;
  }

  // Check if has tabindex >= 0
  if (tabIndex !== null && parseInt(tabIndex) >= 0) {
    return true;
  }

  return false;
}
