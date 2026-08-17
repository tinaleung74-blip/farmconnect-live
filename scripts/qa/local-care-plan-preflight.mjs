import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outputDir = path.join(root, "test-results", "kafarm");
const reportPath = path.join(outputDir, "local-care-plan-preflight.json");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split(/\r?\n/)
      .map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean)
      .map(match => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]),
  );
}

function commandPass(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true });
  return { ok: !result.error && result.status === 0, detail: result.error?.code || result.stderr?.trim() || null };
}

const env = { ...readEnvFile(path.join(root, ".env.local")), ...process.env };
const schemaDumpPath = path.resolve(root, env.E2E_SCHEMA_DUMP_PATH || path.join("test-results", "local-supabase", "public-schema.sql"));
const schemaDump = fs.existsSync(schemaDumpPath) ? fs.readFileSync(schemaDumpPath, "utf8") : "";
const docker = commandPass("docker", ["version", "--format", "{{.Server.Version}}"]);
const localSupabaseBinary = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
const supabase = fs.existsSync(localSupabaseBinary)
  ? commandPass(localSupabaseBinary, ["--version"])
  : { ok: false, detail: "local Supabase CLI is not installed" };

let targetHost = null;
try {
  targetHost = env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.toLowerCase() : null;
} catch {
  targetHost = "invalid";
}
const localTarget = ["localhost", "127.0.0.1", "::1"].includes(targetHost);
const requiredCoreTables = ["profiles", "farm_products", "customer_animals", "customer_inventory_items", "caretakers", "caretaker_tasks", "task_proofs", "manual_payment_requests", "inbox_items"];
const missingBaselineTables = requiredCoreTables.filter(name => !new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+(?:public\\.)?${name}\\b`, "i").test(schemaDump));
const containsCopiedRows = /\bcopy\s+public\./i.test(schemaDump) || /\binsert\s+into\s+public\./i.test(schemaDump);

const checks = [
  { name: "Docker engine is installed and running", ok: docker.ok, detail: docker.detail },
  { name: "Supabase CLI is installed locally in the project", ok: supabase.ok, detail: supabase.detail },
  { name: "E2E Supabase URL is loopback-only", ok: localTarget, detail: targetHost || "not configured" },
  { name: "Local anon key is configured", ok: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY), detail: null },
  { name: "Local service-role key is configured", ok: Boolean(env.SUPABASE_SERVICE_ROLE_KEY), detail: null },
  { name: "Local cron secret is configured", ok: Boolean(env.CRON_SECRET), detail: null },
  { name: "Schema-only baseline exists", ok: Boolean(schemaDump), detail: schemaDumpPath },
  { name: "Schema baseline contains Care Plan core dependencies", ok: Boolean(schemaDump) && missingBaselineTables.length === 0, detail: missingBaselineTables },
  { name: "Schema baseline contains no copied production rows", ok: Boolean(schemaDump) && !containsCopiedRows, detail: containsCopiedRows ? "data statements detected" : null },
];
const report = { generatedAt: new Date().toISOString(), passed: checks.every(check => check.ok), checks };
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Local Care Plan Preflight] ${report.passed ? "PASS" : "FAIL"}`);
for (const check of checks) console.log(`- ${check.ok ? "PASS" : "FAIL"}: ${check.name}${check.detail ? ` (${Array.isArray(check.detail) ? check.detail.join(", ") : check.detail})` : ""}`);
if (!report.passed) process.exitCode = 1;
