import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const FARMCONNECT_PROJECT_URL = "https://bfckjrqrixbtqqvsxgjq.supabase.co";

type GatewayMode = "read" | "write" | "migration";

const destructivePatterns = [
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\bupdate\s+auth\./i,
  /\bdelete\s+from\s+auth\./i,
  /\balter\s+role\b/i,
  /\bgrant\s+.*\bsuperuser\b/i,
];

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function sqlPreview(sql: string) {
  return sql.replace(/\s+/g, " ").trim().slice(0, 260);
}

function requiresWriteMode(sql: string) {
  return !/^\s*(select|with|show|explain)\b/i.test(sql);
}

export async function POST(request: NextRequest) {
  const enabled = process.env.KAFARM_SQL_GATEWAY_ENABLED === "true";
  const configuredUrl = (process.env.KAFARM_SQL_GATEWAY_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const expectedToken = (process.env.KAFARM_SQL_GATEWAY_TOKEN || "").trim();
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);

  if (!enabled) {
    return json(403, { ok: false, error: "KAFARM_SQL_GATEWAY_DISABLED" });
  }

  if (configuredUrl !== FARMCONNECT_PROJECT_URL) {
    return json(403, { ok: false, error: "PROJECT_URL_NOT_FARMCONNECT", configuredUrl });
  }

  if (!serviceRoleKey) {
    return json(500, { ok: false, error: "MISSING_SUPABASE_SERVICE_ROLE_KEY" });
  }

  if (expectedToken && !isLocalhost) {
    const sentToken = (request.headers.get("x-kafarm-gateway-token") || "").trim();
    if (sentToken !== expectedToken) {
      return json(401, {
        ok: false,
        error: "INVALID_GATEWAY_TOKEN",
        hint: "Paste the KAFARM_SQL_GATEWAY_TOKEN from the active deployment environment.",
      });
    }
  }

  const authHeader = request.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json(401, { ok: false, error: "MISSING_ADMIN_SESSION" });
  }

  const supabase = createClient(FARMCONNECT_PROJECT_URL, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) {
    return json(401, { ok: false, error: "INVALID_ADMIN_SESSION", detail: userError?.message });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,role,account_status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return json(500, { ok: false, error: "ADMIN_PROFILE_CHECK_FAILED", detail: profileError.message });
  }

  if (!profile || profile.role !== "admin" || String(profile.account_status || "").toLowerCase() !== "active") {
    return json(403, {
      ok: false,
      error: "ADMIN_ACTIVE_PROFILE_REQUIRED",
      profile: profile ? { email: profile.email, role: profile.role, account_status: profile.account_status } : null,
    });
  }

  let body: { sql?: string; mode?: GatewayMode; confirmDanger?: boolean };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "INVALID_JSON_BODY" });
  }

  const sql = String(body.sql || "").trim();
  const mode = body.mode || "read";

  if (!sql) {
    return json(400, { ok: false, error: "EMPTY_SQL" });
  }

  if (sql.length > 120_000) {
    return json(400, { ok: false, error: "SQL_TOO_LONG", maxCharacters: 120000 });
  }

  if (mode === "read" && requiresWriteMode(sql)) {
    return json(400, {
      ok: false,
      error: "WRITE_SQL_REQUIRES_WRITE_MODE",
      preview: sqlPreview(sql),
    });
  }

  const dangerous = destructivePatterns.some(pattern => pattern.test(sql));
  if (dangerous && !body.confirmDanger) {
    return json(400, {
      ok: false,
      error: "DESTRUCTIVE_SQL_BLOCKED_UNTIL_CONFIRMED",
      preview: sqlPreview(sql),
    });
  }

  const startedAt = Date.now();
  const { data, error } = await supabase.rpc("kafarm_dev_exec_sql", {
    p_sql: sql,
    p_mode: mode,
    p_confirm_danger: Boolean(body.confirmDanger),
    p_admin_profile_id: profile.id,
  });

  const durationMs = Date.now() - startedAt;

  if (error) {
    return json(400, {
      ok: false,
      error: "SQL_GATEWAY_RPC_FAILED",
      detail: error.message,
      hint: error.hint,
      code: error.code,
      durationMs,
      preview: sqlPreview(sql),
    });
  }

  return json(200, {
    ok: true,
    projectUrl: FARMCONNECT_PROJECT_URL,
    admin: { email: profile.email, id: profile.id },
    mode,
    durationMs,
    preview: sqlPreview(sql),
    result: data,
  });
}
