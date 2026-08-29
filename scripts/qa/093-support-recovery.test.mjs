import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const key='11111111-1111-4111-8111-111111111111';
const transpile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;

async function route(options={}) {
 const exports={};const filters=[];const writes=[];let generatedFrom;let clients=0;
 const service={from(){return {select(){return this},eq(k,v){filters.push([k,v]);return this},async maybeSingle(){return {data:options.missing?null:{request:{role:'customer',body:'saved question',escalate:!!options.escalate},reply_message_id:options.already?'reply':null}}}}},async rpc(name,args){writes.push({name,args});return {data:options.skip?null:'reply'}}};
 vm.runInNewContext(transpile('app/api/support/reply/route.ts'),{exports,Response,URL,process:{env:{NEXT_PUBLIC_SUPABASE_URL:options.production?'https://bfckjrqrixbtqqvsxgjq.supabase.co':'https://isolated.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:options.noKey?'':'server-secret'}},require(name){
  if(name==='@supabase/supabase-js')return {createClient(){clients++;return clients===1?{auth:{getUser:async()=>({data:{user:options.invalidUser?null:{id:'verified-user'}},error:null})}}:service}};
  if(name==='@/lib/kafarm-brain')return {getKaFarmReply(body,role){generatedFrom={body,role};return 'server-generated reply'}};
  throw Error(name);
 }});
 const request=new Request(options.local?'http://localhost:3000/api/support/reply':'https://app.example/api/support/reply',{method:'POST',headers:options.noToken?{}:{Authorization:'Bearer verified-token','Content-Type':'application/json'},body:JSON.stringify(options.input || {operationKey:key})});
 const response=await exports.POST(request);
 return {status:response.status,body:await response.json(),filters,writes,generatedFrom,clients};
}
test('trusted reply uses verified actor and persisted message, not browser text',async()=>{
 const result=await route();assert.equal(result.status,200);assert.deepEqual(result.filters,[['user_id','verified-user'],['operation_key',key]]);
 assert.equal(result.generatedFrom.body,'saved question');assert.equal(result.writes[0].args.p_actor,'verified-user');assert.equal(result.writes[0].args.p_body,'server-generated reply');
});
test('browser cannot supply reply body, role or actor',async()=>{
 for(const field of ['body','role','actor']){const result=await route({input:{operationKey:key,[field]:'forged'}});assert.equal(result.status,400);assert.equal(result.writes.length,0);}
});
test('invalid login or another user receipt cannot save replies',async()=>{
 for(const [options,status] of [[{noToken:true},401],[{invalidUser:true},401],[{missing:true},404]]){const result=await route(options);assert.equal(result.status,status);assert.equal(result.writes.length,0);}
});
test('existing reply or escalated receipt never creates another reply',async()=>{
 for(const options of [{already:true},{escalate:true}]){const result=await route(options);assert.equal(result.status,200);assert.equal(result.writes.length,0);}
});
test('local production and missing server configuration fail closed',async()=>{
 assert.equal((await route({local:true,production:true})).status,403);
 assert.equal((await route({noKey:true})).status,503);
});

async function support(options={}) {
 const exports={};const states=[],refs=[],effects=[];let stateIndex=0,refIndex=0,effectIndex=0;let tree;let reads=0;const listeners=new Map();const values=new Map(options.saved?[['farmconnect.support.pending.p',options.saved]]:[]);
 const jsx=(type,props)=>({type,props});const queued=[];
 vm.runInNewContext(transpile('lib/support-conversation.tsx'),{exports,crypto:{randomUUID:()=>key},setTimeout:()=>0,clearTimeout(){},localStorage:{get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k),confirm:()=>options.confirm!==false},require(name){
  if(name==='react')return {
   useState(initial){const n=stateIndex++;if(!(n in states))states[n]=initial;return [states[n],value=>states[n]=typeof value==='function'?value(states[n]):value]},
   useRef(initial){const n=refIndex++;return refs[n] ||= {current:initial}},useCallback:fn=>fn,
   useEffect(fn,deps){const n=effectIndex++;const previous=effects[n];if(!previous || deps.some((v,i)=>v!==previous.deps[i])){previous?.cleanup?.();effects[n]={deps};queued.push(()=>effects[n].cleanup=fn());}}
  };
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='@/lib/farmconnect-data')return {getCurrentProfile:async()=>({id:'p',role:'customer'})};
  if(name==='@/lib/backend/support-chat')return {getLatestSupportSessionId:async()=>{reads++;if(options.failFirst && reads===1)return {error:{message:'offline'}};return {data:{id:'session'}}},getSupportMessages:async()=>({data:[]}),getSupportSessionStatus:async()=>({data:{status:'open'}})};
  if(name==='@/lib/recovery-guard')return {safeFingerprint:async()=> 'safe-fingerprint',retrySafeRead:fn=>fn(),beginRecoveryOperation:async()=>({status:'created',duplicate:false}),markRecoverySending:async()=>({status:'sending',duplicate:false}),reconcileRecoveryOperation:async()=>({state:'completed',verified:true,result_reference:receipt})};
  if(name==='@/lib/supabase')return {supabase:{rpc(){throw Error('Initialization must not send messages')}}};
  return {};
 }});
 async function render(){stateIndex=refIndex=effectIndex=0;tree=exports.SupportConversation({role:'customer'});while(queued.length)queued.shift()();await new Promise(resolve=>setImmediate(resolve));}
 function find(label,n=tree){if(!n || typeof n!=='object')return;if(Array.isArray(n))return n.map(x=>find(label,x)).find(Boolean);if(n.type==='button'&&n.props.children===label)return n;if(n.props?.children!==undefined)return find(label,n.props.children)}
 await render();await render();
 return {states,values,listeners,render,find};
}
test('initial network failure recovers through Retry loading',async()=>{
 const ui=await support({failFirst:true});assert.equal(ui.states[8],false);
 ui.find('Retry loading').props.onClick();await ui.render();assert.equal(ui.states[8],true);assert.equal(ui.states[4],'');
});
test('online event retries initialization without sending anything',async()=>{
 const ui=await support({failFirst:true});ui.listeners.get('online')();await ui.render();assert.equal(ui.states[8],true);
});
test('damaged draft keeps history accessible and requires explicit recovery',async()=>{
 const ui=await support({saved:'{broken'});assert.equal(ui.states[8],true);assert.equal(ui.find('Send').props.disabled,true);
 ui.find('Keep recovery copy and start a new draft').props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.values.get(`farmconnect.support.pending.p.recovery.${key}`),'{broken');assert.equal(ui.values.has('farmconnect.support.pending.p'),false);assert.equal(ui.states[2],'');
});
test('declining damaged draft recovery leaves original untouched',async()=>{
 const ui=await support({saved:'{broken',confirm:false});ui.find('Keep recovery copy and start a new draft').props.onClick();assert.equal(ui.values.get('farmconnect.support.pending.p'),'{broken');
});
test('valid uncertain operation is preserved after initialization retry',async()=>{
 const saved=JSON.stringify({key,session:null,body:'keep this',escalate:false});const ui=await support({saved,failFirst:true});
 ui.find('Retry loading').props.onClick();await ui.render();assert.equal(ui.states[6].key,key);assert.equal(ui.values.get(`farmconnect.support.pending.p.operation.${key}`),saved);assert.equal(ui.values.has('farmconnect.support.pending.p'),false);
});
test('093 SQL contract restricts trusted writer and serializes duplicate replies',()=>{
 const sql=fs.readFileSync('database/applied/093_support_trusted_replies.sql','utf8');
 assert.match(sql,/raise exception 'TRUSTED_REPLY_REQUIRED'/);
 assert.match(sql,/revoke all on function public\.support_save_trusted_reply\(uuid,uuid,text\) from public,anon,authenticated/);
 assert.match(sql,/auth\.role\(\) is distinct from 'service_role'/);
 assert.ok(sql.indexOf('pg_advisory_xact_lock')<sql.indexOf('delivery.reply_message_id is not null'));
 assert.ok(sql.indexOf('session_status not in')<sql.indexOf('insert into public.support_chat_messages'));
});
