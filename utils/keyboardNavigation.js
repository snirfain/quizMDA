/**
 * Keyboard Navigation Utilities
 * Helper functions for keyboard navigation and focus management
 * Hebrew: כלי עזר לניווט במקלדת
 */

/**
 * Create a focus trap within a container element
 * @param {HTMLElement} container - Container element to trap focus within
 * @param {Function} onEscape - Callback when Escape key is pressed
 * @returns {Function} Cleanup function
 */
export function createFocusTrap(container, onEscape = null) {
  if (!container) return () => {};

  const focusableElements = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleTab = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  const handleEscape = (e) => {
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
    }
  };

  container.addEventListener('keydown', handleTab);
  if (onEscape) {
    container.addEventListener('keydown', handleEscape);
  }

  // Focus first element
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTab);
    if (onEscape) {
      container.removeEventListener('keydown', handleEscape);
    }
  };
}

/**
 * Navigate through a list of elements with arrow keys
 * @param {HTMLElement[]} elements - Array of focusable elements
 * @param {KeyboardEvent} event - Keyboard event
 * @param {HTMLElement} currentElement - Currently focused element
 * @returns {HTMLElement|null} Next element to focus, or null
 */
export function navigateList(elements, event, currentElement) {
  if (!elements || elements.length === 0) return null;

  const currentIndex = elements.indexOf(currentElement);
  if (currentIndex === -1) return elements[0] || null;

  let nextIndex = currentIndex;

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % elements.length;
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = currentIndex === 0 ? elements.length - 1 : currentIndex - 1;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = elements.length - 1;
      break;
    default:
      return null;
  }

  event.preventDefault();
  return elements[nextIndex];
}

/**
 * Handle Enter/Space key activation
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Function} callback - Callback to execute
 */
export function handleActivation(event, callback) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (callback) {
      callback();
    }
  }
}

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - Container element
 * @returns {HTMLElement[]} Array of focusable elements
 */
export function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
}

/**
 * Focus first focusable element in container
 * @param {HTMLElement} container - Container element
 */
export function focusFirst(container) {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[0].focus();
  }
}

/**
 * Focus last focusable element in container
 * @param {HTMLElement} container - Container element
 */
export function focusLast(container) {
  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    elements[elements.length - 1].focus();
  }
}

/**
 * Restore focus to a previously focused element
 * @param {HTMLElement} element - Element to restore focus to
 */
export function restoreFocus(element) {
  if (element && typeof element.focus === 'function') {
    element.focus();
  }
}

/**
 * Save current focus for later restoration
 * @returns {HTMLElement} Currently focused element
 */
export function saveFocus() {
  return document.activeElement;
}

/**
 * Handle keyboard navigation for tabs
 * @param {KeyboardEvent} event - Keyboard event
 * @param {HTMLElement[]} tabs - Array of tab elements
 * @param {HTMLElement} currentTab - Currently active tab
 * @param {Function} onTabChange - Callback when tab changes
 */
export function handleTabNavigation(event, tabs, currentTab, onTabChange) {
  if (!tabs || tabs.length === 0) return;

  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex === -1) return;

  let nextIndex = currentIndex;

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      nextIndex = (currentIndex + 1) % tabs.length;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = tabs.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  if (onTabChange && nextIndex !== currentIndex) {
    onTabChange(nextIndex);
  }
  tabs[nextIndex]?.focus();
}

/**
 * Handle keyboard navigation for dropdown menus
 * @param {KeyboardEvent} event - Keyboard event
 * @param {HTMLElement[]} items - Array of menu items
 * @param {HTMLElement} currentItem - Currently focused item
 * @param {Function} onSelect - Callback when item is selected
 */
export function handleDropdownNavigation(event, items, currentItem, onSelect) {
  if (!items || items.length === 0) return;

  const currentIndex = items.indexOf(currentItem);
  if (currentIndex === -1) {
    // If no current item, focus first
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      items[0]?.focus();
    }
    return;
  }

  let nextIndex = currentIndex;

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % items.length;
      event.preventDefault();
      items[nextIndex]?.focus();
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
      event.preventDefault();
      items[nextIndex]?.focus();
      break;
    case 'Home':
      event.preventDefault();
      items[0]?.focus();
      break;
    case 'End':
      event.preventDefault();
      items[items.length - 1]?.focus();
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (onSelect) {
        onSelect(currentItem, currentIndex);
      }
      break;
    case 'Escape':
      event.preventDefault();
      // Close dropdown - handled by parent component
      break;
  }
}

/**
 * Check if element is focusable
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if element is focusable
 */
export function isFocusable(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  const tabIndex = element.getAttribute('tabindex');

  if (tabIndex === '-1') return false;

  if (tagName === 'a' && element.href) return true;
  if (['button', 'input', 'select', 'textarea'].includes(tagName)) {
    return !element.disabled;
  }
  if (tabIndex !== null && parseInt(tabIndex) >= 0) return true;

  return false;
}

/**
 * Close a component when Escape key is pressed
 * @param {Function} onClose - Callback to execute when Escape is pressed
 * @returns {Function} Cleanup function to remove the listener
 */
export function closeOnEscape(onClose) {
  if (!onClose) return () => {};

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}

/**
 * Register a keyboard shortcut
 * @param {string} key - Key to listen for (e.g., '/', 'Escape', 'Ctrl+k')
 * @param {Function} callback - Callback function to execute
 * @param {Object} options - Options (preventDefault, stopPropagation, etc.)
 * @returns {Function} Cleanup function to unregister
 */
export function registerShortcut(key, callback, options = {}) {
  const { preventDefault = false, stopPropagation = false, ctrlKey = false, shiftKey = false, altKey = false } = options;

  const handleKeyDown = (event) => {
    // Check modifier keys
    if (ctrlKey && !event.ctrlKey) return;
    if (shiftKey && !event.shiftKey) return;
    if (altKey && !event.altKey) return;

    // Check if we're in an input/textarea (don't trigger shortcuts)
    const target = event.target;
    const tagName = target.tagName.toLowerCase();
    if (['input', 'textarea'].includes(tagName) && target.type !== 'search') {
      // Allow shortcuts in search inputs
      if (target.type !== 'search' && key !== 'Escape') {
        return;
      }
    }

    // Check if key matches
    if (event.key === key || event.code === key) {
      if (preventDefault) {
        event.preventDefault();
      }
      if (stopPropagation) {
        event.stopPropagation();
      }
      callback(event);
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
