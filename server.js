/**
 * Production server: serves the built app and provides /api/extract-doc for .doc files.
 * Run after build: npm run build && node server.js
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractDocHandler } from './server/docExtract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.post('/api/extract-doc', (req, res) => extractDocHandler(req, res));
app.use(express.static(path.join(__dirname, 'dist')));
app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Server at http://localhost:${PORT} (includes .doc extraction)`);
});
