import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('lib/farmconnect-v1.tsx','utf8');
function handler(name,context){
 const ast=ts.createSourceFile('app.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let fn;function walk(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)fn=node;ts.forEachChild(node,walk)}walk(ast);
 assert.ok(fn);
 return vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
}
test('recovered payment is terminal even before React rerenders',async()=>{
 let reads=0;const terminal={current:false};
 const query={select(){return this},eq(){return this},async maybeSingle(){reads++;return {data:{source_record_id:'saved-payment'}}}};
 const submit=handler('submitPayment',{paymentBusy:{current:false},paymentTerminal:terminal,submittedId:'',ready:true,setSubmitting(){},getCurrentProfile:async()=>({id:'p'}),setNote(){},context:{sourceType:'care',sourceRef:'r'},localStorage:{getItem:()=>'{"key":"k"}',removeItem(){}},supabase:{from:()=>query},setSubmittedId(){},readableAppError:String});
 await submit();await submit();assert.equal(reads,1);assert.equal(terminal.current,true);
});
for(const state of ['pending','approved','loading','error']) test(`KYC ${state} cannot initiate upload`,async()=>{
 let note='';const submit=handler('submitKyc',{kycBusy:{current:false},kycSubmitting:false,kycFlow:{state},kycUnconfirmed:{current:false},setSettingsNote:v=>note=v});
 await submit();assert.match(note,/verification status/);
});
async function supportRecovery(result,options={}){
 const pending={key:'k',session:null,body:'original',escalate:true};
 const states=[[],options.session || null,'original','','',false,options.fresh ? null : pending,false,options.ready ?? true,options.closed || false];let i=0,r=0;let calls=0;let payload;
 const values=new Map();const exports={};const jsx=(type,props)=>({type,props});
 const code=ts.transpileModule(fs.readFileSync('lib/support-conversation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require(name){
   if(name==='react')return {useState(){const n=i++;return [states[n],v=>states[n]=v]},useRef(initial){const n=r++;return {current:n===0?false:n===1?'farmconnect.support.pending.p':initial}},useCallback:fn=>fn,useEffect(){}};
   if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
   if(name==='@/lib/supabase')return {supabase:{rpc:async(name,args)=>{calls++;if(name==='support_send_guarded'){payload=args;return options.sendResponse || {error:{code:'P0001',message:options.errorMessage || ''}}}return result}}};
   if(name==='@/lib/recovery-guard')return {
     safeFingerprint:async()=> 'fingerprint',
     retrySafeRead:async(fn)=>fn(),
     beginRecoveryOperation:async()=>({duplicate:false,status:'created'}),
     markRecoverySending:async()=>({status:'sending'}),
     reconcileRecoveryOperation:async()=>({state:'completed',status:'completed',result_reference:result?.data?.session_id || options.sendResponse?.data || 'receipt'}),
   };
   if(name==='@/lib/backend/support-chat')return {getSupportMessages:async()=>({data:[]}),getSupportSessionStatus:async()=>({data:{status:'escalated'}}),saveKaFarmSupportMessage:async()=>({})};
   if(name==='@/lib/kafarm-brain')return {shouldEscalateToAdmin:()=>false,getKaFarmReply:()=> 'reply'};
   if(name==='@/lib/farmconnect-data')return {getCurrentProfile:async()=>({id:options.profileId || 'p',role:'customer'})};
   return {};
 },crypto:{randomUUID:()=> 'new-key'},localStorage:{get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});
 const tree=exports.SupportConversation({role:'customer'});
 function find(n){if(!n)return;if(Array.isArray(n))return n.map(find).find(Boolean);if(n.type==='button'&&['Retry','Send'].includes(n.props.children))return n;return find(n.props?.children)}
 find(tree).props.onClick();await new Promise(resolve=>setImmediate(resolve));return {states,values,calls,payload};
}
test('reconciled rejection unlocks restored draft without losing its text',async()=>{
 const {states,values}=await supportRecovery({data:{state:'not_sent'}});assert.equal(states[6],null);assert.equal(states[2],'original');assert.equal(values.size,0);
});
test('recovered delivery is sent, not offered as a new message',async()=>{
 const {states}=await supportRecovery({data:{state:'sent',session_id:'s'}});assert.equal(states[6],null);assert.equal(states[2],'');assert.equal(states[1],'s');
});
test('failed reconciliation preserves original operation',async()=>{
 const {states,values}=await supportRecovery({error:{message:'offline'}});assert.equal(states[6].key,'k');assert.equal(values.size,1);
});
test('support initialization must finish before sending',async()=>{
 const result=await supportRecovery({}, {ready:false});assert.equal(result.calls,0);
});
test('account change cannot deliver old account draft',async()=>{
 const result=await supportRecovery({}, {profileId:'other'});assert.equal(result.calls,0);assert.equal(result.states[8],false);
});
test('closed chat starts a new conversation without changing old history',async()=>{
 const result=await supportRecovery({}, {fresh:true,closed:true,session:'closed-session',sendResponse:{data:'new-session'}});
 assert.equal(result.payload.p_session_id,null);assert.equal(result.states[1],'new-session');
});
test('chat closed during send is retired safely before starting again',async()=>{
 const result=await supportRecovery({data:{state:'not_sent'}},{session:'closed-session',errorMessage:'CHAT_CLOSED'});
 assert.equal(result.states[1],null);assert.equal(result.states[6],null);assert.equal(result.states[2],'original');
});
