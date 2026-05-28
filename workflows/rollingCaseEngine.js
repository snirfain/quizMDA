/**
 * Rolling case runtime and validation engine.
 */

function asSet(values) {
  return new Set((Array.isArray(values) ? values : []).map((x) => String(x)));
}

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
    const precision = got.size > 0 ? matches / got.size : 0;
    const recall = matches / expected.size;
    return Math.max(0, Math.min(1, (precision + recall) / 2));
  }
  return 0;
}

function evaluateCondition(condition, branch, userAnswer, branchScore) {
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
  const transitions = Array.isArray(rollingCase?.transitions) ? rollingCase.transitions : [];
  const outgoing = transitions
    .filter((t) => String(t?.from_branch_id || '') === String(currentBranchId || ''))
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  const matched = outgoing.filter((t) => evaluateCondition(t.condition || {}, null, userAnswer, branchScore));
  return matched.map((t) => String(t.to_branch_id));
}

export function validateRollingCaseStructure(rollingCase) {
  const errors = [];
  if (!rollingCase || typeof rollingCase !== 'object') return ['rolling_case חסר'];
  const branches = Array.isArray(rollingCase.branches) ? rollingCase.branches : [];
  const transitions = Array.isArray(rollingCase.transitions) ? rollingCase.transitions : [];
  if (branches.length < 3 || branches.length > 10) errors.push('נדרשים בין 3 ל-10 ענפים');
  const ids = new Set();
  for (const b of branches) {
    if (!b?.id) errors.push('ענף ללא מזהה');
    if (ids.has(b.id)) errors.push(`מזהה ענף כפול: ${b.id}`);
    ids.add(b.id);
    if (!['single_choice', 'multi_choice', 'true_false'].includes(b.question_type)) {
      errors.push(`סוג ענף לא נתמך: ${b.question_type}`);
    }
    const hasCorrect =
      b.question_type === 'multi_choice'
        ? Array.isArray(b.correct_answer?.values) && b.correct_answer.values.length > 0
        : (b.correct_answer?.value ?? b.correct_answer) != null && String(b.correct_answer?.value ?? b.correct_answer) !== '';
    if (!hasCorrect) errors.push(`ענף ${b.id} חייב לפחות תשובה נכונה אחת`);
  }
  for (const t of transitions) {
    if (!ids.has(t?.from_branch_id)) errors.push(`transition from לא קיים: ${t?.from_branch_id}`);
    if (!ids.has(t?.to_branch_id)) errors.push(`transition to לא קיים: ${t?.to_branch_id}`);
  }
  const graph = new Map();
  for (const id of ids) graph.set(id, []);
  for (const t of transitions) graph.get(t.from_branch_id)?.push(t.to_branch_id);
  const visited = new Set();
  const inStack = new Set();
  const hasCycle = (node) => {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const nxt of graph.get(node) || []) {
      if (hasCycle(nxt)) return true;
    }
    inStack.delete(node);
    return false;
  };
  for (const id of ids) {
    if (hasCycle(id)) {
      errors.push('לולאות אסורות בעץ המעברים');
      break;
    }
  }
  return errors;
}

export function computeRollingCaseTotalScore(rollingCase, answersByBranchId = {}) {
  const branches = Array.isArray(rollingCase?.branches) ? rollingCase.branches : [];
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
