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

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-KaFarm-Monitor": "read-only" } });
}

function fingerprint(item: MonitorFinding) {
  return createHash("sha256").update(`${item.code}|${item.workflow}|${item.sourceRecordId || "global"}`).digest("hex").slice(0, 24);
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
    findings.push({ code: "monitor_snapshot_unavailable", severity: "high", workflow: "monitoring", message: error.message, source: "rpc:kafarm_guardian_monitor_snapshot" });
  } else {
    const row = (Array.isArray(data) ? data[0] : data) as { findings?: MonitorFinding[]; generated_at?: string } | null;
    for (const item of row?.findings || []) findings.push({ ...item, source: item.source || "rpc:kafarm_guardian_monitor_snapshot" });
  }

  const deduplicated = Array.from(new Map(findings.map((item) => [fingerprint(item), { ...item, fingerprint: fingerprint(item) }])).values());
  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  deduplicated.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

  return json(200, {
    ok: true,
    mode: "read-only-proactive-monitor",
    generatedAt: new Date().toISOString(),
    findingCount: deduplicated.length,
    findings: deduplicated,
    mutationAttempted: false,
    persistence: "Response-only. Durable incident-memory persistence requires separate reviewed approval.",
  });
}
