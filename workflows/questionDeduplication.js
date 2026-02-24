/**
 * Question Deduplication Engine
 *
 * Before importing new questions, compare each one against the existing
 * question bank. Questions that are ≥ SIMILARITY_THRESHOLD similar are
 * flagged so the user can decide whether to keep, merge, or discard them.
 *
 * Similarity algorithm: Jaccard index on word-trigrams.
 *   • Fast, no external dependencies, works well for Hebrew text.
 *   • Jaccard = |A ∩ B| / |A ∪ B|  (0 = nothing in common, 1 = identical)
 *
 * Hebrew: מנוע זיהוי שאלות כפולות / דומות
 */

import { entities } from '../config/appConfig';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Minimum Jaccard similarity (0–1) to flag a new question as a duplicate. */
export const SIMILARITY_THRESHOLD = 0.80;

// ─────────────────────────────────────────────────────────────
// Text normalisation & fingerprinting
// ─────────────────────────────────────────────────────────────

/** Strip punctuation, digits, extra spaces; lower-case. */
function normalise(text) {
  return (text || '')
    .replace(/[^\u0590-\u05FFa-zA-Z\s]/g, ' ')   // keep Hebrew + Latin letters
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Split into individual words. */
function words(text) {
  return normalise(text).split(' ').filter(w => w.length > 1);
}

/**
 * Build a Set of word-bigrams from a word list.
 * Bigrams catch word-order similarity better than single words.
 */
function bigrams(wordList) {
  const set = new Set();
  for (let i = 0; i < wordList.length - 1; i++) {
    set.add(`${wordList[i]}|${wordList[i + 1]}`);
  }
  // Also add individual words for short texts
  wordList.forEach(w => set.add(w));
  return set;
}

/** Jaccard similarity between two Sets. */
function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Compute similarity (0–1) between two question texts.
 */
export function computeSimilarity(textA, textB) {
  const wA = words(textA);
  const wB = words(textB);
  // For very short questions use word-level Jaccard only
  if (wA.length < 5 || wB.length < 5) {
    return jaccard(new Set(wA), new Set(wB));
  }
  return jaccard(bigrams(wA), bigrams(wB));
}

// ─────────────────────────────────────────────────────────────
// Pre-computed fingerprint cache (avoids re-computing for large banks)
// ─────────────────────────────────────────────────────────────

/**
 * Build a fingerprint index from an array of questions.
 * Returns an array of { id, question_text, _fp } objects.
 */
function buildIndex(questions) {
  return questions.map(q => ({
    id:            q.id,
    question_text: q.question_text,
    hierarchy_id:  q.hierarchy_id,
    _fp:           bigrams(words(q.question_text)),
  }));
}

// ─────────────────────────────────────────────────────────────
// Core: find similar existing question
// ─────────────────────────────────────────────────────────────

/**
 * For a single new question text, find the most similar question in an
 * already-built index.
 *
 * @param {string}   newText      — question_text of the new question
 * @param {object[]} index        — result of buildIndex()
 * @param {number}   [threshold]  — minimum similarity to report
 * @returns {{ match: object, similarity: number } | null}
 */
export function findMostSimilar(newText, index, threshold = SIMILARITY_THRESHOLD) {
  const fpNew = bigrams(words(newText));
  let best = null;
  let bestScore = 0;

  for (const item of index) {
    const score = jaccard(fpNew, item._fp);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best && bestScore >= threshold) {
    return { match: best, similarity: bestScore };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Check an array of new questions against all existing questions in the DB.
 *
 * Returns the same array, where each question MAY have extra fields:
 *   • `_similarTo`     — { id, question_text, similarity }
 *   • `_duplicateFlag` — true when similarity >= threshold
 *
 * @param {object[]} newQuestions
 * @param {number}   [threshold]
 * @param {Function} [onProgress]   — (done, total) callback
 * @returns {Promise<object[]>}
 */
export async function checkDuplicatesAgainstDB(
  newQuestions,
  threshold = SIMILARITY_THRESHOLD,
  onProgress
) {
  if (!newQuestions || newQuestions.length === 0) return newQuestions;

  // Fetch all active/draft questions from DB
  const existing = await entities.Question_Bank.find({
    status: { $in: ['active', 'draft', 'pending_review'] },
  });

  if (existing.length === 0) {
    // Nothing to compare against
    return newQuestions;
  }

  const index = buildIndex(existing);
  const result = [];

  for (let i = 0; i < newQuestions.length; i++) {
    const q = newQuestions[i];
    onProgress?.(i + 1, newQuestions.length);

    const found = findMostSimilar(q.question_text, index, threshold);
    if (found) {
      result.push({
        ...q,
        _duplicateFlag: true,
        _similarTo: {
          id:            found.match.id,
          question_text: found.match.question_text,
          hierarchy_id:  found.match.hierarchy_id,
          similarity:    Math.round(found.similarity * 100),
        },
      });
    } else {
      result.push(q);
    }
  }

  return result;
}

/**
 * Check for duplicates WITHIN the new questions batch itself
 * (catches cases where the same question was parsed twice from the PDF).
 *
 * Marks the later occurrence with `_internalDuplicate: true`.
 */
export function checkInternalDuplicates(questions, threshold = SIMILARITY_THRESHOLD) {
  const seen = [];
  return questions.map((q, i) => {
    const fp = bigrams(words(q.question_text));
    for (const prev of seen) {
      const score = jaccard(fp, prev._fp);
      if (score >= threshold) {
        return {
          ...q,
          _internalDuplicate: true,
          _similarTo: {
            id:            `new-${prev.idx}`,
            question_text: prev.question_text,
            similarity:    Math.round(score * 100),
          },
        };
      }
    }
    seen.push({ idx: i, question_text: q.question_text, _fp: fp });
    return q;
  });
}
