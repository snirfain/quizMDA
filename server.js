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
import { getQuestions, postQuestions, syncQuestions, dedupeQuestions, recatalogAllQuestions, updateQuestion, deleteQuestion } from './server/questionApi.js';
import { listTranscripts, getTranscript, updateTranscript, deleteTranscript, uploadTranscript, uploadTranscriptMiddleware, matchAllQuestions, generateQuestionsFromTranscript, getGenerateQuestionsStatus } from './server/transcriptApi.js';
import { getUsers, postUser } from './server/userApi.js';

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
  app.put('/api/questions/:id', updateQuestion);
  app.delete('/api/questions/:id', deleteQuestion);
  app.get('/api/users', getUsers);
  app.post('/api/users', postUser);
  app.get('/api/transcripts', listTranscripts);
  app.post('/api/transcripts/upload', uploadTranscriptMiddleware, uploadTranscript);
  app.post('/api/transcripts/match-all', matchAllQuestions);
  app.post('/api/transcripts/generate-questions', generateQuestionsFromTranscript);
  app.get('/api/transcripts/generate-questions/status/:jobId', getGenerateQuestionsStatus);
  app.get('/api/transcripts/:id', getTranscript);
  app.put('/api/transcripts/:id', updateTranscript);
  app.delete('/api/transcripts/:id', deleteTranscript);
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

  app.listen(PORT, () => {
    console.log(`Server at http://localhost:${PORT} (includes .doc extraction and media upload)`);
  });
}

start();
