import { buildProtocolContextBlock, extractQuestionSignals } from '../shared/protocolContext.js';
import { extractTextFromPDF } from './questionImport.js';

export async function retrieveProtocolContextForQuestion(questionText, options = {}) {
  const payload = {
    question_text: String(questionText || ''),
    token_budget: options.tokenBudget || 3800,
    top_k: options.topK || 6,
    debug: !!options.debug,
  };
  const res = await fetch('/api/protocol-context/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `protocol-context retrieve failed (${res.status})`);
  }
  const data = await res.json();
  return {
    contextBlock: data.context_block || '',
    topChunks: Array.isArray(data.top_chunks) ? data.top_chunks : [],
    noProtocolMatch: !!data.no_protocol_match,
    signals: data.signals || extractQuestionSignals(questionText),
  };
}

export async function ingestProtocolPdf(file, options = {}) {
  const text = await extractTextFromPDF(file);
  const body = {
    source_doc: options.sourceDoc || file?.name || 'ALS Protocol PDF',
    version: options.version || 'ALS-2024-04',
    effective_date: options.effectiveDate || null,
    text,
    token_min: options.tokenMin || 700,
    token_max: options.tokenMax || 1200,
    overlap_tokens: options.overlapTokens || 120,
    set_active: options.setActive !== false,
    clear_existing_for_version: options.clearExistingForVersion !== false,
  };
  const res = await fetch('/api/protocol-context/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `protocol ingest failed (${res.status})`);
  }
  return res.json();
}

export async function listProtocolVersions() {
  const res = await fetch('/api/protocol-context/versions', { method: 'GET' });
  if (!res.ok) throw new Error(`failed loading versions (${res.status})`);
  return res.json();
}

export async function activateProtocolVersion(version) {
  const res = await fetch('/api/protocol-context/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `failed activating version (${res.status})`);
  }
  return res.json();
}

export { buildProtocolContextBlock, extractQuestionSignals };
