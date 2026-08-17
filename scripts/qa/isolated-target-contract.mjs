import { assertIsolatedSupabaseUrl } from "./isolated-supabase-guard.mjs";

function mustThrow(label, action, expected) {
  try {
    action();
  } catch (error) {
    if (String(error.message || "").includes(expected)) return;
    throw new Error(`${label}: expected ${expected}, received ${error.message}`);
  }
  throw new Error(`${label}: unsafe target was accepted`);
}

mustThrow(
  "FarmConnect production",
  () => assertIsolatedSupabaseUrl("https://bfckjrqrixbtqqvsxgjq.supabase.co", { E2E_ISOLATED_PROJECT_ACK: "true" }),
  "E2E_PRODUCTION_DATABASE_BLOCKED",
);
mustThrow(
  "unacknowledged remote project",
  () => assertIsolatedSupabaseUrl("https://disposable-example.supabase.co", {}),
  "E2E_REMOTE_PROJECT_NOT_ACKNOWLEDGED",
);

assertIsolatedSupabaseUrl("http://127.0.0.1:54321", {});
assertIsolatedSupabaseUrl("http://localhost:54321", {});
assertIsolatedSupabaseUrl("https://disposable-example.supabase.co", { E2E_ISOLATED_PROJECT_ACK: "true" });

console.log("[KaFarm Isolated Target Contract] PASS: production writes are permanently blocked.");
