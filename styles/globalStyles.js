/**
 * Global Styles
 * Base styles and resets
 * Hebrew: עיצוב גלובלי
 */

import { colors, typography, spacing } from './designSystem';

export const globalStyles = {
  '*': {
    boxSizing: 'border-box',
    margin: 0,
    padding: 0
  },
  
  'html, body': {
    direction: 'rtl',
    textAlign: 'right',
    fontFamily: typography.fontFamily.hebrew,
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.normal,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    minHeight: '100vh'
  },
  
  // Headings
  'h1, h2, h3, h4, h5, h6': {
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
    marginBottom: spacing.md,
    color: colors.text.primary
  },
  
  h1: {
    fontSize: typography.fontSize['4xl']
  },
  
  h2: {
    fontSize: typography.fontSize['3xl']
  },
  
  h3: {
    fontSize: typography.fontSize['2xl']
  },
  
  h4: {
    fontSize: typography.fontSize.xl
  },
  
  h5: {
    fontSize: typography.fontSize.lg
  },
  
  h6: {
    fontSize: typography.fontSize.md
  },
  
  // Links
  a: {
    color: colors.primary.main,
    textDecoration: 'none',
    transition: 'color 0.2s ease',
    '&:hover': {
      color: colors.primary.dark,
      textDecoration: 'underline'
    },
    '&:focus': {
      outline: `2px solid ${colors.primary.main}`,
      outlineOffset: '2px'
    }
  },
  
  // Buttons base
  button: {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    padding: `${spacing.md} ${spacing.lg}`,
    transition: 'all 0.2s ease',
    '&:focus': {
      outline: `2px solid ${colors.primary.main}`,
      outlineOffset: '2px'
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed'
    }
  },
  
  // Inputs
  'input, textarea, select': {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    direction: 'rtl',
    textAlign: 'right',
    '&:focus': {
      outline: `2px solid ${colors.primary.main}`,
      outlineOffset: '2px'
    }
  },
  
  // Images
  img: {
    maxWidth: '100%',
    height: 'auto',
    display: 'block'
  },
  
  // Lists
  'ul, ol': {
    paddingRight: spacing.xl
  },
  
  // Focus visible (keyboard navigation)
  '*:focus-visible': {
    outline: `3px solid ${colors.primary.main}`,
    outlineOffset: '2px'
  },
  
  // Skip link (accessibility)
  '.skip-link': {
    position: 'absolute',
    top: '-40px',
    right: '0',
    backgroundColor: colors.primary.main,
    color: colors.primary.contrast,
    padding: spacing.md,
    textDecoration: 'none',
    zIndex: 10000,
    '&:focus': {
      top: '0'
    }
  },
  
  // Screen reader only
  '.sr-only': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: '0'
  },
  
  // Print styles
  '@media print': {
    '*': {
      background: 'transparent !important',
      color: '#000 !important',
      boxShadow: 'none !important',
      textShadow: 'none !important'
    },
    'a, a:visited': {
      textDecoration: 'underline'
    },
    'pre, blockquote': {
      border: '1px solid #999',
      pageBreakInside: 'avoid'
    },
    'thead': {
      display: 'table-header-group'
    },
    'tr, img': {
      pageBreakInside: 'avoid'
    },
    'img': {
      maxWidth: '100% !important'
    },
    '@page': {
      margin: '2cm'
    },
    'p, h2, h3': {
      orphans: 3,
      widows: 3
    },
    'h2, h3': {
      pageBreakAfter: 'avoid'
    }
  }
};
