# Component Documentation
# תיעוד קומפוננטות

## Overview
מערכת הקומפוננטות של מערכת למידה ותרגול מד"א.

## Layout Components

### MainLayout
Wrapper component לכל העמודים. כולל Navigation Bar, Breadcrumbs, Footer.

**Props:**
- `children` - תוכן העמוד
- `showBreadcrumbs` - האם להציג breadcrumbs (default: true)

**Usage:**
```jsx
<MainLayout>
  <YourPageContent />
</MainLayout>
```

### NavigationBar
סרגל ניווט ראשי עם תפריט לפי תפקיד.

**Props:**
- `onMenuToggle` - callback לפתיחת/סגירת תפריט מובייל

### Breadcrumbs
פירורי לחם לניווט.

**Props:**
- `currentPath` - נתיב נוכחי (optional)

## Form Components

### FormField
שדה טופס נגיש עם label, error, help text.

**Props:**
- `label` - תווית השדה
- `name` - שם השדה
- `type` - סוג השדה (text, password, textarea, etc.)
- `value` - ערך
- `onChange` - handler לשינוי
- `error` - הודעת שגיאה
- `helpText` - טקסט עזרה
- `required` - האם חובה
- `disabled` - האם מושבת

**Usage:**
```jsx
<FormField
  label="שם משתמש"
  name="username"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  required
  error={errors.username}
/>
```

## UI Components

### LoadingSpinner
ספינר טעינה.

**Props:**
- `size` - גודל (sm, md, lg)
- `fullScreen` - האם מסך מלא
- `message` - הודעה

**Exports:**
- `SkeletonLoader` - טעינה skeleton
- `ProgressBar` - פס התקדמות

### Modal
חלון מודאלי עם focus trap.

**Props:**
- `isOpen` - האם פתוח
- `onClose` - callback לסגירה
- `title` - כותרת
- `size` - גודל (sm, md, lg, xl, full)
- `showCloseButton` - האם להציג כפתור סגירה
- `ariaLabel` - תווית ARIA

### ConfirmDialog
דיאלוג אישור.

**Props:**
- `isOpen` - האם פתוח
- `onClose` - callback לסגירה
- `onConfirm` - callback לאישור
- `title` - כותרת
- `message` - הודעה
- `confirmText` - טקסט כפתור אישור
- `cancelText` - טקסט כפתור ביטול
- `danger` - האם כפתור סכנה

### Toast
התראות טוסט.

**Functions:**
- `showToast(message, type, duration)` - הצגת טוסט
- `ToastContainer` - קומפוננטה להצגת טוסטים

**Types:** success, error, warning, info

### SearchBar
חיפוש עם autocomplete.

**Props:**
- `onSearch` - callback לחיפוש
- `placeholder` - placeholder
- `autoFocus` - האם focus אוטומטי

## Permission Components

### PermissionGate
שער הרשאות - מציג/מסתיר תוכן לפי הרשאות.

**Props:**
- `permission` - הרשאה נדרשת
- `action` - פעולה
- `resource` - משאב
- `isOwner` - האם בעלים
- `fallback` - תוכן חלופי
- `showError` - האם להציג שגיאה

### AuthGuard
שמירה על נתיבים - מגן על routes לפי authentication.

**Props:**
- `children` - תוכן
- `route` - נתיב
- `fallback` - תוכן חלופי

## Practice Components

### TraineePracticeSession
מסך תרגול למתאמנים.

**Props:**
- `userId` - ID משתמש
- `onComplete` - callback לסיום

### QuestionNotes
הערות לשאלה.

**Props:**
- `questionId` - ID שאלה
- `onNoteChange` - callback לשינוי הערה

## Progress Components

### UserProgressDashboard
לוח התקדמות משתמש.

**Props:**
- `userId` - ID משתמש

### AchievementsPanel
פאנל הישגים.

**Props:**
- `userId` - ID משתמש

### Leaderboard
לוח מובילים.

**Props:**
- `timeframe` - תקופה (daily, weekly, all)

## Study Plans Components

### StudyPlanViewer
צפייה בתוכניות לימוד (מתאמנים).

### StudyPlanCard
כרטיס תוכנית לימוד.

**Props:**
- `plan` - תוכנית
- `isEnrolled` - האם רשום
- `progress` - התקדמות
- `onEnroll` - callback להרשמה
- `onView` - callback לצפייה

### StudyPlanManager
ניהול תוכניות לימוד (מדריכים).

## Instructor Components

### InstructorDashboard
לוח בקרה מדריך.

### InstructorAnalytics
אנליטיקה למדריכים.

### QuestionManagement
ניהול שאלות.

### QuestionEditor
עורך שאלות.

## Manager Components

### ManagerDashboard
לוח בקרה מנהל.

## Notification Components

### NotificationsPanel
פאנל התראות.

**Props:**
- `userId` - ID משתמש
- `onClose` - callback לסגירה

### NotificationItem
פריט התראה.

## Bookmark Components

### BookmarksList
רשימת סימניות.

## Error Components

### ErrorBoundary
Error boundary ל-React.

**Props:**
- `children` - תוכן
- `fallback` - תוכן חלופי בשגיאה

## Accessibility Components

### SkipLink
קישור דילוג לתוכן ראשי.

## Styling

כל הקומפוננטות משתמשות ב-Design System:
- `styles/designSystem.js` - tokens
- `styles/responsive.js` - כלי responsive
- `styles/globalStyles.js` - עיצוב גלובלי

## Best Practices

1. **Accessibility:** כל הקומפוננטות חייבות להיות נגישות (ARIA, keyboard nav)
2. **RTL:** כל הקומפוננטות תומכות RTL
3. **Responsive:** עיצוב mobile-first
4. **Error Handling:** טיפול בשגיאות בכל הקומפוננטות
5. **Loading States:** הצגת מצבי טעינה
6. **Semantic HTML:** שימוש ב-HTML סמנטי
