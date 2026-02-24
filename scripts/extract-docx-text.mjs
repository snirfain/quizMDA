#!/usr/bin/env node
/**
 * One-off: extract raw text from DOCX using mammoth (same as app).
 * Usage: node scripts/extract-docx-text.mjs <path1.docx> [path2.docx]
 * Output: prints to stdout (or use > file.txt)
 */
import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';

async function extract(path) {
  const buf = await readFile(path);
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || '';
}

const paths = process.argv.slice(2).filter(Boolean);
if (paths.length === 0) {
  console.error('Usage: node scripts/extract-docx-text.mjs <file1.docx> [file2.docx]');
  process.exit(1);
}

for (const p of paths) {
  console.log('\n\n=== FILE:', p, '===\n');
  try {
    const text = await extract(p);
    console.log('Length:', text.length);
    console.log('First 2500 chars:\n', text.slice(0, 2500));
    if (text.length > 2500) console.log('\n... [truncated]\n');
  } catch (e) {
    console.error('Error:', e.message);
  }
}
