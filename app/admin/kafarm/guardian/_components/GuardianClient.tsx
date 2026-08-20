"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { KaFarmGuardianDiagnosis, KaFarmTruthReference } from "@/lib/kafarm/guardian/types";

type GuardianStatus = {
  ok: boolean;
  rateLimit?: {
    requestedMode: "off" | "observe" | "enforce";
    effectiveMode: "unverified" | "enforce";
    switchPrepared: boolean;
    persistentBackendInstalled: boolean;
    businessRpcEnforcement: boolean;
    productionVerified: boolean;
    databaseVerified: boolean;
    activationAuthority: "database_migration_and_deployment_verification";
    environmentKey: string;
    status: "READY_NOT_VERIFIED" | "ENFORCING";
    warning: string;
  };
  capabilities?: {
    guardianVersion: string;
    blueprint: { id: string; version: string; updatedAt: string };
    ai: { configured: boolean; model: string; serverOnly: boolean; unrestrictedDatabaseMutation: boolean };
    killSwitch: { aiActionsFrozen: boolean; safeDefault: boolean };
    evidenceTools: string[];
    executionAdapters: { available: boolean; reason: string };
  };
  systemMap?: {
    generatedAt: string;
    fingerprint: string;
    counts: { pages: number; apiRoutes: number; actions: number; backendReferences: number; edges: number; tests: number };
    commitMatchesDeployment: boolean | null;
    limitations: string[];
  };
  truthReference?: KaFarmTruthReference;
  error?: string;
};

type DiagnosisResponse = { ok: boolean; diagnosis?: KaFarmGuardianDiagnosis; error?: string; execution?: { attempted: boolean; allowed: boolean; reason: string } };

function badgeClass(value: string) {
  if (/PASS|CONFIRMED_HEALTHY|green/i.test(value)) return "bg-emerald-100 text-emerald-900 ring-emerald-300";
  if (/BLOCK|FAIL|red|CONTRADICTORY/i.test(value)) return "bg-red-100 text-red-900 ring-red-300";
  if (/CONFIRMED_ISSUE/i.test(value)) return "bg-red-100 text-red-900 ring-red-300";
  if (/APPROVAL|HOLD|orange|yellow|LIKELY|HIGH/i.test(value)) return "bg-amber-100 text-amber-950 ring-amber-300";
  return "bg-slate-100 text-slate-800 ring-slate-300";
}

async function adminToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export function GuardianClient() {
  const [status, setStatus] = useState<GuardianStatus | null>(null);
  const [statusNote, setStatusNote] = useState("Checking active Admin and Guardian status...");
  const [question, setQuestion] = useState("Trace the latest FarmConnect workflow issue. Identify the last proven-good step, first broken or unproven step, root-cause confidence, containment, and proof still required.");
  const [running, setRunning] = useState(false);
  const [diagnosis, setDiagnosis] = useState<KaFarmGuardianDiagnosis | null>(null);
  const [runNote, setRunNote] = useState("No diagnosis run yet. This page cannot execute a repair or production mutation.");

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await adminToken();
      if (!token) {
        if (active) setStatusNote("No active Admin session. Login again as an active Admin.");
        return;
      }
      try {
        const response = await fetch("/api/kafarm/guardian", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const body = await response.json() as GuardianStatus;
        if (!active) return;
        setStatus(body);
        setStatusNote(body.ok ? "Guardian boundary verified for the current Admin session." : `Guardian unavailable: ${body.error || response.status}`);
      } catch (error) {
        if (active) setStatusNote(error instanceof Error ? error.message : "Guardian status request failed.");
      }
    })();
    return () => { active = false; };
  }, []);

  async function runDiagnosis() {
    const clean = question.trim();
    if (clean.length < 8) {
      setRunNote("Describe the FarmConnect workflow, expected result, and actual result first.");
      return;
    }
    setRunning(true);
    setRunNote("Collecting controlled FarmConnect evidence. No mutation is being executed...");
    setDiagnosis(null);
    try {
      const token = await adminToken();
      if (!token) throw new Error("Active Admin login is required.");
      const response = await fetch("/api/kafarm/guardian", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean }),
      });
      const body = await response.json() as DiagnosisResponse;
      if (!response.ok || !body.ok || !body.diagnosis) throw new Error(body.error || `Guardian request failed (${response.status}).`);
      setDiagnosis(body.diagnosis);
      setRunNote(body.diagnosis.mode === "openai_evidence_reasoning"
        ? "Evidence-grounded LLM reasoning completed. Gate decision is deterministic; no repair was executed."
        : "Deterministic fallback completed. LLM reasoning was unavailable, so root cause was not invented.");
    } catch (error) {
      setRunNote(error instanceof Error ? error.message : "Guardian diagnosis failed.");
    } finally {
      setRunning(false);
    }
  }

  const capabilities = status?.capabilities;
  const truth = status?.truthReference;

  async function copyTruthReference() {
    if (!truth) return;
    const lines = [
      "KAFARM TRUTH REFERENCE",
      `Generated: ${truth.generatedAt}`,
      `Verdict: ${truth.verdict}`,
      `Reason: ${truth.verdictReason}`,
      `Deployment: ${truth.deployment.classification} · ${truth.deployment.commit || "unknown commit"}`,
      `Monitor: ${truth.monitor.classification} · latest ${truth.monitor.latestRunAt || "not proven"}`,
      `Raw open records read: ${truth.incidentSummary.rawOpenRecordsRead}`,
      `Grouped current root causes: ${truth.incidentSummary.groupedRootCauses}`,
      `Unproven groups: ${truth.incidentSummary.unprovenGroups}`,
      `Stale groups ignored: ${truth.incidentSummary.staleGroups}`,
      "",
      "CURRENT GROUPS",
      ...truth.incidentSummary.groups.map((item, index) => `${index + 1}. [${item.classification} / ${item.severity}] ${item.title}\nWorkflow: ${item.workflow}\nEvidence records: ${item.evidenceCount}\nLast seen: ${item.lastSeenAt || "unknown"}\nNext: ${item.safeNextAction}`),
      "",
      "RULE: Newer direct production evidence overrides older tests and locked history. UNPROVEN is never presented as healthy.",
      "Safety: read-only; no business mutation or automatic repair was attempted.",
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setStatusNote("KaFarm Truth Reference copied. It contains grouped evidence and no credentials.");
  }
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#e9f7e9_0%,#fff8dc_52%,#e9f3ff_100%)] p-4 text-[#14241b]">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#163d8f]/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#1d7a45]">FarmConnect-only evidence guardian</p>
              <h1 className="mt-1 text-3xl font-black text-[#0f3f2c]">KaFarm Guardian</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#637064]">Reads evidence, traces workflows, tests hypotheses, explains the result, and sends every proposed action through a deterministic safety gate.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/kafarm/whole-app-reader" className="rounded-2xl bg-[#163d8f] px-4 py-3 text-xs font-black text-white">Whole-App Reader</Link>
              <Link href="/admin/kafarm" className="rounded-2xl bg-[#0f3f2c] px-4 py-3 text-xs font-black text-white">KaFarm Report</Link>
              <Link href="/admin" className="rounded-2xl bg-[#5f6f65] px-4 py-3 text-xs font-black text-white">Admin Home</Link>
            </div>
          </div>
          <p className="mt-4 rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] px-4 py-3 text-xs font-bold text-[#526054]">{statusNote}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Reasoning</p><p className="mt-1 font-black">{capabilities?.ai.configured ? `OpenAI · ${capabilities.ai.model}` : "Deterministic fallback"}</p></div>
            <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Kill switch</p><p className="mt-1 font-black">{capabilities?.killSwitch.aiActionsFrozen === false ? "AI actions unfrozen" : "AI ACTIONS FROZEN"}</p></div>
            <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Living map</p><p className="mt-1 font-black">{status?.systemMap ? `${status.systemMap.counts.pages} pages · ${status.systemMap.counts.edges} edges` : "Unavailable"}</p></div>
            <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Execution adapter</p><p className="mt-1 font-black">{capabilities?.executionAdapters.available ? "Available" : "Not installed"}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Full-app rate-limit switch</p>
              <p className="mt-1 text-sm font-black text-[#0f3f2c]">{status?.rateLimit ? `${status.rateLimit.effectiveMode.toUpperCase()} · Persistent guard ${status.rateLimit.persistentBackendInstalled ? "installed" : "missing"}` : "Checking status..."}</p>
              <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-[#637064]">{status?.rateLimit?.warning || "Status is available only after active Admin verification."}</p>
            </div>
            <button type="button" disabled data-kafarm-monitor-ignore="true" title="Activation is controlled by the deployment environment, not by the browser." className="cursor-not-allowed rounded-2xl bg-slate-200 px-5 py-3 text-xs font-black text-slate-600">
              {status?.rateLimit?.effectiveMode === "enforce" ? "Rate Limit ON · Database Enforced" : "Rate Limit · Awaiting Database Verification"}
            </button>
          </div>
        </header>

        <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#163d8f]/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#163d8f]">Single source of operational truth</p>
              <h2 className="mt-1 text-2xl font-black text-[#0f3f2c]">KaFarm Truth Reference</h2>
              <p className="mt-2 max-w-4xl text-sm font-bold leading-6 text-[#637064]">Groups repeated records into root causes and separates current proof from prediction and stale history.</p>
            </div>
            <button type="button" data-kafarm-monitor-ignore="true" onClick={copyTruthReference} disabled={!truth} className="rounded-2xl bg-[#163d8f] px-5 py-3 text-xs font-black text-white disabled:opacity-50">Copy Truth Reference</button>
          </div>

          {truth ? <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${badgeClass(truth.verdict)}`}>{truth.verdict.replaceAll("_", " ")}</span>
              <p className="text-sm font-bold leading-6">{truth.verdictReason}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Raw records</p><p className="mt-1 text-2xl font-black">{truth.incidentSummary.rawOpenRecordsRead}</p></div>
              <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Current root causes</p><p className="mt-1 text-2xl font-black">{truth.incidentSummary.groupedRootCauses}</p></div>
              <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Unproven leads</p><p className="mt-1 text-2xl font-black">{truth.incidentSummary.unprovenGroups}</p></div>
              <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Stale groups ignored</p><p className="mt-1 text-2xl font-black">{truth.incidentSummary.staleGroups}</p></div>
              <div className="rounded-2xl bg-[#f4f8f2] p-4"><p className="text-[10px] font-black uppercase text-slate-500">Latest monitor</p><p className="mt-1 text-sm font-black">{truth.monitor.latestRunAt ? new Date(truth.monitor.latestRunAt).toLocaleString() : "UNPROVEN"}</p></div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4">
                <p className="text-xs font-black uppercase text-[#1d7a45]">Authority order</p>
                <ol className="mt-3 space-y-2 text-xs font-bold leading-5">{truth.authorityOrder.map((item) => <li key={item.rank} className="rounded-xl bg-white p-3"><span className="font-black">{item.rank}. {item.source}</span><br /><span className="text-[#637064]">{item.rule}</span></li>)}</ol>
              </div>
              <div className="rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4">
                <p className="text-xs font-black uppercase text-[#163d8f]">Grouped evidence</p>
                {truth.incidentSummary.groups.length ? <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">{truth.incidentSummary.groups.map((item) => <article key={item.key} className="rounded-xl bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${badgeClass(item.classification)}`}>{item.classification.replaceAll("_", " ")}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{item.severity}</span><span className="text-[10px] font-black text-slate-500">{item.evidenceCount} record(s) grouped</span></div>
                  <p className="mt-2 text-sm font-black">{item.title}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#637064]">{item.message}</p>
                  <p className="mt-2 text-[10px] font-bold text-slate-500">Workflow: {item.workflow} · Last seen: {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : "unknown"}</p>
                  <p className="mt-2 rounded-lg bg-[#eef8ec] p-2 text-xs font-bold">Next: {item.safeNextAction}</p>
                </article>)}</div> : <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm font-bold">No current or stale open incident group was returned.</p>}
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-[#fff8dc] p-4 text-xs font-bold leading-5">Proof rule: {truth.proofRules.join(" ")}</p>
          </> : <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold">Truth Reference is unavailable until the active Admin session and authoritative evidence reads succeed.</p>}
        </section>

        <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#1d7a45]/10">
          <h2 className="text-xl font-black text-[#0f3f2c]">Evidence Investigation</h2>
          <p className="mt-1 text-xs font-bold text-[#637064]">State the route/workflow, expected result, actual result, timestamp, and known record or error. Do not paste passwords, PINs, tokens, or private KYC images.</p>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} className="mt-4 min-h-36 w-full rounded-2xl border border-[#cbdcc8] bg-[#fbfbf6] p-4 text-sm font-bold leading-6 outline-none focus:border-[#1d7a45]" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-[#637064]">{runNote}</p>
            <button type="button" data-kafarm-monitor-ignore="true" onClick={runDiagnosis} disabled={running} className="rounded-2xl bg-[#f8c51c] px-6 py-4 text-sm font-black text-[#14241b] shadow-md disabled:opacity-60">{running ? "Reading Evidence..." : "Run Guardian Diagnosis"}</button>
          </div>
        </section>

        {diagnosis ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${badgeClass(diagnosis.confidence)}`}>{diagnosis.confidence}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${badgeClass(diagnosis.gate.decision)}`}>{diagnosis.gate.decision}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{diagnosis.mode}</span>
                </div>
                <h2 className="mt-4 text-2xl font-black text-[#0f3f2c]">{diagnosis.summary}</h2>
                <div className="mt-4 rounded-2xl bg-[#eef8ec] p-4">
                  <p className="text-xs font-black uppercase text-[#1d7a45]">Owner explanation</p>
                  <p className="mt-2 text-base font-bold leading-7">{diagnosis.ownerExplanation}</p>
                </div>
                <div className="mt-4 rounded-2xl bg-[#f4f6fb] p-4">
                  <p className="text-xs font-black uppercase text-[#163d8f]">Technical explanation</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">{diagnosis.technicalExplanation}</p>
                </div>
              </div>

              <aside className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg">
                <p className="text-xs font-black uppercase text-slate-500">Deterministic logic gate</p>
                <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-black ring-1 ${badgeClass(diagnosis.gate.decision)}`}>{diagnosis.gate.decision}</p>
                <p className="mt-3 text-sm font-black">Risk: {diagnosis.gate.level.toUpperCase()}</p>
                <p className="mt-1 text-xs font-bold text-[#637064]">Execution allowed: {diagnosis.gate.executionAllowed ? "Yes by gate, but no adapter exists" : "No"}</p>
                <ul className="mt-4 space-y-2 text-xs font-bold leading-5">
                  {diagnosis.gate.reasons.map((item) => <li key={item} className="rounded-xl bg-[#fbf3dc] p-3">{item}</li>)}
                </ul>
              </aside>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg">
                <h2 className="text-xl font-black text-[#0f3f2c]">Workflow Trace</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl bg-[#f4f8f2] p-4"><dt className="text-xs font-black uppercase text-slate-500">Expected</dt><dd className="mt-1 font-bold">{diagnosis.expectedState}</dd></div>
                  <div className="rounded-2xl bg-[#f4f8f2] p-4"><dt className="text-xs font-black uppercase text-slate-500">Actual</dt><dd className="mt-1 font-bold">{diagnosis.actualState}</dd></div>
                  <div className="rounded-2xl bg-emerald-50 p-4"><dt className="text-xs font-black uppercase text-emerald-800">Last proven good</dt><dd className="mt-1 font-bold">{diagnosis.lastProvenGoodStep}</dd></div>
                  <div className="rounded-2xl bg-amber-50 p-4"><dt className="text-xs font-black uppercase text-amber-800">First broken or unproven</dt><dd className="mt-1 font-bold">{diagnosis.firstBrokenOrUnprovenStep}</dd></div>
                  <div className="rounded-2xl bg-red-50 p-4"><dt className="text-xs font-black uppercase text-red-800">Root cause</dt><dd className="mt-1 font-bold">{diagnosis.rootCause}</dd></div>
                </dl>
              </div>
              <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg">
                <h2 className="text-xl font-black text-[#0f3f2c]">Containment & Safe Recovery</h2>
                <p className="mt-4 text-xs font-black uppercase text-slate-500">Contain now</p>
                <ol className="mt-2 space-y-2 text-sm font-bold">{diagnosis.containment.map((item, index) => <li key={item} className="rounded-xl bg-red-50 p-3">{index + 1}. {item}</li>)}</ol>
                <p className="mt-5 text-xs font-black uppercase text-slate-500">Resume safely</p>
                <ol className="mt-2 space-y-2 text-sm font-bold">{diagnosis.safeRecovery.map((item, index) => <li key={item} className="rounded-xl bg-emerald-50 p-3">{index + 1}. {item}</li>)}</ol>
              </div>
            </section>

            <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg">
              <h2 className="text-xl font-black text-[#0f3f2c]">Evidence Used</h2>
              {diagnosis.evidence.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{diagnosis.evidence.map((item, index) => (
                <article key={`${item.locator}-${index}`} className="rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4">
                  <p className="text-[10px] font-black uppercase text-[#163d8f]">{item.source}</p>
                  <p className="mt-1 text-sm font-black">{item.title}</p>
                  <p className="mt-2 text-xs font-bold leading-5 text-[#637064]">{item.detail}</p>
                  <p className="mt-2 break-all font-mono text-[10px] text-slate-500">{item.locator}</p>
                </article>
              ))}</div> : <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm font-bold">No authoritative evidence reference was returned. The diagnosis cannot be treated as confirmed.</p>}
            </section>

            <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-lg">
              <h2 className="text-xl font-black text-[#0f3f2c]">Proof of Done</h2>
              <p className="mt-1 text-xs font-bold text-[#637064]">Test exists is different from test passed on this release.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{diagnosis.proofOfDone.map((item, index) => (
                <div key={`${item.key}-${index}`} className="rounded-2xl bg-[#f4f8f2] p-4">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${badgeClass(item.status)}`}>{item.status}</span>
                  <p className="mt-3 text-xs font-black uppercase">{item.key.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-xs font-bold leading-5 text-[#637064]">{item.detail}</p>
                </div>
              ))}</div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
