/**
 * Production server: serves the built app, API routes, and MongoDB.
 * Run after build: npm run build && node server.js
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { extractDocHandler } from './server/docExtract.js';
import { uploadMiddleware, uploadMediaHandler } from './server/upload.js';
import { getQuestions, postQuestions, syncQuestions, dedupeQuestions, recatalogAllQuestions, updateQuestion, deleteQuestion, classifyThinkingLevel } from './server/questionApi.js';
import { listTranscripts, getTranscript, updateTranscript, deleteTranscript, uploadTranscript, uploadTranscriptMiddleware, matchAllQuestions, generateQuestionsFromTranscript, getGenerateQuestionsStatus, startFixSpelling, getFixSpellingStatus } from './server/transcriptApi.js';
import { getUsers, postUser, setupUser, updateCourseNumbers, changeUserRole, setInstructorCourses, getUsersByCourse } from './server/userApi.js';
import { createReport, listReports, countPendingReports, reviewReport } from './server/reportApi.js';
import { submitContactForm } from './server/contactApi.js';
import {
  activateProtocolVersion,
  ingestProtocolText,
  listProtocolVersions,
  retrieveProtocolContext,
} from './server/protocolContextApi.js';
import { listQuestionVersions, mergeMediaTags } from './server/questionApi.js';
import { submitExam } from './server/examApi.js';
import { requireAuth, requireRole, isAuthEnforced } from './server/authMiddleware.js';
import { recoverStuckJobs } from './server/transcriptApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB connected');
      // Any job stuck in pending/processing from a previous crash is marked failed.
      await recoverStuckJobs();
    } catch (err) {
      console.error('MongoDB connection error:', err);
      console.warn('Server starting without database; /api/questions will return empty.');
    }
  } else {
    console.warn('MONGODB_URI not set; running without database');
  }

  console.log(`[auth] enforcement: ${isAuthEnforced() ? 'ON' : 'OFF (best-effort identity)'}`);

  // ── Public routes (no authentication) ──────────────────────────────
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/contact', submitContactForm);

  // ── Authenticated routes (any signed-in user) ──────────────────────
  app.get('/api/questions', requireAuth, getQuestions);
  // Login resolves the signed-in user's own record via this list, so it must be
  // reachable by any authenticated user (mutations below stay role-gated).
  app.get('/api/users', requireAuth, getUsers);
  app.post('/api/users', requireAuth, postUser);
  app.post('/api/users/setup', requireAuth, setupUser);
  app.put('/api/users/:userId/course-numbers', requireAuth, updateCourseNumbers);
  app.post('/api/reports', requireAuth, createReport);
  app.post('/api/upload-media', requireAuth, uploadMiddleware, uploadMediaHandler);
  app.post('/api/exam/submit', requireAuth, submitExam);

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

  // ── School staff and above ─────────────────────────────────────────
  app.delete('/api/questions/:id', requireRole('school_staff'), deleteQuestion);
  app.get('/api/transcripts', requireRole('school_staff'), listTranscripts);
  app.post('/api/transcripts/upload', requireRole('school_staff'), uploadTranscriptMiddleware, uploadTranscript);
  app.post('/api/transcripts/match-all', requireRole('school_staff'), matchAllQuestions);
  app.post('/api/transcripts/fix-spelling', requireRole('school_staff'), startFixSpelling);
  app.get('/api/transcripts/fix-spelling/status/:jobId', requireRole('school_staff'), getFixSpellingStatus);
  app.post('/api/transcripts/generate-questions', requireRole('school_staff'), generateQuestionsFromTranscript);
  app.get('/api/transcripts/generate-questions/status/:jobId', requireRole('school_staff'), getGenerateQuestionsStatus);
  app.get('/api/transcripts/:id', requireRole('school_staff'), getTranscript);
  app.put('/api/transcripts/:id', requireRole('school_staff'), updateTranscript);
  app.delete('/api/transcripts/:id', requireRole('school_staff'), deleteTranscript);

  // ── Manager and above ──────────────────────────────────────────────
  app.post('/api/questions/dedupe', requireRole('manager'), dedupeQuestions);
  app.post('/api/questions/recatalog', requireRole('manager'), recatalogAllQuestions);
  app.put('/api/users/:userId/role', requireRole('manager'), changeUserRole);
  app.put('/api/users/:userId/courses', requireRole('manager'), setInstructorCourses);

  // ── Static SPA + catch-all (public) ────────────────────────────────
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

  // ── Global error handler (Express 5 forwards rejected promises here) ─
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: err.message || 'שגיאת שרת פנימית' });
  });

  app.listen(PORT, () => {
    console.log(`Server at http://localhost:${PORT} (includes .doc extraction and media upload)`);

    // Keep-alive: ping ourselves every 14 minutes to prevent Render free-tier cold starts
    if (process.env.RENDER) {
      const KEEP_ALIVE_MS = 14 * 60 * 1000;
      setInterval(() => {
        fetch(`http://localhost:${PORT}/api/health`).catch(() => {});
      }, KEEP_ALIVE_MS);
      console.log('Keep-alive enabled (every 14 min)');
    }
  });
}

start();
