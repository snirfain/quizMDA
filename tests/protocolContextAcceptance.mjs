import { buildProtocolContextBlock, extractQuestionSignals, fitChunksToTokenBudget } from '../shared/protocolContext.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runDoseSignalScenario() {
  const s = extractQuestionSignals('מטופל עם אנפילקסיס, אדרנלין 0.5 mg IM למבוגר במשקל 70 kg');
  assert(s.drugs.includes('אדרנלין'), 'Expected אדרנלין signal');
  assert(s.doseTokens.some((t) => t.includes('0.5 mg')), 'Expected 0.5 mg token');
}

function runProtocolScenario() {
  const s = extractQuestionSignals('במקרה ACS עם כאב חזה מתמשך מה פרוטוקול הטיפול הראשוני?');
  assert(s.protocols.some((p) => String(p).toLowerCase().includes('acs')), 'Expected ACS protocol signal');
}

function runTokenBudgetScenario() {
  const chunks = [
    { chunk_text: 'a'.repeat(2000), chunk_tokens_est: 500, chapter: 'A' },
    { chunk_text: 'b'.repeat(6000), chunk_tokens_est: 1500, chapter: 'B' },
    { chunk_text: 'c'.repeat(10000), chunk_tokens_est: 2500, chapter: 'C' },
  ];
  const selected = fitChunksToTokenBudget(chunks, 2200);
  const total = selected.reduce((sum, c) => sum + (c.chunk_tokens_est || 0), 0);
  assert(total <= 2200, 'Token budget overflow');
}

function runContextFormattingScenario() {
  const block = buildProtocolContextBlock([
    {
      source_doc: 'ALS 2024',
      chapter: 'אנפילקסיס',
      protocol_name: 'אנפילקסיס',
      drug_name: 'אדרנלין',
      chunk_text: 'מינון מבוגר: 0.5 מ״ג IM.',
    },
  ]);
  assert(block.includes('מינון מבוגר'), 'Context block missing chunk text');
  assert(block.includes('פרוטוקול'), 'Context block missing protocol metadata');
}

function runAll() {
  runDoseSignalScenario();
  runProtocolScenario();
  runTokenBudgetScenario();
  runContextFormattingScenario();
  console.log('protocolContextAcceptance: all scenarios passed');
}

runAll();
