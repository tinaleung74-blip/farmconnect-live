"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Operation = {
  operation_id:string; correlation_id:string; workflow:string; action:string; route:string|null;
  status:string; attempt_count:number; error_code:string|null; error_source:string|null;
  error_message_safe:string|null; result_reference:string|null; first_seen_at:string; last_seen_at:string;
};
const needsAction=new Set(["failed_retryable","reconciling","failed_terminal","manual_review","dead_letter"]);

export default function RecoveryGuardPage(){
  const [operations,setOperations]=useState<Operation[]>([]);
  const [note,setNote]=useState("Loading recovery operations…");
  const [busy,setBusy]=useState<string|null>(null);
  const load=useCallback(async()=>{
    const result=await supabase.from("kafarm_recovery_operations")
      .select("operation_id,correlation_id,workflow,action,route,status,attempt_count,error_code,error_source,error_message_safe,result_reference,first_seen_at,last_seen_at")
      .order("last_seen_at",{ascending:false}).limit(100);
    if(result.error){setOperations([]);setNote("Recovery ledger is unavailable or the current account is not an Admin.");return;}
    setOperations((result.data||[]) as Operation[]);
    setNote(result.data?.length?String(result.data.length)+" recent operation(s).":"No recovery operations yet.");
  },[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);
  async function reconcile(operationId:string){
    if(busy)return;setBusy(operationId);setNote("Verifying authoritative database state…");
    try{const result=await supabase.rpc("kafarm_recovery_reconcile",{p_operation_id:operationId});if(result.error)throw result.error;
      setNote(result.data?.state==="completed"?"Verified and recovered.":"Verified result: "+(result.data?.state||"manual review")+".");await load();
    }catch{setNote("Recovery check failed safely. No business mutation was repeated.");}finally{setBusy(null);}
  }
  async function adminAction(operationId:string,action:"manual_review"|"dead_letter"|"resolve"|"cancel"){
    if(busy)return;const reason=window.prompt("Reason for this audited recovery action:");if(!reason?.trim())return;
    setBusy(operationId);setNote("Saving audited recovery action…");
    try{const result=await supabase.rpc("kafarm_recovery_admin_action",{p_operation_id:operationId,p_action:action,p_reason:reason.trim()});if(result.error)throw result.error;
      setNote("Operation moved to "+(result.data?.status||action)+".");await load();
    }catch{setNote("Action was rejected by the recovery guard. No business data changed.");}finally{setBusy(null);}
  }
  return <main className="min-h-screen bg-[#eef4ea] px-4 py-5 text-[#14241b]"><div className="mx-auto max-w-7xl">
    <header className="rounded-[28px] border border-white bg-white/95 p-5 shadow-xl"><div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-black uppercase text-[#1d7a45]">KaFarm Recovery Guard MVP</p><h1 className="mt-1 text-3xl font-black">Recovery Operations</h1>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[#637064]">Verify committed results, move unresolved work to review, and keep every action auditable. This page never repeats money or ownership mutations.</p></div>
      <div className="flex gap-2"><button onClick={()=>void load()} className="rounded-xl bg-[#f8c51c] px-4 py-3 text-sm font-black">Refresh</button><Link href="/admin/kafarm" className="rounded-xl bg-[#163d8f] px-4 py-3 text-sm font-black text-white">Command Center</Link></div>
    </div><p role="status" className="mt-4 rounded-xl bg-[#f4f7f1] px-4 py-3 text-sm font-bold">{note}</p></header>
    <section className="mt-5 space-y-3">{operations.map(operation=><article key={operation.operation_id} className={"rounded-2xl border bg-white p-4 shadow-sm "+(needsAction.has(operation.status)?"border-amber-300":"border-[#dbe6d7]")}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#1d7a45]">{operation.workflow+" · "+operation.action}</p><h2 className="mt-1 font-black">{operation.status.replaceAll("_"," ")}</h2>
        <p className="mt-1 text-xs font-bold text-[#637064]">{(operation.route||"No route")+" · attempts "+operation.attempt_count+" · last seen "+new Date(operation.last_seen_at).toLocaleString()}</p>
        {operation.error_message_safe&&<p className="mt-2 text-sm font-bold text-amber-900">{(operation.error_code||"ERROR")+": "+operation.error_message_safe}</p>}
        {operation.result_reference&&<p className="mt-2 text-sm font-bold text-emerald-800">Verified result: {operation.result_reference}</p>}
        <details className="mt-2 text-xs text-[#637064]"><summary className="cursor-pointer font-black">References</summary><p className="mt-1 break-all">Operation: {operation.operation_id}</p><p className="break-all">Correlation: {operation.correlation_id}</p></details>
      </div><div className="flex flex-wrap gap-2">
        {!["completed","resolved","cancelled"].includes(operation.status)&&<button disabled={Boolean(busy)} onClick={()=>void reconcile(operation.operation_id)} className="rounded-xl bg-[#087f83] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{busy===operation.operation_id?"Checking…":"Verify DB"}</button>}
        {needsAction.has(operation.status)&&<button disabled={Boolean(busy)} onClick={()=>void adminAction(operation.operation_id,"manual_review")} className="rounded-xl bg-amber-200 px-3 py-2 text-xs font-black disabled:opacity-50">Manual Review</button>}
        {needsAction.has(operation.status)&&operation.status!=="dead_letter"&&<button disabled={Boolean(busy)} onClick={()=>void adminAction(operation.operation_id,"dead_letter")} className="rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-800 disabled:opacity-50">Dead Letter</button>}
        {["manual_review","dead_letter"].includes(operation.status)&&<button disabled={Boolean(busy)} onClick={()=>void adminAction(operation.operation_id,"resolve")} className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-900 disabled:opacity-50">Resolve</button>}
      </div></div></article>)}
      {!operations.length&&<div className="rounded-2xl border border-dashed border-[#b9cdbf] bg-white p-10 text-center font-black">No recovery records to show.</div>}
    </section>
  </div></main>;
}
