/**
 * Server-side handler: extract text from .doc (Word 97-2003) files.
 * Used by Vite dev middleware and optional production server.
 */
import formidable from 'formidable';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WordExtractor = require('word-extractor');

export async function extractDocHandler(req, res) {
  const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
  let [fields, files] = await form.parse(req);
  const file = files?.file?.[0] ?? files?.file;
  if (!file?.filepath) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'No file uploaded' }));
    return;
  }
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(file.filepath);
    const text = doc.getBody() || '';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message || 'Extraction failed' }));
  } finally {
    try {
      if (file?.filepath && fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);
    } catch (_) {}
  }
}
