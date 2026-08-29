import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const route of ['farm-buy', 'store', 'marketplace', 'marketplace/dashboard']) {
  test(`direct load or reload of ${route} redirects to Add Rooster`, () => {
    const exports = {};
    const source = fs.readFileSync(`app/customer/${route}/page.tsx`, 'utf8');
    const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
    vm.runInNewContext(code, {exports, require: () => ({redirect: url => {throw Error(url);}})});
    assert.throws(() => exports.default(), {message: '/customer-v2/add-rooster'});
    assert.doesNotMatch(source, /FarmBuy/);
  });
}
const source = fs.readFileSync('lib/farmconnect-v1.tsx', 'utf8');
const add = source.slice(source.indexOf('export function FarmBuy()'), source.indexOf('export function InventoryPage()'));
test('customer navigation cannot reopen Farm Buy', () => {
  assert.doesNotMatch(source, /\/customer\/farm-buy/);
});
test('Add Rooster uses the rooster-care-payment wizard without legacy routes', () => {
  assert.match(add, /title="Add Rooster"/);
  assert.doesNotMatch(add, /title=.*Farm Buy|\/customer\/payment/);
  assert.match(add, /const visible = roosterProducts/);
  assert.match(add, /row.product_type !== "breed_chick"\) return false/);
  assert.match(add, /1 · Rooster/);
  assert.match(add, /2 · Care/);
  assert.match(add, /3 · Payment/);
  assert.match(add, /care_preference: careOption/);
  assert.match(add, /router\.push\("\/customer-v2\/payment\?type=farm_buy"\)/);
});
