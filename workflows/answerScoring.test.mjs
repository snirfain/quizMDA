import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePracticeAnswerPoints,
  PRACTICE_CORRECT_POINTS,
  PRACTICE_WRONG_POINTS,
  QUESTION_TIME_LIMIT_SECONDS,
} from '../shared/answerScoring.js';

test('wrong answer deducts 2 points', () => {
  assert.equal(computePracticeAnswerPoints(false, 30), PRACTICE_WRONG_POINTS);
  assert.equal(PRACTICE_WRONG_POINTS, -2);
});

test('correct within 10 minutes earns 1 point', () => {
  assert.equal(computePracticeAnswerPoints(true, 0), PRACTICE_CORRECT_POINTS);
  assert.equal(computePracticeAnswerPoints(true, QUESTION_TIME_LIMIT_SECONDS), PRACTICE_CORRECT_POINTS);
});

test('correct after 10 minutes earns no points', () => {
  assert.equal(computePracticeAnswerPoints(true, QUESTION_TIME_LIMIT_SECONDS + 1), 0);
});
