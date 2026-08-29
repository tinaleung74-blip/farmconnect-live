"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createPrivateEvidenceUrl, getAdminTaskProofs, getCurrentProfile } from "@/lib/farmconnect-data";
type Evidence = { id: string; admin_review_status: string; created_at: string; preset_note?: string; free_note?: string; proof_url?: string; proof_file_urls?: string[]; caretaker_tasks?: { task_type?: string; rooster_name?: string } };
export function LiveEvidencePage({ admin = false }: { admin?: boolean }) {
  const [rows, setRows] = useState<Evidence[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [evidenceLinks, setEvidenceLinks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Evidence | null>(null);
  const evidenceSequence = useRef(0);
  const fetchRecords = useCallback(async (): Promise<Evidence[]> => {
      const profile = await getCurrentProfile();
      if (!profile || profile.role !== (admin ? "admin" : "caretaker")) throw new Error("Sign in with the correct account to view these records.");
      if (admin) return await getAdminTaskProofs();
      else {
        const caretakers = await supabase.from("caretakers").select("id").eq("profile_id", profile.id);
        if (caretakers.error) throw caretakers.error;
        const ids = (caretakers.data || []).map(row => row.id);
        if (!ids.length) return [];
        const result = await supabase.from("task_proofs").select("id,admin_review_status,created_at,preset_note,free_note,proof_url,proof_file_urls").in("caretaker_id", ids).order("created_at", { ascending: false }).limit(100);
        if (result.error) throw result.error;
        return result.data || [];
      }
  }, [admin]);
  async function load() {
    setLoading(true);setError("");setEvidenceLinks([]);evidenceSequence.current++;
    try {setRows(await fetchRecords());}catch{setRows([]);setError("Records could not be loaded. Try again.");}finally{setLoading(false);}
  }
  useEffect(() => {
    let active = true;
    void fetchRecords().then(data => { if(active) {setRows(data);setError("");} }).catch(() => {if(active)setError("Records could not be loaded. Try again.");}).finally(() => {if(active)setLoading(false);});
    return () => {active=false;};
  }, [fetchRecords]);
  async function open(row: Evidence) {
    const sequence=++evidenceSequence.current;
    setSelected(row);
    setEvidenceLinks([]);
    try {
      const stored = row.proof_file_urls?.length ? row.proof_file_urls : row.proof_url ? [row.proof_url] : [];
      const urls = await Promise.all(stored.map(path => createPrivateEvidenceUrl("caretaker-task-proofs", path)));
      if(sequence===evidenceSequence.current)setEvidenceLinks(urls);
    } catch { if(sequence===evidenceSequence.current)setError("This evidence file could not be opened. The saved record has not changed."); }
  }
  const statusLabel = (status: string) => status === "pending" ? "Under Review" : status === "backjob" ? "Correction Needed" : status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : status.replaceAll("_", " ");
  return <main className="min-h-screen bg-[#f8f5e8] text-[#10251d]">
    {!admin && <header className="sticky top-0 z-30 border-b-4 border-[#f4c430] bg-[linear-gradient(110deg,#041f22,#087f83_54%,#063b3f)] text-white shadow-lg"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3"><Link href="/caretaker/tasks" className="font-black">FarmConnect</Link><nav className="ml-auto flex flex-wrap justify-end gap-2 text-xs font-black"><Link href="/caretaker/tasks" className="rounded-xl px-3 py-2 hover:bg-white/15">Today&apos;s Care</Link><Link href="/caretaker/completed" className="rounded-xl bg-white/20 px-3 py-2">Care History</Link><Link href="/caretaker/chat" className="rounded-xl px-3 py-2 hover:bg-white/15">Support</Link><Link href="/caretaker/profile" className="rounded-xl px-3 py-2 hover:bg-white/15">Profile</Link></nav></div></header>}
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">{admin && <Link href="/admin" className="font-black text-[#087f83]">← Admin</Link>}<section className="rounded-[26px] border border-[#f4c430]/60 bg-white p-5 shadow"><p className="text-xs font-black uppercase tracking-[.14em] text-[#087f83]">{admin ? "Admin records" : "Your care reports"}</p><div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black">{admin ? "Evidence" : "Care History"}</h1><p className="mt-2 font-bold text-[#65746b]">{admin ? "Read-only records. Decisions stay in the linked review workflow." : "See each submitted daily report and its latest review status."}</p></div><button onClick={load} disabled={loading} className="rounded-xl bg-[#087f83] px-4 py-3 font-black text-white disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button></div></section>
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800">{error}</p>}{!loading && !error && !rows.length && <div className="rounded-3xl border border-dashed border-[#b9cdbf] bg-white p-10 text-center"><h2 className="text-xl font-black">No care report yet</h2><p className="mt-2 font-bold text-[#65746b]">Reports sent from Today&apos;s Care will appear here.</p></div>}
    <div className="grid gap-4 md:grid-cols-2">{rows.map(row => { const hasProof=Boolean(row.proof_file_urls?.length || (row.proof_url && !row.proof_url.startsWith("farmconnect:"))); return <article key={row.id} className="rounded-[24px] bg-white p-5 shadow"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#087f83]">Daily Care Report</p><h2 className="mt-1 text-xl font-black">{row.caretaker_tasks?.rooster_name || row.preset_note || "Care update"}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-black ${row.admin_review_status === "approved" ? "bg-emerald-100 text-emerald-900" : row.admin_review_status === "backjob" ? "bg-amber-100 text-amber-900" : row.admin_review_status === "rejected" ? "bg-red-100 text-red-900" : "bg-sky-100 text-sky-900"}`}>{statusLabel(row.admin_review_status)}</span></div><p className="mt-3 line-clamp-3 text-sm font-bold leading-6 text-[#65746b]">{row.free_note || row.preset_note || "Submitted care documentation"}</p><time className="mt-3 block text-xs font-black text-[#65746b]">{new Date(row.created_at).toLocaleString()}</time><button type="button" onClick={() => void open(row)} className="mt-4 w-full rounded-xl bg-[#edf6ef] px-4 py-3 font-black text-[#07563f]">{hasProof ? "View Report & Photos" : "View Report"}</button>{admin && <Link className="mt-2 block text-center text-sm font-black text-[#087f83]" href="/admin/customer-requests/task">Open Care Operations</Link>}</article>; })}</div></div>
    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#041f22]/75 p-3 backdrop-blur-sm" onClick={()=>{setSelected(null);setEvidenceLinks([]);}}><section className="mx-auto my-4 w-full max-w-3xl rounded-[28px] bg-white p-5 shadow-2xl" onClick={event=>event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#087f83]">Daily Care Report</p><h2 className="mt-1 text-2xl font-black">{selected.caretaker_tasks?.rooster_name || selected.preset_note || "Care update"}</h2><p className="mt-1 text-sm font-bold text-[#65746b]">{new Date(selected.created_at).toLocaleString()} · {statusLabel(selected.admin_review_status)}</p></div><button type="button" onClick={()=>{setSelected(null);setEvidenceLinks([]);}} className="grid h-10 w-10 place-items-center rounded-full bg-[#edf3ef] font-black">×</button></div><p className="mt-5 whitespace-pre-wrap rounded-2xl bg-[#f8f5e8] p-4 text-sm font-bold leading-6">{selected.free_note || selected.preset_note || "No written documentation."}</p>{evidenceLinks.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{evidenceLinks.map((url,index)=><a key={url} href={url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-2xl border border-[#dce7df]"><img src={url} alt={`Care proof ${index+1}`} className="h-56 w-full object-cover" /><span className="block p-3 text-center text-sm font-black">Open Photo {index+1}</span></a>)}</div> : <p className="mt-4 rounded-xl bg-[#edf3ef] p-4 text-sm font-bold text-[#65746b]">No photo attached to this report.</p>}{selected.admin_review_status === "backjob" && <Link href="/caretaker/tasks" className="mt-5 block rounded-xl bg-amber-400 px-4 py-3 text-center font-black">Correct in Today&apos;s Care</Link>}</section></div>}
  </main>;
}
