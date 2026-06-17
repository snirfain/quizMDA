/**
 * Unit tests for the adaptive practice engine's pure helpers.
 * Run with the built-in Node test runner:
 *
 *   node --test workflows/adaptivePracticeEngine.test.mjs
 *   # or
 *   npm test
 *
 * These cover the randomized question order (Fisher-Yates shuffle) and prove it
 * coexists with the no-repeat-until-quota-exhausted rule (pickNextQuestion still
 * honors the per-session exclusion set regardless of order).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, pickNextQuestion } from '../shared/adaptiveSelection.js';

// Deterministic RNG (mulberry32) so shuffle behavior is reproducible in tests.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── shuffle: must be a permutation, not mutate input, and actually reorder ────
test('shuffle returns the same elements (a permutation of the input)', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(input, seededRandom(42));
  assert.deepEqual([...out].sort((a, b) => a - b), input);
});

test('shuffle does not mutate the original array', () => {
  const input = [1, 2, 3, 4, 5];
  const copy = [...input];
  shuffle(input, seededRandom(7));
  assert.deepEqual(input, copy);
});

test('shuffle actually changes the order for a typical seed', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = shuffle(input, seededRandom(123));
  assert.notDeepEqual(out, input);
});

test('shuffle handles empty and non-array inputs safely', () => {
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle(undefined), []);
  assert.deepEqual(shuffle(null), []);
});

// ── pickNextQuestion: exclusion (no-repeat) survives any order ────────────────
const q = (id) => ({ id });

test('returns the first not-yet-served question', () => {
  const ordered = [q('a'), q('b'), q('c')];
  assert.equal(pickNextQuestion(ordered, ['a']).id, 'b');
});

test('respects exclusion regardless of shuffled order (no early repeat)', () => {
  // Simulate a shuffled bucket where only one question remains unseen.
  const ordered = shuffle([q('a'), q('b'), q('c'), q('d')], seededRandom(99));
  const served = ['a', 'b', 'c']; // everything except 'd' already served
  const next = pickNextQuestion(ordered, served);
  assert.equal(next.id, 'd', 'must serve the only remaining unseen question');
});

test('recycles only once the whole in-scope pool is exhausted', () => {
  const ordered = [q('a'), q('b'), q('c')];
  const served = ['a', 'b', 'c']; // pool exhausted this session
  const next = pickNextQuestion(ordered, served);
  assert.ok(next, 'recycles instead of returning null');
  assert.notEqual(next.id, 'c', 'avoids immediately repeating the last served question');
});

test('returns null for an empty ordered list', () => {
  assert.equal(pickNextQuestion([], ['a']), null);
  assert.equal(pickNextQuestion(undefined, []), null);
});
