import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('lib/farmconnect-v1.tsx', 'utf8');
const shell = source.slice(source.indexOf('function Shell('), source.indexOf('function TopIcon'));
test('all customer URLs use one header and no old phone/tablet/more menus', () => {
  assert.match(shell, /const isCustomerV2 = role === "customer";/);
  assert.doesNotMatch(shell, /customerPhoneLinks|customerTabletLinks|customerMoreLinks|customerMoreOpen|customerNavCardStyle|\/customer\//);
  for (const page of ['wallet', 'inbox', 'support', 'settings']) assert.ok(shell.includes('/customer-v2/' + page));
  assert.match(shell, /role !== "customer" \? \(/);
});

test('redirect preserves repeated query values, IDs and receipt references', async () => {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('lib/customer-route-redirect.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code, {exports, URLSearchParams, require: () => ({redirect: url => {throw Error(url);}})});
  await assert.rejects(exports.customerRouteRedirect('payment')({searchParams: Promise.resolve({id:'abc', reference:'A & B', tag:['one','two']})}),
    {message:'/customer-v2/payment?id=abc&reference=A+%26+B&tag=one&tag=two'});
  await assert.rejects(exports.customerRouteRedirect('roosters')({searchParams:Promise.resolve({})}),
    {message:'/customer-v2/roosters'});
});

test('every retired customer entry is a redirect, never a legacy component', () => {
  for (const file of fs.readdirSync('app/customer', {recursive:true})) {
    if (!String(file).endsWith('page.tsx')) continue;
    const path = String(file).replaceAll('\\', '/');
    if (['login/page.tsx', 'register/page.tsx'].includes(path)) continue;
    const content = fs.readFileSync('app/customer/' + file, 'utf8');
    assert.doesNotMatch(content, /farmconnect-v1/, file);
    assert.match(content, /customerRouteRedirect|redirect\(|sell-rooster\/page/, file);
  }
});
