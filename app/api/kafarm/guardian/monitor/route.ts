import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getKaFarmSystemMapStatus } from "@/lib/kafarm/guardian/system-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FARMCONNECT_PROJECT_URL = "https://bfckjrqrixbtqqvsxgjq.supabase.co";

type MonitorFinding = {
  code: string;
  severity: "critical" | "high" | "medium" | "low";
  workflow: string;
  message: string;
  source: string;
  sourceRecordId?: string | null;
};

const TRUTH_MODEL_VERSION = "current-deployment-v3";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-KaFarm-Monitor": "guarded-observer" } });
}

function fingerprint(item: MonitorFinding) {
  return createHash("sha256").update(`${item.code}|${item.workflow}|${item.sourceRecordId || "global"}`).digest("hex").slice(0, 24);
}

function summarizeFindings(findings: MonitorFinding[]) {
  const groups = new Map<string, { code: string; workflow: string; severity: MonitorFinding["severity"]; count: number; sources: Set<string> }>();
  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  for (const finding of findings) {
    const key = `${finding.code}|${finding.workflow}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { code: finding.code, workflow: finding.workflow, severity: finding.severity, count: 1, sources: new Set([finding.source]) });
      continue;
    }
    existing.count += 1;
    existing.sources.add(finding.source);
    if (rank[finding.severity] > rank[existing.severity]) existing.severity = finding.severity;
  }
  return [...groups.values()].map((group) => ({ ...group, sources: [...group.sources].sort() })).sort((left, right) => rank[right.severity] - rank[left.severity] || right.count - left.count).slice(0, 50);
}

export async function GET(request: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret) return json(503, { ok: false, error: "CRON_SECRET_NOT_CONFIGURED" });
  if ((request.headers.get("authorization") || "") !== `Bearer ${cronSecret}`) return json(401, { ok: false, error: "INVALID_CRON_AUTHORIZATION" });
  if (String(process.env.KAFARM_MONITOR_ENABLED || "false").toLowerCase() !== "true") {
    return json(503, { ok: false, error: "KAFARM_MONITOR_DISABLED", safeDefault: true, note: "Enable only after the proposed read-only monitor RPC is reviewed and applied." });
  }

  const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (projectUrl !== FARMCONNECT_PROJECT_URL || !serviceRoleKey) {
    return json(503, { ok: false, error: "FARMCONNECT_MONITOR_ENV_INVALID" });
  }

  const findings: MonitorFinding[] = [];
  let snapshotMeta = { demoBaselineAt: null as string | null, demoHistoryIgnored: 0 };
  let snapshotOk = true;
  const map = getKaFarmSystemMapStatus();
  if (map.commitMatchesDeployment === false) {
    findings.push({ code: "source_deployment_drift", severity: "high", workflow: "deployment", message: "Generated system map commit does not match the deployed commit.", source: "guardian_system_map" });
  }
  if ((map.sourceAgeMinutes ?? 0) > 1440) {
    findings.push({ code: "stale_system_map", severity: "medium", workflow: "source_inventory", message: `Generated source map is ${map.sourceAgeMinutes} minutes old.`, source: "guardian_system_map" });
  }

  const service = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await service.rpc("kafarm_guardian_monitor_snapshot");
  if (error) {
    snapshotOk = false;
    findings.push({ code: "monitor_snapshot_unavailable", severity: "high", workflow: "monitoring", message: error.message, source: "rpc:kafarm_guardian_monitor_snapshot" });
  } else {
    const row = (Array.isArray(data) ? data[0] : data) as {
      findings?: MonitorFinding[];
      generated_at?: string;
      demo_baseline_at?: string | null;
      demo_history_ignored?: number;
    } | null;
    for (const item of row?.findings || []) findings.push({ ...item, source: item.source || "rpc:kafarm_guardian_monitor_snapshot" });
    snapshotMeta = {
      demoBaselineAt: row?.demo_baseline_at || null,
      demoHistoryIgnored: Math.max(0, Number(row?.demo_history_ignored || 0)),
    };
  }

  const deduplicated = Array.from(new Map(findings.map((item) => [fingerprint(item), { ...item, fingerprint: fingerprint(item) }])).values());
  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  deduplicated.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

  let persistedCount = 0;
  let persistenceError: string | null = null;
  // Runtime incidents already live in kafarm_incidents. Persisting an incident
  // about another incident refreshes old evidence and creates a false current
  // signal. Only first-party monitor findings may create a monitor incident.
  const persistableFindings = deduplicated.filter((item) => item.code !== "open_runtime_incident" && item.source !== "kafarm_incidents");
  if (persistableFindings.length) {
    const incidentRows = persistableFindings.map((item) => ({
      incident_key: `guardian:${item.fingerprint}`,
      source: "guardian_monitor",
      title: `KaFarm Guardian: ${item.code.replaceAll("_", " ")}`,
      category: item.workflow,
      severity: item.severity.toUpperCase(),
      status: "Checking",
      app_role: "system",
      route: "/api/kafarm/guardian/monitor",
      affected: `${item.source}${item.sourceRecordId ? `:${item.sourceRecordId}` : ""}`,
      message: item.message,
      evidence: [
        `Monitor code: ${item.code}`,
        `Source: ${item.source}`,
        ...(item.sourceRecordId ? [`Source record: ${item.sourceRecordId}`] : []),
      ],
      proposed_fix: "Open KaFarm System Health, verify the source record, and investigate the first failed workflow step.",
      safe_recovery: "Do not repeat a sensitive transaction. Preserve evidence and use only the canonical guarded workflow after Admin review.",
      metadata: {
        monitorFingerprint: item.fingerprint,
        monitorCode: item.code,
        sourceRecordId: item.sourceRecordId || null,
        truthModelVersion: TRUTH_MODEL_VERSION,
        deploymentCommit: (process.env.VERCEL_GIT_COMMIT_SHA || "").trim() || null,
        observedAt: new Date().toISOString(),
        automaticRepairAttempted: false,
      },
    }));
    const { data: persistedRows, error: persistError } = await service
      .from("kafarm_incidents")
      .upsert(incidentRows, { onConflict: "incident_key", ignoreDuplicates: true })
      .select("id");
    if (persistError) persistenceError = persistError.message;
    else persistedCount = persistedRows?.length || 0;
  }

  const deploymentCommit = (process.env.VERCEL_GIT_COMMIT_SHA || "").trim() || null;
  const findingSummary = summarizeFindings(deduplicated);
  const { error: heartbeatError } = await service.from("kafarm_guardian_monitor_runs").insert({
    deployment_commit: deploymentCommit,
    finding_count: deduplicated.length,
    persisted_incident_count: persistedCount,
    snapshot_ok: snapshotOk,
    persistence_ok: !persistenceError,
    metadata: {
      monitorMode: "guarded-proactive-monitor",
      truthModelVersion: TRUTH_MODEL_VERSION,
      findingSummary,
      ...snapshotMeta,
      businessMutationAttempted: false,
      incidentLoggingAttempted: persistableFindings.length > 0,
    },
  });

  const monitorHealthy = snapshotOk && !persistenceError && !heartbeatError;

  return json(200, {
    ok: monitorHealthy,
    mode: "guarded-proactive-monitor",
    generatedAt: new Date().toISOString(),
    truthModelVersion: TRUTH_MODEL_VERSION,
    findingCount: deduplicated.length,
    findingSummary,
    ...snapshotMeta,
    findings: deduplicated,
    mutationAttempted: persistableFindings.length > 0,
    businessMutationAttempted: false,
    incidentLoggingAttempted: persistableFindings.length > 0,
    persistedCount,
    persistenceError,
    heartbeatPersisted: !heartbeatError,
    heartbeatError: heartbeatError?.message || null,
    deploymentCommit,
    persistence: "Only first-party monitor findings are deduplicated into the Admin queue. Existing runtime incidents are read directly and are never wrapped as new incidents. No business workflow, money, KYC, ownership, approval, or recovery action is executed.",
  });
}
