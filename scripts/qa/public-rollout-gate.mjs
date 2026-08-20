import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { assertIsolatedSupabaseUrl } from "./isolated-supabase-guard.mjs";

const root = process.cwd();
const outputDir = path.join(root, "test-results", "public-rollout");
const jsonPath = path.join(outputDir, "verdict.json");
const markdownPath = path.join(outputDir, "verdict.md");
const npmCli = process.env.npm_execpath;

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/)
    .map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean)
    .map(match => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]));
}

const env = { ...readEnvFile(path.join(root, ".env.local")), ...process.env };

function runNpm(script) {
  if (!npmCli) return { passed: false, detail: "npm CLI path unavailable" };
  const started = Date.now();
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  if (output) console.log(output);
  return {
    passed: result.status === 0,
    detail: result.status === 0 ? "PASS" : `exit ${result.status ?? "unknown"}`,
    durationMs: Date.now() - started,
    outputTail: output.slice(-3000),
  };
}

function attestation(key, label) {
  const passed = env[key] === "true";
  return { key, label, passed, detail: passed ? "externally attested" : `${key}=true required after real verification` };
}

function isolatedEnvironmentReady() {
  if (env.E2E_ALLOW_DB_WRITES !== "true") return { passed: false, detail: "E2E_ALLOW_DB_WRITES=true is required only for an isolated project" };
  try {
    assertIsolatedSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL || "", env);
  } catch (error) {
    return { passed: false, detail: String(error.message || error) };
  }
  const required = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"];
  const missing = required.filter(key => !env[key]);
  return missing.length ? { passed: false, detail: `Missing isolated E2E configuration: ${missing.join(", ")}` } : { passed: true, detail: "isolated writable target acknowledged" };
}

const staticGates = [
  ["build", "Production build"],
  ["test:lint-critical", "Runtime-critical lint"],
  ["test:security", "Security contract"],
  ["test:dependencies", "Dependency vulnerability contract"],
  ["test:kafarm-guardian", "KaFarm Guardian safety"],
  ["test:kafarm-gate", "KaFarm protected-action gate"],
  ["test:care-plan", "Care Plan 180-day contract"],
  ["test:withdrawal-recovery", "Withdrawal/dispute recovery contract"],
  ["test:inbox-routing", "Inbox action routing"],
  ["test:e2e-target", "Production-write isolation guard"],
];

const gates = [];
for (const [script, label] of staticGates) {
  console.log(`\n[Public Rollout] ${label}`);
  gates.push({ id: script, label, kind: "automated-local", ...runNpm(script) });
}

const isolated = isolatedEnvironmentReady();
gates.push({ id: "isolated-environment", label: "Isolated writable Supabase environment", kind: "environment", ...isolated });
if (isolated.passed) {
  for (const [script, label] of [
    ["test:accounts:create", "Temporary isolated test accounts"],
    ["test:business", "End-to-end business workflow and idempotency"],
    ["test:e2e", "Desktop, phone, and tablet browser matrix"],
  ]) {
    console.log(`\n[Public Rollout] ${label}`);
    gates.push({ id: script, label, kind: "automated-isolated", ...runNpm(script) });
  }
  console.log("\n[Public Rollout] Temporary account cleanup");
  const cleanup = runNpm("test:accounts:delete");
  gates.push({ id: "test:accounts:delete", label: "Temporary test account cleanup", kind: "automated-isolated", ...cleanup });
} else {
  for (const [id, label] of [
    ["test:accounts:create", "Temporary isolated test accounts"],
    ["test:business", "End-to-end business workflow and idempotency"],
    ["test:e2e", "Desktop, phone, and tablet browser matrix"],
    ["test:accounts:delete", "Temporary test account cleanup"],
  ]) gates.push({ id, label, kind: "automated-isolated", passed: false, blocked: true, detail: "blocked until isolated environment is configured" });
}

const rateLimitSource = fs.readFileSync(path.join(root, "lib", "security", "farmconnect-rate-limit.ts"), "utf8");
const persistentRateLimitReady = /persistentBackendInstalled:\s*true/.test(rateLimitSource)
  && /businessRpcEnforcement:\s*true/.test(rateLimitSource);
gates.push({
  id: "persistent-rate-limit",
  label: "Persistent abuse/rate-limit enforcement",
  kind: "code-readiness",
  passed: persistentRateLimitReady,
  detail: persistentRateLimitReady ? "persistent backend and business RPC enforcement declared ready" : "not installed/enforced; controlled pilot only",
});

for (const [key, label] of [
  ["PRODUCTION_MONITOR_VERIFIED", "Production KaFarm cron and durable incident logging"],
  ["PASSWORD_RESET_LIVE_VERIFIED", "Live password-reset callback"],
  ["PRODUCTION_RESTORE_DRILL_ATTESTED", "Backup and isolated restore drill"],
  ["OWNER_REHEARSAL_ATTESTED", "Owner completes Admin operations without developer help"],
  ["LEGAL_PRIVACY_REVIEW_ATTESTED", "Terms, privacy, consent, retention, and support review"],
  ["SUPPORT_ESCALATION_READY", "Named production incident owner and escalation contact"],
  ["CONTROLLED_PILOT_ATTESTED", "Seven-day controlled pilot with no unresolved blocker"],
]) gates.push({ id: key.toLowerCase(), kind: "external-attestation", ...attestation(key, label) });

const blockers = gates.filter(gate => !gate.passed);
const verdict = blockers.length === 0 ? "PUBLIC_ROLLOUT_READY" : "NOT_READY";
const report = {
  generatedAt: new Date().toISOString(),
  verdict,
  passed: blockers.length === 0,
  safetyRule: "No production transaction is created by this gate. Writable workflow tests run only against an explicitly acknowledged isolated Supabase project.",
  counts: { total: gates.length, passed: gates.length - blockers.length, blockedOrFailed: blockers.length },
  gates,
  blockers: blockers.map(({ id, label, detail, blocked }) => ({ id, label, detail, blocked: Boolean(blocked) })),
};

const lines = [
  "# FarmConnect Public Rollout Verdict",
  "",
  `Generated: ${report.generatedAt}`,
  `Verdict: **${verdict}**`,
  "",
  "## Gates",
  "",
  ...gates.map(gate => `- ${gate.passed ? "PASS" : gate.blocked ? "BLOCKED" : "FAIL"}: ${gate.label} — ${gate.detail}`),
  "",
  "## Release rule",
  "",
  "Public rollout is allowed only when every gate passes. A controlled pilot is not a substitute for backup/restore, security, isolation, owner rehearsal, or incident ownership.",
  "",
];

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownPath, `${lines.join("\n")}\n`);
console.log(`\n[Public Rollout] ${verdict}`);
console.log(`[Public Rollout] Report: ${markdownPath}`);
if (!report.passed) process.exitCode = 1;
