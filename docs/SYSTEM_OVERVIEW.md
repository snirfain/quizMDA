# quizMDA — מסמך יכולות ומאפיינים מלא

> **מטרת המסמך:** העברת הקשר מלא למודל/מפתח אחר לסיום בניית המערכת.  
> **שם הפרויקט:** quiz-mda (MDA Adaptive Learning & Assessment Platform)  
> **גרסה:** 1.0.0  
> **שפה/כיוון:** עברית, RTL  
> **Stack:** React 18 + Vite (SPA) · Express 5 · MongoDB (Mongoose) · localStorage cache

---

## תוכן עניינים

1. [סקירה כללית](#1-סקירה-כללית)
2. [מסלולים (Routes) וקישורים](#2-מסלולים-routes-וקישורים)
3. [תפקידים והרשאות (RBAC)](#3-תפקידים-והרשאות-rbac)
4. [יכולות לפי תפקיד](#4-יכולות-לפי-תפקיד)
5. [בנק שאלות — סוגים, שדות וולידציה](#5-בנק-שאלות--סוגים-שדות-וולידציה)
6. [שאלות מתגלגלות (Rolling Case)](#6-שאלות-מתגלגלות-rolling-case)
7. [בינה מלאכותית (LLM)](#7-בינה-מלאכותית-llm)
8. [RAG — ספר פרוטוקולים ALS](#8-rag--ספר-פרוטוקולים-als)
9. [ייבוא וייצוא נתונים](#9-ייבוא-וייצוא-נתונים)
10. [מדיה](#10-מדיה)
11. [תמלילים (Transcripts)](#11-תמלילים-transcripts)
12. [מבחנים ותרגול](#12-מבחנים-ותרגול)
13. [API — כל נקודות הקצה](#13-api--כל-נקודות-הקצה)
14. [מודלים וישויות נתונים](#14-מודלים-וישויות-נתונים)
15. [אינטגרציות חיצוניות](#15-אינטגרציות-חיצוניות)
16. [משתני סביבה](#16-משתני-סביבה)
17. [מפת קבצים לפי פיצ'ר](#17-מפת-קבצים-לפי-פיצר)
18. [מצב נוכחי / נקודות לסיום](#18-מצב-נוכחי--נקודות-לסיום)

---

## 1. סקירה כללית

מערכת למידה והערכה למגן דוד אדום (מד"א) — בנק שאלות, תרגול אדפטיבי, מבחנים, ניהול תוכן, אנליטיקה, ואינטגרציית AI.

**ארכיטקטורה:**
- **Frontend:** React SPA עם router מותאם (`utils/router.js`, לא React Router)
- **Backend:** Express ב-`server.js` — ב-production מגיש גם את `dist/`
- **DB:** MongoDB — מקור האמת לשאלות, משתמשים, דיווחים, תמלילים, chunks פרוטוקול
- **Cache:** `mockEntities.js` — localStorage + sync מ-`/api/questions` בעת עלייה
- **Dev:** `npm run dev:full` — שרת על `:3001`, Vite על `:3000` עם proxy ל-`/api`

**קבצי כניסה:**
| קובץ | תפקיד |
|------|--------|
| `main.jsx` | Bootstrap, sync שאלות, Service Worker |
| `App.jsx` | Routing, AuthGuard, lazy loading |
| `server.js` | Express + static + כל ה-API |
| `config/appConfig.js` | תצורה מרכזית, roles, LLM, admin emails |

---

## 2. מסלולים (Routes) וקישורים

הגדרה: `utils/router.js` · ניווט: `components/MainLayout.jsx` · הגנת auth: `components/AuthGuard.jsx`

### מסלולים ציבוריים

| URL | דף | קובץ |
|-----|-----|------|
| `/` | דף בית | `pages/HomePage.jsx` |
| `/login` | התחברות | `pages/LoginPage.jsx` |
| `/help` | עזרה | `pages/HelpPage.jsx` |
| `/404` | לא נמצא | `pages/NotFoundPage.jsx` |
| `/unauthorized` | אין הרשאה | `pages/UnauthorizedPage.jsx` |

### מסלולים למשתמש מחובר

| URL | דף | תפקידים | קובץ |
|-----|-----|---------|------|
| `/setup` | הגדרת קורס ראשונית | כולם | `components/CourseSetup.jsx` |
| `/practice` | תרגול | trainee+ | `pages/TraineeDashboard.jsx` |
| `/progress` | התקדמות | כולם | `components/UserProgressDashboard.jsx` |
| `/study-plans` | תוכניות לימוד | trainee בלבד | `components/StudyPlanViewer.jsx` |
| `/bookmarks` | סימניות והערות | כולם | `components/BookmarksList.jsx` |
| `/mock-exam` | מבחן מדמה | trainee בלבד | `components/MockExam.jsx` |
| `/settings` | הגדרות | כולם | `pages/SettingsPage.jsx` |
| `/profile` | פרופיל | כולם | `pages/ProfilePage.jsx` |

### מסלולי מדריך / צוות / מנהל

| URL | דף | תפקידים | קובץ |
|-----|-----|---------|------|
| `/instructor` | מחולל מבחנים | instructor+ | `pages/InstructorDashboard.jsx` |
| `/instructor/questions` | ניהול שאלות | instructor+ | `components/QuestionManagement.jsx` |
| `/instructor/study-plans` | ניהול תוכניות לימוד | instructor+ | `components/StudyPlanManager.jsx` |
| `/instructor/analytics` | אנליטיקת מדריך | instructor+ | `components/InstructorAnalytics.jsx` |
| `/instructor/media-bank` | מאגר מדיה | instructor+ | `components/MediaBankManager.jsx` |
| `/instructor/transcripts` | העלאת תמלילים | school_staff+ | `components/TranscriptUpload.jsx` |
| `/manager` | לוח בקרה מנהל | manager, admin | `pages/ManagerDashboardPage.jsx` |
| `/admin/data-import-export` | ייבוא/ייצוא | manager, admin | `components/DataImportExport.jsx` |

### לוח מנהל — טאבים פנימיים (אותו URL `/manager`)

| טאב | תוכן | קובץ |
|-----|------|------|
| שאלות מושעות | שאלות עם אחוז הצלחה נמוך / under_review | `components/ManagerDashboard.jsx` |
| סטטיסטיקות | סטטיסטיקות מערכת | `components/AdminStatistics.jsx` |
| ניהול הרשאות | שינוי תפקידים | `components/PermissionManagement.jsx` |
| ניהול שאלות | QuestionManagement מוטמע | `components/QuestionManagement.jsx` |
| ייבוא/ייצוא | DataImportExport מוטמע | `components/DataImportExport.jsx` |

### ניהול שאלות — טאבים פנימיים (`/instructor/questions`)

| טאב | תוכן |
|-----|------|
| list | רשימת שאלות, CRUD, סינון, bulk, תצוגה מקדימה, AI fix |
| import | ייבוא קבצים + LLM |
| review | אישור שאלות ממתינות |
| reports | דיווחי משתמשים על שאלות |
| protocols | ניהול גרסאות ספר פרוטוקולים ALS |

---

## 3. תפקידים והרשאות (RBAC)

**היררכיה:** `admin (5) > manager (4) > school_staff (3) > instructor (2) > trainee (1)`

| תפקיד | ערך | תיאור |
|-------|-----|--------|
| מתאמן | `trainee` | תרגול, מבחנים, התקדמות |
| מדריך | `instructor` | ניהול שאלות (מוגבל), מחולל מבחנים |
| צוות בית ספר | `school_staff` | + מחיקה, אישור, תמלילים |
| מנהל | `manager` | + לוח בקרה, סטטיסטיקות, הרשאות, ייבוא/ייצוא |
| מנהל מערכת | `admin` | הרשאות מלאות |

**קבצים:** `utils/permissions.js`, `components/PermissionGate.jsx`, `config/appConfig.js` (adminEmails)

**התחברות:** Google Sign-In (`components/GoogleSignIn.jsx`, `workflows/googleAuth.js`) — JWT client-side decode, upsert ל-`/api/users`

---

## 4. יכולות לפי תפקיד

### מתאמן (Trainee)

- **תרגול אדפטיבי** — עדיפות לטעויות ושאלות חדשות (`workflows/adaptivePracticeEngine.js`)
- **בניית מבחן חופשי** — לפי קטגוריה, רמת קושי, זמן → ניווט ל-`/mock-exam`
- **מבחן מדמה** — טיימר, ניווט שאלות, תמיכה בשאלות מתגלגלות (`components/MockExam.jsx`)
- **תוצאות מבחן** — ציון, יחידות ניקוד, breakdown ל-rolling case (`components/ExamResults.jsx`)
- **התקדמות אישית** — סטטיסטיקות, גרפים (`components/UserProgressDashboard.jsx`)
- **תוכניות לימוד** — הרשמה ומעקב (`components/StudyPlanViewer.jsx`)
- **סימניות והערות** (`components/BookmarksList.jsx`)
- **דיווח על בעיה בשאלה** (`components/QuestionReportModal.jsx` → `POST /api/reports`)
- **בדיקת שאלות פתוחות** — LLM + הקשר פרוטוקול (`workflows/openEndedValidation.js`)
- **גיימיפיקציה** — נקודות, streaks, achievements (`workflows/gamification.js`)
- **עבודה offline** — `utils/offlineStorage.js`, `components/OfflineIndicator.jsx`
- **נגישות** — `components/FloatingAccessibilityButton.jsx`
- **טופס יצירת קשר** — `components/FloatingContactButton.jsx`

### מדריך (Instructor)

- **מחולל מבחנים** — בחירת שאלות, ייצוא (`components/TestGenerator.jsx`)
- **ניהול שאלות** — יצירה/עריכה, סינון, תצוגה מקדימה, AI fix (ללא מחיקה/אישור מלא)
- **ניהול תוכניות לימוד** (`components/StudyPlanManager.jsx`)
- **אנליטיקה** — ביצועי כיתה, שאלות בעייתיות (`components/InstructorAnalytics.jsx`)
- **מאגר מדיה** — תגיות, העלאה (`components/MediaBankManager.jsx`)

### צוות בית ספר (School Staff)

- כל יכולות המדריך +
- **מחיקת שאלות**, **אישור/דחייה**, **השעיה/הפעלה**
- **העלאת תמלילים SRT** + יצירת שאלות מ-AI (`components/TranscriptUpload.jsx`)

### מנהל / Admin

- **לוח בקרה** — שאלות מושעות, under_review (`components/ManagerDashboard.jsx`)
- **סטטיסטיקות מערכת** (`components/AdminStatistics.jsx`)
- **ניהול הרשאות ותפקידים** (`components/PermissionManagement.jsx`)
- **ייבוא/ייצוא bulk** (`components/DataImportExport.jsx`)
- **סנכרון/ניקוי כפילויות/recatalog** — מתוך QuestionManagement

---

## 5. בנק שאלות — סוגים, שדות וולידציה

**מקור אמת למטא-דאטה:** `shared/questionBankMetadata.js`  
**סכמת DB:** `models/Question.js`  
**סכמת UI entity:** `entities/Question_Bank.js`  
**API:** `server/questionApi.js`

### סוגי שאלה

| סוג | ערך | תיאור |
|-----|-----|--------|
| רב ברירה — אחת | `single_choice` | אפשרויות + `{ value: "0" }` |
| רב ברירה — כמה | `multi_choice` | `{ values: ["0","2"] }` |
| נכון/לא נכון | `true_false` | `"true"` / `"false"` |
| שאלה פתוחה | `open_ended` | בדיקה ב-LLM |
| שאלה מתגלגלת | `rolling_case` | גזע + ענפים + flow |

### שדות עיקריים

| שדה | תיאור |
|-----|--------|
| `question_text` | טקסט השאלה / גזע המקרה |
| `question_type` | סוג השאלה |
| `options` | מערך `{ value, label }` — ריק ל-rolling_case |
| `correct_answer` | Mixed JSON — null ל-rolling_case |
| `explanation` | הסבר |
| `hint` | רמז |
| `category` | פרק (28 פרקים מספר הספר) |
| `sub_category` | תת-קטגוריה |
| `thinking_level` | Knowledge / Understanding / Application / Synthesis |
| `training_level` | A–E |
| `medical_levels` | multiselect: ALS, BLS, CLS, DLS, ELS |
| `status` | active / under_review / draft |
| `media_attachment` | URL סטטי או `{ url, type, name }` |
| `media_bank_tag` | תג למedia אקראי ממאגר |
| `has_media` | computed |
| `case_name` | שם מקרה (rolling_case) |
| `rolling_case` | מבנה ענפים + transitions |
| `suspended_due_to_branch` | סיבת השעיה בגלל ענף |
| `total_attempts`, `total_success`, `success_rate` | סטטיסטיקות |

### מנוע איכות

- אחרי ≥50 ניסיונות, אחוז הצלחה <50% → `under_review` (`workflows/difficultyEngine.js`)
- סף השעיה: `config/appConfig.js`

### UI ניהול שאלות — יכולות

- חיפוש + סינון (סטטוס, סוג, קטגוריה, רמות)
- הרחבת שורה — כל פרטי השאלה + מסיחים / מבנה rolling
- **תצוגה מקדימה** — popup כמו שהתלמיד רואה (`Modal` + `QuestionResolvedMedia`)
- **עריכה** — `components/QuestionEditor.jsx`
- **תקן עם AI** — `workflows/questionEnrich.js`
- **כתיבה מחדש bulk** — AI rewrite
- **סיווג thinking_level** — `POST /api/questions/:id/classify-thinking-level`
- **Bulk:** שינוי סטטוס, קטגוריה, מחיקה
- **Sync / Dedupe / Recatalog** — API

---

## 6. שאלות מתגלגלות (Rolling Case)

**מנוע:** `workflows/rollingCaseEngine.js`  
**UI עריכה:** `components/QuestionEditor.jsx` (עורך flow)  
**Runtime:** `components/MockExam.jsx`, `components/TraineePracticeSession.jsx`

### מבנה

```json
{
  "case_name": "שם מקרה ייחודי",
  "question_text": "גזע — תיאור מקרה בלבד (טקסט/מדיה)",
  "rolling_case": {
    "branches": [
      {
        "id": "b1",
        "question_type": "single_choice|multi_choice|true_false",
        "question_text": "...",
        "options": [{ "value": "0", "label": "..." }],
        "correct_answer": { "value": "0" },
        "explanation": "..."
      }
    ],
    "transitions": [
      {
        "from_branch_id": "b1",
        "to_branch_id": "b2",
        "priority": 1,
        "condition": { "mode": "always|is_correct|is_incorrect|answer_equals|score_gte|...", "value": "..." }
      }
    ]
  }
}
```

### כללים

- 3–10 ענפים
- רמת branching אחת בלבד
- אין לולאות (DAG validation)
- אין חזרה לאחור ב-runtime
- כל ענף = יחידת ניקוד נפרדת
- multi_choice — ציון חלקי לפי התאמה
- זמן מבחן: זמן_שאלה_רגילה × מספר_ענפים
- גזע השאלה **לא ניתן לשינוי** ב-AI generation (נעול ב-UI ובפרומפט)
- AI generation: `generateRollingCaseWithAI()` ב-`workflows/questionEnrich.js`
- פרסום ברמת מקרה — `suspended_due_to_branch` אם ענף בעייתי

### תנאי מעבר (modes)

`always`, `is_correct`, `is_incorrect`, `answer_equals`, `answer_includes`, `score_gte`, `score_lt`, `score_between`

---

## 7. בינה מלאכותית (LLM)

**ספק נוכחי:** OpenAI בלבד (`config/appConfig.js` → `llm.providers: ['openai']`)  
**לקוח:** `workflows/llmClient.js`  
**מודל ברירת מחדל:** `gpt-4o-mini` (env: `OPENAI_MODEL`)

### שימושים

| שימוש | קובץ |
|-------|------|
| ייבוא וניתוח קבצים (LLM-first) | `workflows/questionImport.js` |
| נרmalize + validate אחרי import | `workflows/questionImport.js` |
| יצירת מסיחים | `workflows/questionEnrich.js` |
| זיהוי תשובה נכונה | `workflows/questionEnrich.js` |
| תיקון שאלה (Fix with AI) | `workflows/questionEnrich.js` |
| יצירת rolling case מלא | `workflows/questionEnrich.js` |
| בדיקת שאלה פתוחה | `workflows/openEndedValidation.js` |
| סיווג thinking_level (server) | `server/questionApi.js` |
| יצירת שאלות מתמליל | `server/transcriptApi.js` |
| תיקון איות בתמליל | `server/transcriptApi.js` |

### Pipeline ייבוא (LLM-first)

1. חילוץ טקסט (PDF/DOCX/TXT/CSV/JSON/XLSX)
2. נרmalization + chunking חכם
3. שליחה ל-LLM עם פרומפט JSON
4. הזרקת הקשר פרוטוקול (RAG)
5. retry על פלט לא תקין
6. dedup (Jaccard ≥0.80) — `workflows/questionDeduplication.js`
7. enrich אופציונלי
8. `POST /api/questions`

**UI:** `components/QuestionImport.jsx`

---

## 8. RAG — ספר פרוטוקולים ALS

**מטרה:** וידוא מינונים, פרוטוקולים, תרופות מול ספר ALS רשמי

| שכבה | קובץ |
|------|------|
| Chunk model | `models/ProtocolChunk.js` |
| Signal extraction + token budget | `shared/protocolContext.js` |
| Client wrapper | `workflows/protocolContext.js` |
| Server API | `server/protocolContextApi.js` |
| Admin UI | טאב "protocols" ב-`QuestionManagement.jsx` |

### API

- `GET /api/protocol-context/versions` — רשימת גרסאות
- `POST /api/protocol-context/ingest` — ingest PDF/טקסט → chunks
- `POST /api/protocol-context/activate` — הפעלת גרסה
- `POST /api/protocol-context/retrieve` — שליפת context לשאלה

### שדות chunk

`source_doc`, `chapter`, `protocol_name`, `drug_name`, `aliases`, `chunk_text`, `version`, `effective_date`, `priority`, `is_active_version`, `source_page_start/end`

### שימוש ב-LLM

- import, enrich, validate, classify thinking_level, open-ended, rolling case generation

---

## 9. ייבוא וייצוא נתונים

### ייבוא שאלות

| פורמט | מנגנון | קובץ |
|-------|--------|------|
| טקסט חופשי | Regex + LLM | `workflows/questionImport.js` |
| `.docx` | mammoth | `extractTextFromDocx()` |
| `.doc` | word-extractor / API | `server/docExtract.js` |
| `.pdf` | pdfjs-dist | `extractTextFromPDF()` |
| `.txt` | FileReader | `extractTextFromFile()` |
| `.csv` | parseCSV + LLM | `importQuestionsFromCSV()` |
| `.json` | parseJSON + LLM | `importQuestionsFromJSON()` |
| `.xlsx` (Moodle) | xlsx + LLM | `importQuestionsFromMoodleExcel()` |

**UI:** `components/QuestionImport.jsx` (טאב import ב-QuestionManagement)

### ייצוא

| פורמט | קובץ |
|-------|------|
| CSV | `components/DataImportExport.jsx` |
| JSON | `components/DataImportExport.jsx` |
| Excel (.xlsx) | `components/DataImportExport.jsx` |
| מבחן (instructor) | `workflows/testGenerator.js` |

**שדות ייצוא כוללים:** `medical_levels`, `case_name`, `rolling_case`, `media_bank_tag`

---

## 10. מדיה

- **העלאה:** `POST /api/upload-media` → Cloudinary (`server/upload.js`)
- **קובץ סטטי:** `media_attachment` (URL / object)
- **מאגר מדיה:** `media_bank_tag` — בחירה אקראית לפי תג (`workflows/mediaEngine.js`)
- **הצגה:** `components/QuestionResolvedMedia.jsx`
- **ניהול:** `components/MediaBankManager.jsx`
- **כלל:** attachment ו-bank_tag בלעדיים זה לזה

---

## 11. תמלילים (Transcripts)

**UI:** `components/TranscriptUpload.jsx` (school_staff+)  
**Backend:** `server/transcriptApi.js`, `models/Transcript.js`

- העלאת SRT
- התאמת שאלות לתמליל
- תיקון איות (job async)
- יצירת שאלות מ-AI מתמליל (job async)
- CRUD תמלילים

---

## 12. מבחנים ותרגול

| רכיב | קובץ | תיאור |
|------|------|--------|
| תרגול אדפטיבי | `pages/TraineeDashboard.jsx` | בחירת נושא, session |
| Session | `components/TraineePracticeSession.jsx` | תשובות, feedback, rolling |
| מבחן | `components/MockExam.jsx` | טיימר, nav, scoring |
| תוצאות | `components/ExamResults.jsx` | ציון, review, rolling breakdown |
| מחולל | `components/TestGenerator.jsx` | בחירה + export |
| Engine | `workflows/testGenerator.js` | effective units (rolling = branches count) |
| Adaptive | `workflows/adaptivePracticeEngine.js` | mistake prioritization |

**ניווט למבחן:** `history.state` — `preGeneratedQuestions`, `examSpec`, filters, timer

---

## 13. API — כל נקודות הקצה

**Base:** `/api` · **Health:** `GET /api/health`

### שאלות

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/questions` | רשימה (skip/limit, header `X-QuizMDA-Db-Connected`) |
| POST | `/api/questions` | יצירה |
| PUT | `/api/questions/:id` | עדכון (partial/full) |
| DELETE | `/api/questions/:id` | מחיקה |
| POST | `/api/questions/sync` | bulk sync (dedup by text) |
| POST | `/api/questions/dedupe` | ניקוי כפילויות DB |
| POST | `/api/questions/recatalog` | recatalog (no-op כיום) |
| POST | `/api/questions/:id/classify-thinking-level` | AI classification |

### משתמשים

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/users` | רשימה |
| POST | `/api/users` | upsert |
| POST | `/api/users/setup` | הגדרת קורס ראשונית |
| PUT | `/api/users/:userId/role` | שינוי תפקיד |
| PUT | `/api/users/:userId/course-numbers` | עדכון מספרי קורס |
| PUT | `/api/users/:userId/courses` | קורסי מדריך |
| GET | `/api/users/by-course/:courseNumber` | מתאמנים לפי קורס |

### דיווחים

| Method | Path | תיאור |
|--------|------|--------|
| GET | `/api/reports/count` | ספירת pending |
| GET | `/api/reports` | רשימה |
| POST | `/api/reports` | יצירת דיווח |
| PUT | `/api/reports/:id/review` | אישור/דחייה |

### תמלילים

| Method | Path |
|--------|------|
| GET | `/api/transcripts` |
| POST | `/api/transcripts/upload` |
| GET | `/api/transcripts/:id` |
| PUT | `/api/transcripts/:id` |
| DELETE | `/api/transcripts/:id` |
| POST | `/api/transcripts/match-all` |
| POST | `/api/transcripts/fix-spelling` |
| GET | `/api/transcripts/fix-spelling/status/:jobId` |
| POST | `/api/transcripts/generate-questions` |
| GET | `/api/transcripts/generate-questions/status/:jobId` |

### פרוטוקול (RAG)

| Method | Path |
|--------|------|
| GET | `/api/protocol-context/versions` |
| POST | `/api/protocol-context/ingest` |
| POST | `/api/protocol-context/activate` |
| POST | `/api/protocol-context/retrieve` |

### אחר

| Method | Path | תיאור |
|--------|------|--------|
| POST | `/api/upload-media` | Cloudinary |
| POST | `/api/extract-doc` | חילוץ .doc |
| POST | `/api/contact` | טופס יצירת קשר (Resend) |

---

## 14. מודלים וישויות נתונים

### MongoDB (`models/`)

| Model | קובץ |
|-------|------|
| Question | `models/Question.js` |
| User | `models/User.js` |
| ProtocolChunk | `models/ProtocolChunk.js` |
| Transcript | `models/Transcript.js` |
| QuestionReport | `models/QuestionReport.js` |
| ContactMessage | `models/ContactMessage.js` |

### Client entities (`entities/`)

Question_Bank, Users, Activity_Log, Content_Hierarchy, Study_Plans, Study_Plan_Enrollments, User_Notes, Notifications, Achievements, Question_Versions

### Cache layer

`mockEntities.js` — localStorage + API sync  
**חשוב:** שמירת שאלות חייבת לעבור API — אין fallback שקט ל-local בלבד (תוקן)

---

## 15. אינטגרציות חיצוניות

| שירות | שימוש | Env vars |
|-------|-------|----------|
| MongoDB | DB ראשי | `MONGODB_URI` |
| Google OAuth | Sign-In | `VITE_GOOGLE_CLIENT_ID` |
| OpenAI | כל LLM | `VITE_OPENAI_API_KEY`, `OPENAI_MODEL` |
| Cloudinary | מדיה | `CLOUDINARY_*` |
| Resend | אימייל contact | `RESEND_API_KEY` |
| Render | keep-alive ping | `RENDER` |
| MDA Bot (legacy) | validation | `VITE_MDA_BOT_API_*` |

---

## 16. משתני סביבה

ראה `.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/quizmda
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
VITE_GOOGLE_CLIENT_ID=
VITE_OPENAI_API_KEY=
VITE_MDA_BOT_API_URL=
VITE_MDA_BOT_API_KEY=
```

**פקודות:**
```bash
npm run dev:full   # dev — Vite :3000 + API :3001
npm run build      # build frontend
npm run serve      # production server
npm run db:reset   # reset DB script
```

---

## 17. מפת קבצים לפי פיצ'ר

| פיצ'ר | קבצים עיקריים |
|-------|----------------|
| Routing | `utils/router.js`, `App.jsx`, `components/AuthGuard.jsx` |
| Auth | `pages/LoginPage.jsx`, `workflows/googleAuth.js`, `utils/auth.js` |
| שאלות CRUD | `components/QuestionManagement.jsx`, `components/QuestionEditor.jsx`, `server/questionApi.js` |
| Import LLM | `components/QuestionImport.jsx`, `workflows/questionImport.js` |
| Enrich/Fix AI | `workflows/questionEnrich.js`, `workflows/llmClient.js` |
| Rolling case | `workflows/rollingCaseEngine.js` |
| Protocol RAG | `shared/protocolContext.js`, `workflows/protocolContext.js`, `server/protocolContextApi.js` |
| Mock exam | `components/MockExam.jsx`, `components/ExamResults.jsx` |
| Test generator | `components/TestGenerator.jsx`, `workflows/testGenerator.js` |
| Analytics | `components/InstructorAnalytics.jsx`, `components/AdminStatistics.jsx` |
| Manager | `pages/ManagerDashboardPage.jsx`, `components/ManagerDashboard.jsx` |
| Media | `components/MediaBankManager.jsx`, `workflows/mediaEngine.js`, `server/upload.js` |
| Transcripts | `components/TranscriptUpload.jsx`, `server/transcriptApi.js` |
| Metadata | `shared/questionBankMetadata.js`, `utils/questionValidation.js` |
| Permissions | `utils/permissions.js`, `components/PermissionGate.jsx` |
| Data layer | `mockEntities.js`, `config/appConfig.js` |
| Offline | `utils/offlineStorage.js`, `utils/serviceWorker.js` |
| Accessibility | `utils/accessibility.js`, `styles/accessibility.css` |

---

## 18. מצב נוכחי / נקודות לסיום

### מה כבר מיושם

- [x] בנק שאלות מלא עם 5 סוגי שאלות
- [x] שאלות מתגלגלות — עריכה, validation, runtime, scoring
- [x] LLM-first import לכל סוגי הקבצים
- [x] RAG פרוטוקולים ALS
- [x] OpenAI-only (Gemini הוסר)
- [x] medical_levels multiselect
- [x] תצוגה מקדימה לשאלה (popup)
- [x] תיקון שמירה — rolling_case לא שולח options ריקות
- [x] תיקון persistence — אין fallback שקט ל-localStorage
- [x] גזע rolling case נעול — AI לא משנה question_text

### ידוע / לשיפור

- [ ] תצוגת preview ל-rolling_case — כרגע מציגה כל הענפים; אפשר לשדרג ל-flow sequential כמו MockExam
- [ ] analytics ל-rolling case — top 5 paths (מוגדר באפיון, לוודא השלמה)
- [ ] dedicated rolling case practice mode (מוגדר באפיון)
- [ ] PUT/DELETE עם local IDs (`q...`) — רק POST מחזיר MongoDB ObjectId אמיתי
- [ ] Question_Versions — mock בלבד
- [ ] recatalog API — no-op
- [ ] בדיקות אוטומטיות — אין test suite משמעותי
- [ ] תיעוד API (Swagger/OpenAPI) — לא קיים

### קבצים ששונו לאחרונה (rolling case + persistence)

- `components/QuestionManagement.jsx` — תצוגה מורחבת, preview popup
- `components/QuestionEditor.jsx` — rolling editor, AI gen, stem lock, options fix
- `workflows/questionEnrich.js` — generateRollingCaseWithAI + stem lock
- `workflows/rollingCaseEngine.js` — validation + scoring
- `mockEntities.js` — persistence strict (throw on API fail)
- `server/questionApi.js` — rolling_case validation
- `models/Question.js` — schema rolling_case, medical_levels

---

## נספח: מבנה שאלה (JSON ל-AI)

```json
{
  "question_type": "single_choice",
  "question_text": "טקסט השאלה",
  "category": "4. החולה הנשימתי",
  "sub_category": "פגיעות נוספות בדרכי הנשימה",
  "thinking_level": "Application",
  "training_level": "A",
  "medical_levels": ["ALS", "BLS"],
  "status": "active",
  "options": [
    { "value": "0", "label": "אפשרות א" },
    { "value": "1", "label": "אפשרות ב" }
  ],
  "correct_answer": { "value": "0" },
  "explanation": "הסבר",
  "hint": "רמז",
  "media_attachment": null,
  "media_bank_tag": null,
  "case_name": "",
  "rolling_case": null
}
```

---

*מסמך זה נוצר לצורך handoff. עדכון אחרון: מאי 2026.*
