/**
 * Protocol-context helpers shared by client and server.
 * Used for signal extraction and context budget calculations.
 */

const DRUG_ALIAS_PATTERNS = [
  ['אדרנלין', ['אדרנלין', 'אפינפרין', 'epinephrine']],
  ['אמיודרון', ['אמיודרון', 'amiodarone']],
  ['אטומידאט', ['אטומידאט', 'etomidate']],
  ['אטרופין', ['אטרופין', 'atropine']],
  ['אדנוזין', ['אדנוזין', 'adenosine']],
  ['סולומדרול', ['סולומדרול', 'solumedrol', 'methylprednisolone']],
  ['ונטולין', ['ונטולין', 'salbutamol', 'אלבוטרול']],
  ['אירובנט', ['אירובנט', 'ipratropium']],
  ['דקסטרוז', ['דקסטרוז', 'גלוקוז', 'dextrose']],
  ['קטמין', ['קטמין', 'ketamine']],
  ['פנטניל', ['פנטניל', 'fentanyl']],
  ['נרקן', ['נרקן', 'naloxone', 'נלוקסון']],
  ['מגנזיום סולפט', ['מגנזיום סולפט', 'magnesium sulfate']],
  ['ביקרבונט', ['סודיום ביקרבונט', 'ביקרבונט', 'sodium bicarbonate']],
  ['קלציום גלוקונט', ['קלציום גלוקונט', 'calcium gluconate']],
  ['דופמין', ['דופמין', 'dopamine']],
  ['הידרוקסיקובלמין', ['הידרוקסיקובלמין', 'hydroxocobalamin']],
];

const PROTOCOL_HINTS = [
  'acs',
  'אנפילקסיס',
  'דום לב',
  'rosc',
  'פרכוס',
  'טכיקרדיה',
  'ברדיקרדיה',
  'נתיב אוויר',
  'cpr',
  'vf',
  'vt',
  'pea',
  'asystole',
  'טראומה',
  'כוויות',
  'היפותרמיה',
  'שבץ',
  'אירוע מוחי',
  'הרעלה',
  'עילפון',
];

export function estimateTokens(text = '') {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

function normalizeLooseText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/["'`׳״]/g, '')
    .replace(/[^\u0590-\u05ffa-z0-9%./+\-\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractQuestionSignals(questionText = '') {
  const normalized = normalizeLooseText(questionText);
  const drugs = new Set();
  const protocols = new Set();
  const doseTokens = new Set();

  for (const [canonical, aliases] of DRUG_ALIAS_PATTERNS) {
    if (aliases.some((alias) => normalized.includes(normalizeLooseText(alias)))) {
      drugs.add(canonical);
    }
  }

  for (const hint of PROTOCOL_HINTS) {
    if (normalized.includes(normalizeLooseText(hint))) {
      protocols.add(hint.toUpperCase() === hint ? hint : hint);
    }
  }

  const doseRe =
    /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|cc|iu|units|מג|מ״ג|מל|מ״ל|מקג|מיקרוגרם|טיפות|kg|\/kg|ליטר)\b/gi;
  const matches = normalized.match(doseRe) || [];
  for (const m of matches) doseTokens.add(m.trim());

  return {
    drugs: [...drugs],
    protocols: [...protocols],
    doseTokens: [...doseTokens],
    normalizedText: normalized,
  };
}

export function fitChunksToTokenBudget(chunks = [], tokenBudget = 4000) {
  const selected = [];
  let used = 0;
  for (const chunk of chunks) {
    const text = String(chunk.chunk_text || '').trim();
    if (!text) continue;
    const t = chunk.chunk_tokens_est || estimateTokens(text);
    if (selected.length > 0 && used + t > tokenBudget) break;
    if (selected.length === 0 && t > tokenBudget) {
      selected.push({ ...chunk, chunk_text: text.slice(0, tokenBudget * 4), chunk_tokens_est: tokenBudget });
      used = tokenBudget;
      break;
    }
    selected.push({ ...chunk, chunk_text: text, chunk_tokens_est: t });
    used += t;
  }
  return selected;
}

export function buildProtocolContextBlock(chunks = []) {
  if (!Array.isArray(chunks) || chunks.length === 0) return '';
  const body = chunks
    .map((c, i) => {
      const source = c.source_doc || 'ALS';
      const chapter = c.chapter || 'כללי';
      const proto = c.protocol_name || '';
      const drug = c.drug_name || '';
      const header = `[מקור ${i + 1}] ${source} | פרק: ${chapter}${proto ? ` | פרוטוקול: ${proto}` : ''}${drug ? ` | תרופה: ${drug}` : ''}`;
      return `${header}\n${c.chunk_text}`;
    })
    .join('\n\n');
  return `הקשר פרוטוקולים מחייב (ALS):\n${body}\n\nיש להסתמך על הקשר זה בלבד לגבי מינונים/הנחיות.`;
}

export const DRUG_ALIASES = DRUG_ALIAS_PATTERNS;
