"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Incident = {
  id: string; title: string; category: string; severity: string; status: string;
  app_role: string; route: string | null; message: string; http_status: number | null;
  request_url: string | null; profile_id: string | null; email: string | null;
  full_name: string | null; created_at: string;
};
type Kind = "withdrawal" | "payment" | "care" | "kyc" | "session" | "general";

const plans: Record<Kind, { purpose: string; route: string; checks: string[]; guards: string[] }> = {
  withdrawal: { purpose: "Request a Wallet withdrawal and receive a tracked payout result.", route: "/admin/customer-requests/withdraw", checks: ["Refresh request status", "Check existing receipt and Inbox state", "Check repeated idempotency key"], guards: ["Verify KYC, balance, PIN guard, and existing request", "Never deduct twice", "Use canonical guarded withdrawal flow", "Create receipt, evidence, and Inbox result atomically"] },
  payment: { purpose: "Submit payment proof and create the correct pending payment request.", route: "/admin/customer-requests/payment", checks: ["Refresh pending request", "Re-read proof metadata", "Check duplicate reference"], guards: ["Never fabricate payment approval", "Reuse the submitted idempotency key", "Use canonical payment review", "Create invoice and Inbox result through the guarded flow"] },
  care: { purpose: "Submit a paid care request and continue into assignment and proof review.", route: "/admin/customer-requests/task", checks: ["Refresh care-request status", "Re-read linked payment and task", "Check existing assignment"], guards: ["Do not duplicate the care request", "Keep rooster ownership unchanged", "Use existing care/task flow", "Require proof review before completion"] },
  kyc: { purpose: "Submit or review customer identity verification.", route: "/admin/account-verification", checks: ["Refresh KYC status", "Re-read submission metadata"], guards: ["Never auto-approve KYC", "Require active Admin decision", "Preserve evidence", "Send canonical Inbox result"] },
  session: { purpose: "Restore a valid session and retry a non-financial read.", route: "/admin/kafarm/system-health", checks: ["Refresh session", "Re-read current page", "Clear only stale session state after sign-in"], guards: ["Do not impersonate another role", "Do not retry financial mutations automatically"] },
  general: { purpose: "Complete the intended action without inventing a business result.", route: "/admin/kafarm/whole-app-reader", checks: ["Refresh current state", "Re-read affected route", "Check for existing successful result"], guards: ["Do not run generic SQL", "Do not create financial or ownership side effects", "Send report to Buddy when no canonical flow exists"] },
};

function classify(row: Incident): Kind {
  const text = `${row.title} ${row.category} ${row.route || ""} ${row.request_url || ""} ${row.message}`.toLowerCase();
  if (/withdraw|payout|wallet/.test(text)) return "withdrawal";
  if (/payment|farm.?buy|checkout|receipt/.test(text)) return "payment";
  if (/care|caretaker|task|feeding|proof/.test(text)) return "care";
  if (/kyc|verification|identity|selfie/.test(text)) return "kyc";
  if (/session|refresh token|auth|login/.test(text)) return "session";
  return "general";
}

function maskEmail(email: string | null) {
  if (!email) return "Unknown account";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain || "***"}`;
}

function actionLabel(row: Incident) {
  let apiPath = "no API path captured";
  if (row.request_url) {
    try { apiPath = new URL(row.request_url, "https://farmconnect.local").pathname; } catch { apiPath = "invalid API path"; }
  }
  return `${row.route || "unknown page"} → ${apiPath}`;
}

export default function TroubleshootingPage() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [rows, setRows] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [copyText, setCopyText] = useState("Copy Technical Report");
  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;
  const kind = selected ? classify(selected) : "general";
  const plan = plans[kind];

  const report = useMemo(() => !selected ? "Run Troubleshooting to read the current incident queue." : [
    "KAFARM SAFE CONTINUITY TROUBLESHOOTING REPORT",
    `Incident ID: ${selected.id}`, `Captured: ${selected.created_at}`,
    `Account: ${maskEmail(selected.email)} (${selected.profile_id || "profile unavailable"})`,
    `Role: ${selected.app_role}`, `Action: ${actionLabel(selected)}`, `Purpose: ${plan.purpose}`,
    `Observed: ${selected.http_status ? `HTTP ${selected.http_status} — ` : ""}${selected.message}`,
    `Functioned: ${selected.http_status && selected.http_status >= 400 ? "NO / FAILED REQUEST" : "NOT PROVEN — RECONCILE FIRST"}`,
    "", "SAFE AUTOMATIC CHECKS", ...plan.checks.map((item) => `- ${item}`),
    "", "ADMIN-GUARDED RECOVERY", ...plan.guards.map((item) => `- ${item}`),
    "", `Canonical route: ${plan.route}`,
    "Safety: preparation does not move money, approve KYC, change ownership, or execute generic SQL.",
  ].join("\n"), [plan, selected]);

  async function run() {
    setStatus("running"); setError(""); setPrepared(false);
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Active Admin login is required.");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,account_status").eq("auth_user_id", user.user.id).maybeSingle();
      if (profileError || profile?.role !== "admin" || profile?.account_status !== "active") throw new Error("Active Admin profile is required.");
      const { data, error: queueError } = await supabase.from("admin_kafarm_incident_queue").select("id,title,category,severity,status,app_role,route,message,http_status,request_url,profile_id,email,full_name,created_at").order("created_at", { ascending: false }).limit(100);
      if (queueError) throw queueError;
      const open = ((data || []) as Incident[]).filter((row) => !["resolved", "ignored", "completed"].includes(row.status.toLowerCase()));
      setRows(open); setSelectedId(open[0]?.id || null); setStatus("done");
    } catch (runError) { setError(runError instanceof Error ? runError.message : "Reader failed."); setStatus("error"); }
  }

  async function copyReport() {
    await navigator.clipboard.writeText(report); setCopyText("Copied");
    window.setTimeout(() => setCopyText("Copy Technical Report"), 1200);
  }

  return <main className="min-h-screen bg-[linear-gradient(135deg,#eef8ec_0%,#f8f4df_52%,#e4f4ff_100%)] p-4 text-[#14241b]"><div className="mx-auto max-w-7xl space-y-4">
    <header className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase text-[#1d7a45]">The show must go on — safely</p><h1 className="text-3xl font-black text-[#0f3f2c]">KaFarm Safe Continuity Mode</h1><p className="mt-1 max-w-3xl text-sm font-bold text-[#637064]">Find the failed customer action, reconcile partial results, and prepare the canonical guarded recovery.</p></div><div className="flex flex-wrap gap-2"><button onClick={run} disabled={status === "running"} className="rounded-2xl bg-[#f8c51c] px-6 py-3 text-sm font-black disabled:opacity-60">{status === "running" ? "Reading…" : "Run Troubleshooting"}</button><Link href="/admin/kafarm" className="rounded-2xl bg-[#163d8f] px-5 py-3 text-xs font-black text-white">KaFarm Report</Link><Link href="/admin" className="rounded-2xl bg-[#0f3f2c] px-5 py-3 text-xs font-black text-white">Admin Home</Link></div></div></header>
    {status === "idle" && <Notice>Click Run Troubleshooting. The scan executes no recovery or transaction.</Notice>}
    {status === "error" && <div className="rounded-3xl border border-red-200 bg-red-50 p-5 font-bold text-red-800">{error}</div>}
    {status === "done" && !rows.length && <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center"><h2 className="text-xl font-black text-emerald-800">No open failed action found.</h2><p className="mt-2 font-bold text-emerald-700">Nothing needs manual recovery.</p></div>}
    {status === "done" && selected && <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-[28px] border border-white bg-white/90 p-4 shadow-lg"><h2 className="text-lg font-black">Detected Failed Actions</h2><div className="mt-3 max-h-[720px] space-y-2 overflow-y-auto">{rows.map((row) => <button key={row.id} onClick={() => { setSelectedId(row.id); setPrepared(false); }} className={`w-full rounded-2xl border p-3 text-left ${selected.id === row.id ? "border-[#1d7a45] bg-emerald-50" : "border-[#dbe6d7] bg-[#fbfbf6]"}`}><div className="flex justify-between gap-2"><b className="text-sm">{row.title}</b><span className="text-[10px] font-black uppercase text-red-700">{row.http_status || row.severity}</span></div><p className="mt-1 text-xs font-bold text-[#637064]">{maskEmail(row.email)} · {new Date(row.created_at).toLocaleString()}</p><p className="mt-1 truncate text-xs font-bold text-[#1d7a45]">{row.route || "Unknown route"}</p></button>)}</div></div>
      <div className="space-y-4">
        <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#1d7a45]">{kind} recovery</p><h2 className="text-2xl font-black">{selected.title}</h2></div><span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">{selected.http_status ? `HTTP ${selected.http_status}` : selected.status}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Info label="Customer" value={`${selected.full_name || "Customer"} · ${maskEmail(selected.email)}`} /><Info label="Date and time" value={new Date(selected.created_at).toLocaleString()} /><Info label="Button / action" value={actionLabel(selected)} /><Info label="Purpose" value={plan.purpose} /></div><div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-950">{selected.message}</div></div>
        <div className="grid gap-4 lg:grid-cols-2"><List title="Safe Automatic Checks" items={plan.checks} tone="green" /><List title="Needs Admin-Guarded Recovery" items={plan.guards} tone="amber" /></div>
        <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black">Recovery Plan</h3><p className="text-xs font-bold text-[#637064]">Preparation is read-only. Continue only through the canonical guarded workflow.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setPrepared(true)} className="rounded-2xl bg-[#f8c51c] px-5 py-3 text-xs font-black">Prepare Safe Recovery</button><Link href={plan.route} className={`rounded-2xl px-5 py-3 text-xs font-black text-white ${prepared ? "bg-[#1d7a45]" : "pointer-events-none bg-slate-400"}`}>Open Guarded Workflow</Link></div></div>{prepared && <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">Plan prepared. Reconcile the existing record first. Do not create a duplicate request or manually alter Wallet data.</div>}</div>
        <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg"><div className="flex justify-between gap-3"><div><h3 className="text-xl font-black">Technical Report</h3><p className="text-xs font-bold text-[#637064]">Copy to Buddy if the guarded workflow still fails.</p></div><button onClick={copyReport} className="rounded-2xl bg-[#163d8f] px-4 py-3 text-xs font-black text-white">{copyText}</button></div><textarea readOnly value={report} className="mt-4 h-72 w-full resize-none rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4 font-mono text-xs leading-5" /></div>
      </div>
    </section>}
  </div></main>;
}

function Notice({ children }: { children: React.ReactNode }) { return <div className="rounded-3xl border-2 border-dashed border-[#cadbcf] bg-white/80 p-10 text-center font-bold text-[#637064]">{children}</div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-3"><p className="text-[10px] font-black uppercase text-[#637064]">{label}</p><p className="mt-1 break-words text-sm font-black">{value}</p></div>; }
function List({ title, items, tone }: { title: string; items: string[]; tone: "green" | "amber" }) { const style = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"; return <div className={`rounded-[28px] border p-5 ${style}`}><h3 className="font-black">{title}</h3><ul className="mt-3 space-y-2 text-sm font-bold">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>; }
