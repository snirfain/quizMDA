#!/usr/bin/env node
import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { parseUnnumberedBlocks } from '../utils/questionParser.js';

async function extract(path) {
  const buf = await readFile(path);
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || '';
}

const paths = process.argv.slice(2).filter(Boolean);
if (paths.length === 0) {
  console.error('Usage: node scripts/test-unnumbered.mjs <file1.docx> [file2.docx]');
  process.exit(1);
}

for (const p of paths) {
  const text = await extract(p);
  const questions = parseUnnumberedBlocks(text);
  console.log(p);
  console.log('  Parsed questions:', questions.length);
  if (questions.length > 0) {
    console.log('  First question text:', questions[0].question_text?.slice(0, 80) + '...');
    console.log('  First options count:', questions[0].options?.length);
  }
}
