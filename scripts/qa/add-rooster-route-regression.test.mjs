import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const route of ['farm-buy', 'store', 'marketplace', 'marketplace/dashboard']) {
  test(`direct load or reload of ${route} redirects to the one-page rooster app`, () => {
    const exports = {};
    const source = fs.readFileSync(`app/customer/${route}/page.tsx`, 'utf8');
    const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
    vm.runInNewContext(code, {exports, require: () => ({redirect: url => {throw Error(url);}})});
    assert.throws(() => exports.default(), {message: '/customer-v2/roosters'});
    assert.doesNotMatch(source, /FarmBuy/);
  });
}
const source = fs.readFileSync('lib/farmconnect-v1.tsx', 'utf8');
const roosters = source.slice(source.indexOf('function AddRoosterOrderModal'), source.indexOf('export function CustomerRoosterDiaryV2'));
test('customer navigation cannot reopen Farm Buy', () => {
  assert.doesNotMatch(source, /\/customer\/farm-buy/);
});
test('Add Rooster is an in-page order modal with pending-order feedback', () => {
  assert.match(roosters, /function AddRoosterOrderModal/);
  assert.match(roosters, /Choose a rooster breed/);
  assert.match(roosters, /Add care now\?/);
  assert.match(roosters, /Submit payment proof/);
  assert.match(roosters, /submitManualPaymentRequest/);
  assert.match(roosters, /Purchase Pending/);
  assert.match(roosters, /pendingOrders/);
  assert.doesNotMatch(roosters, /router\.push\("\/customer-v2\/payment/);
});
