/**
 * Unit tests for the resilient question-bank sync decision logic.
 * Run with the built-in Node test runner (no external dependencies):
 *
 *   node --test workflows/syncRetry.test.mjs
 *   # or
 *   npm test
 *
 * These cover the core fix: a brand-new client (no local cache) must keep
 * retrying on transient failures until real questions arrive, instead of
 * giving up after a single failure and showing only the 2 seed questions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldRetrySync,
  backoffDelay,
  SYNC_BASE_BACKOFF_MS,
  SYNC_MAX_BACKOFF_MS,
} from '../shared/syncRetry.js';

// ── Fresh machine (no cache): transient failures must be retried ─────────────
test('retries when there is no cache and the sync was a transient skip', () => {
  assert.equal(shouldRetrySync({ fetched: 0, skipped: true, transient: true }, false), true);
});

test('retries when there is no cache and the sync errored (network/server)', () => {
  assert.equal(shouldRetrySync({ fetched: 0, error: 'boom', transient: true }, false), true);
});

test('retries when there is no cache and no result yet', () => {
  assert.equal(shouldRetrySync(null, false), true);
});

// ── Success: real questions arrived → never retry ────────────────────────────
test('stops once real questions are fetched, even without a prior cache', () => {
  assert.equal(shouldRetrySync({ fetched: 8944 }, false), false);
});

test('stops on success even when a cache already exists', () => {
  assert.equal(shouldRetrySync({ fetched: 8944 }, true), false);
});

// ── Existing real cache: a transient no-op is harmless → don't hammer ────────
test('does not retry transient failures when a real cache already exists', () => {
  assert.equal(shouldRetrySync({ fetched: 0, skipped: true, transient: true }, true), false);
});

// ── Unauthorized: a fresh token is required → retrying is pointless ───────────
test('does not retry on unauthorized even without a cache', () => {
  assert.equal(shouldRetrySync({ fetched: 0, skipped: true, reason: 'unauthorized' }, false), false);
});

// ── Backoff grows exponentially and is capped ────────────────────────────────
test('backoff grows exponentially from the base delay', () => {
  assert.equal(backoffDelay(1), SYNC_BASE_BACKOFF_MS);
  assert.equal(backoffDelay(2), SYNC_BASE_BACKOFF_MS * 2);
  assert.equal(backoffDelay(3), SYNC_BASE_BACKOFF_MS * 4);
});

test('backoff is capped at the maximum delay', () => {
  assert.equal(backoffDelay(50), SYNC_MAX_BACKOFF_MS);
  assert.ok(backoffDelay(10) <= SYNC_MAX_BACKOFF_MS);
});
