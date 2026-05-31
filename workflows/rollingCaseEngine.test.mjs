/**
 * Unit tests for the rolling case engine.
 * Run with the built-in Node test runner (no external dependencies):
 *
 *   node --test workflows/rollingCaseEngine.test.mjs
 *   # or
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreBranchAnswer,
  evaluateCondition,
  resolveNextBranch,
  findCycle,
  findUnreachableBranches,
  findDeadEndBranches,
  validateRollingCaseDAG,
  validateRollingCaseStructure,
  RollingCaseValidationError,
} from './rollingCaseEngine.js';

// ── Edge case 1: partial scoring in multi_choice ────────────────────────────
test('multi_choice partial scoring rewards coverage and penalizes wrong picks', () => {
  const branch = {
    question_type: 'multi_choice',
    correct_answer: { values: ['0', '1', '2'] },
  };

  // Fully correct → 1.0
  assert.equal(scoreBranchAnswer(branch, ['0', '1', '2']), 1);

  // 2 of 3 correct, no wrong picks → precision 1, recall 2/3 → (1 + 0.667)/2 ≈ 0.833
  const partial = scoreBranchAnswer(branch, ['0', '1']);
  assert.ok(partial > 0.8 && partial < 0.84, `expected ~0.833, got ${partial}`);

  // 2 correct + 1 wrong → precision 2/3, recall 2/3 → ≈ 0.667
  const withWrong = scoreBranchAnswer(branch, ['0', '1', '9']);
  assert.ok(withWrong > 0.66 && withWrong < 0.67, `expected ~0.667, got ${withWrong}`);

  // No answer → 0
  assert.equal(scoreBranchAnswer(branch, []), 0);

  // All wrong → 0
  assert.equal(scoreBranchAnswer(branch, ['7', '8']), 0);
});

// ── Edge case 2: infinite loop (cycle) detection ────────────────────────────
test('cycle detection identifies an infinite loop in transitions', () => {
  const cyclic = {
    branches: [
      { id: 'b1', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b2', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b3', question_type: 'single_choice', correct_answer: { value: '0' } },
    ],
    transitions: [
      { from_branch_id: 'b1', to_branch_id: 'b2', condition: { mode: 'always' } },
      { from_branch_id: 'b2', to_branch_id: 'b3', condition: { mode: 'always' } },
      { from_branch_id: 'b3', to_branch_id: 'b2', condition: { mode: 'always' } }, // loop b2→b3→b2
    ],
  };

  const cycle = findCycle(cyclic);
  assert.ok(Array.isArray(cycle), 'expected a cycle path array');
  assert.ok(cycle.includes('b2') && cycle.includes('b3'), `cycle should include b2 & b3, got ${cycle}`);

  // Hard validation must throw with structured Hebrew details.
  assert.throws(
    () => validateRollingCaseDAG(cyclic),
    (err) => {
      assert.ok(err instanceof RollingCaseValidationError);
      assert.ok(err.details.some((d) => d.includes('לולאה')), 'details should mention לולאה');
      return true;
    },
  );

  // Soft validation must also report the loop (blocks save).
  const softErrors = validateRollingCaseStructure(cyclic);
  assert.ok(softErrors.some((e) => e.includes('לולאות')), `soft errors should flag loop: ${softErrors}`);
});

// ── Edge case 3: valid transition via 'score_between' ───────────────────────
test("score_between transition fires only inside the [min,max] range", () => {
  const condition = { mode: 'score_between', min: 0.4, max: 0.8 };

  assert.equal(evaluateCondition(condition, null, null, 0.5), true, 'mid-range should match');
  assert.equal(evaluateCondition(condition, null, null, 0.4), true, 'lower bound inclusive');
  assert.equal(evaluateCondition(condition, null, null, 0.8), true, 'upper bound inclusive');
  assert.equal(evaluateCondition(condition, null, null, 0.39), false, 'below range');
  assert.equal(evaluateCondition(condition, null, null, 0.81), false, 'above range');

  // End-to-end: resolveNextBranch picks the branch whose score_between matches.
  const rollingCase = {
    branches: [
      { id: 'b1', question_type: 'multi_choice', correct_answer: { values: ['0', '1', '2'] } },
      { id: 'b2', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b3', question_type: 'single_choice', correct_answer: { value: '0' } },
    ],
    transitions: [
      { from_branch_id: 'b1', to_branch_id: 'b2', priority: 1, condition: { mode: 'score_between', min: 0.0, max: 0.5 } },
      { from_branch_id: 'b1', to_branch_id: 'b3', priority: 2, condition: { mode: 'score_between', min: 0.5, max: 1.0 } },
    ],
  };

  // Score 0.833 (2/3 partial) → only the second transition (0.5..1.0) matches → b3.
  const score = scoreBranchAnswer(rollingCase.branches[0], ['0', '1']);
  const next = resolveNextBranch(rollingCase, 'b1', ['0', '1'], score);
  assert.deepEqual(next, ['b3'], `expected ['b3'] for score ${score}, got ${JSON.stringify(next)}`);
});

// ── Extra coverage: a clean linear DAG passes hard validation ───────────────
test('a valid linear DAG passes validateRollingCaseDAG', () => {
  const valid = {
    branches: [
      { id: 'b1', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b2', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b3', question_type: 'single_choice', correct_answer: { value: '0' } },
    ],
    transitions: [
      { from_branch_id: 'b1', to_branch_id: 'b2', condition: { mode: 'always' } },
      { from_branch_id: 'b2', to_branch_id: 'b3', condition: { mode: 'always' } },
      // b3 is a leaf → natural ending
    ],
  };
  const result = validateRollingCaseDAG(valid);
  assert.equal(result.ok, true);
  assert.equal(result.entryId, 'b1');
  assert.deepEqual(findUnreachableBranches(valid), []);
  assert.deepEqual(findDeadEndBranches(valid), []);
});

// ── Extra coverage: dead-end (conditional with no guaranteed fallthrough) ────
test('dead-end detection flags a branch whose conditions are not exhaustive', () => {
  const deadEnd = {
    branches: [
      { id: 'b1', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b2', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b3', question_type: 'single_choice', correct_answer: { value: '0' } },
    ],
    transitions: [
      // b1 only transitions when the answer is correct → if wrong, the user is stuck.
      { from_branch_id: 'b1', to_branch_id: 'b2', condition: { mode: 'is_correct' } },
      { from_branch_id: 'b2', to_branch_id: 'b3', condition: { mode: 'always' } },
    ],
  };
  assert.deepEqual(findDeadEndBranches(deadEnd), ['b1']);
  assert.throws(() => validateRollingCaseDAG(deadEnd), RollingCaseValidationError);
});

// ── Extra coverage: unreachable branch is detected ──────────────────────────
test('unreachable branch detection', () => {
  const orphan = {
    branches: [
      { id: 'b1', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b2', question_type: 'single_choice', correct_answer: { value: '0' } },
      { id: 'b3', question_type: 'single_choice', correct_answer: { value: '0' } }, // orphan
    ],
    transitions: [
      { from_branch_id: 'b1', to_branch_id: 'b2', condition: { mode: 'always' } },
    ],
  };
  assert.deepEqual(findUnreachableBranches(orphan), ['b3']);
});
