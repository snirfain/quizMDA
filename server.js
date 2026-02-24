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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI).then(
    () => console.log('MongoDB connected'),
    (err) => console.error('MongoDB connection error:', err)
  );
} else {
  console.warn('MONGODB_URI not set; running without database');
}

app.post('/api/extract-doc', (req, res) => extractDocHandler(req, res));
app.post('/api/upload-media', uploadMiddleware, uploadMediaHandler);
app.use(express.static(path.join(__dirname, 'dist')));
app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Server at http://localhost:${PORT} (includes .doc extraction and media upload)`);
});
