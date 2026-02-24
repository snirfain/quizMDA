/**
 * Question Import Workflow
 * Import questions from CSV/JSON/Text/Word/PDF files
 * Hebrew: ייבוא שאלות
 */

import { entities, appConfig } from '../config/appConfig';
import { validateQuestion } from '../utils/questionValidation';
import { parseTextQuestions, parseUnnumberedBlocks } from '../utils/questionParser';
import {
  detectEnrichmentType,
  enrichQuestion,
  ENRICH_NONE,
  ENRICH_GENERATE,
  ENRICH_IDENTIFY_ANSWER,
} from './questionEnrich';
import {
  checkDuplicatesAgainstDB,
  checkInternalDuplicates,
} from './questionDeduplication';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// File text extraction
// ─────────────────────────────────────────────

/**
 * Extract plain text from a Word (.docx) file using mammoth
 */
export async function extractTextFromDocx(file) {
  const { default: mammoth } = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/**
 * Extract plain text from a PDF file using pdfjs-dist
 */
// pdfjs VerbosityLevel.ERRORS = 0  (suppress font warnings like "TT: undefined function")
const PDFJS_VERBOSITY_ERRORS = 0;

export async function extractTextFromPDF(file) {
  const pdfjsLib = await import('pdfjs-dist');

  // Use local worker via Vite ?url import (works with pdfjs-dist v5.x which ships .mjs workers)
  const workerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();

  // Create a PDFWorker with verbosity=0 so the worker thread itself suppresses TT font warnings
  let worker = null;
  try {
    worker = new pdfjsLib.PDFWorker({ verbosity: PDFJS_VERBOSITY_ERRORS });
  } catch (_) {
    // PDFWorker constructor not available in this build — fall back to default worker
  }

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    ...(worker ? { worker } : {}),
    verbosity: PDFJS_VERBOSITY_ERRORS,
  });

  const pdf = await loadingTask.promise;

  let fullText = '';
  let hasEOLCount = 0;
  let itemCount = 0;
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    let pageText = '';
    for (const item of textContent.items) {
      if (!item.str) continue;
      itemCount++;
      if (item.hasEOL) hasEOLCount++;
      pageText += item.str;
      pageText += item.hasEOL ? '\n' : ' ';
    }
    fullText += pageText.trimEnd() + '\n';
  }

  // #region agent log
  if (import.meta.env.DEV) fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H1',location:'questionImport.js:extractTextFromPDF',message:'hasEOL stats',data:{hasEOLCount,itemCount,totalChars:fullText.length,lineCount:fullText.split('\n').length,sampleFirstLine:fullText.split('\n')[0]?.slice(0,150)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (worker) worker.destroy();
  return fullText;
}

/**
 * Extract text from .doc (Word 97-2003) via server API (word-extractor).
 * Returns text or throws if API unavailable or extraction fails.
 */
async function extractTextFromDocViaApi(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/extract-doc', { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `שגיאה ${res.status}`);
  if (typeof data.text !== 'string') throw new Error('לא התקבל טקסט מהשרת');
  return data.text;
}

/**
 * Extract text from any supported file (PDF / DOCX / DOC / TXT)
 */
export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf'))  return extractTextFromPDF(file);
  if (name.endsWith('.docx')) return extractTextFromDocx(file);
  if (name.endsWith('.doc')) {
    try {
      return await extractTextFromDocViaApi(file);
    } catch (_) {
      try {
        return await extractTextFromDocx(file);
      } catch (err) {
        if (err?.message?.includes('zip') || err?.message?.includes('central directory') || err?.message?.includes('docx') || err?.message?.includes('body element')) {
          throw new Error('קובץ .doc (Word ישן) לא נתמך. שמור ב-Word כ־"שמור בשם" → Word Document (.docx) ונסה שוב.');
        }
        throw err;
      }
    }
  }
  if (name.endsWith('.txt'))  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsText(file, 'utf-8');
  });
  throw new Error(`סוג קובץ לא נתמך: ${name}`);
}

// ─────────────────────────────────────────────
// AI-based parsing via OpenAI  (optimized)
// ─────────────────────────────────────────────

// Smaller chunks → output never truncated; parallel batches → speed
const CHUNK_MAX_CHARS = 5000;    // ~15-20 questions per chunk → safe within max_tokens
const PARALLEL_BATCH  = 8;       // more parallel calls to compensate for more chunks

// ── JSON repair / parse helpers ──────────────────────────────

function repairJsonString(str) {
  return str
    .replace(/,(\s*[}\]])/g, '$1')          // trailing commas
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // unquoted keys (rare)
}

function parseQuestionsJson(content) {
  // Strip markdown fences if present
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const jsonMatch = stripped.match(/\[[\s\S]*\]/);
  // #region agent log
  if (import.meta.env.DEV && !jsonMatch) fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H3',location:'questionImport.js:parseQuestionsJson',message:'no JSON array in content',data:{strippedLen:stripped.length,strippedPreview:stripped.slice(0,400)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!jsonMatch) return [];

  let raw = jsonMatch[0];

  // 1. Direct parse
  try { return JSON.parse(raw); } catch (_) {}

  // 2. Repair then parse
  try { return JSON.parse(repairJsonString(raw)); } catch (_) {}

  // 3. Progressive scan — salvage completed objects before a truncation point
  let depth = 0, inStr = false, esc = false, lastGood = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (esc)            { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true;  continue; }
    if (inStr)          { if (c === '"') inStr = false; continue; }
    if (c === '"')      { inStr = true;  continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') { depth--; if (depth === 0) lastGood = i + 1; }
  }
  if (lastGood > 1) {
    try { return JSON.parse(raw.slice(0, lastGood)); } catch (_) {}
  }
  // #region agent log
  if (import.meta.env.DEV) fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H5',location:'questionImport.js:parseQuestionsJson',message:'parse and salvage failed',data:{rawLen:raw.length,rawPreview:raw.slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return [];
}

// ── Smart chunking — robust section-aware splitting ──────────
//
// PROBLEM: pdfjs extracts "1 . text" (number SPACE period) not "1. text".
//          Each topic section restarts numbering from 1, so naive chunking
//          sends multiple sections in one call and the AI gets confused.
//
// SOLUTION:
//   1. Detect question boundaries with a regex that handles "1 . text" AND "1. text".
//   2. Detect topic-section headers and insert a mandatory flush at each one.
//   3. Flush a chunk whenever it would exceed CHUNK_MAX_CHARS.
//   4. Guaranteed fallback: plain character-based slicing if nothing is detected.

/**
 * Matches question-start lines: "1. text", "1 . text", "(1)", "1-", "2.1.", "שאלה 1", "Question 1"
 */
const Q_LINE_RE = /^\d{1,3}(\.\d+)?\s*[.):\-]\s*[\u05D0-\u05FFa-zA-Z]|^\(\s*\d+\s*\)\s*[\u05D0-\u05FFa-zA-Z]|^\s*שאלה\s*[\d.)\s]*[\u05D0-\u05FFa-zA-Z]|^\s*question\s*\d*\s*[\u05D0-\u05FFa-zA-Z]/i;

/** Global pattern to find question-start positions (fallback when line-based detection finds nothing). */
const Q_START_GLOBAL_RE = /(?:^|\n)\s*(?:\d{1,3}(\.\d+)?\s*[.):\-]|\(\s*\d+\s*\)\s*|שאלה\s*[\d.)\s]*|question\s*\d*\s*)[\u05D0-\u05FFa-zA-Z]/gi;

/**
 * Returns true if a trimmed line looks like a topic-section header:
 *   - Has Hebrew content
 *   - Does NOT start with a digit (question number)
 *   - Does NOT start with an answer option letter followed by . or ) (א. ב. etc.)
 *   - Does NOT contain fill-in-blank markers
 *   - Is short enough to be a title
 *   - Is followed by "1." within the next 15 lines (new section start)
 */
function isSectionHeader(trimmed, allLines, fromIdx) {
  if (!trimmed || trimmed.length < 3 || trimmed.length > 65) return false;
  if (!/[\u05D0-\u05FF]/.test(trimmed)) return false;           // must have Hebrew
  if (/^\d/.test(trimmed)) return false;                         // question number
  if (/^[\u05D0-\u05FF]\s*[.):]/.test(trimmed)) return false;   // answer option (א. ב. ...)
  if (trimmed.includes('__')) return false;                      // fill-in-blank
  if (/\d/.test(trimmed)) return false;                          // contains any digit → sentence fragment
  if (trimmed.endsWith('.') || trimmed.endsWith(',')) return false; // sentence fragments
  if (trimmed.split(/\s+/).length > 8) return false;             // too many words to be a title
  // Count distinct Hebrew words — title needs at least 1
  const hebrewWords = (trimmed.match(/[\u05D0-\u05FF]{2,}/g) || []);
  if (hebrewWords.length === 0) return false;
  // Confirm: next 15 lines contain a question "1." / "1 ."
  const end = Math.min(fromIdx + 15, allLines.length);
  for (let j = fromIdx; j < end; j++) {
    if (/^\s*1\s*[.)]\s/.test(allLines[j])) return true;
  }
  return false;
}

/**
 * Split text into chunks ≤ CHUNK_MAX_CHARS, respecting section boundaries.
 *
 * Each section gets its header prepended as "[נושא: XXX]" so the AI knows
 * the medical topic even when the chunk doesn't contain the full section.
 */
function smartChunkText(text) {
  const lines = text.split('\n');

  // Build a flat list of "boundary events" with their byte positions
  // Each event is: { pos, type: 'question'|'section', label? }
  const boundaries = [];   // sorted by pos
  let bytePos = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw     = lines[i];
    const trimmed = raw.trim();

    if (isSectionHeader(trimmed, lines, i + 1)) {
      boundaries.push({ pos: bytePos, type: 'section', label: trimmed });
    } else if (Q_LINE_RE.test(trimmed)) {
      boundaries.push({ pos: bytePos, type: 'question' });
    }

    bytePos += raw.length + 1;  // +1 for the '\n'
  }

  // #region agent log
  if (import.meta.env.DEV) {
    const sectionCount = boundaries.filter(b => b.type === 'section').length;
    const questionCount = boundaries.filter(b => b.type === 'question').length;
    fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H3',location:'questionImport.js:smartChunkText',message:'boundary stats',data:{totalBoundaries:boundaries.length,sectionCount,questionCount,lineCount:lines.length,sampleLines:lines.slice(0,5).map(l=>l.slice(0,80))},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

  // ── Fallback: try global regex for question starts (DOCX often has few line breaks) ─────────
  if (boundaries.length < 3) {
    const globalMatches = [...text.matchAll(Q_START_GLOBAL_RE)];
    const positions = globalMatches.map(m => m.index).filter(i => i >= 0);
    if (positions.length >= 3) {
      if (import.meta.env.DEV) console.log('[AI parse] line boundaries failed → using global regex,', positions.length, 'starts');
      const chunks = [];
      let chunkStart = 0;
      for (let k = 0; k < positions.length; k++) {
        if (positions[k] > chunkStart && positions[k] - chunkStart >= CHUNK_MAX_CHARS) {
          const slice = text.slice(chunkStart, positions[k]).trim();
          if (slice) chunks.push(slice);
          chunkStart = positions[k];
        }
      }
      const tail = text.slice(chunkStart).trim();
      if (tail) chunks.push(tail);
      if (chunks.length > 0) return chunks.filter(c => c.length > 30);
    }

    // ── Fallback: paragraph boundaries (DOCX with no "1." / "שאלה" — one question per paragraph block)
    const paraBlocks = text.split(/\n\n+/);
    const paraStarts = [];
    let run = 0;
    for (let i = 0; i < paraBlocks.length; i++) {
      if (paraBlocks[i].trim().length > 50) paraStarts.push(run);
      run += paraBlocks[i].length;
      if (i < paraBlocks.length - 1) run += 2; // \n\n
    }
    if (paraStarts.length >= 3) {
      if (import.meta.env.DEV) console.log('[AI parse] no numbering → using paragraph boundaries,', paraStarts.length, 'blocks');
      const chunks = [];
      let chunkStart = 0;
      for (let k = 0; k < paraStarts.length; k++) {
        if (paraStarts[k] > chunkStart && paraStarts[k] - chunkStart >= CHUNK_MAX_CHARS) {
          const slice = text.slice(chunkStart, paraStarts[k]).trim();
          if (slice) chunks.push(slice);
          chunkStart = paraStarts[k];
        }
      }
      const tail = text.slice(chunkStart).trim();
      if (tail) chunks.push(tail);
      if (chunks.length > 0) return chunks.filter(c => c.length > 30);
    }

    if (import.meta.env.DEV) console.log('[AI parse] no boundaries → fixed-size chunks');
    const chunks = [];
    for (let s = 0; s < text.length; s += CHUNK_MAX_CHARS) {
      chunks.push(text.slice(s, s + CHUNK_MAX_CHARS));
    }
    return chunks.length ? chunks : [text];
  }

  // ── Walk boundaries, flush chunks ─────────────────────────
  const chunks   = [];
  let chunkStart = boundaries[0].pos;
  let curSection = boundaries[0].type === 'section' ? boundaries[0].label : '';

  const flush = (endPos) => {
    const body = text.slice(chunkStart, endPos).trim();
    if (!body) return;
    const prefix = curSection ? `[נושא: ${curSection}]\n` : '';
    chunks.push(prefix + body);
  };

  for (let k = 1; k < boundaries.length; k++) {
    const { pos, type, label } = boundaries[k];
    const accumulated = pos - chunkStart;

    // Flush at section boundaries (only if chunk is big enough to be meaningful)
    // or when accumulated size exceeds the limit
    const MIN_FLUSH_SIZE = 300;
    if ((type === 'section' && accumulated >= MIN_FLUSH_SIZE) || accumulated >= CHUNK_MAX_CHARS) {
      flush(pos);
      chunkStart = pos;
      if (type === 'section') curSection = label;
    } else if (type === 'section') {
      // Section header found but chunk too small — just update the label
      curSection = label;
    }
  }
  // Flush the final chunk
  flush(text.length);

  const finalChunks = chunks.filter(c => c.trim().length > 30);
  const sizes = finalChunks.map(c => c.length).sort((a,b)=>b-a);

  // #region agent log
  if (import.meta.env.DEV) fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H4',location:'questionImport.js:smartChunkText',message:'chunk sizes',data:{chunkCount:finalChunks.length,maxChunk:sizes[0],minChunk:sizes[sizes.length-1],top5:sizes.slice(0,5)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return finalChunks;
}

// ── Strip leading question number from question_text ─────────
// pdfjs / AI often includes "1 . text" or "1. text" at the start.
const LEADING_NUM_RE = /^\d{1,3}\s*[.):\-]\s*/;

function stripLeadingNumber(str) {
  return (str || '').replace(LEADING_NUM_RE, '').trim();
}

// ── Single chunk API call ─────────────────────────────────────

const SYSTEM_PROMPT = `אתה מנתח מסמך מלא של שאלות בחינה רפואיות (מד"א).
מקבל קובץ כמחרוזת אחת — לפעמים עם שורות ברורות, לפעמים טקסט רצוף בלי מעברי שורה.
תפקידך: לנתח את כל התוכן, לזהות ולפצל כל שאלה בנפרד, ולהחזיר JSON בלבד — מערך אובייקטים. ללא markdown, ללא הסברים מחוץ ל-JSON.
זהה כל שאלה גם כשאין מספור (1. 2.) — לפי משפטי שאלה, סימני שאלה, ואפשרויות בחירה (א. ב. ג. ד. / תשובות א+ג נכונות וכו').
אם התשובה הנכונה לא מסומנת, השתמש בידע הרפואי שלך לקבוע אותה.`;

const USER_PROMPT_TEMPLATE = (fullText) =>
`להלן קובץ מלא (מחרוזת אחת). נתח את כל התוכן, זהה ופצל כל שאלה, והחזר מערך JSON של כל השאלות.

פורמט JSON:
[{"question_text":"...","question_type":"single_choice","options":[{"value":"0","label":"..."}],"correct_answer":{"value":"0"},"explanation":"..."}]

חוקים:
1. זהה כל שאלה — גם ממוספרות (1. 2.) וגם לא ממוספרות (טקסט רצוף עם משפטי שאלה ואפשרויות)
2. question_text: טקסט השאלה בלבד — ללא מספר בהתחלה
3. אפשרויות א. ב. ג. ד. ה. → value "0","1","2","3","4"
4. נכון/לא-נכון → type "true_false", options [{"value":"0","label":"נכון"},{"value":"1","label":"לא נכון"}]
5. שאלה פתוחה ללא אפשרויות → type "open_ended", options []
6. שאלת סידור/דירוג → type "ordering", options עם הפריטים
7. correct_answer: {"value":"N"} | {"values":["N","M"]} | {"value":"true"/"false"}
8. explanation: הסבר רפואי קצר לכל שאלה
9. התעלם מקטעים שאינם שאלות (כותרות בלבד, מספרים בודדים כמו "4 מ\"ג", "200 מ\"ל" בלי שאלה)

תוכן הקובץ:
${fullText}`;

async function parseOneChunkWithAI(fullText, apiKey) {
  const response = await fetch(appConfig.openai.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: appConfig.openai.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: USER_PROMPT_TEMPLATE(fullText) },
      ],
      temperature: 0.05,
      max_tokens: 16000,  // תשובה אחת לכל הקובץ — מספיק לעשרות שאלות
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  // #region agent log
  if (import.meta.env.DEV) fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H1',location:'questionImport.js:parseOneChunkWithAI',message:'API response content',data:{contentLength:content.length,contentPreview:(typeof content==='string'?content:JSON.stringify(content)).slice(0,800),hasArray:(typeof content==='string'?content:'').indexOf('[')!==-1},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const parsed = parseQuestionsJson(content);
  // #region agent log
  if (import.meta.env.DEV) fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H2',location:'questionImport.js:parseOneChunkWithAI',message:'after parseQuestionsJson',data:{parsedCount:Array.isArray(parsed)?parsed.length:-1},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return parsed;
}

// ── Deduplication ────────────────────────────────────────────

/** Normalise question text for comparison (uses more chars to avoid false drops). */
function normaliseText(t) {
  return (t || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 120)   // increased from 80 — avoids false dedup of similar-start questions
    .toLowerCase();
}

/** Remove questions whose text is a near-duplicate of an already-seen one. */
function deduplicateQuestions(questions) {
  const seen = new Set();
  return questions.filter(q => {
    const key = normaliseText(q.question_text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Batch parallel runner ─────────────────────────────────────

/**
 * Run an array of async tasks with a fixed concurrency limit.
 * Returns results in the same order as tasks (failed tasks return null).
 */
async function runInBatches(tasks, concurrency, onBatchDone) {
  const results = new Array(tasks.length).fill(null);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        console.warn(`[AI batch] chunk ${i} failed:`, err.message);
        results[i] = [];
      }
      onBatchDone?.(i + 1, tasks.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main export ───────────────────────────────────────────────

/**
 * Parse questions from free text using OpenAI.
 * Each file is sent as one long string; the AI analyzes and splits into questions.
 *
 * @param {string}   text   full file content (one string)
 * @param {Function} [onProgress]  called as (done, total) — one call (1, 1) when done
 */
export async function parseQuestionsWithAI(text, onProgress) {
  const apiKey = appConfig.openai.getApiKey();
  if (!apiKey) throw new Error('מפתח OpenAI לא מוגדר. הגדר VITE_OPENAI_API_KEY בקובץ .env');

  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('אין טקסט לניתוח');

  if (import.meta.env.DEV) {
    console.log(`[AI parse] שולח קובץ כמחרוזת אחת (${trimmed.length} תווים)`);
  }

  const raw = await parseOneChunkWithAI(trimmed, apiKey);
  onProgress?.(1, 1);

  if (import.meta.env.DEV) {
    console.log(`[AI parse] לפני dedup: ${raw.length} שאלות`);
  }

  // Deduplicate (handles overlap artefacts)
  const unique = deduplicateQuestions(raw);

  if (import.meta.env.DEV) {
    console.log(`[AI parse] אחרי dedup: ${unique.length} שאלות ייחודיות`);
  }

  let toNormalise = unique;
  let usedFallback = false;
  if (toNormalise.length === 0) {
    // Fallback 1: quick regex parser (works when doc has "1. question" per line)
    let quick = parseTextQuestions(trimmed);
    // Fallback 2: unnumbered blocks (DOCX with no "1." — question + options per paragraph block)
    if (quick.length === 0) quick = parseUnnumberedBlocks(trimmed);
    if (quick.length > 0) {
      usedFallback = true;
      if (import.meta.env.DEV) console.log('[AI parse] fallback: נתח מהיר זיהה', quick.length, 'שאלות');
      toNormalise = quick.map(q => ({
        question_text: q.question_text || '',
        question_type: q.question_type || 'single_choice',
        options: (q.options || []).map((o, i) => ({ value: String(i), label: o.text || o.label || '' })),
        correct_answer: q.correct_answer || '{}',
        explanation: q.explanation || '',
      }));
    } else {
      throw new Error('ה-AI לא זיהה שאלות בטקסט. נסה לפרמט את המסמך עם מספור (1. 2. ...) או להשתמש ב"נתח שאלות (מהיר)".');
    }
  }

  // Normalise each question: strip leading numbers, fix correct_answer format
  const normalised = toNormalise.map(q => {
    // Strip leading question number from question_text ("1 . שאלה" → "שאלה")
    const cleanText = stripLeadingNumber(q.question_text || '');

    let ca = q.correct_answer;

    if (ca !== null && typeof ca === 'object') {
      ca = JSON.stringify(ca);
    }

    // AI returned plain text instead of index → resolve to option index
    if (typeof ca === 'string' && !ca.trim().startsWith('{') && !ca.trim().startsWith('[')) {
      const opts = Array.isArray(q.options) ? q.options : [];
      const matchIdx = opts.findIndex(o =>
        (o.label ?? o.text ?? '').includes(ca) || ca.includes(o.label ?? o.text ?? '')
      );
      ca = JSON.stringify({ value: matchIdx >= 0 ? String(matchIdx) : '0' });
    }

    return { ...q, question_text: cleanText, correct_answer: ca || '{}', status: 'active' };
  });

  // ── Duplicate detection against existing DB ──────────────
  // Runs in background; flags are attached to each question object.
  // The preview UI uses _duplicateFlag / _similarTo to warn the user.
  try {
    const withDupFlags = await checkDuplicatesAgainstDB(
      checkInternalDuplicates(normalised),
      0.80,
      onProgress ? (_d, _t) => {} : undefined  // silent during AI progress
    );
    if (import.meta.env.DEV) {
      const flagged = withDupFlags.filter(q => q._duplicateFlag || q._internalDuplicate);
      if (flagged.length) console.log(`[AI parse] ${flagged.length} שאלות דומות זוהו`);
    }
    return { questions: withDupFlags, usedFallback };
  } catch (err) {
    // Dedup failure must never block import
    console.warn('[AI parse] שגיאה בבדיקת כפילויות:', err.message);
    return { questions: normalised, usedFallback };
  }
}

/**
 * Parse CSV text to array of question objects
 */
export function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('קובץ CSV חייב להכיל לפחות שורת כותרת ושורת נתונים אחת');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Required columns
  const requiredColumns = ['question_text', 'question_type', 'correct_answer', 'difficulty_level', 'hierarchy_id'];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`חסרות עמודות נדרשות: ${missingColumns.join(', ')}`);
  }

  const questions = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    if (values.length !== headers.length) {
      console.warn(`שורה ${i + 1} נדלגה - מספר עמודות לא תואם`);
      continue;
    }

    const question = {};
    
    headers.forEach((header, index) => {
      let value = values[index];
      
      // Parse JSON fields
      if (header === 'options' && value) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          console.warn(`שגיאה בפענוח אופציות בשורה ${i + 1}`);
        }
      }
      
      // Parse numbers
      if (header === 'difficulty_level' || header === 'total_attempts' || header === 'total_success') {
        value = value ? parseInt(value) : undefined;
      }
      
      // Parse booleans
      if (header === 'email_verified' || value === 'true' || value === 'false') {
        value = value === 'true';
      }
      
      question[header] = value;
    });

    questions.push(question);
  }

  return questions;
}

/**
 * Parse JSON text to array of question objects
 */
export function parseJSON(jsonText) {
  try {
    const data = JSON.parse(jsonText);

    if (!Array.isArray(data)) {
      throw new Error('קובץ JSON חייב להכיל מערך של שאלות');
    }

    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('קובץ JSON לא תקין: ' + error.message);
    }
    throw error;
  }
}

/**
 * Parse Moodle-style Excel (.xlsx) with columns: question_text, answers
 * answers format: "Option1 || Option2 (Correct) || Option3" — separated by ||, correct marked with (Correct); (Correct) is stripped from label
 */
export function parseMoodleExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellNF: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows.length || rows[0].length < 2) {
    throw new Error('קובץ Excel חייב להכיל לפחות עמודות question_text ו-answers');
  }

  const questions = [];
  const headers = rows[0].map(h => String(h ?? '').replace(/\uFEFF/g, '').trim().toLowerCase());
  const qIdx = headers.findIndex(h => /question/.test(h) || h === 'שאלה' || h === 'טקסט השאלה');
  const aIdx = headers.findIndex(h => /answer/.test(h) || h === 'תשובות' || h === 'answers');

  if (qIdx < 0 || aIdx < 0) {
    throw new Error(`נדרשות עמודות question_text ו-answers. נמצאו: ${headers.slice(0, 5).join(', ')}`);
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const questionText = String(row[qIdx] ?? '').trim();
    const answersStr = String(row[aIdx] ?? '').trim();

    if (!questionText || !answersStr) continue;

    const parts = answersStr.split(/\s*\|\|\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) continue; // need at least 2 options for single_choice

    const options = [];
    let correctIndex = 0;

    for (let j = 0; j < parts.length; j++) {
      const raw = parts[j];
      const isCorrect = /\(Correct\)/i.test(raw);
      const label = raw.replace(/\s*\(Correct\)\s*/gi, '').trim();
      options.push({ value: String(j), label: label || `אופציה ${j + 1}` }); // avoid empty label for validation
      if (isCorrect) correctIndex = j;
    }

    const correctAnswerPayload = { value: String(correctIndex), options };
    questions.push({
      question_text: questionText,
      question_type: 'single_choice',
      correct_answer: JSON.stringify(correctAnswerPayload),
      options, // for validation
      difficulty_level: null,
      hierarchy_id: 'h1',
    });
  }

  return questions;
}

/**
 * Validate question data
 */
export function validateQuestionData(question, index = null) {
  const validation = validateQuestion(question);
  
  return {
    index: index,
    question: question,
    isValid: validation.isValid,
    errors: validation.errors
  };
}

/**
 * Bulk create questions with optional AI enrichment.
 *
 * options.enrich {boolean}  — when true, questions missing distractors or a
 *                             correct answer are automatically enriched via AI
 *                             before saving:
 *   • No options   → generate 4 distractors, save as TWO entities
 *                    (open_ended + single_choice)
 *   • No correct_answer → ask AI to identify it, save ONE entity
 *
 * options.onEnrichProgress {Function} — called during enrichment phase
 */
export async function bulkCreateQuestions(questions, options = {}) {
  const {
    validate         = true,
    skipInvalid      = true,
    enrich           = true,
    skipDuplicates   = false,   // when true, questions flagged as duplicates are not saved
    onProgress       = null,
    onEnrichProgress = null,
  } = options;

  const results = {
    total:      questions.length,
    successful: 0,
    failed:     0,
    skipped:    0,
    enriched:   0,
    split:      0,
    duplicates: 0,   // questions skipped because they are duplicates of existing ones
    errors:     [],
    created:    [],
  };

  // ── Phase 1: AI enrichment ───────────────────────────────
  let workingSet = questions;

  if (enrich) {
    const apiKey = appConfig.openai.getApiKey();
    if (apiKey) {
      const enriched = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const enrichType = detectEnrichmentType(q);

        onEnrichProgress?.({
          phase: 'enrich',
          current: i + 1,
          total: questions.length,
          enrichType,
          questionText: q.question_text?.slice(0, 60),
        });

        if (enrichType === ENRICH_NONE) {
          enriched.push(q);
          continue;
        }

        try {
          const res = await enrichQuestion(q, apiKey);

          if (res.type === ENRICH_GENERATE) {
            // Save original as open_ended + new MC sibling
            enriched.push(res.question);
            enriched.push(res.extraQuestion);
            results.split++;
            results.enriched++;
          } else if (res.type === ENRICH_IDENTIFY_ANSWER) {
            enriched.push(res.question);
            results.enriched++;
          } else {
            enriched.push(res.question);
          }
        } catch (err) {
          console.warn(`[enrichment] שגיאה בשאלה ${i + 1}:`, err.message);
          // Keep original on AI failure; mark for review
          enriched.push({ ...q, enrichment_error: err.message, status: 'pending_review' });
        }
      }
      workingSet = enriched;
    }
    // If no API key — skip enrichment silently, proceed with originals
  }

  // Update total to reflect possible splits
  results.total = workingSet.length;

  // ── Phase 2: validate & save ─────────────────────────────
  for (let i = 0; i < workingSet.length; i++) {
    const question = workingSet[i];

    // Skip duplicates when requested
    if (skipDuplicates && (question._duplicateFlag || question._internalDuplicate)) {
      results.duplicates++;
      results.skipped++;
      onProgress?.({ current: i + 1, total: workingSet.length, success: results.successful, failed: results.failed, duplicates: results.duplicates });
      continue;
    }

    if (validate) {
      const validation = validateQuestionData(question, i);
      if (!validation.isValid) {
        if (skipInvalid) {
          results.skipped++;
          results.errors.push({ index: i, question, errors: validation.errors });
          onProgress?.({ current: i + 1, total: workingSet.length, success: results.successful, failed: results.failed });
          continue;
        } else {
          throw new Error(`שאלה ${i + 1} לא תקינה: ${validation.errors.join(', ')}`);
        }
      }
    }

    try {
      if (!question.status) question.status = 'active';
      // Duplicate or AI-error: needs human review
      if (question._duplicateFlag || question.enrichment_error) question.status = 'pending_review';
      // Strip internal dedup metadata before persisting
      const { _duplicateFlag, _internalDuplicate, _similarTo, enrichment_error, ...clean } = question;
      const created = await entities.Question_Bank.create(clean);
      // Store similarity metadata as a separate field for later review
      if (question._similarTo) {
        await entities.Question_Bank.update(created.id, {
          similar_to: question._similarTo,
        });
      }
      results.successful++;
      results.created.push(created);
    } catch (error) {
      console.error(`Error creating question ${i + 1}:`, error);
      results.failed++;
      results.errors.push({ index: i, question, error: error.message });
    }

    onProgress?.({ current: i + 1, total: workingSet.length, success: results.successful, failed: results.failed, duplicates: results.duplicates });
  }

  return results;
}

/**
 * Import questions from CSV
 */
export async function importQuestionsFromCSV(csvText, options = {}) {
  try {
    const questions = parseCSV(csvText);
    const results = await bulkCreateQuestions(questions, options);
    return results;
  } catch (error) {
    throw new Error(`שגיאה בייבוא CSV: ${error.message}`);
  }
}

/**
 * Import questions from JSON
 */
export async function importQuestionsFromJSON(jsonText, options = {}) {
  try {
    const questions = parseJSON(jsonText);
    const results = await bulkCreateQuestions(questions, options);
    return results;
  } catch (error) {
    throw new Error(`שגיאה בייבוא JSON: ${error.message}`);
  }
}

/**
 * Import questions from Moodle-style Excel (.xlsx)
 * options.defaultHierarchyId — optional; if set, applied to each question
 */
export async function importQuestionsFromMoodleExcel(buffer, options = {}) {
  try {
    let questions = parseMoodleExcel(buffer);
    if (options.defaultHierarchyId) {
      questions = questions.map(q => ({ ...q, hierarchy_id: options.defaultHierarchyId }));
    }
    const results = await bulkCreateQuestions(questions, options);
    return results;
  } catch (error) {
    throw new Error(`שגיאה בייבוא Excel: ${error.message}`);
  }
}

/**
 * Preview questions before import
 */
export function previewQuestions(questions) {
  const preview = {
    total: questions.length,
    valid: 0,
    invalid: 0,
    byType: {},
    byDifficulty: {},
    details: []
  };

  questions.forEach((question, index) => {
    const validation = validateQuestionData(question, index);
    
    if (validation.isValid) {
      preview.valid++;
    } else {
      preview.invalid++;
    }

    // Count by type
    const type = question.question_type || 'unknown';
    preview.byType[type] = (preview.byType[type] || 0) + 1;

    // Count by difficulty
    const difficulty = question.difficulty_level || 'unknown';
    preview.byDifficulty[difficulty] = (preview.byDifficulty[difficulty] || 0) + 1;

    preview.details.push({
      index: index + 1,
      question: question,
      isValid: validation.isValid,
      errors: validation.errors
    });
  });

  return preview;
}
