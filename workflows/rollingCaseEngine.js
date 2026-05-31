/**
 * Rolling case runtime and validation engine.
 *
 * Public API:
 *   - scoreBranchAnswer(branch, userAnswer)            → number 0..1
 *   - evaluateCondition(condition, branch, ans, score) → boolean
 *   - resolveNextBranch(rollingCase, id, ans, score)   → string[] (next branch ids)
 *   - buildTransitionGraph(rollingCase)                → { ids, outgoing, indegree }
 *   - findCycle(rollingCase)                           → string[] | null  (cycle path)
 *   - findUnreachableBranches(rollingCase)             → string[]
 *   - findDeadEndBranches(rollingCase)                 → string[]
 *   - validateRollingCaseDAG(rollingCase)              → throws RollingCaseValidationError on invalid graph
 *   - validateRollingCaseStructure(rollingCase)        → string[] (soft, used by save paths)
 *   - computeRollingCaseTotalScore(rollingCase, ans)   → { totalBranches, rawScore, percent, perBranch }
 *
 * RTL/Hebrew: all error messages returned to the user are in Hebrew.
 */

const BRANCH_TYPES = ['single_choice', 'multi_choice', 'true_false'];
const CONDITION_MODES = [
  'always',
  'is_correct',
  'is_incorrect',
  'answer_equals',
  'answer_includes',
  'score_gte',
  'score_lt',
  'score_between',
];

/** Custom error carrying structured Hebrew details about why a rolling case is invalid. */
export class RollingCaseValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'RollingCaseValidationError';
    this.details = Array.isArray(details) ? details : [details];
  }
}

function asSet(values) {
  return new Set((Array.isArray(values) ? values : []).map((x) => String(x)));
}

function getBranches(rollingCase) {
  return Array.isArray(rollingCase?.branches) ? rollingCase.branches : [];
}

function getTransitions(rollingCase) {
  return Array.isArray(rollingCase?.transitions) ? rollingCase.transitions : [];
}

// ─────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────

export function scoreBranchAnswer(branch, userAnswer) {
  if (!branch) return 0;
  const type = branch.question_type;
  if (type === 'single_choice' || type === 'true_false') {
    const expected = String(branch.correct_answer?.value ?? branch.correct_answer ?? '');
    return String(userAnswer ?? '') === expected ? 1 : 0;
  }
  if (type === 'multi_choice') {
    const expected = asSet(branch.correct_answer?.values ?? []);
    const got = asSet(Array.isArray(userAnswer) ? userAnswer : userAnswer != null ? [userAnswer] : []);
    if (expected.size === 0) return 0;
    let matches = 0;
    for (const v of got) if (expected.has(v)) matches++;
    // Penalize wrong selections via precision; reward coverage via recall.
    const precision = got.size > 0 ? matches / got.size : 0;
    const recall = matches / expected.size;
    return Math.max(0, Math.min(1, (precision + recall) / 2));
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Transition condition evaluation
// ─────────────────────────────────────────────────────────────

export function evaluateCondition(condition, _branch, userAnswer, branchScore) {
  const mode = condition?.mode || 'always';
  if (mode === 'always') return true;
  if (mode === 'is_correct') return branchScore >= 0.999;
  if (mode === 'is_incorrect') return branchScore < 0.999;
  if (mode === 'answer_equals') return String(userAnswer ?? '') === String(condition?.value ?? '');
  if (mode === 'answer_includes') {
    const values = Array.isArray(userAnswer) ? userAnswer.map(String) : [String(userAnswer ?? '')];
    return values.includes(String(condition?.value ?? ''));
  }
  if (mode === 'score_gte') return branchScore >= Number(condition?.value ?? 1);
  if (mode === 'score_lt') return branchScore < Number(condition?.value ?? 1);
  if (mode === 'score_between') {
    const min = Number(condition?.min ?? 0);
    const max = Number(condition?.max ?? 1);
    return branchScore >= min && branchScore <= max;
  }
  return false;
}

export function resolveNextBranch(rollingCase, currentBranchId, userAnswer, branchScore) {
  const transitions = getTransitions(rollingCase);
  const outgoing = transitions
    .filter((t) => String(t?.from_branch_id || '') === String(currentBranchId || ''))
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  const matched = outgoing.filter((t) => evaluateCondition(t.condition || {}, null, userAnswer, branchScore));
  return matched.map((t) => String(t.to_branch_id));
}

// ─────────────────────────────────────────────────────────────
// Graph construction & analysis
// ─────────────────────────────────────────────────────────────

/**
 * Build adjacency / indegree maps for the transition graph.
 * Only transitions whose endpoints reference existing branch ids are included.
 */
export function buildTransitionGraph(rollingCase) {
  const branches = getBranches(rollingCase);
  const transitions = getTransitions(rollingCase);
  const ids = branches.map((b) => String(b?.id ?? ''));
  const idSet = new Set(ids);

  const outgoing = new Map();
  const indegree = new Map();
  for (const id of ids) {
    outgoing.set(id, []);
    indegree.set(id, 0);
  }

  for (const t of transitions) {
    const from = String(t?.from_branch_id ?? '');
    const to = String(t?.to_branch_id ?? '');
    if (!idSet.has(from) || !idSet.has(to)) continue; // dangling edges handled separately
    outgoing.get(from).push(to);
    indegree.set(to, (indegree.get(to) || 0) + 1);
  }

  return { ids, idSet, outgoing, indegree };
}

/**
 * Detect a cycle in the transition graph using DFS with a recursion stack.
 * Returns the cycle path (e.g. ["b2","b3","b2"]) or null when the graph is acyclic.
 */
export function findCycle(rollingCase) {
  const { ids, outgoing } = buildTransitionGraph(rollingCase);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(ids.map((id) => [id, WHITE]));
  const parent = new Map();

  let cyclePath = null;

  const dfs = (node) => {
    color.set(node, GRAY);
    for (const next of outgoing.get(node) || []) {
      if (cyclePath) return;
      if (color.get(next) === GRAY) {
        // Reconstruct cycle: walk parents from `node` back to `next`.
        const path = [next];
        let cur = node;
        while (cur !== undefined && cur !== next) {
          path.push(cur);
          cur = parent.get(cur);
        }
        path.push(next);
        cyclePath = path.reverse();
        return;
      }
      if (color.get(next) === WHITE) {
        parent.set(next, node);
        dfs(next);
        if (cyclePath) return;
      }
    }
    color.set(node, BLACK);
  };

  for (const id of ids) {
    if (color.get(id) === WHITE) dfs(id);
    if (cyclePath) break;
  }
  return cyclePath;
}

/** The entry branch is the first branch with indegree 0, else the first branch. */
export function getEntryBranchId(rollingCase) {
  const { ids, indegree } = buildTransitionGraph(rollingCase);
  if (ids.length === 0) return null;
  const zeroIn = ids.find((id) => (indegree.get(id) || 0) === 0);
  return zeroIn ?? ids[0];
}

/**
 * Branches that cannot be reached from the entry branch (orphans / disconnected).
 */
export function findUnreachableBranches(rollingCase) {
  const { ids, outgoing } = buildTransitionGraph(rollingCase);
  if (ids.length === 0) return [];
  const entry = getEntryBranchId(rollingCase);
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const node = stack.pop();
    if (node == null || seen.has(node)) continue;
    seen.add(node);
    for (const next of outgoing.get(node) || []) stack.push(next);
  }
  return ids.filter((id) => !seen.has(id));
}

/** True when a branch is explicitly marked as a terminal (valid case ending). */
function isTerminalBranch(branch, rollingCase) {
  if (!branch) return false;
  if (branch.is_terminal === true) return true;
  const terminalIds = Array.isArray(rollingCase?.terminal_branch_ids)
    ? rollingCase.terminal_branch_ids.map(String)
    : [];
  return terminalIds.includes(String(branch.id));
}

/**
 * A branch "guarantees progress" when, for every possible answer/score, at least
 * one outgoing transition will fire. This prevents runtime dead-ends where a user
 * answers a branch and the engine has nowhere to send them.
 *
 * Guaranteed when:
 *   - it has no outgoing transitions (it is a leaf → natural ending), or
 *   - it has an `always` transition, or
 *   - it has both `is_correct` and `is_incorrect` (covers the full score range), or
 *   - it has a `score_lt` and a `score_gte` whose thresholds overlap to cover [0,1], or
 *   - (true_false) `answer_equals` transitions cover both "true" and "false".
 */
function branchGuaranteesProgress(branch, outgoingTransitions) {
  if (!outgoingTransitions || outgoingTransitions.length === 0) return true; // leaf = valid end

  const modes = outgoingTransitions.map((t) => t?.condition?.mode || 'always');
  if (modes.includes('always')) return true;
  if (modes.includes('is_correct') && modes.includes('is_incorrect')) return true;

  // score_lt(x) + score_gte(y) with y <= x covers the whole [0,1] range.
  const ltVals = outgoingTransitions
    .filter((t) => t?.condition?.mode === 'score_lt')
    .map((t) => Number(t.condition.value));
  const gteVals = outgoingTransitions
    .filter((t) => t?.condition?.mode === 'score_gte')
    .map((t) => Number(t.condition.value));
  for (const lt of ltVals) {
    for (const gte of gteVals) {
      if (Number.isFinite(lt) && Number.isFinite(gte) && gte <= lt) return true;
    }
  }

  // true_false branch fully covered by answer_equals true + false.
  if (branch?.question_type === 'true_false') {
    const eqVals = new Set(
      outgoingTransitions
        .filter((t) => t?.condition?.mode === 'answer_equals')
        .map((t) => String(t.condition.value)),
    );
    if (eqVals.has('true') && eqVals.has('false')) return true;
  }

  return false;
}

/**
 * Branches that are dead-ends: they have outgoing transitions, are not terminal,
 * yet there exist answers/scores for which no transition fires (user gets stuck).
 */
export function findDeadEndBranches(rollingCase) {
  const branches = getBranches(rollingCase);
  const transitions = getTransitions(rollingCase);
  const deadEnds = [];
  for (const b of branches) {
    const id = String(b?.id ?? '');
    const out = transitions.filter((t) => String(t?.from_branch_id ?? '') === id);
    if (out.length === 0) continue; // leaf → handled as a natural ending
    if (isTerminalBranch(b, rollingCase)) continue;
    if (!branchGuaranteesProgress(b, out)) deadEnds.push(id);
  }
  return deadEnds;
}

// ─────────────────────────────────────────────────────────────
// Hard validation (throws)
// ─────────────────────────────────────────────────────────────

/**
 * Strict, no-compromise DAG validation. Throws RollingCaseValidationError with a
 * detailed Hebrew message when the rolling case is not a valid directed acyclic
 * graph, has unreachable branches, or contains runtime dead-ends.
 *
 * @returns {{ ok: true, entryId: string, order: string[] }}
 */
export function validateRollingCaseDAG(rollingCase) {
  if (!rollingCase || typeof rollingCase !== 'object') {
    throw new RollingCaseValidationError('מבנה השאלה המתגלגלת חסר או אינו תקין', ['rolling_case חסר']);
  }
  const branches = getBranches(rollingCase);
  const transitions = getTransitions(rollingCase);
  const details = [];

  if (branches.length === 0) {
    throw new RollingCaseValidationError('אין ענפים בשאלה המתגלגלת', ['נדרש לפחות ענף אחד']);
  }

  // 1) Dangling transitions (reference a non-existent branch).
  const idSet = new Set(branches.map((b) => String(b?.id ?? '')));
  for (const t of transitions) {
    const from = String(t?.from_branch_id ?? '');
    const to = String(t?.to_branch_id ?? '');
    if (!idSet.has(from)) details.push(`מעבר ממקור שאינו קיים: "${from || '—'}"`);
    if (!idSet.has(to)) details.push(`מעבר ליעד שאינו קיים: "${to || '—'}"`);
  }

  // 2) Cycle detection (DAG requirement).
  const cycle = findCycle(rollingCase);
  if (cycle) {
    details.push(`זוהתה לולאה בטרנזיציות: ${cycle.join(' → ')}`);
  }

  // 3) Unreachable branches.
  const unreachable = findUnreachableBranches(rollingCase);
  if (unreachable.length > 0) {
    details.push(`ענפים שאי אפשר להגיע אליהם: ${unreachable.join(', ')}`);
  }

  // 4) Dead-ends (branch with outgoing edges but no guaranteed next step).
  const deadEnds = findDeadEndBranches(rollingCase);
  if (deadEnds.length > 0) {
    details.push(
      `ענפים ללא מוצא מובטח (חסר מעבר "תמיד" או כיסוי מלא של נכון/שגוי): ${deadEnds.join(', ')}`,
    );
  }

  if (details.length > 0) {
    throw new RollingCaseValidationError(
      'מבנה השאלה המתגלגלת אינו תקין ולא ניתן לשמור אותו',
      details,
    );
  }

  // Build a topological order for callers that want a deterministic traversal.
  const { ids, outgoing, indegree } = buildTransitionGraph(rollingCase);
  const order = [];
  const queue = ids.filter((id) => (indegree.get(id) || 0) === 0);
  const localIndeg = new Map(ids.map((id) => [id, indegree.get(id) || 0]));
  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const next of outgoing.get(node) || []) {
      localIndeg.set(next, localIndeg.get(next) - 1);
      if (localIndeg.get(next) === 0) queue.push(next);
    }
  }

  return { ok: true, entryId: getEntryBranchId(rollingCase), order };
}

// ─────────────────────────────────────────────────────────────
// Soft validation (returns string[]) — used by save paths
// ─────────────────────────────────────────────────────────────

export function validateRollingCaseStructure(rollingCase) {
  const errors = [];
  if (!rollingCase || typeof rollingCase !== 'object') return ['rolling_case חסר'];
  const branches = getBranches(rollingCase);
  const transitions = getTransitions(rollingCase);

  if (branches.length < 3 || branches.length > 10) errors.push('נדרשים בין 3 ל-10 ענפים');

  const ids = new Set();
  for (const b of branches) {
    if (!b?.id) errors.push('ענף ללא מזהה');
    if (ids.has(b.id)) errors.push(`מזהה ענף כפול: ${b.id}`);
    ids.add(b.id);
    if (!BRANCH_TYPES.includes(b.question_type)) {
      errors.push(`סוג ענף לא נתמך: ${b.question_type}`);
    }
    if (b.question_type === 'true_false') {
      const tfVal = String(b.correct_answer?.value ?? b.correct_answer ?? '');
      if (tfVal !== 'true' && tfVal !== 'false') {
        errors.push(`ענף ${b.id}: שאלת נכון/לא נכון חייבת תשובה נכונה אחת (true או false)`);
      }
    }
    const hasCorrect =
      b.question_type === 'multi_choice'
        ? Array.isArray(b.correct_answer?.values) && b.correct_answer.values.length > 0
        : (b.correct_answer?.value ?? b.correct_answer) != null &&
          String(b.correct_answer?.value ?? b.correct_answer) !== '';
    if (!hasCorrect) errors.push(`ענף ${b.id} חייב לפחות תשובה נכונה אחת`);
  }

  for (const t of transitions) {
    if (!ids.has(t?.from_branch_id)) errors.push(`מעבר ממקור שאינו קיים: ${t?.from_branch_id}`);
    if (!ids.has(t?.to_branch_id)) errors.push(`מעבר ליעד שאינו קיים: ${t?.to_branch_id}`);
    const mode = t?.condition?.mode || 'always';
    if (!CONDITION_MODES.includes(mode)) errors.push(`תנאי מעבר לא נתמך: ${mode}`);
  }

  // Reuse the hard DAG checks as soft errors so saving is blocked on invalid graphs
  // without throwing (the caller aggregates the returned strings).
  const cycle = findCycle(rollingCase);
  if (cycle) errors.push(`לולאות אסורות בעץ המעברים: ${cycle.join(' → ')}`);

  const unreachable = findUnreachableBranches(rollingCase);
  if (unreachable.length > 0) errors.push(`ענפים שאי אפשר להגיע אליהם: ${unreachable.join(', ')}`);

  const deadEnds = findDeadEndBranches(rollingCase);
  if (deadEnds.length > 0) errors.push(`ענפים ללא מוצא מובטח: ${deadEnds.join(', ')}`);

  return errors;
}

export function computeRollingCaseTotalScore(rollingCase, answersByBranchId = {}) {
  const branches = getBranches(rollingCase);
  let sum = 0;
  const perBranch = [];
  for (const b of branches) {
    const score = scoreBranchAnswer(b, answersByBranchId[b.id]);
    sum += score;
    perBranch.push({ branch_id: b.id, score });
  }
  return {
    totalBranches: branches.length,
    rawScore: sum,
    percent: branches.length ? (sum / branches.length) * 100 : 0,
    perBranch,
  };
}
