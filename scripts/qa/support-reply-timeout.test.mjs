import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('lib/backend/support-chat.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const never=()=>new Promise(()=>{});
function client(mode){
 const exports={};let timeout,signal,cleared=false,requests=0;
 vm.runInNewContext(code,{exports,AbortController,setTimeout(fn,ms){assert.equal(ms,15000);timeout=fn;return 1},clearTimeout(){cleared=true},require(){return {supabase:{auth:{getSession:async()=>mode==='auth-stall'?never():{data:{session:{access_token:'fake'}}}}}}},fetch:async(_url,options)=>{
   requests++;signal=options.signal;
   if(mode==='fetch-stall')return never();
   return {ok:mode!=='http-error',json:async()=>mode==='body-stall'?never():mode==='invalid'?{unexpected:true}:mode==='null'?null:{state:mode==='skipped'?'skipped':'saved'}};
 }});
 return {run:()=>exports.saveKaFarmSupportMessage('receipt-key'),timeout:()=>timeout(),get signal(){return signal},get requests(){return requests},get cleared(){return cleared}};
}
for(const mode of ['auth-stall','fetch-stall','body-stall'])test(`${mode}: timeout releases caller without declaring save failure`,async()=>{
 const api=client(mode),result=api.run();await tick();api.timeout();const response=await result;
 assert.match(response.error.message,/not confirmed/);assert.equal(api.cleared,true);if(api.signal)assert.equal(api.signal.aborted,true);
});
for(const mode of ['invalid','null','http-error'])test(`${mode}: response cannot falsely confirm reply`,async()=>{
 const api=client(mode);assert.ok((await api.run()).error);assert.equal(api.cleared,true);
});
for(const mode of ['saved','skipped'])test(`${mode}: accepted receipt clears deadline`,async()=>{
 const api=client(mode);assert.equal((await api.run()).error,null);assert.equal(api.cleared,true);
});
