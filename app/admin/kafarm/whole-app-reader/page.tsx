"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  KaFarmFindingConfidence,
  KaFarmReaderRun,
  KaFarmReaderScope,
} from "@/lib/kafarm-whole-app-reader";

const scopes: Array<{ key: KaFarmReaderScope; title: string; label: string; description: string }> = [
  { key: "whole-app", title: "Whole App", label: "All 3 apps", description: "Active routes, buttons, backend references, at cross-role support." },
  { key: "system", title: "System", label: "App health", description: "Routes, imports, shared components, at source freshness." },
  { key: "customer", title: "Customer", label: "Client flow", description: "Customer pages, actions, requests, payment, KYC, at Inbox signals." },
  { key: "admin", title: "Admin", label: "Ops flow", description: "Queues, reviews, assignments, decisions, at evidence controls." },
  { key: "caretaker", title: "Caretaker", label: "Worker flow", description: "Tasks, QR/camera/upload, proof, backjob, at completion actions." },
  { key: "database", title: "Database", label: "Live + static", description: "Live open incidents plus tables, RPC, storage, SQL references, at DB authority rules." },
  { key: "flow", title: "Cross-role", label: "Role bridge", description: "Producer → database → receiver → notification → evidence support." },
];

const confidenceStyles: Record<KaFarmFindingConfidence, string> = {
  confirmed: "border-red-200 bg-red-50 text-red-800",
  possible: "border-amber-200 bg-amber-50 text-amber-800",
  stale: "border-slate-300 bg-slate-100 text-slate-700",
};

const severityStyles: Record<string, string> = {
  critical: "bg-red-700 text-white",
  high: "bg-orange-600 text-white",
  medium: "bg-amber-200 text-amber-950",
  low: "bg-emerald-100 text-emerald-800",
};

function friendlyError(code: string, detail?: string) {
  const messages: Record<string, string> = {
    MISSING_ADMIN_SESSION: "Walang active admin session. Login muna bilang active admin.",
    INVALID_ADMIN_SESSION: "Expired o invalid ang admin session. Login ulit, then Run.",
    ACTIVE_ADMIN_REQUIRED: "Active admin account lang ang puwedeng gumamit ng Whole-App Reader.",
    ADMIN_PROFILE_CHECK_FAILED: "Hindi mabasa ang admin profile. I-check ang profile RLS/server environment bago magpalit ng app code.",
    PROJECT_URL_NOT_FARMCONNECT: "Naka-block ang reader dahil hindi FarmConnect Supabase project ang configured URL.",
  };
  return `${messages[code] || code}${detail ? ` — ${detail}` : ""}`;
}

export default function KaFarmWholeAppReaderPage() {
  const [scope, setScope] = useState<KaFarmReaderScope>("whole-app");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<KaFarmReaderRun | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("Copy Buddy Report");
  const [confidence, setConfidence] = useState<"all" | KaFarmFindingConfidence>("all");

  const visibleFindings = useMemo(() => {
    if (!result) return [];
    return confidence === "all"
      ? result.findings
      : result.findings.filter((finding) => finding.confidence === confidence);
  }, [confidence, result]);

  async function runInvestigation() {
    setStatus("running");
    setError("");
    setResult(null);
    setConfidence("all");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("MISSING_ADMIN_SESSION");

      const response = await fetch(`/api/kafarm/whole-app-reader?scope=${encodeURIComponent(scope)}`, {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(friendlyError(String(body.error || `HTTP_${response.status}`), body.detail));
      setResult(body as KaFarmReaderRun);
      setStatus("done");
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Reader request failed.";
      setError(message === "MISSING_ADMIN_SESSION" ? friendlyError(message) : message);
      setStatus("error");
    }
  }

  async function copyBuddyReport() {
    if (!result?.buddyReport) return;
    try {
      await navigator.clipboard.writeText(result.buddyReport);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
    window.setTimeout(() => setCopyStatus("Copy Buddy Report"), 1400);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#eef8ec_0%,#f8f4df_52%,#e4f4ff_100%)] p-4 text-[#14241b]">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#163d8f]/10 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#e8fff2] text-3xl shadow-inner">🔎</div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#1d7a45]">KaFarm Reader Engine</p>
                <h1 className="text-3xl font-black text-[#0f3f2c]">Whole-App Reader V2</h1>
                <p className="mt-1 max-w-3xl text-sm font-bold text-[#637064]">
                  Binabasa ang active source connections bago manual testing: page, button, route, backend signal, receiving role, at evidence support.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/kafarm" className="rounded-2xl border border-[#b9d7c2] bg-white px-4 py-3 text-xs font-black text-[#0f3f2c]">KaFarm Tools</Link>
              <Link href="/admin" className="rounded-2xl bg-[#0f3f2c] px-4 py-3 text-xs font-black text-white">Admin Home</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            ["1", "Active Source Map", "Reachable routes/components lang; hiwalay ang dead o legacy files."],
            ["2", "Truth & Freshness", "Confirmed, Possible, o Stale para hindi hulaan ang root cause."],
            ["3", "Connection Check", "Button → handler/route/backend → receiving role → evidence support."],
          ].map(([number, title, text]) => (
            <div key={number} className="rounded-3xl border border-white bg-white/85 p-4 shadow-md shadow-[#163d8f]/5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0f3f2c] text-sm font-black text-white">{number}</span>
                <div>
                  <h2 className="text-sm font-black text-[#0f3f2c]">{title}</h2>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#637064]">{text}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#1d7a45]/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#0f3f2c]">1. Choose Reader Scope</h2>
              <p className="text-xs font-bold text-[#637064]">Piliin kung buong app o isang operational area ang reread.</p>
            </div>
            <span className="rounded-full bg-[#e8fff2] px-3 py-1 text-[10px] font-black uppercase text-[#1d7a45]">Read only</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {scopes.map((item) => (
              <button
                key={item.key}
                type="button"
                data-kafarm-monitor-ignore="true"
                onClick={() => { setScope(item.key); setStatus("idle"); setResult(null); setError(""); }}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${scope === item.key ? "border-[#1d7a45] bg-[#e8fff2] shadow-md" : "border-[#dbe6d7] bg-[#fbfbf6]"}`}
              >
                <p className="text-sm font-black">{item.title}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-[#1d7a45]">{item.label}</p>
                <p className="mt-2 text-xs font-bold leading-5 text-[#637064]">{item.description}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-3">
            <button
              type="button"
              data-kafarm-monitor-ignore="true"
              onClick={runInvestigation}
              disabled={status === "running"}
              className="rounded-2xl bg-[#1d7a45] px-6 py-3 text-sm font-black text-white shadow-md disabled:cursor-wait disabled:opacity-60"
            >
              {status === "running" ? "Reading active system…" : "Run Investigation"}
            </button>
            <p className="text-xs font-bold text-[#637064]">
              Walang SQL execute, auto-fix, approval, wallet, KYC, ownership, o delete action.
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#163d8f]/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#0f3f2c]">2. Findings Box</h2>
              <p className="text-xs font-bold text-[#637064]">Expected vs actual, evidence, exact page/action, at safe next check.</p>
            </div>
            <button
              type="button"
              data-kafarm-monitor-ignore="true"
              onClick={copyBuddyReport}
              disabled={!result}
              className="rounded-2xl bg-[#163d8f] px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copyStatus}
            </button>
          </div>

          {status === "idle" && (
            <div className="mt-4 rounded-3xl border-2 border-dashed border-[#cadbcf] bg-[#fbfbf6] p-10 text-center">
              <p className="text-lg font-black text-[#0f3f2c]">Wala pang reader result.</p>
              <p className="mt-2 text-sm font-bold text-[#637064]">Piliin ang scope, then click Run Investigation.</p>
            </div>
          )}
          {status === "running" && (
            <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-6 text-sm font-black text-sky-800">KaFarm is reading the current build snapshot and active connection map…</div>
          )}
          {status === "error" && (
            <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-6">
              <p className="font-black text-red-800">Reader blocked</p>
              <p className="mt-2 text-sm font-bold text-red-700">{error}</p>
              <p className="mt-2 text-xs font-bold text-red-600">Walang code o SQL na binago ng failed run.</p>
            </div>
          )}

          {status === "done" && result && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  ["Findings", result.summary.total, "text-[#14241b]"],
                  ["Confirmed", result.summary.confirmed, "text-red-700"],
                  ["Possible", result.summary.possible, "text-amber-700"],
                  ["Runtime", result.summary.runtime, "text-violet-700"],
                  ["Routes read", result.snapshot.counts.routes, "text-[#163d8f]"],
                  ["APIs read", result.snapshot.counts.apiEndpoints, "text-[#1d7a45]"],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-3">
                    <p className="text-[10px] font-black uppercase text-[#637064]">{label}</p>
                    <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f1f5ed] p-3 text-xs font-bold text-[#526053]">
                <span>Snapshot: {new Date(result.snapshot.generatedAt).toLocaleString()}</span>
                <span>Source: {result.snapshot.sourceFingerprint.slice(0, 12)}</span>
                <div className="flex flex-wrap gap-2">
                  {(["all", "confirmed", "possible", "stale"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      data-kafarm-monitor-ignore="true"
                      onClick={() => setConfidence(item)}
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${confidence === item ? "bg-[#0f3f2c] text-white" : "bg-white text-[#526053]"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {!visibleFindings.length ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-center">
                  <p className="text-lg font-black text-emerald-800">No open static or captured runtime blocker found.</p>
                  <p className="mt-2 text-sm font-bold text-emerald-700">Hindi ito runtime readiness proof. Kailangan pa rin ang real-account, real-record, at cross-role manual verification.</p>
                </div>
              ) : (
                <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
                  {visibleFindings.map((finding, index) => (
                    <article key={finding.id} className="rounded-3xl border border-[#dbe6d7] bg-[#fffef9] p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-[#637064]">#{index + 1}</span>
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${confidenceStyles[finding.confidence]}`}>{finding.confidence}</span>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${severityStyles[finding.severity] || severityStyles.low}`}>{finding.severity}</span>
                          </div>
                          <h3 className="mt-2 text-base font-black text-[#14241b]">{finding.title}</h3>
                          <p className="mt-1 break-words text-xs font-bold text-[#1d7a45]">{finding.role} · {finding.page} · {finding.action}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl bg-emerald-50 p-3">
                          <p className="text-[10px] font-black uppercase text-emerald-700">Expected</p>
                          <p className="mt-1 text-sm font-bold leading-5 text-emerald-950">{finding.expected}</p>
                        </div>
                        <div className="rounded-2xl bg-red-50 p-3">
                          <p className="text-[10px] font-black uppercase text-red-700">Actual</p>
                          <p className="mt-1 text-sm font-bold leading-5 text-red-950">{finding.actual}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl bg-[#f3f0e6] p-3">
                        <p className="text-[10px] font-black uppercase text-[#637064]">Evidence</p>
                        <p className="mt-1 break-words font-mono text-xs leading-5 text-[#2d392f]">{finding.evidence}</p>
                      </div>
                      <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
                        <p className="text-[10px] font-black uppercase text-sky-700">Safe next check</p>
                        <p className="mt-1 text-sm font-bold leading-5 text-sky-950">{finding.nextStep}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
