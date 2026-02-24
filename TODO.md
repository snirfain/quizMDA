# רשימת משימות לביצוע
## TODO List

## עדיפות גבוהה

### 1. TagFilter Component (Phase 3.5)
- [ ] `components/TagFilter.jsx` - קומפוננטה לסנן שאלות לפי תגיות
- [ ] שילוב ב-QuestionManagement ו-TraineeDashboard
- [ ] תמיכה בתגיות מרובות

### 2. שיפורי נגישות (Phase 4.4)
- [ ] הוספת ARIA labels לכל הקומפוננטות החסרות
- [ ] שיפור Keyboard navigation
- [ ] שיפור Screen reader support
- [ ] בדיקת WCAG 2.1 AA compliance מלא

### 3. שיפורי ביצועים (Phase 4.5)
- [ ] בדיקה ויישום של `utils/cache.js`
- [ ] בדיקה ויישום של `utils/lazyLoad.js`
- [ ] Query optimization - בדיקת ביצועים של שאילתות
- [ ] Code splitting מתקדם

## עדיפות בינונית

### 4. מצב לא מקוון (Phase 3.1)
- [ ] `utils/offlineStorage.js` - אחסון מקומי
- [ ] `utils/serviceWorker.js` - Service Worker לזיכרון מטמון
- [ ] `components/OfflineIndicator.jsx` - אינדיקטור מצב לא מקוון
- [ ] תמיכה בתרגול לא מקוון

### 5. גרסאות שאלות (Phase 3.3)
- [ ] `entities/Question_Versions.js` - Entity לגרסאות
- [ ] `workflows/questionVersioning.js` - לוגיקת גרסאות
- [ ] שיפור `components/QuestionVersionHistory.jsx` - היסטוריית גרסאות מלאה
- [ ] אפשרות לחזור לגרסה קודמת

### 6. Workflows חסרים
- [ ] `workflows/mockExam.js` - Workflow ייעודי לבחינה מדומה
- [ ] `workflows/dataImportExport.js` - Workflow ייעודי לייבוא/ייצוא

## עדיפות נמוכה

### 7. Testing Infrastructure (Phase 4.1)
- [ ] Unit tests מלאים לכל ה-workflows
- [ ] Integration tests ל-workflows
- [ ] E2E tests לזרימות עיקריות
- [ ] בדיקות נגישות אוטומטיות

### 8. שיפורים נוספים
- [ ] PDF export מתקדם (כרגע יש רק הכנה)
- [ ] Analytics מתקדמים
- [ ] דוחות מותאמים אישית
- [ ] אינטגרציה עם מערכות חיצוניות

## הערות

### מה שכבר קיים ופועל:
✅ **מערכת ניהול הרשאות** - `components/PermissionManagement.jsx` + `utils/permissions.js`
✅ **מערכת הכנסת שאלות ידנית** - `components/QuestionEditor.jsx` (יצירה ועריכה)
✅ **מערכת מחיקת שאלות** - `components/QuestionManagement.jsx` (מחיקה יחידה ומרובה)
✅ **מערכת העלאת שאלות מקובץ** - `components/QuestionImport.jsx` + `workflows/questionImport.js` (CSV/JSON)

### מה שצריך לבדוק/לשפר:
- [ ] בדיקה שכל הפונקציונליות עובדת כמו שצריך
- [ ] בדיקת אינטגרציה בין הקומפוננטות
- [ ] בדיקת ביצועים עם כמות גדולה של שאלות
- [ ] בדיקת נגישות מלאה
