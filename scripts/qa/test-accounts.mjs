import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const outputDir = path.join(process.cwd(), "test-results", "kafarm");
const credentialsPath = path.join(outputDir, "e2e-credentials.json");

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

const env = {
  ...readEnvFile(path.join(process.cwd(), ".env.local")),
  ...process.env,
};

function requireWriteApproval() {
  if (env.E2E_ALLOW_DB_WRITES !== "true") {
    throw new Error("Set E2E_ALLOW_DB_WRITES=true to manage isolated E2E accounts.");
  }
}

function client() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase URL and service-role key are required.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function credentials() {
  if (!fs.existsSync(credentialsPath)) return null;
  return JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
}

async function removeAccount(supabase, account) {
  if (!account?.userId) return;
  if (account.role === "caretaker") {
    const profile = await supabase.from("profiles").select("id").eq("auth_user_id", account.userId).maybeSingle();
    if (profile.data?.id) {
      const caretaker = await supabase.from("caretakers").select("id").eq("profile_id", profile.data.id).maybeSingle();
      if (caretaker.data?.id) {
        await supabase.from("caretaker_tasks").delete().eq("caretaker_id", caretaker.data.id);
        await supabase.from("caretakers").delete().eq("id", caretaker.data.id);
      }
    }
  }
  await supabase.from("profiles").delete().eq("auth_user_id", account.userId);
  const deleted = await supabase.auth.admin.deleteUser(account.userId);
  if (deleted.error && !/not found/i.test(deleted.error.message)) throw deleted.error;
}

async function cleanup(supabase) {
  const existing = credentials();
  if (!existing) return;
  await removeAccount(supabase, existing.caretaker);
  await removeAccount(supabase, existing.customer);
  fs.rmSync(credentialsPath, { force: true });
}

async function createAuthUser(supabase, role, suffix, password) {
  const email = `farmconnect-e2e-${role}-${suffix}@example.test`;
  const result = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${role}`, role, e2e: true },
  });
  if (result.error || !result.data.user) throw new Error(`${role} auth creation failed: ${result.error?.message || "no user"}`);
  return { userId: result.data.user.id, email, password, role };
}

async function create() {
  requireWriteApproval();
  const supabase = client();
  await cleanup(supabase);

  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const password = `Fc!${crypto.randomBytes(12).toString("base64url")}9a`;
  const created = [];
  try {
    const customer = await createAuthUser(supabase, "customer", suffix, password);
    created.push(customer);
    const customerProfile = await supabase.from("profiles").insert({
      auth_user_id: customer.userId,
      email: customer.email,
      phone: "09000000001",
      full_name: "E2E Customer",
      display_name: "E2E Customer",
      role: "customer",
      account_status: "active",
      verification_status: "pending",
      membership_status: "inactive",
    });
    if (customerProfile.error) throw customerProfile.error;

    const caretaker = await createAuthUser(supabase, "caretaker", suffix, password);
    created.push(caretaker);
    const profileResult = await supabase.from("profiles").insert({
      auth_user_id: caretaker.userId,
      email: caretaker.email,
      phone: "09000000002",
      full_name: "E2E Caretaker",
      display_name: "E2E Caretaker",
      role: "caretaker",
      account_status: "active",
      verification_status: "approved",
      membership_status: "inactive",
    }).select("id").single();
    if (profileResult.error) throw profileResult.error;

    const caretakerResult = await supabase.from("caretakers").insert({
      profile_id: profileResult.data.id,
      caretaker_profile_id: profileResult.data.id,
      email: caretaker.email,
      full_name: "E2E Caretaker",
      display_name: "E2E Caretaker",
      phone: "09000000002",
      farm_role: "E2E workflow tester",
      status: "active",
      resume_review_status: "reviewed",
      work_pin_set: false,
    });
    if (caretakerResult.error) throw caretakerResult.error;

    const output = { createdAt: new Date().toISOString(), customer, caretaker };
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(credentialsPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`[KaFarm E2E Accounts] READY: ${credentialsPath}`);
  } catch (error) {
    for (const account of created.reverse()) await removeAccount(supabase, account);
    throw error;
  }
}

async function remove() {
  requireWriteApproval();
  await cleanup(client());
  console.log("[KaFarm E2E Accounts] CLEAN");
}

const command = process.argv[2];
if (command === "create") create().catch(error => { console.error(error.message); process.exitCode = 1; });
else if (command === "delete") remove().catch(error => { console.error(error.message); process.exitCode = 1; });
else {
  console.error("Usage: node scripts/qa/test-accounts.mjs <create|delete>");
  process.exitCode = 1;
}
