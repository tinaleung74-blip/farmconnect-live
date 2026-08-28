import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const ui = readFileSync('lib/farmconnect-v1.tsx', 'utf8');
const source = ui.slice(ui.indexOf('  function resetDraft(task:'), ui.indexOf('  function addCareEntry()'));
function restore(proof, busy = false) {
  const values = {};
  const cache = new Map([['old', 'old-file']]);
  const context = {
    submittingRef: { current: busy }, uploadedProofsRef: { current: cache },
    crypto: { randomUUID: () => 'new-submission-key' },
    parseDailyCareReport: () => [],
  };
  for (const name of new Set(source.match(/\bset[A-Z]\w*/g))) context[name] = (value) => { values[name] = value; };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  context.resetDraft({ id: 'task', status: 'backjob', backjobProof: proof });
  return { values, cache };
}

test('returned WATCH report keeps health, checks, feed, photos and notes', () => {
  const { values, cache } = restore({
    health_status: 'watch', daily_report: [{ period: 'Morning', time: '05:30', work: 'Fed', findings: 'Watch' }],
    checklist_results: { health: [{ label: 'Appetite normal', checked: false }], operations: [{ label: 'Water replaced', checked: true }] },
    inventory_usage: [{ inventory_item_id: 'feed', quantity: 0.25 }], actual_remaining_feed: 1.75,
    stored_paths: ['photo-path'], signed_urls: ['signed-photo'], admin_note: 'Check appetite again',
  });
  assert.equal(values.setHealthStatus, 'watch');
  assert.equal(values.setChecklistAnswers['health_checklist:Appetite normal'], false);
  assert.equal(values.setChecklistAnswers['operations_checklist:Water replaced'], true);
  assert.equal(values.setFeedUsed, '0.25');
  assert.equal(values.setActualRemainingFeed, '1.75');
  assert.equal(values.setInventoryItemId, 'feed');
  assert.equal(values.setExistingProofs[0].path, 'photo-path');
  assert.match(values.setTaskNote, /Check appetite again/);
  assert.equal(cache.size, 0);
});

test('missing old health stays unselected, never silently PASS', () => {
  const { values } = restore(null);
  assert.equal(values.setHealthStatus, '');
  assert.equal(values.setActualRemainingFeed, '');
  assert.equal(Object.keys(values.setChecklistAnswers).length, 0);
});

test('cannot switch drafts during an in-flight submission', () => {
  const { values, cache } = restore(null, true);
  assert.equal(Object.keys(values).length, 0);
  assert.equal(cache.size, 1);
});
