import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import generatedSnapshot from "@/lib/kafarm-system-snapshot.generated.json";
import {
  createKaFarmReaderRun,
  kaFarmReaderScopes,
  type KaFarmReaderScope,
  type KaFarmRuntimeIncident,
  type KaFarmSystemSnapshot,
} from "@/lib/kafarm-whole-app-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FARMCONNECT_PROJECT_URL = "https://bfckjrqrixbtqqvsxgjq.supabase.co";
const FARMCONNECT_PUBLIC_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY2tqcnFyaXhidHFxdnN4Z2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTA2MDIsImV4cCI6MjA5NjM4NjYwMn0.MmIW41XMThPzwr_5jc_2GjZwpHkHanh1zJWOsmXNkxE";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-KaFarm-Mode": "read-only",
    },
  });
}

export async function GET(request: NextRequest) {
  const requestedScope = request.nextUrl.searchParams.get("scope") || "whole-app";
  if (!kaFarmReaderScopes.includes(requestedScope as KaFarmReaderScope)) {
    return json(400, { ok: false, error: "INVALID_READER_SCOPE", allowed: kaFarmReaderScopes });
  }

  const authHeader = request.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json(401, { ok: false, error: "MISSING_ADMIN_SESSION" });

  const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || FARMCONNECT_PROJECT_URL).trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FARMCONNECT_PUBLIC_ANON_KEY).trim();
  if (projectUrl !== FARMCONNECT_PROJECT_URL) {
    return json(403, { ok: false, error: "PROJECT_URL_NOT_FARMCONNECT" });
  }

  const authClient = createClient(projectUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData.user) {
    return json(401, { ok: false, error: "INVALID_ADMIN_SESSION", detail: userError?.message });
  }

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const profileClient = serviceRoleKey
    ? createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : authClient;
  const { data: profile, error: profileError } = await profileClient
    .from("profiles")
    .select("id,email,role,account_status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return json(500, {
      ok: false,
      error: "ADMIN_PROFILE_CHECK_FAILED",
      detail: profileError.message,
      hint: serviceRoleKey ? undefined : "Confirm the signed-in user can read their own profiles row, or configure the existing server service-role environment.",
    });
  }
  if (!profile || String(profile.role).toLowerCase() !== "admin" || String(profile.account_status).toLowerCase() !== "active") {
    return json(403, {
      ok: false,
      error: "ACTIVE_ADMIN_REQUIRED",
      profile: profile ? { role: profile.role, account_status: profile.account_status } : null,
    });
  }

  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || null;
  const incidentSource = serviceRoleKey ? profileClient.from("kafarm_incidents") : authClient.from("admin_kafarm_incident_queue");
  const { data: runtimeIncidents, error: incidentError } = await incidentSource
    .select("id,incident_key,title,category,severity,status,app_role,route,affected,message,evidence,proposed_fix,safe_recovery,stack_trace,http_status,request_url,created_at")
    .not("status", "in", '("Resolved","Ignored","Completed")')
    .gte("created_at", (generatedSnapshot as { generatedAt: string }).generatedAt)
    .order("created_at", { ascending: false })
    .limit(50);

  const result = createKaFarmReaderRun(
    generatedSnapshot as unknown as KaFarmSystemSnapshot,
    requestedScope as KaFarmReaderScope,
    deployedCommit,
    (runtimeIncidents || []) as KaFarmRuntimeIncident[],
  );
  return json(200, {
    ...result,
    admin: { id: profile.id, email: profile.email },
    runtimeSource: incidentError ? { ok: false, error: incidentError.message } : { ok: true, openIncidentsRead: runtimeIncidents?.length || 0 },
  });
}
