"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createPrivateEvidenceUrl, getAdminTaskProofs, getCurrentProfile } from "@/lib/farmconnect-data";
type Evidence = { id: string; admin_review_status: string; created_at: string; preset_note?: string; proof_url?: string; proof_file_urls?: string[]; caretaker_tasks?: { task_type?: string; rooster_name?: string } };
export function LiveEvidencePage({ admin = false }: { admin?: boolean }) {
  const [rows, setRows] = useState<Evidence[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [evidenceLinks, setEvidenceLinks] = useState<string[]>([]);
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
        const result = await supabase.from("task_proofs").select("id,admin_review_status,created_at,preset_note,proof_url,proof_file_urls").in("caretaker_id", ids).order("created_at", { ascending: false }).limit(100);
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
    setEvidenceLinks([]);
    try {
      const stored = row.proof_file_urls?.length ? row.proof_file_urls : row.proof_url ? [row.proof_url] : [];
      const urls = await Promise.all(stored.map(path => createPrivateEvidenceUrl("caretaker-task-proofs", path)));
      if(sequence===evidenceSequence.current)setEvidenceLinks(urls);
    } catch { if(sequence===evidenceSequence.current)setError("This evidence file could not be opened. The saved record has not changed."); }
  }
  return <main className="min-h-screen bg-[#f8f5e8] p-5 text-[#10251d]"><div className="mx-auto max-w-4xl space-y-4"><Link href={admin ? "/admin" : "/caretaker/tasks"}>← Back</Link><h1 className="text-3xl font-black">{admin ? "Evidence" : "Submitted Work"}</h1><p>{admin ? "Read-only records. Review decisions belong to the linked request." : "Your saved submissions and review results."}</p><button onClick={load} disabled={loading} className="rounded-xl bg-[#087f83] px-4 py-2 text-white">{loading ? "Loading…" : "Refresh"}</button>{evidenceLinks.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="mr-4 inline-block underline">Open photo {index + 1}</a>)}{error && <p role="alert">{error}</p>}{!loading && !error && !rows.length && <p>No saved submissions yet.</p>}{rows.map(row => <article key={row.id} className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-bold">{row.caretaker_tasks?.rooster_name || row.preset_note || "Work submission"}</h2><p>{row.caretaker_tasks?.task_type}</p><p>{row.admin_review_status === "pending" ? "Awaiting review" : row.admin_review_status === "backjob" ? "Correction requested" : row.admin_review_status}</p><time>{new Date(row.created_at).toLocaleString()}</time>{(row.proof_file_urls?.length || (row.proof_url && !row.proof_url.startsWith("farmconnect:"))) ? <button onClick={() => open(row)} className="ml-4 underline">View evidence</button> : null}{admin && <Link className="ml-4 underline" href="/admin/caretaker-management">Open task review</Link>}</article>)}</div></main>;
}
