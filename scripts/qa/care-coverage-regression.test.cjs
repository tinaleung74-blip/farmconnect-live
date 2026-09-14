const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve('lib/care-coverage.ts');
const mod = new Module(filename);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, filename);
const { selectRoosterCarePlan, careCoverageStatus } = mod.exports;

test('new draft cannot hide active care on the same rooster', () => {
  const plans = [{ customer_animal_id: 'a', status: 'draft' }, { customer_animal_id: 'a', status: 'active' }];
  assert.equal(selectRoosterCarePlan(plans, 'a').status, 'active');
});
test('never borrow another rooster coverage', () => {
  assert.equal(selectRoosterCarePlan([{ customer_animal_id: 'a', status: 'active' }], 'b'), null);
});
test('closed plans do not grant coverage', () => {
  for (const status of ['expired', 'cancelled', 'completed']) {
    assert.equal(selectRoosterCarePlan([{ customer_animal_id: 'a', status }], 'a'), null);
  }
});
test('every open monthly state has an explicit label', () => {
  for (const status of ['draft','payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused']) {
    assert.notEqual(careCoverageStatus(status, '').badge, 'No Active Care');
  }
});
test('no plan means no active care, never paid by inference', () => {
  assert.equal(careCoverageStatus('', '').badge, 'No Active Care');
});
test('failed refresh is unknown, not no care', () => {
  assert.equal(careCoverageStatus('', '', 1, 30, true).badge, 'Status unavailable');
});
test('active daily is visible while monthly is under review', () => {
  assert.equal(careCoverageStatus('payment_submitted', 'assigned').badge, 'Daily Active');
});
test('paid awaiting setup is not described as already active', () => {
  assert.equal(careCoverageStatus('paid_pending_setup', '').badge, 'Monthly Paid');
  assert.match(careCoverageStatus('paid_pending_setup', '').label, /do not pay again/);
});
// Source contract only. These are NOT substitutes for transaction/RLS DB tests.
test('approval RPC retains guards and does not swallow assignment failure', () => {
  const sql = fs.readFileSync('database/pending/109_care_payment_approve_assign.sql', 'utf8');
  for (const pattern of [/public.is_admin\(\)/, /for update/, /payment_request_id=v_payment.id/, /profile_id=v_payment.profile_id/, /admin_review_manual_payment_guarded/, /admin_assign_care_plan/, /admin_assign_care_request/, /from public,anon/]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /exception\s+when/i);
});
