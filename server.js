/**
 * Production server: serves the built app, API routes, and MongoDB.
 * Run after build: npm run build && node server.js
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { extractDocHandler } from './server/docExtract.js';
import { uploadMiddleware, uploadMediaHandler } from './server/upload.js';
import { getQuestions, postQuestions, syncQuestions, dedupeQuestions, recatalogAllQuestions, updateQuestion, deleteQuestion, classifyThinkingLevel } from './server/questionApi.js';
import { listTranscripts, getTranscript, updateTranscript, deleteTranscript, uploadTranscript, uploadTranscriptMiddleware, matchAllQuestions, generateQuestionsFromTranscript, getGenerateQuestionsStatus, startFixSpelling, getFixSpellingStatus } from './server/transcriptApi.js';
import { getUsers, postUser, setupUser, updateCourseNumbers, changeUserRole, setInstructorCourses, getUsersByCourse, awardUserPoints } from './server/userApi.js';
import { createReport, listReports, countPendingReports, reviewReport } from './server/reportApi.js';
import { submitContactForm } from './server/contactApi.js';
import {
  activateProtocolVersion,
  ingestProtocolText,
  listProtocolVersions,
  retrieveProtocolContext,
} from './server/protocolContextApi.js';
import {
  classifyAgainstBook,
  clearBookCategory,
  getBookSummary,
  ingestBookContent,
  searchBookContent,
} from './server/bookContentApi.js';
import { listQuestionVersions, mergeMediaTags } from './server/questionApi.js';
import { submitExam } from './server/examApi.js';
import { requireAuth, requireRole, isAuthEnforced, createSession } from './server/authMiddleware.js';
import { recoverStuckJobs } from './server/transcriptApi.js';
import {
  createEcgSubmission,
  listEcgSubmissions,
  listMyEcgSubmissions,
  listEcgTags,
  reviewEcgSubmission,
} from './server/ecgApi.js';
import { getLeaderboard } from './server/leaderboardApi.js';
import { recordConsent } from './server/consentApi.js';
import {
  getTodayChallenge,
  getChallengeArchive,
  answerChallenge,
  listChallengesAdmin,
  upsertChallengeAdmin,
  deleteChallengeAdmin,
} from './server/challengeApi.js';
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  listScheduledPush,
  createScheduledPush,
  deleteScheduledPush,
  startPushCron,
  runDuePushes,
} from './server/pushApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Allow Google Identity Services (Sign In With Google) popups to postMessage
// back to the opener. Without this, Chrome logs "Cross-Origin-Opener-Policy
// policy would block the window.postMessage call" and can break the login popup.
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

const MONGODB_URI = process.env.MONGODB_URI;

// ── Global crash guards ─────────────────────────────────────────────
// Keep the process alive on stray errors so a single unhandled promise or
// exception never silently kills the server (critical on Render).
// מנגנון הגנה גלובלי: מונע מהשרת למות בגלל שגיאה לא מטופלת.
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception caught:', error);
});

async function start() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      console.log('✅ MongoDB connected / מסד הנתונים מחובר');
      // Any job stuck in pending/processing from a previous crash is marked failed.
      await recoverStuckJobs();
      // Deliver any scheduled pushes that came due while the server was down.
      await runDuePushes().catch((e) => console.error('[push] initial run failed:', e?.message || e));
    } catch (err) {
      // Never crash on DB failure — log loudly (he+en) so it is visible in Render logs
      // and keep serving the SPA + read-only endpoints.
      console.error('❌ MongoDB connection FAILED / החיבור למסד הנתונים נכשל');
      console.error('   message:', err?.message || err);
      console.error('   reason :', err?.reason || '(none)');
      console.warn('⚠️ Server is starting WITHOUT a database; data endpoints will be empty until DB recovers.');
      console.warn('⚠️ השרת עולה ללא מסד נתונים; נתיבי הנתונים יחזירו ריק עד שהחיבור יתוקן.');
    }
  } else {
    console.error('❌ MONGODB_URI is not set / משתנה הסביבה MONGODB_URI חסר');
    console.warn('⚠️ Running without database. Set MONGODB_URI in Render → Environment.');
  }

  console.log(`[auth] enforcement: ${isAuthEnforced() ? 'ON' : 'OFF (best-effort identity)'}`);

  // ── Public routes (no authentication) ──────────────────────────────
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/contact', submitContactForm);
  app.post('/api/auth/session', createSession);

  // ── Authenticated routes (any signed-in user) ──────────────────────
  app.get('/api/questions', requireAuth, getQuestions);
  // Login resolves the signed-in user's own record via this list, so it must be
  // reachable by any authenticated user (mutations below stay role-gated).
  app.get('/api/users', requireAuth, getUsers);
  app.post('/api/users', requireAuth, postUser);
  app.post('/api/users/setup', requireAuth, setupUser);
  app.post('/api/users/me/points', requireAuth, awardUserPoints);
  app.put('/api/users/:userId/course-numbers', requireAuth, updateCourseNumbers);
  app.post('/api/reports', requireAuth, createReport);
  app.post('/api/upload-media', requireAuth, uploadMiddleware, uploadMediaHandler);
  app.post('/api/exam/submit', requireAuth, submitExam);

  // National leaderboard (personal competition — any signed-in user)
  app.get('/api/leaderboard', requireAuth, getLeaderboard);

  // GDPR / TOS consent
  app.post('/api/users/consent', requireAuth, recordConsent);

  // ECG submission pipeline (trainee side)
  app.post('/api/ecg-submissions', requireAuth, createEcgSubmission);
  app.get('/api/ecg-submissions/mine', requireAuth, listMyEcgSubmissions);
  app.get('/api/ecg-submissions/tags', requireAuth, listEcgTags);

  // Daily challenges (trainee side)
  app.get('/api/challenges/today', requireAuth, getTodayChallenge);
  app.get('/api/challenges/archive', requireAuth, getChallengeArchive);
  app.post('/api/challenges/:date/answer', requireAuth, answerChallenge);

  // Web push — opt-in subscriptions
  app.get('/api/notifications/vapid-public-key', requireAuth, getVapidPublicKey);
  app.post('/api/notifications/subscribe', requireAuth, subscribePush);
  app.post('/api/notifications/unsubscribe', requireAuth, unsubscribePush);

  // ── Instructor and above ───────────────────────────────────────────
  app.post('/api/extract-doc', requireRole('instructor'), (req, res) => extractDocHandler(req, res));
  app.post('/api/media/merge-tags', requireRole('instructor'), mergeMediaTags);
  app.post('/api/questions', requireRole('instructor'), postQuestions);
  app.post('/api/questions/sync', requireRole('instructor'), syncQuestions);
  app.put('/api/questions/:id', requireRole('instructor'), updateQuestion);
  app.post('/api/questions/:id/classify-thinking-level', requireRole('instructor'), classifyThinkingLevel);
  app.get('/api/questions/:id/versions', requireRole('instructor'), listQuestionVersions);
  app.get('/api/users/by-course/:courseNumber', requireRole('instructor'), getUsersByCourse);
  app.get('/api/reports/count', requireRole('instructor'), countPendingReports);
  app.get('/api/reports', requireRole('instructor'), listReports);
  app.put('/api/reports/:id/review', requireRole('instructor'), reviewReport);
  app.get('/api/protocol-context/versions', requireRole('instructor'), listProtocolVersions);
  app.post('/api/protocol-context/ingest', requireRole('instructor'), ingestProtocolText);
  app.post('/api/protocol-context/activate', requireRole('instructor'), activateProtocolVersion);
  app.post('/api/protocol-context/retrieve', requireRole('instructor'), retrieveProtocolContext);

  // Book content knowledge base
  app.get('/api/book-content/summary', requireRole('instructor'), getBookSummary);
  app.post('/api/book-content/search', requireRole('instructor'), searchBookContent);
  app.post('/api/book-content/classify', requireRole('instructor'), classifyAgainstBook);

  // ECG review queue (instructor and above)
  app.get('/api/ecg-submissions', requireRole('instructor'), listEcgSubmissions);
  app.put('/api/ecg-submissions/:id/review', requireRole('instructor'), reviewEcgSubmission);

  // ── School staff and above ─────────────────────────────────────────
  app.delete('/api/questions/:id', requireRole('school_staff'), deleteQuestion);
  app.get('/api/transcripts', requireRole('school_staff'), listTranscripts);
  app.post('/api/transcripts/upload', requireRole('school_staff'), uploadTranscriptMiddleware, uploadTranscript);
  app.post('/api/transcripts/match-all', requireRole('school_staff'), matchAllQuestions);
  app.post('/api/transcripts/fix-spelling', requireRole('school_staff'), startFixSpelling);
  app.get('/api/transcripts/fix-spelling/status/:jobId', requireRole('school_staff'), getFixSpellingStatus);
  app.post('/api/transcripts/generate-questions', requireRole('school_staff'), generateQuestionsFromTranscript);
  app.post('/api/book-content/ingest', requireRole('school_staff'), ingestBookContent);
  app.get('/api/transcripts/generate-questions/status/:jobId', requireRole('school_staff'), getGenerateQuestionsStatus);
  app.get('/api/transcripts/:id', requireRole('school_staff'), getTranscript);
  app.put('/api/transcripts/:id', requireRole('school_staff'), updateTranscript);
  app.delete('/api/transcripts/:id', requireRole('school_staff'), deleteTranscript);

  // ── Manager and above ──────────────────────────────────────────────
  app.post('/api/questions/dedupe', requireRole('manager'), dedupeQuestions);
  app.post('/api/questions/recatalog', requireRole('manager'), recatalogAllQuestions);
  app.delete('/api/book-content/category', requireRole('manager'), clearBookCategory);
  app.put('/api/users/:userId/role', requireRole('manager'), changeUserRole);
  app.put('/api/users/:userId/courses', requireRole('manager'), setInstructorCourses);

  // Scheduled push management (manager and above)
  app.get('/api/notifications/scheduled', requireRole('manager'), listScheduledPush);
  app.post('/api/notifications/scheduled', requireRole('manager'), createScheduledPush);
  app.delete('/api/notifications/scheduled/:id', requireRole('manager'), deleteScheduledPush);

  // Challenge authoring (manager and above)
  app.get('/api/challenges/admin', requireRole('manager'), listChallengesAdmin);
  app.post('/api/challenges/admin', requireRole('manager'), upsertChallengeAdmin);
  app.delete('/api/challenges/admin/:id', requireRole('manager'), deleteChallengeAdmin);

  // ── Static assets + SPA catch-all ──────────────────────────────────
  const distDir = path.join(__dirname, 'dist');
  const indexHtml = path.join(distDir, 'index.html');
  app.use(express.static(distDir));

  // SPA fallback so deep links (e.g. /instructor/book-content) and hard
  // refreshes always return index.html and let the client router take over.
  //
  // IMPORTANT: under Express 5 (path-to-regexp v8) a literal `app.get('*', ...)`
  // THROWS at boot ("Missing parameter name") and crashes the server. A
  // method-guarded middleware is the safe, version-proof equivalent.
  app.use((req, res, next) => {
    // Only serve the SPA shell for navigations.
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // Unknown API routes must return JSON 404 — never the HTML shell.
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: `API route not found: ${req.path}` });
    }
    if (!fs.existsSync(indexHtml)) {
      console.error('❌ dist/index.html not found — did "npm run build" run? / קבצי ה-build חסרים.');
      return res
        .status(500)
        .send('Build artifacts missing. Run "npm run build". / חסרים קבצי build — הרץ build.');
    }
    return res.sendFile(indexHtml, (err) => {
      if (err && !res.headersSent) {
        console.error('[server] sendFile error / שגיאה בהגשת הדף:', err?.message || err);
        res.status(500).json({ error: 'שגיאה בהגשת הדף / failed to serve page' });
      }
    });
  });

  // ── Global error handler (Express 5 forwards rejected promises here) ─
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: err.message || 'שגיאת שרת פנימית' });
  });

  // ── Start listening (guarded) ──────────────────────────────────────
  const server = app.listen(PORT, () => {
    console.log(`✅ Server listening on http://localhost:${PORT} / השרת מאזין`);

    // Start the scheduled-push cron loop.
    startPushCron();

    // Keep-alive: ping ourselves every 14 minutes to prevent Render free-tier cold starts
    if (process.env.RENDER) {
      const KEEP_ALIVE_MS = 14 * 60 * 1000;
      setInterval(() => {
        fetch(`http://localhost:${PORT}/api/health`).catch(() => {});
      }, KEEP_ALIVE_MS);
      console.log('Keep-alive enabled (every 14 min)');
    }
  });

  // app.listen failures (e.g. port in use) emit 'error' rather than throwing.
  server.on('error', (err) => {
    console.error('💥 HTTP server failed to start / האזנת השרת נכשלה:', err?.message || err);
  });
}

// Wrap boot so any synchronous/async failure is logged loudly (he+en) instead
// of dying silently in Render's logs.
start().catch((err) => {
  console.error('💥 Fatal error during boot / שגיאה קריטית בעליית השרת:', err?.message || err);
  console.error(err?.stack || '');
});
