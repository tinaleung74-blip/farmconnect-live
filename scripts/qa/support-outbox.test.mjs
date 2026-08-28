import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('lib/support-conversation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',receipt='33333333-3333-4333-8333-333333333333';
const account='farmconnect.support.pending.p';
const slot=key=>`${account}.operation.${key}`;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
async function mount(store=new Map(),options={}){
 const states=[],refs=[],effects=[];let si=0,ri=0,ei=0,tree;const tasks=[],calls=[],replies=[],timers=new Map();let timerId=0,keyCount=0,profileCalls=0;
 const exports={};const jsx=(type,props)=>({type,props});
 vm.runInNewContext(code,{exports,setTimeout(fn,ms){const id=++timerId;if(ms===20000)timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)},crypto:{randomUUID:()=>options.key || (keyCount++===0?a:b)},window:{addEventListener(){},removeEventListener(){},confirm:()=>true},localStorage:{
   get length(){return store.size},key:i=>[...store.keys()][i]??null,getItem:k=>store.get(k)??null,
   setItem(k,v){if(options.failReplyWrite && JSON.parse(v).phase==='reply')throw Error('Storage full');store.set(k,v)},removeItem:k=>store.delete(k),
 },require(name){
  if(name==='react')return {useState(initial){const n=si++;if(!(n in states))states[n]=initial;return [states[n],v=>states[n]=typeof v==='function'?v(states[n]):v]},useRef(initial){return refs[ri++] ||= {current:initial}},useCallback:fn=>fn,useEffect(fn,deps){const n=ei++;const prev=effects[n];if(!prev||deps.some((v,i)=>v!==prev.deps[i])){prev?.cleanup?.();effects[n]={deps};tasks.push(()=>effects[n].cleanup=fn());}}};
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='@/lib/farmconnect-data')return {getCurrentProfile:async()=>{profileCalls++;if(options.stallProfile && profileCalls>1)return new Promise(()=>{});return {id:options.profileId || 'p',role:options.role || 'customer'}}};
  if(name==='@/lib/kafarm-brain')return {shouldEscalateToAdmin:()=>!!options.escalate};
  if(name==='@/lib/supabase')return {supabase:{rpc:async(name,args)=>{calls.push({name,args});return options.rpc?options.rpc(name,args):{data:receipt}}}};
  if(name==='@/lib/backend/support-chat')return {getLatestSupportSessionId:async()=>({data:{id:receipt}}),getSupportMessages:async()=>({data:[]}),getSupportSessionStatus:async()=>({data:{status:'open'}}),saveKaFarmSupportMessage:async key=>{replies.push(key);return options.reply?options.reply(key):{error:null}}};
  throw Error(name);
 }});
 async function render(){si=ri=ei=0;tree=exports.SupportConversation({role:options.role || 'customer'});while(tasks.length)tasks.shift()();await tick();}
 function find(type,label,n=tree){if(!n||typeof n!=='object')return;if(Array.isArray(n))return n.map(x=>find(type,label,x)).find(Boolean);if(n.type===type&&(!label||n.props.children===label))return n;if(n.props?.children!==undefined)return find(type,label,n.props.children);}
 async function type(text){assert.equal(find('textarea').props.disabled,false);find('textarea').props.onChange({target:{value:text}});await render();}
 async function click(label){const button=find('button',label);assert.ok(button,`missing ${label}`);assert.equal(button.props.disabled,false);button.props.onClick();await tick();}
 await render();await render();return {store,states,calls,replies,render,type,click,timeout:()=>{for(const fn of timers.values())fn()}};
}
test('two tabs: completing A cannot erase unconfirmed B, including after reload',async()=>{
 const store=new Map(),da=deferred(),db=deferred();
 const first=await mount(store,{key:a,rpc:()=>da.promise});const second=await mount(store,{key:b,rpc:name=>name==='support_send_guarded'?db.promise:{error:{message:'offline'}}});
 await first.type('first');await first.click('Send');await second.type('second');await second.click('Send');
 assert.equal(store.size,2);da.resolve({data:receipt});await tick();assert.equal(store.has(slot(a)),false);assert.equal(JSON.parse(store.get(slot(b))).key,b);
 db.resolve({error:{message:'offline'}});await tick();assert.equal(JSON.parse(store.get(slot(b))).key,b);
 const reopened=await mount(store);assert.equal(reopened.states[6].key,b);assert.equal(reopened.states[2],'second');
});
for(const role of ['customer','caretaker'])test(`${role}: reply failure survives reload; reply-only retry never resends user message`,async()=>{
 const store=new Map();const first=await mount(store,{role,reply:async()=>({error:{message:'offline'}})});
 await first.type('hello');await first.click('Send');assert.equal(first.calls.length,1);assert.equal(JSON.parse(store.get(slot(a))).phase,'reply');
 const reopened=await mount(store,{role});assert.equal(reopened.states[6],null);assert.equal(reopened.states[12][0].phase,'reply');await reopened.click('Retry reply');
 assert.equal(reopened.calls.length,0);assert.deepEqual(reopened.replies,[a]);assert.equal(store.size,0);
});
test('network exception during reply keeps durable retry record',async()=>{
 const ui=await mount(new Map(),{reply:async()=>{throw Error('network')}});await ui.type('hello');await ui.click('Send');
 assert.equal(JSON.parse(ui.store.get(slot(a))).phase,'reply');assert.equal(ui.states[6],null);assert.equal(ui.states[12][0].phase,'reply');
});
test('storage failure between acknowledgement and reply retains original send key',async()=>{
 const store=new Map();const ui=await mount(store,{failReplyWrite:true});await ui.type('hello');await ui.click('Send');
 assert.equal(JSON.parse(store.get(slot(a))).key,a);assert.equal(JSON.parse(store.get(slot(a))).phase,undefined);assert.equal(ui.replies.length,0);
 const reopened=await mount(store);await reopened.click('Retry');assert.equal(reopened.calls[0].args.p_key,a);assert.equal(store.size,0);
});
test('opening during an unfinished reply request restores reply-only recovery',async()=>{
 const waiting=deferred();const store=new Map();const first=await mount(store,{reply:()=>waiting.promise});
 await first.type('hello');await first.click('Send');assert.equal(JSON.parse(store.get(slot(a))).phase,'reply');
 const reopened=await mount(store);await reopened.click('Retry reply');assert.equal(reopened.calls.length,0);assert.equal(store.size,0);
 waiting.resolve({error:null});await tick();assert.equal(store.size,0);
});
test('processing one recovered operation exposes the next instead of deleting it',async()=>{
 const item=key=>JSON.stringify({key,session:null,body:key,escalate:false,phase:'reply',receipt});
 const store=new Map([[slot(a),item(a)],[slot(b),item(b)]]);const ui=await mount(store);
 await ui.click('Retry reply');assert.equal(ui.states[12][0].key,b);assert.equal(store.has(slot(b)),true);await ui.render();await ui.click('Retry reply');assert.equal(store.size,0);
});
test('other accounts do not inherit pending operations',async()=>{
 const store=new Map([[slot(a),JSON.stringify({key:a,session:null,body:'private',escalate:false})]]);
 const ui=await mount(store,{profileId:'other'});assert.equal(ui.states[6],null);assert.equal(store.has(slot(a)),true);
});
test('escalated user message completes without a bot reply recovery item',async()=>{
 const ui=await mount(new Map(),{escalate:true});await ui.type('help');await ui.click('Send');assert.equal(ui.store.size,0);assert.equal(ui.replies.length,0);
});
test('unavailable bot does not block a new message to human support',async()=>{
 const ui=await mount(new Map(),{reply:async()=>({error:{message:'unavailable'}})});
 await ui.type('hello');await ui.click('Send');await ui.render();
 await ui.type('please help');await ui.click('Send to support team');
 assert.equal(ui.calls.at(-1).args.p_force_escalate,true);assert.equal(ui.states[5],false);assert.equal(ui.store.has(slot(a)),true);assert.equal(ui.store.has(slot(b)),false);
});
test('reply deadline also covers a stalled account recheck',async()=>{
 const store=new Map([[slot(a),JSON.stringify({key:a,session:null,body:'hello',escalate:false,phase:'reply',receipt})]]);
 const ui=await mount(store,{stallProfile:true});await ui.click('Retry reply');ui.timeout();await tick();
 assert.equal(ui.states[13],null);assert.equal(ui.replies.length,0);assert.equal(store.has(slot(a)),true);
});
test('stalled bot does not hold Send, and deadline preserves receipt',async()=>{
 const waiting=deferred();const ui=await mount(new Map(),{reply:()=>waiting.promise});
 await ui.type('hello');await ui.click('Send');await ui.render();assert.equal(ui.states[5],false);
 await ui.type('a new draft');ui.timeout();await tick();assert.equal(ui.states[13],null);assert.equal(ui.store.has(slot(a)),true);
 waiting.resolve({error:null});await tick();assert.equal(ui.store.has(slot(a)),true);assert.equal(ui.states[2],'a new draft');
});
