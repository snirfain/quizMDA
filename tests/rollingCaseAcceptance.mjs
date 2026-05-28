import {
  computeRollingCaseTotalScore,
  resolveNextBranch,
  validateRollingCaseStructure,
} from '../workflows/rollingCaseEngine.js';

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

const sample = {
  branches: [
    { id: 'b1', question_type: 'single_choice', question_text: 'q1', correct_answer: { value: '1' } },
    { id: 'b2', question_type: 'multi_choice', question_text: 'q2', correct_answer: { values: ['0', '2'] } },
    { id: 'b3', question_type: 'true_false', question_text: 'q3', correct_answer: { value: 'true' } },
  ],
  transitions: [
    { from_branch_id: 'b1', to_branch_id: 'b2', priority: 1, condition: { mode: 'is_correct' } },
    { from_branch_id: 'b1', to_branch_id: 'b3', priority: 2, condition: { mode: 'is_incorrect' } },
  ],
};

const errs = validateRollingCaseStructure(sample);
assert(errs.length === 0, `expected valid rolling case, got: ${errs.join(', ')}`);

const s = computeRollingCaseTotalScore(sample, {
  b1: '1',
  b2: ['0'],
  b3: 'false',
});
assert(s.totalBranches === 3, 'expected 3 branches');
assert(s.rawScore > 1 && s.rawScore < 3, 'expected partial score in range');

const nextCorrect = resolveNextBranch(sample, 'b1', '1', 1);
assert(nextCorrect[0] === 'b2', 'expected correct path to b2');

const nextWrong = resolveNextBranch(sample, 'b1', '0', 0);
assert(nextWrong[0] === 'b3', 'expected incorrect path to b3');

console.log('rollingCaseAcceptance: all scenarios passed');
