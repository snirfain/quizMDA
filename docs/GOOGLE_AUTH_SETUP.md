# הגדרת התחברות עם Google

## שלב 1: יצירת Google OAuth Credentials

1. עבור ל-[Google Cloud Console](https://console.cloud.google.com/)
2. בחר או צור פרויקט חדש
3. עבור ל-**APIs & Services** > **Credentials**
4. לחץ על **Create Credentials** > **OAuth client ID**
5. אם זו הפעם הראשונה, תצטרך להגדיר את **OAuth consent screen**:
   - בחר **External** (או Internal אם יש לך Google Workspace)
   - מלא את הפרטים הבסיסיים:
     - App name: `מערכת למידה ותרגול מד"א`
     - User support email: האימייל שלך
     - Developer contact: האימייל שלך
   - לחץ **Save and Continue**
   - ב-**Scopes**, לחץ **Add or Remove Scopes** והוסף:
     - `email`
     - `profile`
     - `openid`
   - לחץ **Save and Continue**
   - ב-**Test users**, הוסף את האימיילים של המשתמשים שיבדקו (אם במצב Testing)
   - לחץ **Save and Continue**

6. חזור ל-**Credentials** ויצור **OAuth client ID**:
   - Application type: **Web application**
   - Name: `MDA Learning Platform`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (לפיתוח)
     - `https://yourdomain.com` (לייצור)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/auth/google/callback` (לפיתוח)
     - `https://yourdomain.com/auth/google/callback` (לייצור)
   - לחץ **Create**

7. העתק את ה-**Client ID** (נראה כמו: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)

## שלב 2: הגדרת המשתנה בסביבה

1. צור קובץ `.env` בתיקיית הפרויקט (או העתק מ-`.env.example`)
2. הוסף את ה-Client ID:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

3. שמור את הקובץ

## שלב 3: הפעלה מחדש של השרת

אם השרת כבר רץ, עצור אותו והפעל מחדש:

```bash
npm run dev
```

## שלב 4: בדיקה

1. פתח את הדפדפן ונווט לעמוד ההתחברות
2. לחץ על כפתור "Sign in with Google"
3. בחר חשבון Google והתחבר
4. המערכת תיצור משתמש חדש או תתחבר למשתמש קיים לפי האימייל

## פתרון בעיות

### כפתור Google לא מופיע
- ודא שה-Client ID מוגדר נכון ב-`.env`
- ודא שהשרת הופעל מחדש לאחר הוספת המשתנה
- בדוק את ה-Console בדפדפן לשגיאות

### שגיאת "redirect_uri_mismatch"
- ודא שה-URI ב-**Authorized redirect URIs** תואם בדיוק ל-URL של האפליקציה
- ודא שה-URI מתחיל ב-`http://` או `https://` (לא `http://localhost` בלבד)

### שגיאת "access_denied"
- אם האפליקציה במצב Testing, ודא שהאימייל נוסף ל-**Test users**
- או שנה את מצב האפליקציה ל-**In production** (דורש אימות)

## הערות אבטחה

- **אל תפרסם את ה-Client ID בקוד** - הוא כבר מוגדר ב-`.env` שלא נכנס ל-git
- בייצור, ודא שה-`.env` לא נכנס ל-git (כבר מוגדר ב-`.gitignore`)
- עבור ייצור, מומלץ לאמת את ה-token בצד השרת (backend) ולא רק בצד הלקוח
