import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function database(env){
 let requests=0,checked;
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('lib/supabase.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,process:{env},URL,Request,window:{location:{hostname:'localhost'}},fetch:async()=>{requests++;return {}},require:()=>({createClient:(url,key,options)=>{checked=options.global.fetch;return {}}})});
 return {exports,send:(...args)=>checked(...args),count:()=>requests};
}
test('pass 7: missing configuration cannot send network requests',async()=>{
 const db=database({});await assert.rejects(db.send('https://configuration.invalid'),/DATABASE_NOT_CONFIGURED/);assert.equal(db.count(),0);
});
test('pass 7: malformed configuration fails closed',async()=>{
 const db=database({NEXT_PUBLIC_SUPABASE_URL:'not a URL',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public'});assert.equal(db.exports.databaseConfigured,false);
});
test('pass 7: localhost blocks known production writes',async()=>{
 const url='https://bfckjrqrixbtqqvsxgjq.supabase.co';const db=database({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:'public'});
 await assert.rejects(db.send(url+'/rest/v1/rpc/support_send_guarded',{method:'POST'}),/LOCAL_PRODUCTION_WRITE_BLOCKED/);assert.equal(db.count(),0);
});
test('pass 8: cancellation and sending use the same lock (source check)',()=>{
 const sql=fs.readFileSync('database/applied/091_support_delivery_reconciliation.sql','utf8');
 assert.equal((sql.match(/pg_advisory_xact_lock\(hashtextextended\(actor::text \|\| p_key::text,0\)\)/g)||[]).length,2);
 assert.match(sql,/if exists\(select 1 from public.support_delivery_cancellations/);
 assert.match(sql,/revoke all on public.support_delivery_cancellations from public,anon,authenticated/);
});
test('pass 6: evidence exposes all photos without an asynchronous popup (source check)',()=>{
 const source=fs.readFileSync('lib/live-evidence-pages.tsx','utf8');assert.match(source,/stored.map\(path/);assert.match(source,/evidenceLinks.map/);assert.doesNotMatch(source,/window.open/);
});
test('pass 5: stale refresh results are ignored (source check)',()=>{
 const source=fs.readFileSync('lib/support-conversation.tsx','utf8');assert.match(source,/if\(sequence!==refreshSequence.current\)return/);assert.match(source,/invalidateRefresh\(\);clearTimeout/);
});
