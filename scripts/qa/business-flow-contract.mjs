import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const outputDir = path.join(root, "test-results", "kafarm");
const credentialsPath = path.join(outputDir, "e2e-credentials.json");
const reportPath = path.join(outputDir, "business-flow-contract.json");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/)
    .map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean)
    .map(match => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]));
}

const env = { ...readEnvFile(path.join(root, ".env.local")), ...process.env };
const credentials = fs.existsSync(credentialsPath) ? JSON.parse(fs.readFileSync(credentialsPath, "utf8")) : null;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) { throw new Error(message); }
function appClient() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function signIn(client, email, password, role) {
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user) fail(`${role} sign-in failed: ${result.error?.message || "no user"}`);
  return result.data.user;
}
async function rpc(client, name, args = {}) {
  const result = await client.rpc(name, args);
  if (result.error) fail(`${name}: ${result.error.message}`);
  return result.data;
}
async function one(query, label) {
  const result = await query;
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (!result.data) fail(`${label}: record not found`);
  return result.data;
}

async function cleanup(service, profileId, caretakerId) {
  if (!profileId) return;
  if (caretakerId) await service.from("task_proofs").delete().eq("caretaker_id", caretakerId);
  await service.from("task_proofs").delete().eq("profile_id", profileId);
  await service.from("caretaker_tasks").delete().eq("profile_id", profileId);
  await service.from("farm_care_requests").delete().eq("profile_id", profileId);
  await service.from("withdrawal_evidence_logs").delete().eq("profile_id", profileId);
  await service.from("withdrawal_requests").delete().eq("profile_id", profileId);
  await service.from("payment_evidence_logs").delete().eq("profile_id", profileId);
  await service.from("manual_payment_requests").delete().eq("profile_id", profileId);
  await service.from("customer_inventory_items").delete().eq("profile_id", profileId);
  await service.from("customer_animals").delete().eq("profile_id", profileId);
  await service.from("wallet_transactions").delete().eq("profile_id", profileId);
  await service.from("customer_payout_methods").delete().eq("profile_id", profileId);
  await service.from("inbox_items").delete().eq("profile_id", profileId);
  await service.from("profiles").update({ wallet_balance: 0, wallet_on_hold: 0, verification_status: "pending" }).eq("id", profileId);
}

async function main() {
  if (env.E2E_ALLOW_DB_WRITES !== "true") fail("Set E2E_ALLOW_DB_WRITES=true for the isolated business-flow test.");
  if (!url || !anonKey || !serviceKey || !credentials) fail("Supabase configuration and temporary E2E credentials are required.");
  if (!env.E2E_ADMIN_EMAIL || !env.E2E_ADMIN_PASSWORD) fail("E2E admin credentials are required.");

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const customer = appClient();
  const caretaker = appClient();
  const admin = appClient();
  const checks = [];
  let profileId;
  let caretakerId;

  try {
    const customerUser = await signIn(customer, credentials.customer.email, credentials.customer.password, "customer");
    await signIn(caretaker, credentials.caretaker.email, credentials.caretaker.password, "caretaker");
    await signIn(admin, env.E2E_ADMIN_EMAIL, env.E2E_ADMIN_PASSWORD, "admin");
    profileId = (await one(service.from("profiles").select("id").eq("auth_user_id", customerUser.id).single(), "customer profile")).id;
    const caretakerProfile = await one(service.from("profiles").select("id").eq("auth_user_id", credentials.caretaker.userId).single(), "caretaker profile");
    caretakerId = (await one(service.from("caretakers").select("id").eq("profile_id", caretakerProfile.id).single(), "caretaker record")).id;

    const paymentId = await rpc(customer, "customer_submit_manual_payment", {
      p_source_type: "farm_buy", p_source_ref: "e2e-backend-contract", p_amount_expected: 1,
      p_summary: { source: "E2E Farm Buy", lines: [{ id: "e2e-breed-chick", name: "E2E Breed Chick", category: "Breed Chicks", quantity: 1, unit_price: 1, total: 1, product_type: "breed_chick", breed: "E2E Asil" }], total: 1 },
      p_payment_method: "E2E", p_receiver_account: "FarmConnect E2E", p_sender_name: "E2E Customer",
      p_reference_number: `E2E-${Date.now()}`, p_receipt_image_url: "e2e://payment-proof.png",
    });
    const submittedPayment = await one(customer.from("manual_payment_requests").select("id,status").eq("id", paymentId).single(), "customer payment visibility");
    if (submittedPayment.status !== "for_review") fail(`payment status was ${submittedPayment.status}`);
    checks.push("Customer payment submission and own-record RLS");
    const adminPayment = await one(admin.from("manual_payment_requests").select("id,status").eq("id", paymentId).single(), "admin payment visibility");
    if (adminPayment.status !== "for_review") fail("admin did not receive the payment queue record");
    await rpc(admin, "admin_review_manual_payment", { p_payment_request_id: paymentId, p_decision: "approved", p_admin_note: "E2E approved" });
    const animal = await one(customer.from("customer_animals").select("id,animal_name,animal_code,status").eq("profile_id", profileId).eq("source_product_name", "E2E Breed Chick").single(), "approved Farm Buy ownership");
    checks.push("Admin payment approval creates customer-owned rooster/chick");

    const careRequestId = await rpc(customer, "customer_create_care_request", {
      p_customer_animal_id: animal.id, p_rooster_name: animal.animal_name, p_rooster_tag: animal.animal_code,
      p_service_name: "E2E Photo Update", p_service_category: "photo", p_service_price: 0,
      p_required_proof: "photo and note", p_customer_note: "E2E care request",
    });
    const taskId = await rpc(admin, "admin_assign_care_request", { p_care_request_id: careRequestId, p_caretaker_id: caretakerId, p_admin_note: "E2E assignment" });
    const visibleTask = await one(caretaker.from("caretaker_tasks").select("id,status").eq("id", taskId).single(), "caretaker assigned task visibility");
    if (visibleTask.status !== "active") fail(`assigned task status was ${visibleTask.status}`);
    checks.push("Care request assignment reaches the selected caretaker");
    const proofId = await rpc(caretaker, "caretaker_submit_task_proof_v3", {
      p_task_id: taskId, p_proof_urls: ["e2e://caretaker-proof.png"], p_preset_note: "E2E completed",
      p_free_note: "Automated backend workflow proof", p_qr_verified: false, p_serial_exception: true,
      p_feed_quantity_used: null, p_feed_unit: null,
    });
    await rpc(admin, "admin_review_task_proof", { p_proof_id: proofId, p_decision: "approved", p_admin_note: "E2E proof approved" });
    const released = await one(customer.from("farm_care_requests").select("id,status").eq("id", careRequestId).single(), "customer care result visibility");
    if (released.status !== "released_to_customer") fail(`care result status was ${released.status}`);
    const proofVisible = await one(customer.from("task_proofs").select("id,admin_review_status").eq("id", proofId).single(), "customer proof visibility");
    if (proofVisible.admin_review_status !== "approved") fail("customer did not receive approved proof state");
    checks.push("Caretaker proof, admin approval, and customer care update");

    await service.from("profiles").update({ wallet_balance: 500, wallet_on_hold: 0, verification_status: "approved", kyc_status: "approved" }).eq("id", profileId);
    const withdrawalId = await rpc(customer, "customer_submit_withdrawal_request", { p_amount: 100, p_payout_method: "GCash", p_payout_holder: "E2E Customer", p_payout_account: "09000000001", p_customer_note: "E2E withdrawal" });
    const held = await one(service.from("profiles").select("wallet_balance,wallet_on_hold").eq("id", profileId).single(), "withdrawal hold");
    if (Number(held.wallet_balance) !== 400 || Number(held.wallet_on_hold) !== 100) fail("withdrawal did not reserve wallet funds exactly once");
    await rpc(admin, "admin_review_withdrawal_request", { p_withdrawal_request_id: withdrawalId, p_decision: "rejected", p_admin_note: "E2E refund check", p_admin_reference_number: null, p_admin_receipt_url: null, p_admin_receipt_file_name: null });
    const refunded = await one(service.from("profiles").select("wallet_balance,wallet_on_hold").eq("id", profileId).single(), "withdrawal refund");
    if (Number(refunded.wallet_balance) !== 500 || Number(refunded.wallet_on_hold) !== 0) fail("rejected withdrawal did not refund held funds");
    checks.push("Withdrawal hold and rejection refund are balanced");

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), passed: true, checks }, null, 2)}\n`);
    console.log(`[KaFarm Business Flow] PASS (${checks.length} contracts)`);
  } catch (error) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), passed: false, checks, error: error.message }, null, 2)}\n`);
    throw error;
  } finally {
    await cleanup(service, profileId, caretakerId);
    await customer.auth.signOut(); await caretaker.auth.signOut(); await admin.auth.signOut();
  }
}

main().catch(error => { console.error(`[KaFarm Business Flow] FAIL: ${error.message}`); process.exitCode = 1; });
