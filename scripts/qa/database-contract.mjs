import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map(line => line.match(/^([^#=]+)=(.*)$/))
      .filter(Boolean)
      .map(match => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]),
  );
}

const localEnv = readEnvFile(path.join(process.cwd(), ".env.local"));
const env = { ...localEnv, ...process.env };
const outputDir = path.join(process.cwd(), "test-results", "kafarm");
const reportPath = path.join(outputDir, "database-contract.json");

const requiredTables = [
  "profiles",
  "manual_payment_requests",
  "payment_evidence_logs",
  "inbox_items",
  "customer_animals",
  "customer_inventory_items",
  "farm_care_requests",
  "caretaker_tasks",
  "task_proofs",
  "caretaker_applications",
  "caretakers",
  "wallet_transactions",
  "withdrawal_requests",
  "withdrawal_evidence_logs",
  "rooster_sale_requests",
  "customer_kyc_profiles",
  "kafarm_incidents",
  "workflow_operation_keys",
  "workflow_chain_runs",
  "workflow_chain_events",
  "care_mission_templates",
  "rooster_care_plans",
  "care_plan_supply_requirements",
  "rooster_daily_missions",
  "care_plan_events",
  "care_plan_inventory_usage",
  "manual_care_inventory_reservations",
  "manual_care_inventory_usage",
  "care_plan_package_items",
];

const requiredDefinerFunctions = [
  "current_profile_id",
  "is_admin",
  "customer_submit_manual_payment",
  "admin_review_manual_payment",
  "customer_create_care_request",
  "admin_assign_care_request",
  "caretaker_submit_task_proof",
  "admin_review_task_proof",
  "submit_caretaker_application",
  "admin_review_caretaker_application",
  "customer_submit_withdrawal_request",
  "admin_review_withdrawal_request",
  "admin_review_rooster_sale",
  "admin_review_customer_kyc",
  "kafarm_database_health_snapshot",
  "customer_submit_manual_payment_guarded",
  "admin_review_manual_payment_guarded",
  "kafarm_workflow_chain_snapshot",
  "customer_submit_withdrawal_request_guarded",
  "admin_review_task_proof_guarded",
  "admin_review_withdrawal_request_guarded",
  "admin_review_rooster_sale_guarded",
  "admin_review_caretaker_application_guarded",
  "admin_review_customer_kyc_guarded",
  "customer_ensure_signup_profile",
  "generate_due_care_plan_missions",
  "customer_request_care_plan",
  "admin_prepare_care_plan_quote_v2",
  "fulfill_care_plan_feed",
  "caretaker_get_task_inventory",
  "caretaker_submit_mission_proof",
  "admin_review_mission_proof_guarded",
  "admin_activate_care_plan",
  "customer_cancel_care_plan",
  "admin_control_care_plan",
  "admin_record_care_plan_refund",
  "kafarm_care_plan_health_snapshot",
  "caretaker_submit_manual_mission_proof",
  "admin_review_manual_mission_proof_guarded",
  "admin_assign_care_plan",
  "customer_prepare_fixed_care_plan_payment",
  "sync_care_plan_day1_readiness",
];

const requiredInvokerFunctions = [
  "withdrawal_wallet_pin_guard_version",
  "care_mission_checklist_passes",
  "care_plan_customer_inventory_contract_version",
  "kafarm_care_plan_health_classifier_version",
];

function fail(message) {
  throw new Error(message);
}

async function main() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.E2E_ADMIN_EMAIL;
  const password = env.E2E_ADMIN_PASSWORD;
  if (!url || !anonKey) fail("Supabase public URL/key are required in .env.local.");
  if (!email || !password) fail("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.");

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const auth = await client.auth.signInWithPassword({ email, password });
  if (auth.error || !auth.data.user) fail(`Admin sign-in failed: ${auth.error?.message || "no user"}`);

  const profileResult = await client
    .from("profiles")
    .select("id,role,account_status")
    .eq("auth_user_id", auth.data.user.id)
    .maybeSingle();
  if (profileResult.error) fail(`Admin profile query failed: ${profileResult.error.message}`);

  const profile = profileResult.data;
  const adminReady = profile
    && String(profile.role).toLowerCase() === "admin"
    && ["active", "approved"].includes(String(profile.account_status).toLowerCase());
  if (!adminReady) fail("Authenticated E2E account is not an active admin profile.");

  const snapshotResult = await client.rpc("kafarm_database_health_snapshot");
  if (snapshotResult.error) fail(`Database reader failed: ${snapshotResult.error.message}`);
  const snapshot = Array.isArray(snapshotResult.data) ? snapshotResult.data[0] : snapshotResult.data;
  if (!snapshot || typeof snapshot !== "object") fail("Database reader returned no snapshot.");

  const tables = Array.isArray(snapshot.tables) ? snapshot.tables : [];
  const functions = Array.isArray(snapshot.functions) ? snapshot.functions : [];
  const missingObjects = Array.isArray(snapshot.missing_objects) ? snapshot.missing_objects : [];
  const findings = Array.isArray(snapshot.findings) ? snapshot.findings : [];
  const carePlanHealthResult = await client.rpc("kafarm_care_plan_health_snapshot");
  if (carePlanHealthResult.error) fail(`Care Plan health reader failed: ${carePlanHealthResult.error.message}`);
  const carePlanHealth = Array.isArray(carePlanHealthResult.data) ? carePlanHealthResult.data[0] : carePlanHealthResult.data;
  const carePlanHealthOk = Number(carePlanHealth?.catalog_days || 0) === 180
    && Number(carePlanHealth?.active_supply_conversion_missing || 0) === 0
    && Number(carePlanHealth?.negative_inventory || 0) === 0;

  const tableChecks = requiredTables.map(name => {
    const table = tables.find(item => item.table_name === name);
    return {
      name,
      exists: Boolean(table),
      rlsEnabled: Boolean(table?.rls_enabled),
      policyCount: Number(table?.policies || 0),
      ok: Boolean(table && table.rls_enabled && Number(table.policies || 0) > 0),
    };
  });

  const functionChecks = [...requiredDefinerFunctions, ...requiredInvokerFunctions].map(name => {
    const entries = functions.filter(item => item.function_name === name);
    const requiresSecurityDefiner = requiredDefinerFunctions.includes(name);
    return {
      name,
      overloads: entries.length,
      securityDefiner: entries.length > 0 && entries.every(item => item.security_definer === true),
      requiresSecurityDefiner,
      ok: entries.length > 0 && (!requiresSecurityDefiner || entries.every(item => item.security_definer === true)),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    projectHost: new URL(url).host,
    adminProfileReady: Boolean(adminReady),
    missingObjects,
    databaseFindings: findings,
    carePlanHealth,
    tableChecks,
    functionChecks,
    passed:
      missingObjects.length === 0
      && findings.length === 0
      && tableChecks.every(check => check.ok)
      && functionChecks.every(check => check.ok)
      && carePlanHealthOk,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await client.auth.signOut();

  console.log(`[KaFarm DB Contract] ${report.passed ? "PASS" : "FAIL"}`);
  console.log(`[KaFarm DB Contract] Report: ${reportPath}`);
  if (!report.passed) process.exitCode = 1;
}

main().catch(error => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), passed: false, error: error.message }, null, 2)}\n`);
  console.error(`[KaFarm DB Contract] FAIL: ${error.message}`);
  process.exitCode = 1;
});
