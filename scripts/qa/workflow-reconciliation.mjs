import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/)
    .map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean)
    .map(match => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]));
}

const root = process.cwd();
const env = { ...readEnv(path.join(root, ".env.local")), ...process.env };
const outputDir = path.join(root, "test-results", "kafarm");
const reportPath = path.join(outputDir, "workflow-reconciliation.json");
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let report;
try {
  if (!env.E2E_ADMIN_EMAIL || !env.E2E_ADMIN_PASSWORD) throw new Error("E2E admin credentials are required.");
  const auth = await client.auth.signInWithPassword({ email: env.E2E_ADMIN_EMAIL, password: env.E2E_ADMIN_PASSWORD });
  if (auth.error) throw auth.error;
  const result = await client.rpc("kafarm_workflow_chain_snapshot");
  if (result.error) throw result.error;
  const snapshot = Array.isArray(result.data) ? result.data[0] : result.data;
  const findings = Array.isArray(snapshot?.findings) ? snapshot.findings : [];
  report = { generatedAt: new Date().toISOString(), passed: findings.length === 0, findingCount: findings.length, findings, countsByStatus: snapshot?.counts_by_status || {} };
  await client.auth.signOut();
} catch (error) {
  report = { generatedAt: new Date().toISOString(), passed: false, error: error.message };
}
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Workflow Reconciliation] ${report.passed ? "PASS" : "FAIL"}`);
console.log(`[KaFarm Workflow Reconciliation] findings=${report.findingCount ?? "unknown"}`);
if (!report.passed) process.exitCode = 1;
