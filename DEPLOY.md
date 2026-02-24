# הכנת הקבצים והעלאה לשרת

מדריך קצר להכנת הפרויקט להעלאה (ללא צורך בהכרת קוד).

---

## דרישות מוקדמות

- **Node.js** מותקן במחשב ([nodejs.org](https://nodejs.org)).
- הפרויקט מותקן: בטרמינל בתיקיית הפרויקט הרץ `npm install`.

---

## משתני סביבה

1. העתק את הקובץ `.env.example` לקובץ בשם `.env` (או צור קובץ `.env` והדבק לתוכו את התוכן).
2. מלא ערכים:
   - **VITE_GOOGLE_CLIENT_ID** — חובה להפעלת התחברות Google אחרי ההעלאה. הערך מתקבל מ-Google Cloud Console (OAuth 2.0 Client ID).
   - **VITE_OPENAI_API_KEY** — אופציונלי. נדרש רק אם תרצה לנתח שאלות מקבצים עם בינה מלאכותית; אם לא תמלא — ניתוח "מהיר" (ללא AI) ימשיך לעבוד.
3. בהעלאה ל-Netlify / Vercel וכו': הגדר את אותם משתנים בממשק ההעלאה (Environment Variables), לא רק בקובץ `.env` מקומי.

---

## בניית הפרויקט (Build)

בטרמינל, בתיקיית הפרויקט:

```bash
npm run build
```

- אחרי ההרצה נוצרת תיקייה בשם **dist** עם כל הקבצים המוכנים להעלאה.
- אם יש שגיאות — תקן אותן לפני ההעלאה.

---

## העלאה סטטית (Netlify / Vercel)

### הגדרות Build בפלטפורמה

- **Build command:** `npm run build`
- **Publish directory / Output directory:** `dist`
- **Environment variables:** הוסף בממשק:
  - `VITE_GOOGLE_CLIENT_ID` (חובה)
  - `VITE_OPENAI_API_KEY` (אופציונלי)

### Netlify

1. התחבר ל-[netlify.com](https://www.netlify.com).
2. "Add new site" → "Import an existing project" (או "Deploy manually").
3. אם מחובר ל-Git: הגדר Build command ו-Publish directory above, והוסף את משתני הסביבה.
4. אם Deploy manual: אחרי `npm run build` גרור את תיקיית **dist** לחלון ההעלאה.

### Vercel

1. התחבר ל-[vercel.com](https://vercel.com).
2. "New Project" → חבר את ריפו או העלה קבצים.
3. Framework Preset: Vite (לרוב מזוהה אוטומטית).
4. Build: `npm run build`, Output: `dist`.
5. הוסף Environment Variables כמו למעלה.

---

## Google Sign-In אחרי ההעלאה

כדי שהתחברות עם Google תעבוד באתר החי:

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com).
2. בחר את הפרויקט → **APIs & Services** → **Credentials**.
3. פתח את ה-**OAuth 2.0 Client ID** שבו אתה משתמש (סוג "Web application").
4. תחת **Authorized JavaScript origins** הוסף את כתובת האתר המלאה, למשל:
   - `https://your-site.netlify.app`
   - או `https://your-domain.com`
5. שמור. עדכן את ההגדרות רק עם הכתובת הסופית שקיבלת אחרי ההעלאה.

---

## הערה: קבצי Word ישנים (.doc)

- תמיכה בהעלאת קבצי **.doc** (Word 97–2003) דורשת שרת שמריץ את ה-API לחילוץ טקסט (למשל `node server.js`).
- בהעלאה **סטטית בלבד** (רק תיקיית `dist` ב-Netlify/Vercel וכו') — לא יהיה API כזה, ולכן העלאת .doc לא תעבוד.
- אפשר להעלות קבצי **.docx**, **.pdf** ו-**.txt** כרגיל; לקבצי .doc יש להמיר ל-.docx או להריץ את הפרויקט עם `npm run serve` בשרת שמגיש גם את `server.js`.

---

## סיכום

| שלב | פעולה |
|-----|--------|
| 1 | התקן Node, הרץ `npm install` |
| 2 | צור `.env` מהדוגמה, מלא `VITE_GOOGLE_CLIENT_ID` |
| 3 | הרץ `npm run build` |
| 4 | העלה את תוכן `dist` (או חבר Git והגדר build + env בפלטפורמה) |
| 5 | ב-Google Console הוסף את כתובת האתר כ-Authorized JavaScript origin |
