"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getLatestSupportSessionId, getSupportMessages, getSupportSessionStatus, saveKaFarmSupportMessage, type SupportRole } from "@/lib/backend/support-chat";
import { shouldEscalateToAdmin } from "@/lib/kafarm-brain";
import { getCurrentProfile } from "@/lib/farmconnect-data";
import { beginRecoveryOperation, markRecoverySending, reconcileRecoveryOperation, retrySafeRead, safeFingerprint } from "@/lib/recovery-guard";
type Message = { id: string; sender_role: string; body: string; created_at: string };
type Pending = { key: string; correlation?: string; session: string | null; body: string; escalate: boolean; phase?: "reply"; receipt?: string };
type DamagedDraft = { storageKey: string; raw: string };
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const operationStorageKey=(account: string,key: string)=>`${account}.operation.${key}`;
function parseOperation(raw: string): Pending {
  const item=JSON.parse(raw) as Pending;
  if(!item || typeof item.key!=="string" || !uuid.test(item.key) || typeof item.body!=="string" || typeof item.escalate!=="boolean"
    || !(item.session===null || (typeof item.session==="string" && uuid.test(item.session)))
    || (item.correlation!==undefined && (typeof item.correlation!=="string" || !uuid.test(item.correlation)))
    || (item.phase!==undefined && item.phase!=="reply")
    || (item.phase==="reply" && (typeof item.receipt!=="string" || !uuid.test(item.receipt))))throw new Error("Invalid saved draft");
  return item;
}
function readOperations(account: string): { items: Pending[]; damaged: DamagedDraft | null } {
  const items: Pending[]=[];
  let damaged: DamagedDraft|null=null;
  // Import the old single-slot record once. New writes never use that slot.
  const legacy=localStorage.getItem(account);
  if(legacy){
    try {
      const item=parseOperation(legacy);
      const target=operationStorageKey(account,item.key);
      if(localStorage.getItem(target)===null)localStorage.setItem(target,legacy);
      if(localStorage.getItem(account)===legacy)localStorage.removeItem(account);
    } catch {damaged={storageKey:account,raw:legacy};}
  }
  for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index);
    if(!key?.startsWith(`${account}.operation.`))continue;
    const raw=localStorage.getItem(key);
    if(raw===null)continue;
    try {
      const item=parseOperation(raw);
      if(key!==operationStorageKey(account,item.key))throw new Error("Mismatched operation");
      items.push(item);
    } catch {damaged ||= {storageKey:key,raw};}
  }
  return {items,damaged};
}
export function SupportConversation({ role }: { role: SupportRole }) {
  const [messages,setMessages]=useState<Message[]>([]);
  const [session,setSession]=useState<string|null>(null);
  const [body,setBody]=useState("");
  const [note,setNote]=useState("");
  const [loadError,setLoadError]=useState("");
  const [sending,setSending]=useState(false);
  const [pending,setPending]=useState<Pending|null>(null);
  const [escalated,setEscalated]=useState(false);
  const [ready,setReady]=useState(false);
  const [closed,setClosed]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [damagedDraft,setDamagedDraft]=useState<DamagedDraft|null>(null);
  const [replyPending,setReplyPending]=useState<Pending[]>([]);
  const [replyWorking,setReplyWorking]=useState<string|null>(null);
  const [replyNote,setReplyNote]=useState("");
  const busy=useRef(false);
  const storage=useRef("");
  const refreshSequence=useRef(0);
  const replyBusy=useRef(false);
  const invalidateRefresh=useCallback(()=>{refreshSequence.current++;},[]);
  const refresh=useCallback(async (id: string) => {
    const sequence=++refreshSequence.current;
    const [result,status]=await Promise.all([
      retrySafeRead(async()=>{const value=await getSupportMessages(id);if(value.error)throw value.error;return value;}),
      retrySafeRead(async()=>{const value=await getSupportSessionStatus(id);if(value.error)throw value.error;return value;}),
    ]);
    if(sequence!==refreshSequence.current)return;
    if(result.error) throw result.error;
    if(status.error) throw status.error;
    setMessages(result.data || []);
    setClosed(["ended","completed"].includes(status.data?.status || ""));
    setEscalated(["escalated","admin_joined","ended","completed"].includes(status.data?.status || ""));
    setLoadError("");
  },[]);
  useEffect(()=>{
    let active=true;
    storage.current="";
    void (async()=>{
      try {
        const profile=await getCurrentProfile();
        if(!profile || profile.role!==role) throw new Error("Sign in with the correct account.");
        if(!active)return;
        setReady(false);setPending(null);setBody("");setMessages([]);setClosed(false);setEscalated(false);
        const key=`farmconnect.support.pending.${profile.id}`;
        const saved=readOperations(key);
        setDamagedDraft(saved.damaged);
        setReplyPending(saved.items.filter(item=>item.phase==="reply"));
        const item=saved.items.find(item=>item.phase!=="reply");
        if(item){setPending(item);setBody(item.body);setNote("Previous message is unconfirmed. Retry checks the same submission.");}
        if(saved.damaged)setNote("Your saved draft could not be restored. Check the conversation before starting a new draft.");
        const result=await retrySafeRead(async()=>{const value=await getLatestSupportSessionId();if(value.error)throw value.error;return value;});
        if(result.error) throw result.error;
        if(active){setSession(result.data?.id || null);storage.current=key;setReady(true);setLoadError("");}
      } catch {if(active){setReady(false);setSession(null);setMessages([]);setLoadError("Support could not be loaded. Check your connection and account.");}}
    })();
    return ()=>{active=false;};
  },[role,loadAttempt]);
  useEffect(()=>{
    const retry=()=>{if(!ready && !busy.current)setLoadAttempt(value=>value+1);};
    window.addEventListener("online",retry);
    return()=>window.removeEventListener("online",retry);
  },[ready]);
  async function startNewDraft(){
    if(!damagedDraft || !ready || !storage.current || busy.current)return;
    if(!window.confirm("Check the conversation first: your previous message may already have been sent. Keep a recovery copy and start an empty draft? Nothing will be sent automatically."))return;
    busy.current=true;
    try {
      const profile=await getCurrentProfile();
      if(!profile || profile.role!==role || storage.current!==`farmconnect.support.pending.${profile.id}`)throw new Error("Account changed");
      // Never silently destroy the damaged draft or reuse its unknown operation.
      localStorage.setItem(`${storage.current}.recovery.${crypto.randomUUID()}`,damagedDraft.raw);
      if(localStorage.getItem(damagedDraft.storageKey)===damagedDraft.raw)localStorage.removeItem(damagedDraft.storageKey);
      const saved=readOperations(storage.current);
      const next=saved.items.find(item=>item.phase!=="reply") || null;
      setReplyPending(saved.items.filter(item=>item.phase==="reply"));
      setDamagedDraft(saved.damaged);setPending(next);setBody(next?.body || "");setNote("Recovery copy kept. Nothing has been sent.");
    } catch {setNote("Draft could not be reset. Your saved copy has been kept.");}
    finally {busy.current=false;}
  }
  useEffect(()=>{
    if(!session)return;
    let stopped=false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll(){
      try {if(!busy.current)await refresh(session!);}catch{if(!stopped)setLoadError("Updates could not be loaded. Reconnecting…");}
      if(!stopped)timer=setTimeout(poll,5000);
    }
    void poll();return()=>{stopped=true;invalidateRefresh();clearTimeout(timer);};
  },[session,refresh,invalidateRefresh]);
  async function retryReply(item: Pending, account: string){
    if(replyBusy.current || !account || item.phase!=="reply")return;
    replyBusy.current=true;setReplyWorking(item.key);setReplyNote("");
    let expired=false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async()=>{
          const profile=await getCurrentProfile();
          if(expired)return;
          if(!profile || profile.role!==role || account!==`farmconnect.support.pending.${profile.id}` || storage.current!==account)throw new Error("Account changed");
          const answer=await saveKaFarmSupportMessage(item.key);
          if(expired)return;
          if(answer.error)throw new Error("Reply unconfirmed");
          localStorage.removeItem(operationStorageKey(account,item.key));
          if(storage.current===account){
            setReplyPending(readOperations(account).items.filter(item=>item.phase==="reply"));
            setReplyNote("Reply checked.");
          }
        })(),
        new Promise<never>((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error("Reply timed out"));},20000);}),
      ]);
    } catch {if(storage.current===account)setReplyNote("Automatic reply unavailable. You can retry or message the support team.");}
    finally {if(timer!==undefined)clearTimeout(timer);replyBusy.current=false;setReplyWorking(null);}
  }
  async function send(force=false){
    if(busy.current || !ready || damagedDraft || !storage.current || (!pending && !body.trim()))return;
    busy.current=true;refreshSequence.current++;setSending(true);setNote("Sending…");
    let acknowledged=false;
    try{
      const profile=await getCurrentProfile();
      if(!profile || profile.role!==role || storage.current!==`farmconnect.support.pending.${profile.id}`){setReady(false);setNote("Your account changed. Reopen Support before sending.");return;}
      const draft: Pending=pending || {key:crypto.randomUUID(),session:closed ? null : session,body:body.trim(),escalate:force || (!closed && escalated) || shouldEscalateToAdmin(body,role)};
      const item: Pending={...draft,correlation:draft.correlation || crypto.randomUUID()};
      const account=storage.current;
      const itemStorageKey=operationStorageKey(account,item.key);
      const finish=()=>{
        // Never delete the account's other in-flight operations.
        localStorage.removeItem(itemStorageKey);
        const saved=readOperations(account);
        const next=saved.items.find(item=>item.phase!=="reply") || null;
        setReplyPending(saved.items.filter(item=>item.phase==="reply"));
        setPending(next);setBody(next?.body || "");setDamagedDraft(saved.damaged);
        return next;
      };
      localStorage.setItem(itemStorageKey,JSON.stringify(item));setPending(item);
      const fingerprint=await safeFingerprint({role,session:item.session,body:item.body,escalate:item.escalate});
      const ledger=await beginRecoveryOperation({
        operationId:item.key,
        correlationId:item.correlation!,
        workflow:"support_delivery",
        action:"send_message",
        route:role==="customer"?"/customer-v2/support":"/caretaker/chat",
        targetType:"support_session",
        targetId:item.session,
        fingerprint,
      });
      if(ledger.status==="completed" && ledger.result_reference){
        acknowledged=true;setSession(ledger.result_reference);setBody("");setNote("Sent");finish();return;
      }
      await markRecoverySending(item.key);
      const response=await supabase.rpc("support_send_guarded",{p_key:item.key,p_role:role,p_session_id:item.session,p_body:item.body,p_force_escalate:item.escalate});
      let data=response.data;
      const error=response.error;
      if(error){
        // Serialize recovery with delivery, then retire an unsaved key before editing.
        const recovery=await supabase.rpc("support_reconcile_delivery",{p_key:item.key});
        if(recovery.error) throw recovery.error;
        const ledgerRecovery=await reconcileRecoveryOperation(item.key);
        if(recovery.data?.state==="sent" && ledgerRecovery.state==="completed") data=recovery.data.session_id;
        else if(recovery.data?.state==="not_sent"){
          const next=finish();if(!next)setBody(item.body);setNote("Not sent. You can edit your message and send again.");
          if(error.message?.includes("CHAT_CLOSED")){setSession(null);setClosed(false);setEscalated(false);setNote("That conversation is closed. Send again to start a new conversation.");}
          return;
        }else{
          throw error;
        }
      }
      if(typeof data!=="string" || !data)throw new Error("Missing receipt");
      const verified=await reconcileRecoveryOperation(item.key);
      if(verified.state!=="completed" || verified.result_reference!==data)throw new Error("Delivery receipt was not verified");
      acknowledged=true;setSession(data);setBody("");setNote("Sent");
      // Only a confirmed user message can trigger a reply. A reply failure must not resend the user message.
      if(!item.escalate){
        // Persist reply recovery BEFORE discarding the send recovery. If this write
        // fails, the original send record still retries the same idempotent key.
        const reply: Pending={...item,phase:"reply",receipt:data};
        localStorage.setItem(itemStorageKey,JSON.stringify(reply));
        const saved=readOperations(account);
        const next=saved.items.find(entry=>entry.phase!=="reply") || null;
        setPending(next);setBody(next?.body || "");setReplyPending(saved.items.filter(entry=>entry.phase==="reply"));
        void retryReply(reply,account);
      } else finish();
      // The poll refreshes messages independently; a bot outage cannot hold Send.
    }catch{
      setNote(acknowledged ? "Your message was saved. Retry any pending reply; do not send the message again." : "Message not confirmed. Retry safely using the same message.");
    }finally{busy.current=false;setSending(false);}
  }
  return <section className="rounded-2xl bg-white p-5 space-y-4">
    <h2 className="text-xl font-bold">Support</h2>
    {loadError && <p role="alert">{loadError}</p>}
    {!ready && loadError && <button onClick={()=>setLoadAttempt(value=>value+1)} className="underline">Retry loading</button>}
    <div className="max-h-[55vh] overflow-y-auto space-y-3">
      {messages.map(message=><article key={message.id} className="rounded-xl bg-[#edf7f5] p-3">
        <strong>{message.sender_role===role?"You":message.sender_role==="admin"?"Support":"KaFarm"}</strong>
        <p className="whitespace-pre-wrap">{message.body}</p><time className="text-xs">{new Date(message.created_at).toLocaleString()}</time>
      </article>)}
    </div>
    {damagedDraft && ready && <button onClick={()=>void startNewDraft()} className="underline">Keep recovery copy and start a new draft</button>}
    <textarea aria-label="Message" value={body} disabled={!ready || sending || Boolean(pending) || Boolean(damagedDraft)} onChange={e=>setBody(e.target.value)} className="w-full rounded-xl border p-3" placeholder="How can we help?"/>
    <p role="status">{note}</p>
    {(replyPending || []).map(item=><div key={item.key} className="rounded-xl border p-3">
      <p className="text-sm">Automatic reply pending</p>
      <button disabled={Boolean(replyWorking) || !ready} onClick={()=>void retryReply(item,storage.current)} className="underline">
        {replyWorking===item.key?"Checking reply…":"Retry reply"}
      </button>
    </div>)}
    {replyNote && <p role="status">{replyNote}</p>}
    <button disabled={!ready || sending || Boolean(damagedDraft) || (!pending && !body.trim())} onClick={()=>void send()} className="rounded-xl bg-[#087f83] px-5 py-2 text-white disabled:opacity-50">
      {sending?"Sending…":pending?.phase==="reply"?"Retry reply":pending?"Retry":"Send"}
    </button>
    {!pending && <button disabled={!ready || sending || Boolean(damagedDraft) || !body.trim()} onClick={()=>void send(true)} className="ml-3 underline">Send to support team</button>}
  </section>;
}
