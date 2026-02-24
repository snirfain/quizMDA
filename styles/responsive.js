/**
 * Responsive Utilities
 * Media queries and responsive helpers
 * Hebrew: כלי responsive
 */

import { breakpoints } from './designSystem';

/**
 * Media query helper
 */
export function mediaQuery(breakpoint, styles) {
  const bp = typeof breakpoint === 'number' ? breakpoint : breakpoints[breakpoint];
  return `@media (min-width: ${bp}px) { ${styles} }`;
}

/**
 * Mobile-first media query
 */
export function mobileFirst(breakpoint, styles) {
  return mediaQuery(breakpoint, styles);
}

/**
 * Desktop-only styles
 */
export function desktop(styles) {
  return mediaQuery('lg', styles);
}

/**
 * Tablet and up
 */
export function tablet(styles) {
  return mediaQuery('md', styles);
}

/**
 * Mobile only
 */
export function mobile(styles) {
  return `@media (max-width: ${breakpoints.md - 1}px) { ${styles} }`;
}

/**
 * Check if screen is mobile
 */
export function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < breakpoints.md;
}

/**
 * Check if screen is tablet
 */
export function isTablet() {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= breakpoints.md && width < breakpoints.lg;
}

/**
 * Check if screen is desktop
 */
export function isDesktop() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= breakpoints.lg;
}

/**
 * Get responsive value
 */
export function responsive(values) {
  return {
    mobile: values.mobile || values.default,
    tablet: values.tablet || values.mobile || values.default,
    desktop: values.desktop || values.tablet || values.mobile || values.default
  };
}

/**
 * Container max widths
 */
export const containerMaxWidths = {
  sm: '540px',
  md: '720px',
  lg: '960px',
  xl: '1140px',
  '2xl': '1320px'
};

/**
 * Grid system
 */
export const grid = {
  columns: 12,
  gutter: '20px'
};

/**
 * Responsive spacing
 */
export function responsiveSpacing(base, multiplier = {}) {
  return {
    mobile: base,
    tablet: multiplier.tablet ? base * multiplier.tablet : base,
    desktop: multiplier.desktop ? base * multiplier.desktop : base
  };
}
