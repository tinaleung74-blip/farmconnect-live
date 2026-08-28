import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
function client() {
  const values=new Map();
  const exports={};
  const code=ts.transpileModule(fs.readFileSync('lib/pending-operation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,crypto:webcrypto,TextEncoder,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}});
  return exports.pendingOperation;
}
test('lost response reuses durable operation key',async()=>{
  const pending=client();
  assert.equal((await pending('alice.payment',{amount:500})).key,(await pending('alice.payment',{amount:500})).key);
});
test('unconfirmed payload cannot be silently changed',async()=>{
  const pending=client();await pending('alice.payment',{amount:500});
  await assert.rejects(pending('alice.payment',{amount:600}),/previous submission/);
});
test('different users do not share pending keys',async()=>{
  const pending=client();
  assert.notEqual((await pending('alice.payment',{})).key,(await pending('bob.payment',{})).key);
});
test('support only clears draft after a confirmed receipt',()=>{
  const source=fs.readFileSync('lib/support-conversation.tsx','utf8');
  const send=source.slice(source.indexOf('async function send('));
  assert.ok(send.indexOf('if(typeof data!=="string"')<send.indexOf('setBody("")'));
  assert.match(source,/p_key:item.key/);
  assert.match(source,/setTimeout\(poll,5000\)/);
});
test('support SQL uses authenticated profile mapping and atomic retry ledger',()=>{
  const source=fs.readFileSync('database/applied/090_support_delivery_guard.sql','utf8');
  assert.match(source,/where auth_user_id = actor/);
  assert.match(source,/pg_advisory_xact_lock/);
  assert.match(source,/prior.request is distinct from request_data/);
  assert.match(source,/revoke all on public.support_delivery_operations from public, anon, authenticated/);
});
