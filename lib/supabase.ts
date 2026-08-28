import { createClient } from "@supabase/supabase-js";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseUrl = (() => { try { const url = new URL(configuredUrl || ""); return ["http:", "https:"].includes(url.protocol) ? url.origin : undefined; } catch { return undefined; } })();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
export const databaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const databaseProject = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "not-configured";

async function checkedFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (!databaseConfigured) throw new Error("DATABASE_NOT_CONFIGURED: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart/rebuild.");
  const target = new URL(input instanceof Request ? input.url : String(input));
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  // Accident-prevention guard, not an authorization boundary. RLS still applies.
  const local = typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  if (local && databaseProject === "bfckjrqrixbtqqvsxgjq" && !["GET", "HEAD", "OPTIONS"].includes(method)
    && !target.pathname.startsWith("/auth/v1/token") && !target.pathname.startsWith("/auth/v1/logout")) {
    throw new Error("LOCAL_PRODUCTION_WRITE_BLOCKED: Use an isolated Supabase project for local workflow tests.");
  }
  return fetch(input, init);
}

// Placeholder permits prerendering; checkedFetch never sends to it.
export const supabase = createClient(supabaseUrl || "https://configuration.invalid", supabaseAnonKey || "not-configured", { global: { fetch: checkedFetch } });
let isolatedClientSequence = 0;
/** Isolates auth session only, not the configured database project. */
export function createIsolatedSupabaseClient(scope = "isolated") {
  isolatedClientSequence += 1;
  const safeScope = scope.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return createClient(supabaseUrl || "https://configuration.invalid", supabaseAnonKey || "not-configured", {
    global: { fetch: checkedFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `farmconnect-${safeScope}-${isolatedClientSequence}` },
  });
}
