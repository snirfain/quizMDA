/**
 * Production server: serves the built app, API routes, and MongoDB.
 * Run after build: npm run build && node server.js
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { extractDocHandler } from './server/docExtract.js';
import Question, { allocateSerials } from './models/Question.js';
import { uploadMiddleware, uploadMediaHandler } from './server/upload.js';
import { getQuestions, postQuestions, syncQuestions, dedupeQuestions, recatalogAllQuestions, assignSerials, updateQuestion, deleteQuestion } from './server/questionApi.js';
import { listTranscripts, getTranscript, updateTranscript, deleteTranscript, uploadTranscript, uploadTranscriptMiddleware, matchAllQuestions, generateQuestionsFromTranscript, getGenerateQuestionsStatus, startFixSpelling, getFixSpellingStatus } from './server/transcriptApi.js';
import { getUsers, postUser, setupUser, updateCourseNumbers, changeUserRole, setInstructorCourses, getUsersByCourse } from './server/userApi.js';
import { createReport, listReports, countPendingReports, reviewReport } from './server/reportApi.js';
import { submitContactForm } from './server/contactApi.js';

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
      // Backfill serial numbers for questions that don't have one
      try {
        const missing = await Question.find({ $or: [{ serial_number: null }, { serial_number: { $exists: false } }] })
          .sort({ createdAt: 1 }).select('_id').lean();
        if (missing.length > 0) {
          const firstSerial = await allocateSerials(missing.length);
          const ops = missing.map((doc, i) => ({
            updateOne: { filter: { _id: doc._id }, update: { $set: { serial_number: firstSerial + i } } }
          }));
          const BATCH = 500;
          for (let i = 0; i < ops.length; i += BATCH) {
            await Question.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
          }
          console.log(`[startup] Assigned serial numbers to ${missing.length} questions (${firstSerial}–${firstSerial + missing.length - 1})`);
        }
      } catch (serialErr) {
        console.warn('[startup] Serial backfill failed:', serialErr.message);
      }
    } catch (err) {
      console.error('MongoDB connection error:', err);
      console.warn('Server starting without database; /api/questions will return empty.');
    }
  } else {
    console.warn('MONGODB_URI not set; running without database');
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/extract-doc', (req, res) => extractDocHandler(req, res));
  app.post('/api/upload-media', uploadMiddleware, uploadMediaHandler);
  app.get('/api/questions', getQuestions);
  app.post('/api/questions', postQuestions);
  app.post('/api/questions/sync', syncQuestions);
  app.post('/api/questions/dedupe', dedupeQuestions);
  app.post('/api/questions/recatalog', recatalogAllQuestions);
  app.post('/api/questions/assign-serials', assignSerials);
  app.put('/api/questions/:id', updateQuestion);
  app.delete('/api/questions/:id', deleteQuestion);
  app.get('/api/users', getUsers);
  app.post('/api/users', postUser);
  app.post('/api/users/setup', setupUser);
  app.put('/api/users/:userId/course-numbers', updateCourseNumbers);
  app.put('/api/users/:userId/role', changeUserRole);
  app.put('/api/users/:userId/courses', setInstructorCourses);
  app.get('/api/users/by-course/:courseNumber', getUsersByCourse);
  app.post('/api/contact', submitContactForm);
  app.get('/api/reports/count', countPendingReports);
  app.get('/api/reports', listReports);
  app.post('/api/reports', createReport);
  app.put('/api/reports/:id/review', reviewReport);
  app.get('/api/transcripts', listTranscripts);
  app.post('/api/transcripts/upload', uploadTranscriptMiddleware, uploadTranscript);
  app.post('/api/transcripts/match-all', matchAllQuestions);
  app.post('/api/transcripts/fix-spelling', startFixSpelling);
  app.get('/api/transcripts/fix-spelling/status/:jobId', getFixSpellingStatus);
  app.post('/api/transcripts/generate-questions', generateQuestionsFromTranscript);
  app.get('/api/transcripts/generate-questions/status/:jobId', getGenerateQuestionsStatus);
  app.get('/api/transcripts/:id', getTranscript);
  app.put('/api/transcripts/:id', updateTranscript);
  app.delete('/api/transcripts/:id', deleteTranscript);
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

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
