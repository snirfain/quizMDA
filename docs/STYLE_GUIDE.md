# Style Guide
# מדריך עיצוב

## Overview
מדריך עיצוב למערכת למידה ותרגול מד"א. כולל Design System, patterns, ו-best practices.

## Design System

### Colors

#### Primary Colors
```javascript
primary: {
  main: '#2196F3',    // כחול ראשי
  light: '#64B5F6',   // כחול בהיר
  dark: '#1976D2',    // כחול כהה
  contrast: '#FFFFFF'  // לבן לניגודיות
}
```

#### Status Colors
```javascript
success: '#4CAF50'   // ירוק
error: '#f44336'     // אדום
warning: '#ff9800'   // כתום
info: '#2196F3'      // כחול
```

#### Neutral Colors
```javascript
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
}
```

### Typography

#### Font Families
- Primary: Arial, Helvetica, sans-serif
- Hebrew: Arial Hebrew, Arial, Helvetica, sans-serif
- Mono: Courier New, monospace

#### Font Sizes
```javascript
xs: '10px'
sm: '12px'
base: '14px'
md: '16px'
lg: '18px'
xl: '20px'
'2xl': '24px'
'3xl': '28px'
'4xl': '32px'
'5xl': '36px'
```

#### Font Weights
- light: 300
- normal: 400
- medium: 500
- semibold: 600
- bold: 700

### Spacing

```javascript
xs: '4px'
sm: '8px'
md: '12px'
lg: '16px'
xl: '20px'
'2xl': '24px'
'3xl': '32px'
'4xl': '40px'
'5xl': '48px'
'6xl': '64px'
```

### Breakpoints

```javascript
xs: 0
sm: 576px
md: 768px
lg: 992px
xl: 1200px
'2xl': 1400px
```

### Shadows

```javascript
sm: '0 1px 2px rgba(0,0,0,0.05)'
md: '0 2px 4px rgba(0,0,0,0.1)'
lg: '0 4px 8px rgba(0,0,0,0.15)'
xl: '0 8px 16px rgba(0,0,0,0.2)'
'2xl': '0 16px 32px rgba(0,0,0,0.25)'
```

### Border Radius

```javascript
none: '0'
sm: '4px'
md: '8px'
lg: '12px'
xl: '16px'
full: '9999px'
```

### Z-Index

```javascript
dropdown: 1000
sticky: 1020
fixed: 1030
modalBackdrop: 1040
modal: 1050
popover: 1060
tooltip: 1070
```

## Responsive Design

### Mobile-First Approach
כל העיצוב מתחיל מ-mobile ומתרחב ל-desktop.

### Media Queries
```javascript
// Mobile only
@media (max-width: 767px) { }

// Tablet and up
@media (min-width: 768px) { }

// Desktop
@media (min-width: 992px) { }
```

### Utilities
```javascript
import { isMobile, isTablet, isDesktop } from '../styles/responsive';
```

## RTL Support

### Direction
כל הקומפוננטות עם `dir="rtl"`:

```jsx
<div dir="rtl" style={{ textAlign: 'right' }}>
```

### Text Alignment
- טקסט: `textAlign: 'right'`
- מספרים: `direction: 'ltr'` (במידת הצורך)

## Component Patterns

### Buttons

#### Primary Button
```jsx
<button style={{
  padding: '12px 24px',
  backgroundColor: '#2196F3',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer'
}}>
  כפתור
</button>
```

#### Secondary Button
```jsx
<button style={{
  padding: '12px 24px',
  backgroundColor: '#FFFFFF',
  color: '#212121',
  border: '1px solid #e0e0e0',
  borderRadius: '4px'
}}>
  כפתור משני
</button>
```

### Cards
```jsx
<div style={{
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  padding: '24px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
}}>
  תוכן
</div>
```

### Forms
- Labels מעל שדות
- Error messages מתחת שדות
- Help text מתחת labels
- Required indicator: `*`

### Modals
- Focus trap
- Backdrop עם opacity
- Close on Escape
- Close button בפינה

## Accessibility

### Focus Indicators
```css
&:focus {
  outline: '2px solid #2196F3',
  outlineOffset: '2px',
  borderRadius: '2px'
}
```

### Color Contrast
- מינימום 4.5:1 לטקסט רגיל
- מינימום 3:1 ל-UI components

### ARIA Labels
כל אלמנט אינטראקטיבי עם `aria-label`:

```jsx
<button aria-label="סגור חלון">✕</button>
```

## Animation

### Transitions
```javascript
fast: '150ms ease-in-out'
normal: '250ms ease-in-out'
slow: '350ms ease-in-out'
```

### Animations
- Fade in/out
- Slide up/down
- Smooth transitions

## Best Practices

1. **Consistency:** שימוש ב-Design System
2. **Responsive:** Mobile-first
3. **Accessibility:** WCAG 2.1 AA
4. **Performance:** אופטימיזציה
5. **RTL:** תמיכה מלאה
6. **Semantic HTML:** HTML סמנטי
7. **Error Handling:** טיפול בשגיאות
8. **Loading States:** מצבי טעינה

## Usage Examples

### Import Design System
```javascript
import { colors, typography, spacing } from '../styles/designSystem';
```

### Responsive Utilities
```javascript
import { isMobile, mediaQuery } from '../styles/responsive';
```

### Global Styles
```javascript
import { globalStyles } from '../styles/globalStyles';
```
