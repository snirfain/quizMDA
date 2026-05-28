import ProtocolChunk from '../models/ProtocolChunk.js';
import { ensureDbConnection, isDbConnected } from './db.js';
import {
  DRUG_ALIASES,
  buildProtocolContextBlock,
  estimateTokens,
  extractQuestionSignals,
  fitChunksToTokenBudget,
} from '../shared/protocolContext.js';

const SECTION_HEADING_RE = /^\s*(פרק\s+\d+|[\u05D0-\u05FF].{0,40})\s*$/;
const PAGE_MARKER_RE = /^\s*--\s*\d+\s*of\s*\d+\s*--\s*$/i;

function normalizeProtocolText(rawText = '') {
  return String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/\t+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !PAGE_MARKER_RE.test(line));
}

function inferAliases(drugName = '', protocolName = '') {
  const aliases = new Set();
  if (drugName) aliases.add(drugName);
  if (protocolName) aliases.add(protocolName);
  const normDrug = drugName.toLowerCase();
  for (const [canonical, variants] of DRUG_ALIASES) {
    if (!normDrug) continue;
    if (canonical.toLowerCase() === normDrug || variants.some((v) => String(v).toLowerCase() === normDrug)) {
      variants.forEach((v) => aliases.add(v));
      aliases.add(canonical);
    }
  }
  return [...aliases].map((x) => String(x).trim()).filter(Boolean);
}

function splitBySections(lines = []) {
  const sections = [];
  let current = { chapter: 'כללי', lines: [] };
  for (const line of lines) {
    const isHeading = SECTION_HEADING_RE.test(line) && line.length < 80 && !/[:?.]/.test(line);
    if (isHeading && current.lines.length > 30) {
      sections.push(current);
      current = { chapter: line, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length) sections.push(current);
  return sections;
}

function detectDrugAndProtocol(text = '', chapter = '') {
  const joined = `${chapter}\n${text}`.toLowerCase();
  let drug = '';
  for (const [canonical, variants] of DRUG_ALIASES) {
    if (variants.some((v) => joined.includes(String(v).toLowerCase()))) {
      drug = canonical;
      break;
    }
  }
  let protocol = '';
  const m = chapter.match(/(acs|אנפילקסיס|דום לב|טראומה|פרכוס|אירוע מוחי|נתיב אוויר|rosc)/i);
  if (m) protocol = m[1];
  return { drug_name: drug, protocol_name: protocol };
}

function chunkSectionLines(section, options = {}) {
  const tokenMin = options.tokenMin || 700;
  const tokenMax = options.tokenMax || 1200;
  const overlapTokens = options.overlapTokens || 120;
  const chunks = [];
  const lines = section.lines || [];
  let buf = [];
  let bufTokens = 0;

  const flush = () => {
    if (!buf.length) return;
    const chunkText = buf.join('\n').trim();
    if (!chunkText) return;
    const detected = detectDrugAndProtocol(chunkText, section.chapter);
    const aliases = inferAliases(detected.drug_name, detected.protocol_name);
    chunks.push({
      chapter: section.chapter || 'כללי',
      protocol_name: detected.protocol_name || '',
      drug_name: detected.drug_name || '',
      aliases,
      chunk_text: chunkText,
      chunk_tokens_est: estimateTokens(chunkText),
      priority: detected.drug_name ? 3 : detected.protocol_name ? 2 : 1,
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

function scoreChunk(chunk, signals, normalizedQuestion) {
  let score = 0;
  const chunkText = String(chunk.chunk_text || '').toLowerCase();
  if (signals.drugs.some((d) => String(chunk.drug_name || '').toLowerCase() === d.toLowerCase())) score += 8;
  if (signals.drugs.some((d) => (chunk.aliases || []).some((a) => String(a).toLowerCase() === d.toLowerCase()))) score += 5;
  if (signals.protocols.some((p) => String(chunk.protocol_name || '').toLowerCase().includes(String(p).toLowerCase()))) score += 4;
  for (const token of signals.doseTokens) {
    if (chunkText.includes(token.toLowerCase())) score += 2;
  }
  const keywords = normalizedQuestion.split(/\s+/).filter((w) => w.length >= 3).slice(0, 25);
  for (const kw of keywords) {
    if (chunkText.includes(kw)) score += 0.15;
  }
  score += (chunk.priority || 0) * 0.4;
  return score;
}

export async function ingestProtocolText(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const {
      source_doc = 'ALS Protocol Book',
      version = 'ALS-2024-04',
      effective_date = null,
      text = '',
      set_active = true,
      token_min = 700,
      token_max = 1200,
      overlap_tokens = 120,
      clear_existing_for_version = true,
    } = req.body || {};

    const normalizedLines = normalizeProtocolText(text);
    if (normalizedLines.length < 50) {
      return res.status(400).json({ error: 'Protocol text too short or empty' });
    }

    if (clear_existing_for_version) {
      await ProtocolChunk.deleteMany({ version });
    }
    if (set_active) {
      await ProtocolChunk.updateMany({}, { $set: { is_active_version: false } });
    }

    const sections = splitBySections(normalizedLines);
    const docs = [];
    let chunkIndex = 0;
    for (const section of sections) {
      const chunks = chunkSectionLines(section, {
        tokenMin: Number(token_min) || 700,
        tokenMax: Number(token_max) || 1200,
        overlapTokens: Number(overlap_tokens) || 120,
      });
      for (const chunk of chunks) {
        docs.push({
          source_doc,
          version,
          effective_date: effective_date ? new Date(effective_date) : null,
          is_active_version: !!set_active,
          chunk_index: chunkIndex++,
          ...chunk,
        });
      }
    }
    if (docs.length === 0) {
      return res.status(400).json({ error: 'No chunks created from text' });
    }

    await ProtocolChunk.insertMany(docs, { ordered: false });
    return res.json({
      success: true,
      version,
      chunks_created: docs.length,
      sections_detected: sections.length,
      active: !!set_active,
    });
  } catch (err) {
    console.error('POST /api/protocol-context/ingest error:', err);
    return res.status(500).json({ error: err.message || 'Ingest failed' });
  }
}

export async function listProtocolVersions(_req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const rows = await ProtocolChunk.aggregate([
      {
        $group: {
          _id: '$version',
          chunks: { $sum: 1 },
          active: { $max: { $cond: ['$is_active_version', 1, 0] } },
          updatedAt: { $max: '$updatedAt' },
          source_doc: { $max: '$source_doc' },
        },
      },
      { $sort: { updatedAt: -1 } },
    ]);
    return res.json(rows.map((r) => ({
      version: r._id,
      chunks: r.chunks,
      active: !!r.active,
      updatedAt: r.updatedAt,
      source_doc: r.source_doc,
    })));
  } catch (err) {
    console.error('GET /api/protocol-context/versions error:', err);
    return res.status(500).json({ error: err.message || 'List versions failed' });
  }
}

export async function activateProtocolVersion(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const version = String(req.body?.version || '').trim();
    if (!version) return res.status(400).json({ error: 'Missing version' });
    const has = await ProtocolChunk.countDocuments({ version });
    if (!has) return res.status(404).json({ error: 'Version not found' });
    await ProtocolChunk.updateMany({}, { $set: { is_active_version: false } });
    await ProtocolChunk.updateMany({ version }, { $set: { is_active_version: true } });
    return res.json({ success: true, version, activated_chunks: has });
  } catch (err) {
    console.error('POST /api/protocol-context/activate error:', err);
    return res.status(500).json({ error: err.message || 'Activation failed' });
  }
}

export async function retrieveProtocolContext(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const questionText = String(req.body?.question_text || req.query?.question_text || '').trim();
    const tokenBudget = Math.max(400, Math.min(6000, Number(req.body?.token_budget || req.query?.token_budget || 4000)));
    const topK = Math.max(1, Math.min(20, Number(req.body?.top_k || req.query?.top_k || 6)));
    const debug = req.body?.debug === true || req.query?.debug === '1';
    if (!questionText) return res.status(400).json({ error: 'Missing question_text' });

    const signals = extractQuestionSignals(questionText);
    const versions = await ProtocolChunk.distinct('version', { is_active_version: true });
    const versionFilter = versions.length ? { version: { $in: versions } } : {};
    const candidateLimit = 250;
    const candidates = await ProtocolChunk.find(versionFilter).limit(candidateLimit).lean();
    const scored = candidates
      .map((c) => ({
        ...c,
        score: scoreChunk(c, signals, signals.normalizedText),
      }))
      .filter((x) => x.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK * 4);

    const fitted = fitChunksToTokenBudget(scored, tokenBudget).slice(0, topK);
    const contextBlock = buildProtocolContextBlock(fitted);
    return res.json({
      question_text: questionText,
      signals: { drugs: signals.drugs, protocols: signals.protocols, doseTokens: signals.doseTokens },
      top_chunks: fitted.map((x) => ({
        id: x._id?.toString?.() || null,
        chapter: x.chapter,
        protocol_name: x.protocol_name,
        drug_name: x.drug_name,
        score: x.score,
        chunk_tokens_est: x.chunk_tokens_est,
        source_doc: x.source_doc,
      })),
      context_block: contextBlock,
      no_protocol_match: fitted.length === 0,
      ...(debug ? { debug_candidates: scored.slice(0, 15).map((x) => ({ id: x._id?.toString?.(), score: x.score, drug_name: x.drug_name, protocol_name: x.protocol_name })) } : {}),
    });
  } catch (err) {
    console.error('POST /api/protocol-context/retrieve error:', err);
    return res.status(500).json({ error: err.message || 'Retrieve failed' });
  }
}
