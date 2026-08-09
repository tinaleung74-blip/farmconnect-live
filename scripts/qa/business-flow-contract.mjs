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
  const saleRows = await service.from("rooster_sale_requests").select("id").eq("profile_id", profileId);
  const saleIds = (saleRows.data || []).map(row => row.id);
  if (saleIds.length) await service.from("rooster_sale_events").delete().in("sale_request_id", saleIds);
  await service.from("rooster_sale_requests").delete().eq("profile_id", profileId);
  if (caretakerId) await service.from("task_proofs").delete().eq("caretaker_id", caretakerId);
  await service.from("task_proofs").delete().eq("profile_id", profileId);
  await service.from("caretaker_tasks").delete().eq("profile_id", profileId);
  await service.from("farm_care_requests").delete().eq("profile_id", profileId);
  await service.from("withdrawal_evidence_logs").delete().eq("profile_id", profileId);
  await service.from("withdrawal_requests").delete().eq("profile_id", profileId);
  await service.from("payment_evidence_logs").delete().eq("profile_id", profileId);
  const workflowRuns = await service.from("workflow_chain_runs").select("id").eq("subject_profile_id", profileId);
  const workflowRunIds = (workflowRuns.data || []).map(row => row.id);
  if (workflowRunIds.length) await service.from("workflow_chain_events").delete().in("workflow_run_id", workflowRunIds);
  await service.from("workflow_chain_runs").delete().eq("subject_profile_id", profileId);
  await service.from("workflow_operation_keys").delete().eq("profile_id", profileId);
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

    const paymentOperationKey = `e2e-payment-${Date.now()}`;
    const paymentResult = await rpc(customer, "customer_submit_manual_payment_guarded", {
      p_source_type: "farm_buy", p_source_ref: "e2e-backend-contract", p_amount_expected: 1,
      p_summary: { source: "E2E Farm Buy", lines: [{ id: "e2e-breed-chick", name: "E2E Breed Chick", category: "Breed Chicks", quantity: 1, unit_price: 1, total: 1, product_type: "breed_chick", breed: "E2E Asil" }], total: 1 },
      p_payment_method: "E2E", p_receiver_account: "FarmConnect E2E", p_sender_name: "E2E Customer",
      p_reference_number: `E2E-${Date.now()}`, p_receipt_image_url: "e2e://payment-proof.png",
      p_idempotency_key: paymentOperationKey,
    });
    const paymentId = paymentResult.id;
    const duplicateSubmission = await rpc(customer, "customer_submit_manual_payment_guarded", {
      p_source_type: "farm_buy", p_source_ref: "e2e-backend-contract", p_amount_expected: 1,
      p_summary: { source: "E2E Farm Buy", lines: [{ id: "e2e-breed-chick", name: "E2E Breed Chick", category: "Breed Chicks", quantity: 1, unit_price: 1, total: 1, product_type: "breed_chick", breed: "E2E Asil" }], total: 1 },
      p_payment_method: "E2E", p_receiver_account: "FarmConnect E2E", p_sender_name: "E2E Customer",
      p_reference_number: "E2E-DUPLICATE-IGNORED", p_receipt_image_url: "e2e://payment-proof.png",
      p_idempotency_key: paymentOperationKey,
    });
    if (!duplicateSubmission.duplicate || duplicateSubmission.id !== paymentId) fail("payment retry created a duplicate request");
    const submittedPayment = await one(customer.from("manual_payment_requests").select("id,status").eq("id", paymentId).single(), "customer payment visibility");
    if (submittedPayment.status !== "for_review") fail(`payment status was ${submittedPayment.status}`);
    checks.push("Customer payment submission, own-record RLS, and retry idempotency");
    const adminPayment = await one(admin.from("manual_payment_requests").select("id,status").eq("id", paymentId).single(), "admin payment visibility");
    if (adminPayment.status !== "for_review") fail("admin did not receive the payment queue record");
    await rpc(admin, "admin_review_manual_payment_guarded", { p_payment_request_id: paymentId, p_decision: "approved", p_admin_note: "E2E approved" });
    const duplicateApproval = await rpc(admin, "admin_review_manual_payment_guarded", { p_payment_request_id: paymentId, p_decision: "approved", p_admin_note: "E2E duplicate approval" });
    if (!duplicateApproval.duplicate) fail("repeated admin approval was not handled idempotently");
    const animal = await one(customer.from("customer_animals").select("id,animal_name,animal_code,status").eq("profile_id", profileId).eq("source_product_name", "E2E Breed Chick").single(), "approved Farm Buy ownership");
    checks.push("Admin payment approval creates ownership exactly once");

    const rejectedResult = await rpc(customer, "customer_submit_manual_payment_guarded", {
      p_source_type: "farm_buy", p_source_ref: "e2e-rejection-contract", p_amount_expected: 1,
      p_summary: { source: "E2E rejected Farm Buy", lines: [] }, p_payment_method: "E2E",
      p_receiver_account: "FarmConnect E2E", p_sender_name: "E2E Customer",
      p_reference_number: `E2E-REJECT-${Date.now()}`, p_receipt_image_url: "e2e://rejected-proof.png",
      p_idempotency_key: `e2e-reject-${Date.now()}`,
    });
    await rpc(admin, "admin_review_manual_payment_guarded", { p_payment_request_id: rejectedResult.id, p_decision: "rejected", p_admin_note: "Receipt needs correction" });
    const rejectionNotice = await one(customer.from("inbox_items").select("id,title,body").eq("profile_id", profileId).ilike("title", "%Payment Rejected%").order("created_at", { ascending: false }).limit(1).maybeSingle(), "payment rejection notice");
    if (!rejectionNotice.title?.includes("Payment Rejected")) fail("rejection notice was not delivered");
    if (!rejectionNotice.body?.includes(`Payment Request: ${rejectedResult.id}`)) fail("rejection notice is not linked to the exact payment request");
    const resubmitted = await rpc(customer, "customer_submit_manual_payment_guarded", {
      p_source_type: "farm_buy", p_source_ref: "e2e-rejection-contract", p_amount_expected: 1,
      p_summary: { source: "E2E corrected Farm Buy", lines: [] }, p_payment_method: "E2E",
      p_receiver_account: "FarmConnect E2E", p_sender_name: "E2E Customer",
      p_reference_number: `E2E-CORRECTED-${Date.now()}`, p_receipt_image_url: "e2e://corrected-proof.png",
      p_idempotency_key: `e2e-resubmit-${Date.now()}`,
    });
    if (!resubmitted.id || resubmitted.id === rejectedResult.id) fail("corrected payment resubmission was not created");
    checks.push("Payment rejection notification and corrected resubmission");

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
    await rpc(admin, "admin_review_task_proof_guarded", { p_proof_id: proofId, p_decision: "approved", p_admin_note: "E2E proof approved" });
    const duplicateProofReview = await rpc(admin, "admin_review_task_proof_guarded", { p_proof_id: proofId, p_decision: "approved", p_admin_note: "E2E repeated proof approval" });
    if (!duplicateProofReview.duplicate) fail("repeated proof approval was not handled idempotently");
    const released = await one(customer.from("farm_care_requests").select("id,status").eq("id", careRequestId).single(), "customer care result visibility");
    if (released.status !== "released_to_customer") fail(`care result status was ${released.status}`);
    const proofVisible = await one(customer.from("task_proofs").select("id,admin_review_status").eq("id", proofId).single(), "customer proof visibility");
    if (proofVisible.admin_review_status !== "approved") fail("customer did not receive approved proof state");
    checks.push("Caretaker proof, admin approval, and customer care update");

    const saleRequestId = await rpc(customer, "customer_request_rooster_sale_price", {
      p_customer_animal_id: animal.id,
      p_customer_note: "E2E sale price inspection",
    });
    const saleRequest = await one(service.from("rooster_sale_requests").select("id,price_care_request_id,status").eq("id", saleRequestId).single(), "sale price request");
    if (!saleRequest.price_care_request_id || saleRequest.status !== "price_requested") fail("sale price request did not create its assignment-ready care request");
    const saleTaskId = await rpc(admin, "admin_assign_care_request", {
      p_care_request_id: saleRequest.price_care_request_id,
      p_caretaker_id: caretakerId,
      p_admin_note: "E2E sale price assignment",
    });
    const saleTask = await one(service.from("caretaker_tasks").select("id,status,workflow_type,care_request_id").eq("id", saleTaskId).single(), "sale price caretaker task");
    if (saleTask.status !== "active" || saleTask.workflow_type !== "sale_price_inspection") fail(`sale assignment produced ${saleTask.status}/${saleTask.workflow_type}`);
    const assignedSale = await one(service.from("rooster_sale_requests").select("status,price_task_id").eq("id", saleRequestId).single(), "assigned sale request");
    if (assignedSale.status !== "price_assigned" || assignedSale.price_task_id !== saleTaskId) fail("sale assignment did not update the linked sale request");
    const saleProofId = await rpc(caretaker, "caretaker_submit_rooster_sale_task", {
      p_task_id: saleTaskId,
      p_declared_amount: 100,
      p_proof_urls: ["e2e://sale-price-proof.png"],
      p_free_note: "E2E rooster sale price inspection",
      p_qr_verified: false,
      p_serial_exception: true,
    });
    const submittedSale = await one(service.from("rooster_sale_requests").select("status,price_proof_id,caretaker_quoted_price").eq("id", saleRequestId).single(), "submitted sale inspection");
    if (submittedSale.status !== "price_submitted" || submittedSale.price_proof_id !== saleProofId || Number(submittedSale.caretaker_quoted_price) !== 100) fail("sale price proof did not reach admin verification");
    await rpc(admin, "admin_review_task_proof_guarded", { p_proof_id: saleProofId, p_decision: "approved", p_admin_note: "E2E sale price approved" });
    const approvedSale = await one(service.from("rooster_sale_requests").select("status,approved_sale_price").eq("id", saleRequestId).single(), "approved sale inspection");
    if (approvedSale.status !== "price_ready" || Number(approvedSale.approved_sale_price) !== 100) fail("approved sale price was not returned to the customer flow");
    checks.push("Rooster sale assignment, caretaker proof, and admin price approval");

    await rpc(customer, "customer_confirm_rooster_sale", { p_sale_request_id: saleRequestId, p_customer_note: "E2E customer confirmed sale" });
    const queuedSale = await one(admin.from("rooster_sale_requests").select("id,status").eq("id", saleRequestId).single(), "admin sell request visibility");
    if (queuedSale.status !== "sale_requested") fail(`customer sell request reached admin as ${queuedSale.status}`);
    await rpc(admin, "admin_review_rooster_sale_guarded", { p_sale_request_id: saleRequestId, p_decision: "approved", p_admin_note: "E2E final release approved" });
    const releaseReady = await one(service.from("rooster_sale_requests").select("status,release_care_request_id").eq("id", saleRequestId).single(), "sale release assignment queue");
    if (releaseReady.status !== "release_pending_assignment" || !releaseReady.release_care_request_id) fail("approved sell request did not create the final release assignment");
    const releaseCare = await one(admin.from("farm_care_requests").select("id,status,service_category").eq("id", releaseReady.release_care_request_id).single(), "admin final release task visibility");
    if (releaseCare.status !== "paid_pending_assignment" || releaseCare.service_category !== "sale_release_confirmation") fail("final release request did not reach Task Management");
    checks.push("Customer sell confirmation reaches admin and creates final release assignment");

    await service.from("profiles").update({ wallet_balance: 500, wallet_on_hold: 0, verification_status: "approved", kyc_status: "approved" }).eq("id", profileId);
    const withdrawalOperationKey = `e2e-withdrawal-${Date.now()}`;
    const withdrawalResult = await rpc(customer, "customer_submit_withdrawal_request_guarded", { p_amount: 100, p_payout_method: "GCash", p_payout_holder: "E2E Customer", p_payout_account: "09000000001", p_customer_note: "E2E withdrawal", p_idempotency_key: withdrawalOperationKey });
    const withdrawalId = withdrawalResult.id;
    const duplicateWithdrawal = await rpc(customer, "customer_submit_withdrawal_request_guarded", { p_amount: 100, p_payout_method: "GCash", p_payout_holder: "E2E Customer", p_payout_account: "09000000001", p_customer_note: "E2E repeated withdrawal", p_idempotency_key: withdrawalOperationKey });
    if (!duplicateWithdrawal.duplicate || duplicateWithdrawal.id !== withdrawalId) fail("withdrawal retry created a duplicate wallet hold");
    const held = await one(service.from("profiles").select("wallet_balance,wallet_on_hold").eq("id", profileId).single(), "withdrawal hold");
    if (Number(held.wallet_balance) !== 400 || Number(held.wallet_on_hold) !== 100) fail("withdrawal did not reserve wallet funds exactly once");
    await rpc(admin, "admin_review_withdrawal_request_guarded", { p_withdrawal_request_id: withdrawalId, p_decision: "rejected", p_admin_note: "E2E refund check", p_admin_reference_number: null, p_admin_receipt_url: null, p_admin_receipt_file_name: null });
    const duplicateWithdrawalReview = await rpc(admin, "admin_review_withdrawal_request_guarded", { p_withdrawal_request_id: withdrawalId, p_decision: "rejected", p_admin_note: "E2E repeated refund check", p_admin_reference_number: null, p_admin_receipt_url: null, p_admin_receipt_file_name: null });
    if (!duplicateWithdrawalReview.duplicate) fail("repeated withdrawal rejection was not handled idempotently");
    const refunded = await one(service.from("profiles").select("wallet_balance,wallet_on_hold").eq("id", profileId).single(), "withdrawal refund");
    if (Number(refunded.wallet_balance) !== 500 || Number(refunded.wallet_on_hold) !== 0) fail("rejected withdrawal did not refund held funds");
    checks.push("Withdrawal retry, hold, decision retry, and rejection refund are balanced");

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
