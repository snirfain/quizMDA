/**
 * Book-content client workflow — thin wrappers over /api/book-content/*.
 * Hebrew: מאגר תוכן הספר (צד לקוח)
 */

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    let parsed = '';
    try { parsed = JSON.parse(msg)?.error || ''; } catch (_) { parsed = msg; }
    throw new Error(parsed || `הבקשה נכשלה (${res.status})`);
  }
  return res.json();
}

/**
 * Ingest a chapter's text into the book knowledge base.
 * @param {{ category: string, subTopic?: string, text: string, sourceDoc?: string, replaceCategory?: boolean }} params
 */
export async function ingestBookChapter({ category, subTopic = '', text, sourceDoc, replaceCategory = true }) {
  return postJson('/api/book-content/ingest', {
    category,
    sub_topic: subTopic,
    text,
    source_doc: sourceDoc,
    replace_category: replaceCategory,
  });
}

export async function getBookSummary() {
  const res = await fetch('/api/book-content/summary', { method: 'GET' });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `טעינת הסיכום נכשלה (${res.status})`);
  }
  return res.json();
}

export async function searchBook({ query, category = '', limit = 20 }) {
  return postJson('/api/book-content/search', { query, category, limit });
}

export async function classifyAgainstBook(questionText, topK = 6) {
  return postJson('/api/book-content/classify', { question_text: questionText, top_k: topK });
}

export async function clearBookCategory(category) {
  const res = await fetch('/api/book-content/category', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `מחיקה נכשלה (${res.status})`);
  }
  return res.json();
}
