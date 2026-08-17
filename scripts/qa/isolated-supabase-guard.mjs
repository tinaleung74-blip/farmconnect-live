const FARMCONNECT_PRODUCTION_HOST = "bfckjrqrixbtqqvsxgjq.supabase.co";

function isLoopback(hostname) {
  const value = hostname.toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

export function assertIsolatedSupabaseUrl(rawUrl, env = process.env) {
  if (!rawUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === FARMCONNECT_PRODUCTION_HOST) {
    throw new Error("E2E_PRODUCTION_DATABASE_BLOCKED: FarmConnect production can never be an E2E write target.");
  }
  if (isLoopback(hostname)) return parsed;

  if (env.E2E_ISOLATED_PROJECT_ACK !== "true") {
    throw new Error("E2E_REMOTE_PROJECT_NOT_ACKNOWLEDGED: use local Supabase or explicitly acknowledge a disposable isolated project.");
  }
  return parsed;
}

export { FARMCONNECT_PRODUCTION_HOST };
