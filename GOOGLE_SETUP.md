# הגדרת Google Sign-In

## מה כבר הוגדר:


3. ✅ קומפוננטת Google Sign-In נוספה לדף ההתחברות
4. ✅ Workflow לאימות Google
5. ✅ עדכון ה-Users entity לתמוך ב-Google auth

## מה צריך לעשות ב-Google Cloud Console:

1. **הוסף Authorized JavaScript origins:**
   - עבור ל-[Google Cloud Console](https://console.cloud.google.com/)
   - בחר את הפרויקט שלך
   - עבור ל-APIs & Services > Credentials
   - לחץ על ה-OAuth 2.0 Client ID שלך
   - ב-"Authorized JavaScript origins" הוסף:
     - `http://localhost:3000`
     - `http://localhost:5173` (אם משתמש ב-Vite dev server)
     - את ה-URL של הפרודקשן שלך

2. **הוסף Authorized redirect URIs:**
   - ב-"Authorized redirect URIs" הוסף:
     - `http://localhost:3000/auth/google/callback`
     - את ה-URL של הפרודקשן שלך + `/auth/google/callback`

## איך זה עובד:

1. המשתמש לוחץ על כפתור "Sign in with Google"
2. Google מציג את מסך ההתחברות
3. לאחר התחברות, Google מחזיר JWT token
4. המערכת מאמתת את ה-token ויוצרת/מעדכנת משתמש
5. המשתמש מועבר לדשבורד המתאים לו

## הערות חשובות:

- **Client Secret** לא נדרש בצד הלקוח - הוא משמש רק בצד השרת
- ב-production, יש לאמת את ה-JWT token בצד השרת (לא רק decode)
- ה-Client ID כבר מוגדר ב-`config/appConfig.js` וב-`.env`

## בדיקה:

1. הרץ את המערכת: `npm run dev`
2. עבור לדף ההתחברות
3. לחץ על כפתור Google Sign-In
4. התחבר עם חשבון Google שלך
5. המערכת אמורה ליצור משתמש חדש או להתחבר למשתמש קיים
