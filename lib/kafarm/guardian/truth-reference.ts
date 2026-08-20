import "server-only";

import type { KaFarmAdminContext } from "./admin-auth";
import { getKaFarmSystemMapStatus } from "./system-map";
import type { KaFarmTruthClassification, KaFarmTruthReference } from "./types";

type IncidentRow = {
  id?: string | null;
  source?: string | null;
  title?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  route?: string | null;
  message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type MonitorRun = {
  ran_at?: string | null;
  deployment_commit?: string | null;
  finding_count?: number | null;
  persisted_incident_count?: number | null;
  snapshot_ok?: boolean | null;
  persistence_ok?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

type MonitorFindingSummary = {
  code?: string;
  workflow?: string;
  severity?: string;
  count?: number;
  sources?: string[];
};

const FRESH_MONITOR_MS = 48 * 60 * 60 * 1000;
const TRUTH_MODEL_VERSION = "current-deployment-v3";
const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function validDate(value?: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value?: string | null, fallback = "Unknown") {
  return String(value || "").trim() || fallback;
}

function normalizedRootKey(row: IncidentRow) {
  const monitorCode = typeof row.metadata?.monitorCode === "string" ? row.metadata.monitorCode : "";
  const title = clean(row.title, "incident")
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, "record")
    .replace(/\b\d+\b/g, "number")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return [monitorCode || title, clean(row.category, "unknown").toLowerCase(), clean(row.route, "unmapped")].join("|");
}

function classifyIncident(row: IncidentRow, deploymentBoundary: number | null): KaFarmTruthClassification {
  const observed = validDate(row.created_at);
  if (deploymentBoundary === null || observed === null) return "UNPROVEN";
  if (observed < deploymentBoundary) return "STALE_IGNORE";
  // Direct browser/API incidents created on this deployment are current runtime
  // evidence. Guardian monitor records are operational leads until the source
  // workflow record is reconciled or the behavior is reproduced.
  return row.source === "guardian_monitor" ? "UNPROVEN" : "CONFIRMED_ISSUE";
}

function groupIncidents(rows: IncidentRow[], deploymentBoundary: number | null) {
  const grouped = new Map<string, IncidentRow[]>();
  for (const row of rows) {
    const key = normalizedRootKey(row);
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }

  return [...grouped.entries()].map(([key, items]) => {
    const sorted = [...items].sort((left, right) => (validDate(right.updated_at || right.created_at) || 0) - (validDate(left.updated_at || left.created_at) || 0));
    const newest = sorted[0] || {};
    const timestamps = items.map((item) => validDate(item.updated_at || item.created_at)).filter((item): item is number => item !== null);
    const firstSeenAt = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
    const lastSeenAt = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
    const classifications = items.map((item) => classifyIncident(item, deploymentBoundary));
    const classification: KaFarmTruthClassification = classifications.includes("CONFIRMED_ISSUE")
      ? "CONFIRMED_ISSUE"
      : classifications.includes("UNPROVEN") ? "UNPROVEN" : "STALE_IGNORE";
    const severity = items.map((item) => clean(item.severity, "MEDIUM").toUpperCase()).sort((left, right) => (severityRank[right] || 0) - (severityRank[left] || 0))[0] || "MEDIUM";
    return {
      key,
      classification,
      severity,
      workflow: clean(newest.category),
      title: clean(newest.title),
      message: clean(newest.message, "No incident message was recorded."),
      route: newest.route ? String(newest.route) : null,
      evidenceCount: items.length,
      firstSeenAt,
      lastSeenAt,
      evidenceSource: clean(newest.source, "kafarm_incidents"),
      safeNextAction: classification === "STALE_IGNORE"
        ? "Do not act on this history unless the same behavior is reproduced on the current deployment."
        : classification === "UNPROVEN"
          ? "Reconcile the source workflow record or reproduce the behavior on the current deployment before calling this a bug."
          : "Open the grouped evidence, confirm the affected record, and investigate the first broken official workflow step without repeating the transaction.",
    };
  }).sort((left, right) => {
    if (left.classification !== right.classification) {
      const rank: Record<KaFarmTruthClassification, number> = { CONFIRMED_ISSUE: 3, UNPROVEN: 2, STALE_IGNORE: 1, CONFIRMED_HEALTHY: 0 };
      return rank[right.classification] - rank[left.classification];
    }
    return (severityRank[right.severity] || 0) - (severityRank[left.severity] || 0) || (validDate(right.lastSeenAt) || 0) - (validDate(left.lastSeenAt) || 0);
  });
}

function monitorLeadGroups(run: MonitorRun | null, runAt: string | null) {
  const summary = Array.isArray(run?.metadata?.findingSummary) ? run?.metadata?.findingSummary as MonitorFindingSummary[] : [];
  return summary.map((item) => ({
    key: `monitor|${clean(item.code, "unknown").toLowerCase()}|${clean(item.workflow, "unknown").toLowerCase()}`,
    classification: "UNPROVEN" as const,
    severity: clean(item.severity, "MEDIUM").toUpperCase(),
    workflow: clean(item.workflow),
    title: `Monitor lead: ${clean(item.code).replaceAll("_", " ")}`,
    message: `${Math.max(0, Number(item.count || 0))} current source record(s) require reconciliation. This is an operational lead, not a confirmed software bug.`,
    route: null,
    evidenceCount: Math.max(0, Number(item.count || 0)),
    firstSeenAt: runAt,
    lastSeenAt: runAt,
    evidenceSource: Array.isArray(item.sources) && item.sources.length ? item.sources.join(", ") : "kafarm_guardian_monitor_snapshot",
    safeNextAction: "Reconcile the source workflow records or reproduce the behavior on this deployment before calling it a bug.",
  }));
}

export async function buildKaFarmTruthReference(context: KaFarmAdminContext): Promise<KaFarmTruthReference> {
  const map = getKaFarmSystemMapStatus();
  const deploymentCommit = (process.env.VERCEL_GIT_COMMIT_SHA || "").trim() || null;
  const limitations: string[] = [];

  const [runResult, incidentResult] = await Promise.all([
    context.privilegedReadClient
      .from("kafarm_guardian_monitor_runs")
      .select("ran_at,deployment_commit,finding_count,persisted_incident_count,snapshot_ok,persistence_ok,metadata")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.privilegedReadClient
      .from(context.serviceRoleAvailable ? "kafarm_incidents" : "admin_kafarm_incident_queue")
      .select("id,source,title,category,severity,status,route,message,created_at,updated_at,metadata")
      .not("status", "in", '("Resolved","Ignored","Completed")')
      .order("updated_at", { ascending: false })
      .limit(1000),
  ]);

  if (runResult.error) limitations.push(`Monitor ledger unavailable: ${runResult.error.message}`);
  if (incidentResult.error) limitations.push(`Incident evidence unavailable: ${incidentResult.error.message}`);
  const run = (runResult.data || null) as MonitorRun | null;
  const runAt = run?.ran_at ? String(run.ran_at) : null;
  const runTimestamp = validDate(runAt);
  const monitorFresh = runTimestamp !== null && Date.now() - runTimestamp <= FRESH_MONITOR_MS;
  const currentTruthModel = run?.metadata?.truthModelVersion === TRUTH_MODEL_VERSION;
  const demoBaselineAt = typeof run?.metadata?.demoBaselineAt === "string" ? run.metadata.demoBaselineAt : null;
  const demoHistoryIgnored = Math.max(0, Number(run?.metadata?.demoHistoryIgnored || 0));
  const monitorHealthy = monitorFresh && currentTruthModel && run?.snapshot_ok === true && run?.persistence_ok === true;
  let deploymentBoundary: number | null = null;
  if (deploymentCommit) {
    const boundaryResult = await context.privilegedReadClient
      .from("kafarm_guardian_monitor_runs")
      .select("ran_at")
      .eq("deployment_commit", deploymentCommit)
      .contains("metadata", { truthModelVersion: TRUTH_MODEL_VERSION })
      .order("ran_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (boundaryResult.error) limitations.push(`Deployment evidence boundary unavailable: ${boundaryResult.error.message}`);
    deploymentBoundary = validDate(boundaryResult.data?.ran_at ? String(boundaryResult.data.ran_at) : null);
  }
  const historicalAndRuntimeGroups = groupIncidents((incidentResult.data || []) as IncidentRow[], deploymentBoundary);
  const currentMonitorLeads = currentTruthModel ? monitorLeadGroups(run, runAt) : [];
  const groups = [...currentMonitorLeads, ...historicalAndRuntimeGroups];
  const currentGroups = groups.filter((item) => item.classification === "CONFIRMED_ISSUE");
  const unprovenGroups = groups.filter((item) => item.classification === "UNPROVEN");
  const staleGroups = groups.filter((item) => item.classification === "STALE_IGNORE");

  let verdict: KaFarmTruthReference["verdict"] = "UNPROVEN";
  let verdictReason = "Current authoritative evidence is incomplete; do not claim the app is healthy or broken.";
  if (currentGroups.length) {
    verdict = "CONFIRMED_ISSUE";
    verdictReason = `${currentGroups.length} current root-cause group(s) remain open. ${incidentResult.data?.length || 0} raw records were grouped so repeated records are not counted as separate bugs.`;
  } else if (unprovenGroups.length) {
    verdictReason = `${unprovenGroups.length} operational lead group(s) require source-record reconciliation or current-deployment reproduction before they can be called bugs.`;
  } else if (monitorHealthy && !incidentResult.error && deploymentBoundary !== null) {
    verdict = "CONFIRMED_HEALTHY";
    verdictReason = "The latest monitor heartbeat passed and no current open incident group was found. This is bounded to the workflows and evidence read by the monitor.";
  }

  const commitMatches = deploymentCommit ? deploymentCommit === map.git.commit : null;
  return {
    generatedAt: new Date().toISOString(),
    verdict,
    verdictReason,
    authorityOrder: [
      { rank: 1, source: "Live Supabase records and schema", rule: "Authoritative for current business and database state." },
      { rank: 2, source: "Current production deployment commit", rule: "Authoritative for the code actually deployed." },
      { rank: 3, source: "Current runtime and API evidence", rule: "Confirms behavior only for the captured route, record, and time." },
      { rank: 4, source: "Latest passed targeted tests", rule: "A test counts only when it passed against the relevant release and environment." },
      { rank: 5, source: "Locked live-test history", rule: "Historical proof remains valid only until newer conflicting evidence appears." },
      { rank: 6, source: "Static code prediction", rule: "Useful for investigation, but never proof that production is healthy or broken." },
    ],
    deployment: {
      commit: deploymentCommit,
      systemMapCommit: map.git.commit || null,
      commitMatches,
      classification: commitMatches === true ? "CONFIRMED_HEALTHY" : commitMatches === false ? "CONFIRMED_ISSUE" : "UNPROVEN",
    },
    monitor: {
      latestRunAt: runAt,
      fresh: monitorFresh,
      snapshotOk: run?.snapshot_ok === true,
      persistenceOk: run?.persistence_ok === true,
      rawFindingCount: Number(run?.finding_count || 0),
      persistedIncidentCount: Number(run?.persisted_incident_count || 0),
      demoBaselineAt,
      demoHistoryIgnored,
      classification: monitorHealthy ? "CONFIRMED_HEALTHY" : "UNPROVEN",
    },
    incidentSummary: {
      rawOpenRecordsRead: incidentResult.data?.length || 0,
      groupedRootCauses: currentGroups.length,
      unprovenGroups: unprovenGroups.length,
      staleGroups: staleGroups.length,
      groups,
    },
    proofRules: [
      "One repeated root cause is one grouped issue, even when it affects many records.",
      "A successful monitor heartbeat proves the monitor ran; it does not prove every FarmConnect feature passed.",
      "Newer direct production evidence overrides older tests and locked history.",
      "Missing evidence is UNPROVEN, not healthy and not broken.",
      "Stale evidence is ignored until reproduced on the current deployment.",
      "A monitor observation about a stuck record is UNPROVEN until the source record is reconciled; it is not automatically a software bug.",
      "Owner-confirmed pre-rollout demo history is preserved for audit but excluded from current operational leads after the recorded baseline.",
    ],
    limitations: [
      ...limitations,
      "The incident read is capped at the latest 1,000 open records.",
      currentTruthModel ? "The latest heartbeat uses the current-deployment truth model." : "Run the production monitor after deploying this truth-model revision before relying on the verdict.",
      "Truth Reference is read-only and cannot approve, reject, pay, transfer, change ownership, decide KYC, repair data, or execute SQL.",
    ],
    safety: { readOnly: true, businessMutationAttempted: false, automaticRepairAttempted: false },
  };
}
