import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const FARMCONNECT_PROJECT_URL = "https://bfckjrqrixbtqqvsxgjq.supabase.co";
const FARMCONNECT_PUBLIC_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY2tqcnFyaXhidHFxdnN4Z2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTA2MDIsImV4cCI6MjA5NjM4NjYwMn0.MmIW41XMThPzwr_5jc_2GjZwpHkHanh1zJWOsmXNkxE";

export type KaFarmAdminContext = {
  userId: string;
  profileId: string;
  email: string | null;
  jwt: string;
  userClient: SupabaseClient;
  privilegedReadClient: SupabaseClient;
  serviceRoleAvailable: boolean;
};

export type KaFarmAdminAuthResult =
  | { ok: true; context: KaFarmAdminContext }
  | { ok: false; status: number; error: string; detail?: string };

export async function authenticateKaFarmAdmin(request: NextRequest): Promise<KaFarmAdminAuthResult> {
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { ok: false, status: 401, error: "MISSING_ADMIN_SESSION" };

  const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || FARMCONNECT_PROJECT_URL).trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FARMCONNECT_PUBLIC_ANON_KEY).trim();
  if (projectUrl !== FARMCONNECT_PROJECT_URL) {
    return { ok: false, status: 403, error: "PROJECT_URL_NOT_FARMCONNECT" };
  }

  const userClient = createClient(projectUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "INVALID_ADMIN_SESSION", detail: userError?.message };
  }

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const privilegedReadClient = serviceRoleKey
    ? createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : userClient;
  const { data: profile, error: profileError } = await privilegedReadClient
    .from("profiles")
    .select("id,email,role,account_status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 500, error: "ADMIN_PROFILE_CHECK_FAILED", detail: profileError.message };
  }
  if (!profile || String(profile.role).toLowerCase() !== "admin" || String(profile.account_status).toLowerCase() !== "active") {
    return { ok: false, status: 403, error: "ACTIVE_ADMIN_REQUIRED" };
  }

  return {
    ok: true,
    context: {
      userId: userData.user.id,
      profileId: String(profile.id),
      email: profile.email ? String(profile.email) : null,
      jwt,
      userClient,
      privilegedReadClient,
      serviceRoleAvailable: Boolean(serviceRoleKey),
    },
  };
}
