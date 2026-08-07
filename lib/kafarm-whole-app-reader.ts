export type KaFarmReaderScope = "whole-app" | "system" | "customer" | "admin" | "caretaker" | "database" | "flow";
export type KaFarmFindingConfidence = "confirmed" | "possible" | "stale";
export type KaFarmFindingSeverity = "critical" | "high" | "medium" | "low";

export type KaFarmReaderFinding = {
  id: string;
  confidence: KaFarmFindingConfidence;
  severity: KaFarmFindingSeverity;
  scope: string;
  role: string;
  page: string;
  action: string;
  title: string;
  expected: string;
  actual: string;
  evidence: string;
  nextStep: string;
  source?: "static" | "runtime";
  requiresAdminApproval?: boolean;
};

export type KaFarmRuntimeIncident = {
  id: string;
  incident_key?: string | null;
  title: string;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  app_role?: string | null;
  route?: string | null;
  affected?: string | null;
  message?: string | null;
  evidence?: string | null;
  proposed_fix?: string | null;
  safe_recovery?: string | null;
  stack_trace?: string | null;
  http_status?: number | null;
  request_url?: string | null;
  created_at?: string | null;
};

export type KaFarmSystemSnapshot = {
  schemaVersion: string;
  generatedAt: string;
  sourceFingerprint: string;
  git: { commit: string | null; branch: string | null; dirtyFiles: string[] };
  safety: {
    mode: string;
    autoFix: boolean;
    sqlExecution: boolean;
    sensitiveActions: boolean;
    rules: string[];
  };
  databaseAuthority: {
    sourceOfTruth: string;
    liveReader: string;
    provenanceFile: string;
    provenancePresent: boolean;
    staticMigrationAbsenceMeans: string;
    rules: string[];
  };
  counts: {
    routes: number;
    apiEndpoints: number;
    clientStorageKeys: number;
    activeFiles: number;
    unreachableFiles: number;
    actions: number;
    backendReferences: number;
    findings: number;
  };
  routes: Array<{ route: string; file: string; role: string }>;
  apiEndpoints: Array<{ route: string; file: string; methods: string[]; role: string }>;
  actions: Array<{
    kind: string;
    label: string;
    file: string;
    line: number;
    role: string;
    route: string;
    wiring: string;
    handler: string | null;
  }>;
  backendReferences: Array<{
    kind: string;
    name: string;
    file: string;
    line: number;
    role: string;
    route: string;
  }>;
  routeReferences: Array<{
    source: string;
    line: number;
    ownerRoute: string;
    target: string;
    exists: boolean;
  }>;
  clientStorageKeys: Array<{
    storage: string;
    operation: string;
    key: string;
    file: string;
    line: number;
    role: string;
    route: string;
  }>;
  contractCoverage: Array<{
    id: string;
    name: string;
    producerRole: string;
    receiverRoles: string[];
    signals: Array<{ id: string; label: string; present: boolean }>;
    missing: string[];
  }>;
  featureDependencies: Array<{
    id: string;
    name: string;
    producer: boolean;
    storage: boolean;
    consumer: boolean;
    connected: boolean;
  }>;
  findings: KaFarmReaderFinding[];
  activeManifest: Array<{ file: string; sha256: string }>;
  unreachableFiles: string[];
};

export type KaFarmReaderRun = {
  ok: true;
  mode: "read-only";
  scope: KaFarmReaderScope;
  runAt: string;
  snapshot: {
    schemaVersion: string;
    generatedAt: string;
    sourceFingerprint: string;
    git: KaFarmSystemSnapshot["git"];
    counts: KaFarmSystemSnapshot["counts"];
    databaseAuthority: KaFarmSystemSnapshot["databaseAuthority"];
  };
  summary: {
    total: number;
    confirmed: number;
    possible: number;
    stale: number;
    critical: number;
    high: number;
    runtime: number;
  };
  findings: KaFarmReaderFinding[];
  featureDependencies: KaFarmSystemSnapshot["featureDependencies"];
  contractCoverage: KaFarmSystemSnapshot["contractCoverage"];
  safety: KaFarmSystemSnapshot["safety"];
  buddyReport: string;
  deviceUsage?: {
    ok: boolean;
    error: string | null;
    periodDays: number;
    totalSessions: number;
    totalRouteViews: number;
    deviceTypes: Array<{
      deviceType: "desktop" | "tablet" | "phone";
      layoutMode: string;
      uniqueSessions: number;
      routeViews: number;
      lastSeenAt: string | null;
    }>;
    recentRoutes: Array<{
      route: string;
      appRole: string;
      deviceType: string;
      views: number;
      lastSeenAt: string;
    }>;
  };
};

export const kaFarmReaderScopes: KaFarmReaderScope[] = ["whole-app", "system", "customer", "admin", "caretaker", "database", "flow"];

function matchesScope(finding: KaFarmReaderFinding, scope: KaFarmReaderScope) {
  if (scope === "whole-app") return true;
  const haystack = `${finding.scope} ${finding.role} ${finding.page}`.toLowerCase();
  if (scope === "database") return /database|sql|rpc|rls|storage|table/.test(`${haystack} ${finding.title} ${finding.actual}`.toLowerCase());
  if (scope === "flow") return finding.scope === "flow" || /cross-role|flow contract|dependency graph/.test(haystack);
  return haystack.includes(scope);
}

function isStaticSchemaAbsenceOnly(finding: KaFarmReaderFinding) {
  const text = `${finding.title} ${finding.actual} ${finding.evidence} ${finding.nextStep}`.toLowerCase();
  const claimsMissingObject = /missing|not found|absent/.test(text) && /table|column|function|view|policy|rls|schema/.test(text);
  const staticOnly = /static|repository|migration|create table|sql file|source scan/.test(text);
  const liveEvidence = /live metadata|kafarm_database_health_snapshot|information_schema|pg_catalog|to_regclass/.test(text);
  return claimsMissingObject && staticOnly && !liveEvidence;
}

function buildBuddyReport(scope: KaFarmReaderScope, snapshot: KaFarmSystemSnapshot, findings: KaFarmReaderFinding[], runAt: string) {
  const confirmed = findings.filter((item) => item.confidence === "confirmed").length;
  const possible = findings.filter((item) => item.confidence === "possible").length;
  const stale = findings.filter((item) => item.confidence === "stale").length;
  const lines = [
    "FARMCONNECT KAFARM WHOLE-APP READER V2",
    `Scope: ${scope}`,
    `Run at: ${runAt}`,
    `Snapshot generated: ${snapshot.generatedAt}`,
    `Source fingerprint: ${snapshot.sourceFingerprint}`,
    `Git: ${snapshot.git.branch || "unknown"} / ${snapshot.git.commit || "unknown"}`,
    `Active routes: ${snapshot.counts.routes}`,
    `API endpoints: ${snapshot.counts.apiEndpoints}`,
    `Browser storage keys: ${snapshot.counts.clientStorageKeys}`,
    `Reachable actions: ${snapshot.counts.actions}`,
    `Findings: ${findings.length} (Confirmed ${confirmed}, Possible ${possible}, Stale ${stale})`,
    "Safety: read-only source analysis; no SQL, auto-fix, approval, money, KYC, ownership, or deletion action was executed.",
    `Database authority: ${snapshot.databaseAuthority.sourceOfTruth} through ${snapshot.databaseAuthority.liveReader}.`,
    "Database rule: missing CREATE statements in repository history are documentation gaps, not missing live objects.",
    "",
  ];

  if (!findings.length) {
    lines.push("No open static or captured runtime blocker was found for this scope.");
    lines.push("This is not runtime readiness proof. Manual role-to-role and real-record verification is still required.");
    return lines.join("\n");
  }

  findings.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.confidence.toUpperCase()} / ${item.severity.toUpperCase()}] ${item.title}`);
    lines.push(`Role/App: ${item.role}`);
    lines.push(`Page: ${item.page}`);
    lines.push(`Action: ${item.action}`);
    lines.push(`Expected: ${item.expected}`);
    lines.push(`Actual: ${item.actual}`);
    lines.push(`Evidence: ${item.evidence}`);
    lines.push(`Evidence source: ${item.source || "static"}`);
    lines.push(`Reproduce: Login as ${item.role}, open ${item.page}, then perform: ${item.action}.`);
    lines.push(`Safe next check: ${item.nextStep}`);
    lines.push(`Approval gate: ${item.requiresAdminApproval ? "ADMIN APPROVAL REQUIRED before any sensitive change." : "Investigation or non-sensitive code review only."}`);
    lines.push("Rollback: preserve the current record/evidence, make one scoped change, and revert that change if the expected result or regression checks fail.");
    lines.push("");
  });
  lines.push("Buddy rule: Confirm POSSIBLE findings with runtime/network/database evidence before changing code or SQL. Ignore STALE findings until reproduced on the current snapshot.");
  return lines.join("\n");
}

function runtimeFinding(incident: KaFarmRuntimeIncident): KaFarmReaderFinding {
  const severity = String(incident.severity || "medium").toLowerCase();
  const safeSeverity: KaFarmFindingSeverity = ["critical", "high", "medium", "low"].includes(severity) ? severity as KaFarmFindingSeverity : "medium";
  const details = [incident.message, incident.evidence, incident.http_status ? `HTTP ${incident.http_status}` : null, incident.request_url, incident.stack_trace].filter(Boolean).join(" | ");
  const sensitive = /wallet|money|payment|withdraw|kyc|pin|password|fraud|ownership|delete/i.test(`${incident.category} ${incident.title} ${incident.message}`);
  return {
    id: `runtime-${incident.id}`,
    confidence: "confirmed",
    severity: safeSeverity,
    scope: incident.app_role || "system",
    role: incident.app_role || "unknown",
    page: incident.route || "unknown",
    action: incident.affected || incident.category || "Captured runtime action",
    title: incident.title,
    expected: "The action should complete without an open runtime incident.",
    actual: incident.message || `${incident.category || "Runtime"} incident remains ${incident.status || "open"}.`,
    evidence: details || `Incident ${incident.incident_key || incident.id}, captured ${incident.created_at || "at runtime"}.`,
    nextStep: incident.proposed_fix || incident.safe_recovery || "Reproduce once, inspect the exact route/request/record, then apply one scoped fix and close the incident only after regression verification.",
    source: "runtime",
    requiresAdminApproval: sensitive,
  };
}

export function createKaFarmReaderRun(snapshot: KaFarmSystemSnapshot, scope: KaFarmReaderScope, deployedCommit?: string | null, runtimeIncidents: KaFarmRuntimeIncident[] = []): KaFarmReaderRun {
  const staticFindings = snapshot.findings.filter((item) => matchesScope(item, scope) && !isStaticSchemaAbsenceOnly(item)).map((item) => ({ ...item, source: item.source || "static" as const }));
  const seenRuntimeSignatures = new Set<string>();
  const liveFindings = runtimeIncidents
    .map(runtimeFinding)
    .filter((item) => matchesScope(item, scope))
    .filter((item) => {
      const signature = `${item.title}|${item.role}|${item.page}|${item.actual}|${item.evidence}`.toLowerCase();
      if (seenRuntimeSignatures.has(signature)) return false;
      seenRuntimeSignatures.add(signature);
      return true;
    });
  const findings = [...liveFindings, ...staticFindings];
  if (deployedCommit && snapshot.git.commit && deployedCommit !== snapshot.git.commit) {
    findings.unshift({
      id: "stale-deployment-snapshot",
      confidence: "stale",
      severity: "high",
      scope: "system",
      role: "admin",
      page: "/admin/kafarm/whole-app-reader",
      action: "Run current source investigation",
      title: "Reader snapshot does not match the deployed commit",
      expected: "The generated KaFarm snapshot and deployed application should reference the same commit.",
      actual: `Snapshot=${snapshot.git.commit}; deployment=${deployedCommit}.`,
      evidence: "Build metadata commit comparison failed.",
      nextStep: "Regenerate the snapshot during the same deployment build, then rerun. Do not use older findings as current proof.",
    });
  }
  const runAt = new Date().toISOString();
  const summary = {
    total: findings.length,
    confirmed: findings.filter((item) => item.confidence === "confirmed").length,
    possible: findings.filter((item) => item.confidence === "possible").length,
    stale: findings.filter((item) => item.confidence === "stale").length,
    critical: findings.filter((item) => item.severity === "critical").length,
    high: findings.filter((item) => item.severity === "high").length,
    runtime: findings.filter((item) => item.source === "runtime").length,
  };
  return {
    ok: true,
    mode: "read-only",
    scope,
    runAt,
    snapshot: {
      schemaVersion: snapshot.schemaVersion,
      generatedAt: snapshot.generatedAt,
      sourceFingerprint: snapshot.sourceFingerprint,
      git: snapshot.git,
      counts: snapshot.counts,
      databaseAuthority: snapshot.databaseAuthority,
    },
    summary,
    findings,
    featureDependencies: snapshot.featureDependencies,
    contractCoverage: snapshot.contractCoverage,
    safety: snapshot.safety,
    buddyReport: buildBuddyReport(scope, snapshot, findings, runAt),
  };
}
