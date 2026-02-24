/**
 * Design System
 * Centralized design tokens and constants
 * Hebrew: מערכת עיצוב
 */

export const colors = {
  // Primary colors
  primary: {
    main: '#2196F3',
    light: '#64B5F6',
    dark: '#1976D2',
    contrast: '#FFFFFF'
  },
  
  // Secondary colors
  secondary: {
    main: '#FF9800',
    light: '#FFB74D',
    dark: '#F57C00',
    contrast: '#FFFFFF'
  },
  
  // Status colors
  success: {
    main: '#4CAF50',
    light: '#81C784',
    dark: '#388E3C',
    contrast: '#FFFFFF'
  },
  
  error: {
    main: '#f44336',
    light: '#E57373',
    dark: '#D32F2F',
    contrast: '#FFFFFF'
  },
  
  warning: {
    main: '#ff9800',
    light: '#FFB74D',
    dark: '#F57C00',
    contrast: '#FFFFFF'
  },
  
  info: {
    main: '#2196F3',
    light: '#64B5F6',
    dark: '#1976D2',
    contrast: '#FFFFFF'
  },
  
  // Neutral colors
  grey: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121'
  },
  
  // Text colors
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD',
    hint: '#9E9E9E'
  },
  
  // Background colors
  background: {
    default: '#F5F5F5',
    paper: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)'
  },
  
  // Border colors
  border: {
    light: '#E0E0E0',
    main: '#BDBDBD',
    dark: '#757575'
  }
};

export const typography = {
  fontFamily: {
    primary: '"Arial", "Helvetica", "sans-serif"',
    hebrew: '"Arial Hebrew", "Arial", "Helvetica", "sans-serif"',
    mono: '"Courier New", "monospace"'
  },
  
  fontSize: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '28px',
    '4xl': '32px',
    '5xl': '36px'
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2
  }
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '40px',
  '5xl': '48px',
  '6xl': '64px'
};

export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  '2xl': 1400
};

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 2px 4px rgba(0,0,0,0.1)',
  lg: '0 4px 8px rgba(0,0,0,0.15)',
  xl: '0 8px 16px rgba(0,0,0,0.2)',
  '2xl': '0 16px 32px rgba(0,0,0,0.25)'
};

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px'
};

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070
};

export const transitions = {
  fast: '150ms ease-in-out',
  normal: '250ms ease-in-out',
  slow: '350ms ease-in-out'
};

export const animations = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 }
  },
  slideUp: {
    from: { transform: 'translateY(20px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 }
  },
  slideDown: {
    from: { transform: 'translateY(-20px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 }
  }
};
