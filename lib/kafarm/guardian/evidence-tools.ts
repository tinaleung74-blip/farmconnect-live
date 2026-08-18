import "server-only";

import blueprint from "@/config/kafarm/farmconnect-blueprint.v1.json";
import type { KaFarmAdminContext } from "./admin-auth";
import { traceWorkflowFindings } from "./anti-malfunction";
import { buildIncidentMemoryView } from "./incident-memory";
import { kaFarmInvariantRegistry } from "./invariants";
import { getKaFarmSystemMapStatus, getTestCatalog, lookupRoute, lookupSourceReference, lookupSystemMap } from "./system-map";
import type { KaFarmEvidenceReference } from "./types";

type JsonRecord = Record<string, unknown>;

export type KaFarmEvidenceToolResult = {
  ok: boolean;
  tool: string;
  data: unknown;
  references: KaFarmEvidenceReference[];
  error?: string;
};

const lookupParameters = {
  type: "object",
  properties: { query: { type: "string", description: "A bounded FarmConnect route, workflow, component, backend object, or business-rule search." } },
  required: ["query"],
  additionalProperties: false,
} as const;

export const kaFarmEvidenceToolDefinitions = [
  { type: "function", name: "system_map_lookup", description: "Search the generated FarmConnect-only living system map. Read-only.", strict: true, parameters: lookupParameters },
  { type: "function", name: "route_lookup", description: "Read a FarmConnect route and its mapped actions and dependencies. Read-only.", strict: true, parameters: { ...lookupParameters, properties: { query: { type: "string", description: "Exact FarmConnect route such as /customer/withdraw." } } } },
  { type: "function", name: "source_code_lookup", description: "Return safe build-time source file and line references. Does not read arbitrary files. Read-only.", strict: true, parameters: lookupParameters },
  { type: "function", name: "dependency_lookup", description: "Search route, action, API/RPC/table, and workflow dependency evidence in the system map. Read-only.", strict: true, parameters: lookupParameters },
  { type: "function", name: "database_metadata_read", description: "Call the existing Admin-only FarmConnect database metadata health RPC. No row mutation and no arbitrary SQL.", strict: true, parameters: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { type: "function", name: "workflow_event_read", description: "Read the Admin-only FarmConnect workflow reconciliation snapshot and filter it by a workflow term. Read-only.", strict: true, parameters: lookupParameters },
  { type: "function", name: "incident_read", description: "Read minimized open KaFarm incident evidence matching a route, category, or symptom. Read-only.", strict: true, parameters: lookupParameters },
  { type: "function", name: "test_result_read", description: "Read the current build's test catalog. Test existence is never presented as a current-release pass.", strict: true, parameters: lookupParameters },
  { type: "function", name: "git_change_history_read", description: "Read build-time commit, branch, dirtiness, and source fingerprint. No shell access.", strict: true, parameters: lookupParameters },
  { type: "function", name: "blueprint_lookup", description: "Read the versioned FarmConnect owner blueprint and invariant registry. Read-only.", strict: true, parameters: lookupParameters },
] as const;

function cleanText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:password|pin|secret|token|service[_ -]?role)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}

function sanitize(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    if (/email|password|pin|token|secret|payout_account|id_front|id_back|selfie/i.test(key)) return "[REDACTED]";
    if (/profile_id|user_id|auth_user_id/i.test(key) && /^[0-9a-f-]{32,}$/i.test(value)) return "[REDACTED_ID]";
    return cleanText(value).slice(0, 4000);
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonRecord).slice(0, 150).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

function queryArg(args: JsonRecord) {
  return String(args.query || "").trim().slice(0, 300);
}

function reference(source: KaFarmEvidenceReference["source"], title: string, detail: string, locator: string, capturedAt?: string | null): KaFarmEvidenceReference {
  return { source, title, detail: cleanText(detail).slice(0, 1000), locator, capturedAt };
}

function filterBlueprint(query: string) {
  const terms = query.toLowerCase().split(/[^a-z0-9_]+/).filter((item) => item.length > 2);
  const sections = Object.entries(blueprint).filter(([, value]) => {
    const text = JSON.stringify(value).toLowerCase();
    return !terms.length || terms.some((term) => text.includes(term));
  });
  const invariants = kaFarmInvariantRegistry.filter((item) => {
    const text = JSON.stringify(item).toLowerCase();
    return !terms.length || terms.some((term) => text.includes(term));
  });
  return { blueprint: Object.fromEntries(sections), invariants };
}

export async function runKaFarmEvidenceTool(name: string, rawArgs: unknown, context: KaFarmAdminContext): Promise<KaFarmEvidenceToolResult> {
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs as JsonRecord : {};
  const query = queryArg(args);

  try {
    if (name === "system_map_lookup" || name === "dependency_lookup") {
      const data = lookupSystemMap(query);
      return { ok: true, tool: name, data: sanitize(data), references: [reference("system_map", `System map lookup: ${query}`, `${data.nodes.length} matching nodes`, `map:${data.mapFingerprint}`)] };
    }
    if (name === "route_lookup") {
      const data = lookupRoute(query);
      return { ok: true, tool: name, data: sanitize(data), references: [reference("system_map", `Route lookup: ${data.route}`, `${data.nodes.length} related nodes; found=${data.found}`, `route:${data.route}`)] };
    }
    if (name === "source_code_lookup") {
      const data = lookupSourceReference(query);
      return { ok: true, tool: name, data: sanitize(data), references: data.references.slice(0, 12).map((item) => reference("source_inventory", String(item.name), `${item.type} on ${item.route || "unmapped route"}`, `${item.file || "unknown"}:${item.line || 1}`)) };
    }
    if (name === "database_metadata_read") {
      const { data, error } = await context.userClient.rpc("kafarm_database_health_snapshot");
      if (error) return { ok: false, tool: name, data: null, references: [], error: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, tool: name, data: sanitize(row), references: [reference("database_metadata", "Live database metadata snapshot", "Admin-only metadata/RLS evidence from the authoritative FarmConnect project.", "rpc:kafarm_database_health_snapshot", String((row as JsonRecord | null)?.generated_at || ""))] };
    }
    if (name === "workflow_event_read") {
      const { data, error } = await context.userClient.rpc("kafarm_workflow_chain_snapshot");
      if (error) return { ok: false, tool: name, data: null, references: [], error: error.message };
      const row = (Array.isArray(data) ? data[0] : data) as JsonRecord | null;
      const findings = Array.isArray(row?.findings) ? row.findings as JsonRecord[] : [];
      const filtered = query ? findings.filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) : findings;
      const minimized = { generated_at: row?.generated_at || null, mode: row?.mode || null, counts_by_status: row?.counts_by_status || {}, finding_count: findings.length, findings: filtered.slice(0, 50), traces: traceWorkflowFindings(filtered.slice(0, 50)) };
      return { ok: true, tool: name, data: sanitize(minimized), references: [reference("workflow_event", `Workflow reconciliation: ${query || "all"}`, `${filtered.length} matching finding(s) from ${findings.length} open finding(s).`, "rpc:kafarm_workflow_chain_snapshot", String(row?.generated_at || ""))] };
    }
    if (name === "incident_read") {
      let request = context.privilegedReadClient
        .from(context.serviceRoleAvailable ? "kafarm_incidents" : "admin_kafarm_incident_queue")
        .select("id,incident_key,title,category,severity,status,app_role,route,affected,message,evidence,http_status,request_url,created_at,updated_at")
        .not("status", "in", '("Resolved","Ignored","Completed")')
        .order("created_at", { ascending: false })
        .limit(40);
      if (query.startsWith("/")) request = request.eq("route", query.split("?")[0]);
      const { data, error } = await request;
      if (error) return { ok: false, tool: name, data: null, references: [], error: error.message };
      const memory = buildIncidentMemoryView(data || [], query).filter((item) => !query || item.similarity > 0).slice(0, 20);
      const matched = memory.map((item) => item.incident);
      return { ok: true, tool: name, data: sanitize(memory), references: matched.map((item) => reference("incident", String(item.title || "Runtime incident"), `${item.severity || "unknown"} / ${item.status || "open"}: ${item.message || "No message"}`, `incident:${item.id}`, item.created_at ? String(item.created_at) : null)) };
    }
    if (name === "test_result_read") {
      const tests = getTestCatalog().filter((item) => !query || `${item.name} ${item.command}`.toLowerCase().includes(query.toLowerCase()));
      return { ok: true, tool: name, data: sanitize(tests), references: tests.map((item) => reference("test_result", item.name, `${item.currentReleaseStatus}: ${item.command}`, `package.json#scripts.${item.name}`)) };
    }
    if (name === "git_change_history_read") {
      const status = getKaFarmSystemMapStatus();
      return { ok: true, tool: name, data: sanitize(status), references: [reference("git_history", "Current generated source identity", `commit=${status.git.commit || "unknown"}; branch=${status.git.branch || "unknown"}; dirty=${status.git.dirtyFiles.length}`, `git:${status.git.commit || "unknown"}`, status.generatedAt)] };
    }
    if (name === "blueprint_lookup") {
      const data = filterBlueprint(query);
      return { ok: true, tool: name, data: sanitize(data), references: [reference("owner_blueprint", `Blueprint lookup: ${query}`, `FarmConnect blueprint ${blueprint.schemaVersion}; ${data.invariants.length} matching invariant(s).`, `config/kafarm/farmconnect-blueprint.v1.json`)] };
    }
    return { ok: false, tool: name, data: null, references: [], error: "TOOL_NOT_ALLOWED" };
  } catch (error) {
    return { ok: false, tool: name, data: null, references: [], error: error instanceof Error ? error.message : "UNKNOWN_EVIDENCE_TOOL_ERROR" };
  }
}
