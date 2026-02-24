# Accessibility Guide
# מדריך נגישות

## Overview
מדריך נגישות למערכת למידה ותרגול מד"א. המערכת עומדת בתקן WCAG 2.1 Level AA.

## WCAG 2.1 AA Compliance

### 1. Perceivable (ניתן לתפיסה)

#### 1.1 Text Alternatives
- כל התמונות כוללות `alt` text
- תמונות דקורטיביות: `alt=""`
- תמונות מידע: `alt` תיאורי

#### 1.2 Time-based Media
- אין וידאו/אודיו במערכת כרגע
- בעתיד: captions, transcripts

#### 1.3 Adaptable
- שימוש ב-semantic HTML
- Headings hierarchy תקין (h1 → h2 → h3)
- Labels לכל form fields
- ARIA landmarks (header, nav, main, footer)

#### 1.4 Distinguishable
- Color contrast מינימלי 4.5:1 לטקסט רגיל
- Color contrast מינימלי 3:1 ל-UI components
- לא מסתמכים על צבע בלבד
- Focus indicators ברורים

### 2. Operable (ניתן להפעלה)

#### 2.1 Keyboard Accessible
- כל הפונקציונליות נגישה במקלדת
- Tab order לוגי
- Focus trap במודלים
- Keyboard shortcuts:
  - `Esc` - סגירת מודל/תפריט
  - `Tab` - ניווט קדימה
  - `Shift+Tab` - ניווט אחורה
  - `Enter/Space` - הפעלת כפתור
  - `/` - פוקוס על חיפוש

#### 2.2 Enough Time
- אין time limits במערכת
- Auto-save בטפסים

#### 2.3 Seizures and Physical Reactions
- אין אנימציות מהבהבות
- אפשרות להפחתת תנועה בהגדרות

#### 2.4 Navigable
- Skip links לתוכן ראשי
- Breadcrumbs
- Headings לניווט
- Focus order תקין

### 3. Understandable (מובן)

#### 3.1 Readable
- שפה מוגדרת: `lang="he"`
- Direction: `dir="rtl"`
- טקסט ברור ופשוט

#### 3.2 Predictable
- ניווט עקבי
- שינויים לא מתרחשים ללא אזהרה
- Labels עקביים

#### 3.3 Input Assistance
- Error messages ברורים
- Help text לשדות
- Validation בזמן אמת
- Required fields מסומנים

### 4. Robust (יציב)

#### 4.1 Compatible
- HTML תקין
- ARIA attributes תקינים
- תאימות screen readers

## Implementation

### ARIA Labels
כל הכפתורים והאלמנטים האינטראקטיביים כוללים `aria-label`:

```jsx
<button aria-label="סגור חלון">✕</button>
```

### Roles
שימוש ב-roles מתאימים:

```jsx
<nav role="navigation" aria-label="ניווט ראשי">
<main role="main" aria-label="תוכן ראשי">
<div role="dialog" aria-modal="true">
```

### Live Regions
התראות ל-screen readers:

```jsx
<div role="status" aria-live="polite">
<div role="alert" aria-live="assertive">
```

### Form Labels
כל שדות הטופס עם labels:

```jsx
<label htmlFor="username">שם משתמש</label>
<input id="username" aria-required="true" />
```

### Focus Management
- Focus trap במודלים
- Focus restoration אחרי סגירת מודל
- Visible focus indicators

### Keyboard Navigation
- כל האלמנטים נגישים במקלדת
- Tab order לוגי
- Keyboard shortcuts

### Screen Reader Support
- Semantic HTML
- ARIA attributes
- Live regions להתראות
- Descriptive link text

### Color Contrast
- מינימום 4.5:1 לטקסט רגיל
- מינימום 3:1 ל-UI components
- בדיקה עם כלים אוטומטיים

## Testing

### Automated Testing
- axe-core
- Lighthouse
- WAVE

### Manual Testing
- Keyboard navigation
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Color contrast checking
- Focus indicators

### Checklist
- [ ] כל הכפתורים עם aria-label
- [ ] כל הטופסים עם labels
- [ ] כל התמונות עם alt text
- [ ] Keyboard navigation מלא
- [ ] Focus indicators ברורים
- [ ] Color contrast תקין
- [ ] Screen reader support
- [ ] ARIA attributes תקינים
- [ ] Semantic HTML
- [ ] Skip links

## Utilities

### announce()
הכרזה ל-screen reader:

```javascript
import { announce } from '../utils/accessibility';
announce('פעולה הושלמה בהצלחה');
```

### announceError()
הכרזת שגיאה:

```javascript
announceError('שגיאה בהתחברות');
```

### focusElement()
פוקוס בטוח על אלמנט:

```javascript
import { focusElement } from '../utils/focusManagement';
focusElement(elementRef.current);
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
