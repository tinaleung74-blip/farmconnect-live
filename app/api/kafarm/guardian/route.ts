import { NextRequest, NextResponse } from "next/server";
import { authenticateKaFarmAdmin } from "@/lib/kafarm/guardian/admin-auth";
import { diagnoseWithKaFarmGuardian, getKaFarmGuardianCapabilities } from "@/lib/kafarm/guardian/reasoning";
import { getKaFarmSystemMapStatus } from "@/lib/kafarm/guardian/system-map";
import { kaFarmInvariantRegistry } from "@/lib/kafarm/guardian/invariants";
import { getFarmConnectRateLimitReadiness } from "@/lib/security/farmconnect-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestWindows = new Map<string, number[]>();

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-KaFarm-Guardian": "read-only-foundation",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function withinRateLimit(profileId: string) {
  const now = Date.now();
  const recent = (requestWindows.get(profileId) || []).filter((item) => now - item < 10 * 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  requestWindows.set(profileId, recent);
  return true;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateKaFarmAdmin(request);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.error, detail: auth.detail });
  return json(200, {
    ok: true,
    mode: "read-only",
    capabilities: getKaFarmGuardianCapabilities(),
    rateLimit: getFarmConnectRateLimitReadiness(),
    systemMap: getKaFarmSystemMapStatus(),
    invariants: kaFarmInvariantRegistry,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateKaFarmAdmin(request);
  if (!auth.ok) return json(auth.status, { ok: false, error: auth.error, detail: auth.detail });
  if (!withinRateLimit(auth.context.profileId)) return json(429, { ok: false, error: "KAFARM_REASONING_RATE_LIMIT" });

  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: "INVALID_JSON_BODY" }); }
  const question = String((body && typeof body === "object" ? (body as Record<string, unknown>).question : "") || "").trim();
  if (question.length < 8 || question.length > 2000) {
    return json(400, { ok: false, error: "INVALID_QUESTION_LENGTH", min: 8, max: 2000 });
  }

  const diagnosis = await diagnoseWithKaFarmGuardian(question, auth.context);
  return json(200, {
    ok: true,
    mode: diagnosis.mode,
    diagnosis,
    execution: { attempted: false, allowed: diagnosis.gate.executionAllowed, reason: "This endpoint has no mutation adapter." },
  });
}
