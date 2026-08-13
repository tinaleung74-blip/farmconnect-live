import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const authorization = request.headers.get("authorization") || "";
  if (!cronSecret) {
    return json(503, { ok: false, error: "CRON_SECRET_NOT_CONFIGURED" });
  }
  if (authorization !== `Bearer ${cronSecret}`) {
    return json(401, { ok: false, error: "INVALID_CRON_AUTHORIZATION" });
  }

  const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!projectUrl || !serviceRoleKey) {
    return json(503, {
      ok: false,
      error: "CARE_PLAN_SCHEDULER_ENV_MISSING",
      required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    });
  }

  const serviceClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runDate = manilaDate();
  const { data, error } = await serviceClient.rpc(
    "generate_due_care_plan_missions",
    { p_run_date: runDate },
  );
  if (error) {
    return json(500, {
      ok: false,
      error: "CARE_PLAN_MISSION_GENERATION_FAILED",
      detail: error.message,
      runDate,
    });
  }
  return json(200, { ok: true, runDate, result: data });
}
