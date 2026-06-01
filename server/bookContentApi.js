/**
 * Book-content API — stores the emergency-medicine textbook as searchable chunks
 * and grounds question cataloging against it.
 * Hebrew: מאגר תוכן הספר
 */
import BookContent from '../models/BookContent.js';
import { ensureDbConnection, isDbConnected } from './db.js';
import { estimateTokens } from '../shared/protocolContext.js';
import { isValidCategory } from '../shared/questionBankMetadata.js';

const PAGE_MARKER_RE = /^\s*--\s*\d+\s*of\s*\d+\s*--\s*$/i;
// Hebrew stop-words skipped when building keyword signals (very common, low signal).
const STOP_WORDS = new Set([
  'אשר', 'הוא', 'היא', 'הם', 'הן', 'זה', 'זאת', 'את', 'של', 'על', 'עם', 'אל',
  'או', 'גם', 'כל', 'יש', 'אין', 'לא', 'כן', 'מה', 'מי', 'איזה', 'כדי', 'אבל',
  'הבא', 'הבאה', 'הבאים', 'נכון', 'נכונה', 'הנכון', 'הנכונה', 'הבאות', 'אחד', 'אחת',
]);

function normalizeLines(rawText = '') {
  return String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/\t+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !PAGE_MARKER_RE.test(line));
}

/** Split a chapter's lines into overlapping chunks targeting ~700–1200 est. tokens. */
function chunkLines(lines, options = {}) {
  const tokenMin = options.tokenMin || 700;
  const tokenMax = options.tokenMax || 1200;
  const overlapTokens = options.overlapTokens || 120;
  const chunks = [];
  let buf = [];
  let bufTokens = 0;

  const flush = () => {
    if (!buf.length) return;
    const chunkText = buf.join('\n').trim();
    if (!chunkText) return;
    chunks.push({
      chunk_text: chunkText,
      chunk_tokens_est: estimateTokens(chunkText),
      char_count: chunkText.length,
    });
  };

  for (const line of lines) {
    const t = estimateTokens(line);
    if (bufTokens + t > tokenMax && bufTokens >= tokenMin) {
      flush();
      const keep = [];
      let keepTokens = 0;
      for (let i = buf.length - 1; i >= 0; i--) {
        const lineTokens = estimateTokens(buf[i]);
        if (keepTokens + lineTokens > overlapTokens) break;
        keep.unshift(buf[i]);
        keepTokens += lineTokens;
      }
      buf = keep;
      bufTokens = keepTokens;
    }
    buf.push(line);
    bufTokens += t;
  }
  flush();
  return chunks;
}

function normalizeForKeywords(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/["'`׳״]/g, '')
    .replace(/[^\u0590-\u05ffa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(text = '', max = 24) {
  const seen = new Set();
  const out = [];
  for (const w of normalizeForKeywords(text).split(' ')) {
    if (w.length < 3 || STOP_WORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

function escapeRegex(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSnippet(chunkText, query, radius = 160) {
  const text = String(chunkText || '');
  const idx = query ? text.toLowerCase().indexOf(String(query).toLowerCase()) : -1;
  if (idx === -1) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

// ── POST /api/book-content/ingest ──────────────────────────────────
export async function ingestBookContent(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    const {
      category = '',
      sub_topic = '',
      text = '',
      source_doc = 'ספר רפואת חירום',
      replace_category = true,
      token_min = 700,
      token_max = 1200,
      overlap_tokens = 120,
    } = req.body || {};

    const cat = String(category || '').trim();
    if (!isValidCategory(cat)) {
      return res.status(400).json({ error: 'נושא (פרק) לא חוקי — בחר מתוך רשימת הפרקים' });
    }
    const lines = normalizeLines(text);
    const totalChars = lines.join('\n').length;
    if (totalChars < 40) {
      return res.status(400).json({ error: 'הטקסט קצר או ריק מדי' });
    }

    if (replace_category) {
      await BookContent.deleteMany({ category: cat });
    }

    const startIndex = replace_category
      ? 0
      : (await BookContent.countDocuments({ category: cat }));
    const chunks = chunkLines(lines, {
      tokenMin: Number(token_min) || 700,
      tokenMax: Number(token_max) || 1200,
      overlapTokens: Number(overlap_tokens) || 120,
    });
    if (!chunks.length) return res.status(400).json({ error: 'לא נוצרו קטעים מהטקסט' });

    const docs = chunks.map((c, i) => ({
      category: cat,
      sub_topic: String(sub_topic || '').trim(),
      source_doc: String(source_doc || 'ספר רפואת חירום').trim(),
      chunk_index: startIndex + i,
      ...c,
    }));
    await BookContent.insertMany(docs, { ordered: false });

    return res.json({
      success: true,
      category: cat,
      chunks_created: docs.length,
      char_count: totalChars,
      replaced: !!replace_category,
    });
  } catch (err) {
    console.error('POST /api/book-content/ingest error:', err);
    return res.status(500).json({ error: err.message || 'קליטת התוכן נכשלה' });
  }
}

// ── GET /api/book-content/summary ──────────────────────────────────
export async function getBookSummary(_req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    const rows = await BookContent.aggregate([
      {
        $group: {
          _id: '$category',
          chunks: { $sum: 1 },
          chars: { $sum: '$char_count' },
          updatedAt: { $max: '$updatedAt' },
          sub_topics: { $addToSet: '$sub_topic' },
          source_doc: { $max: '$source_doc' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const categories = rows.map((r) => ({
      category: r._id,
      chunks: r.chunks,
      chars: r.chars,
      updatedAt: r.updatedAt,
      sub_topics: (r.sub_topics || []).filter(Boolean),
      source_doc: r.source_doc,
    }));
    const totals = categories.reduce(
      (acc, c) => ({ chunks: acc.chunks + c.chunks, chars: acc.chars + c.chars }),
      { chunks: 0, chars: 0 }
    );
    return res.json({ categories, total_chunks: totals.chunks, total_chars: totals.chars });
  } catch (err) {
    console.error('GET /api/book-content/summary error:', err);
    return res.status(500).json({ error: err.message || 'טעינת הסיכום נכשלה' });
  }
}

// ── POST /api/book-content/search ──────────────────────────────────
export async function searchBookContent(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    const query = String(req.body?.query || '').trim();
    const category = String(req.body?.category || '').trim();
    const limit = Math.max(1, Math.min(50, Number(req.body?.limit) || 20));
    if (query.length < 2) return res.status(400).json({ error: 'הזן לפחות 2 תווים לחיפוש' });

    const filter = { chunk_text: { $regex: escapeRegex(query), $options: 'i' } };
    if (category) filter.category = category;
    const total = await BookContent.countDocuments(filter);
    const rows = await BookContent.find(filter).limit(limit).lean();
    return res.json({
      query,
      total_matches: total,
      results: rows.map((r) => ({
        id: r._id?.toString?.() || null,
        category: r.category,
        sub_topic: r.sub_topic,
        snippet: buildSnippet(r.chunk_text, query),
      })),
    });
  } catch (err) {
    console.error('POST /api/book-content/search error:', err);
    return res.status(500).json({ error: err.message || 'החיפוש נכשל' });
  }
}

// ── POST /api/book-content/classify ────────────────────────────────
// Retrieval step for cataloging: return the chapters/snippets that best match a
// question, so the LLM can pick the final category + sub_category.
export async function classifyAgainstBook(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    const questionText = String(req.body?.question_text || '').trim();
    const topK = Math.max(1, Math.min(12, Number(req.body?.top_k) || 6));
    if (!questionText) return res.status(400).json({ error: 'חסר question_text' });

    const keywords = extractKeywords(questionText);
    if (!keywords.length) {
      return res.json({ question_text: questionText, top_chunks: [], no_book_match: true });
    }

    // Fast candidate retrieval via the text index, then re-rank by keyword overlap.
    let candidates = [];
    try {
      candidates = await BookContent.find(
        { $text: { $search: keywords.join(' ') } },
        { score: { $meta: 'textScore' }, chunk_text: 1, category: 1, sub_topic: 1 }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(80)
        .lean();
    } catch (_) {
      // $text may be unavailable on tiny datasets — fall back to a bounded scan.
      candidates = await BookContent.find({}, { chunk_text: 1, category: 1, sub_topic: 1 })
        .limit(400)
        .lean();
    }

    const kwSet = new Set(keywords);
    const scored = candidates
      .map((c) => {
        const norm = normalizeForKeywords(c.chunk_text);
        let overlap = 0;
        for (const kw of kwSet) {
          if (norm.includes(kw)) overlap += 1;
        }
        const textScore = typeof c.score === 'number' ? c.score : 0;
        return { ...c, overlap, combined: overlap * 2 + textScore };
      })
      .filter((c) => c.overlap > 0)
      .sort((a, b) => b.combined - a.combined)
      .slice(0, topK);

    return res.json({
      question_text: questionText,
      keywords,
      no_book_match: scored.length === 0,
      top_chunks: scored.map((c) => ({
        id: c._id?.toString?.() || null,
        category: c.category,
        sub_topic: c.sub_topic,
        score: Number(c.combined.toFixed(2)),
        snippet: buildSnippet(c.chunk_text, keywords[0], 220),
      })),
    });
  } catch (err) {
    console.error('POST /api/book-content/classify error:', err);
    return res.status(500).json({ error: err.message || 'סיווג מול הספר נכשל' });
  }
}

// ── DELETE /api/book-content/category ──────────────────────────────
export async function clearBookCategory(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    const category = String(req.body?.category || '').trim();
    if (!category) return res.status(400).json({ error: 'חסר נושא (פרק) למחיקה' });
    const result = await BookContent.deleteMany({ category });
    return res.json({ success: true, category, deleted: result.deletedCount || 0 });
  } catch (err) {
    console.error('DELETE /api/book-content/category error:', err);
    return res.status(500).json({ error: err.message || 'מחיקת התוכן נכשלה' });
  }
}
