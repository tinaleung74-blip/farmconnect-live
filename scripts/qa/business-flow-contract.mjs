import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { assertIsolatedSupabaseUrl } from "./isolated-supabase-guard.mjs";

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
async function expectRpcError(client, name, args, expectedMessage) {
  const result = await client.rpc(name, args);
  if (!result.error) fail(`${name}: expected ${expectedMessage}, but the call succeeded`);
  if (!String(result.error.message || "").includes(expectedMessage)) {
    fail(`${name}: expected ${expectedMessage}, received ${result.error.message}`);
  }
}
async function one(query, label) {
  const result = await query;
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (!result.data) fail(`${label}: record not found`);
  return result.data;
}
async function noError(query, label) {
  const result = await query;
  if (result.error) fail(`${label}: ${result.error.message}`);
  return result.data;
}

async function cleanup(service, profileId, caretakerId) {
  if (!profileId) return;
  await service.from("care_plan_inventory_usage").delete().eq("profile_id", profileId);
  const planRows = await service.from("rooster_care_plans").select("id").eq("profile_id", profileId);
  const planIds = (planRows.data || []).map(row => row.id);
  if (planIds.length) {
    await service.from("care_plan_events").delete().in("care_plan_id", planIds);
    await service.from("rooster_daily_missions").delete().in("care_plan_id", planIds);
    await service.from("care_plan_supply_requirements").delete().in("care_plan_id", planIds);
    await service.from("rooster_care_plans").delete().in("id", planIds);
  }
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
  assertIsolatedSupabaseUrl(url, env);

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

    const feedItem = await one(service.from("customer_inventory_items").insert({
      profile_id: profileId,
      product_id: `e2e-care-feed-${Date.now()}`,
      product_name: "E2E Care Plan Feed",
      category: "Feeds",
      unit_label: "per kg",
      unit_price: 80,
      quantity: 100,
      product_type: "feed",
      inventory_metadata: { source: "isolated_e2e_fixture" },
    }).select("id,quantity").single(), "Care Plan feed fixture");

    const cancelledDraftPlanId = await rpc(customer, "customer_request_care_plan", {
      p_customer_animal_id: animal.id,
      p_duration_days: 30,
      p_requested_start_day: 16,
    });
    await rpc(customer, "customer_cancel_care_plan", {
      p_care_plan_id: cancelledDraftPlanId,
      p_reason: "E2E unpaid cancellation",
    });
    const cancelledDraftPlan = await one(customer.from("rooster_care_plans").select("status,refund_due_amount").eq("id", cancelledDraftPlanId).single(), "cancelled unpaid Care Plan");
    if (cancelledDraftPlan.status !== "cancelled" || Number(cancelledDraftPlan.refund_due_amount) !== 0) fail("unpaid Care Plan cancellation was not safe");

    const expiredPlanId = await rpc(customer, "customer_request_care_plan", {
      p_customer_animal_id: animal.id,
      p_duration_days: 30,
      p_requested_start_day: 16,
    });
    const expiredQuote = await rpc(admin, "admin_prepare_care_plan_quote_v2", {
      p_care_plan_id: expiredPlanId,
      p_caretaker_id: caretakerId,
      p_feed_inventory_item_id: feedItem.id,
      p_feed_product_id: null,
      p_kg_per_inventory_unit: 1,
      p_unquantified_day_feed_grams: 0,
      p_labor_price: 1,
      p_service_fee: 1,
      p_quote_note: "E2E quote-expiry guard",
    });
    await noError(service.from("rooster_care_plans").update({ quote_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", expiredPlanId), "expire Care Plan quote fixture");
    await expectRpcError(customer, "customer_submit_manual_payment_guarded", {
      p_source_type: "care_plan",
      p_source_ref: expiredPlanId,
      p_amount_expected: Number(expiredQuote.package_total),
      p_summary: { source: "Expired E2E Care Plan", care_plan_id: expiredPlanId, total: expiredQuote.package_total },
      p_payment_method: "E2E",
      p_receiver_account: "FarmConnect E2E",
      p_sender_name: "E2E Customer",
      p_reference_number: `E2E-EXPIRED-${Date.now()}`,
      p_receipt_image_url: "e2e://expired-care-plan-payment.png",
      p_idempotency_key: `e2e-expired-care-plan-${Date.now()}`,
    }, "CARE_PLAN_QUOTE_EXPIRED_REQUOTE_REQUIRED");
    await rpc(customer, "customer_cancel_care_plan", {
      p_care_plan_id: expiredPlanId,
      p_reason: "E2E expired quote closed without payment",
    });
    checks.push("Expired Care Plan quote is rejected before payment creation");

    const carePlanId = await rpc(customer, "customer_request_care_plan", {
      p_customer_animal_id: animal.id,
      p_duration_days: 30,
      p_requested_start_day: 16,
    });
    const quote = await rpc(admin, "admin_prepare_care_plan_quote_v2", {
      p_care_plan_id: carePlanId,
      p_caretaker_id: caretakerId,
      p_feed_inventory_item_id: feedItem.id,
      p_feed_product_id: null,
      p_kg_per_inventory_unit: 1,
      p_unquantified_day_feed_grams: 0,
      p_labor_price: 300,
      p_service_fee: 50,
      p_quote_note: "E2E verified 30-day package",
    });
    if (Number(quote.feed_required_kg) <= 0 || Number(quote.package_total) !== 350) fail("Care Plan quote was not server-computed and locked");
    await expectRpcError(customer, "customer_submit_manual_payment_guarded", {
      p_source_type: "care_plan",
      p_source_ref: carePlanId,
      p_amount_expected: Number(quote.package_total) + 0.01,
      p_summary: { source: "Mismatched E2E Care Plan", care_plan_id: carePlanId, total: Number(quote.package_total) + 0.01 },
      p_payment_method: "E2E",
      p_receiver_account: "FarmConnect E2E",
      p_sender_name: "E2E Customer",
      p_reference_number: `E2E-MISMATCH-${Date.now()}`,
      p_receipt_image_url: "e2e://mismatched-care-plan-payment.png",
      p_idempotency_key: `e2e-mismatched-care-plan-${Date.now()}`,
    }, "CARE_PLAN_PAYMENT_AMOUNT_MISMATCH");
    const carePayment = await rpc(customer, "customer_submit_manual_payment_guarded", {
      p_source_type: "care_plan",
      p_source_ref: carePlanId,
      p_amount_expected: Number(quote.package_total),
      p_summary: { source: "Care Plan", care_plan_id: carePlanId, duration_days: 30, feed_required_kg: quote.feed_required_kg, total: quote.package_total },
      p_payment_method: "E2E",
      p_receiver_account: "FarmConnect E2E",
      p_sender_name: "E2E Customer",
      p_reference_number: `E2E-CARE-PLAN-${Date.now()}`,
      p_receipt_image_url: "e2e://care-plan-payment.png",
      p_idempotency_key: `e2e-care-plan-payment-${Date.now()}`,
    });
    const submittedPlan = await one(customer.from("rooster_care_plans").select("status,payment_request_id").eq("id", carePlanId).single(), "submitted Care Plan payment");
    if (submittedPlan.status !== "payment_submitted" || submittedPlan.payment_request_id !== carePayment.id) fail("Care Plan payment did not bind to the exact plan");
    await rpc(admin, "admin_review_manual_payment_guarded", { p_payment_request_id: carePayment.id, p_decision: "approved", p_admin_note: "E2E Care Plan payment approved" });
    const paidPlan = await one(admin.from("rooster_care_plans").select("status").eq("id", carePlanId).single(), "paid Care Plan");
    if (paidPlan.status !== "paid_pending_setup") fail(`Care Plan payment produced ${paidPlan.status}`);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await rpc(admin, "admin_activate_care_plan", { p_care_plan_id: carePlanId, p_start_date: tomorrow });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    await noError(service.from("rooster_care_plans").update({ start_date: today, end_date: new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10) }).eq("id", carePlanId), "move Care Plan into scheduler test window");
    const generated = await rpc(admin, "generate_due_care_plan_missions", { p_run_date: today });
    if (Number(generated.created) !== 1) fail("Care Plan daily scheduler did not create exactly one idempotent mission");
    const generatedAgain = await rpc(admin, "generate_due_care_plan_missions", { p_run_date: today });
    if (Number(generatedAgain.created) !== 0) fail("Care Plan scheduler retry created a duplicate mission");
    const missionTask = await one(caretaker.from("caretaker_tasks").select("id,daily_mission_id,task_metadata,status").eq("care_plan_id", carePlanId).single(), "caretaker daily mission visibility");
    const template = await one(service.from("rooster_daily_missions").select("mission_template_id").eq("id", missionTask.daily_mission_id).single(), "daily mission template link");
    const catalog = await one(service.from("care_mission_templates").select("operations_checklist,housing_checklist,supplement_checklist,vaccine_checklist,health_checklist").eq("id", template.mission_template_id).single(), "daily mission catalog record");
    const checked = rows => (rows || []).map(label => ({ label, checked: true }));
    const missionProofId = await rpc(caretaker, "caretaker_submit_mission_proof", {
      p_task_id: missionTask.id,
      p_proof_urls: ["e2e://care-plan-mission-proof.png"],
      p_free_note: "E2E complete daily Care Plan proof",
      p_qr_verified: false,
      p_serial_exception: true,
      p_health_status: "pass",
      p_checklist_results: {
        operations: checked(catalog.operations_checklist),
        housing: checked(catalog.housing_checklist),
        supplements: checked(catalog.supplement_checklist),
        vaccines: checked(catalog.vaccine_checklist),
        health: checked(catalog.health_checklist),
      },
      p_inventory_usage: [{ inventory_item_id: feedItem.id, quantity: 0.1, unit: "kg" }],
    });
    await rpc(admin, "admin_review_mission_proof_guarded", { p_proof_id: missionProofId, p_decision: "approved", p_admin_note: "E2E full welfare evidence approved" });
    const missionApprovalRetry = await rpc(admin, "admin_review_mission_proof_guarded", { p_proof_id: missionProofId, p_decision: "approved", p_admin_note: "E2E duplicate review" });
    if (!missionApprovalRetry.duplicate) fail("Care Plan proof retry was not idempotent");
    const remainingFeed = await one(customer.from("customer_inventory_items").select("quantity").eq("id", feedItem.id).single(), "post-mission exact feed balance");
    if (Number(remainingFeed.quantity) !== 99.9) fail(`Care Plan feed balance was ${remainingFeed.quantity}, expected 99.9`);

    const tomorrowMissionDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const secondGenerated = await rpc(admin, "generate_due_care_plan_missions", { p_run_date: tomorrowMissionDate });
    if (Number(secondGenerated.created) !== 1) fail("Care Plan scheduler did not create the next daily mission exactly once");
    const emergencyTask = await one(caretaker.from("caretaker_tasks").select("id,daily_mission_id,status").eq("care_plan_id", carePlanId).eq("status", "active").single(), "caretaker emergency mission visibility");
    const emergencyProofId = await rpc(caretaker, "caretaker_submit_mission_proof", {
      p_task_id: emergencyTask.id,
      p_proof_urls: ["e2e://care-plan-watch-proof.png"],
      p_free_note: "E2E WATCH status escalated without hiding incomplete care work",
      p_qr_verified: false,
      p_serial_exception: true,
      p_health_status: "watch",
      p_checklist_results: { operations: [], housing: [], supplements: [], vaccines: [], health: [] },
      p_inventory_usage: [],
    });
    await expectRpcError(admin, "admin_review_mission_proof_guarded", {
      p_proof_id: emergencyProofId,
      p_decision: "approved",
      p_admin_note: "E2E approval must be blocked",
    }, "HEALTH_ESCALATION_CANNOT_BE_APPROVED");
    await rpc(admin, "admin_review_mission_proof_guarded", {
      p_proof_id: emergencyProofId,
      p_decision: "backjob",
      p_admin_note: "Health WATCH requires documented follow-up before approval",
    });
    const emergencyMission = await one(service.from("rooster_daily_missions").select("status").eq("id", emergencyTask.daily_mission_id).single(), "health escalation mission state");
    if (emergencyMission.status !== "backjob") fail("WATCH mission was not preserved as a backjob");
    const feedAfterEmergency = await one(customer.from("customer_inventory_items").select("quantity").eq("id", feedItem.id).single(), "emergency proof feed balance");
    if (Number(feedAfterEmergency.quantity) !== 99.9) fail("WATCH proof changed inventory before an approvable PASS mission");

    const beforePause = await one(service.from("rooster_care_plans").select("end_date,schedule_shift_days").eq("id", carePlanId).single(), "Care Plan before pause");
    const missionCountBeforePause = await service.from("rooster_daily_missions").select("id", { count: "exact", head: true }).eq("care_plan_id", carePlanId);
    if (missionCountBeforePause.error) fail(`mission count before pause: ${missionCountBeforePause.error.message}`);
    await rpc(admin, "admin_control_care_plan", { p_care_plan_id: carePlanId, p_action: "pause", p_note: "E2E controlled pause", p_new_caretaker_id: null });
    await noError(service.from("rooster_care_plans").update({ paused_at: new Date(Date.now() - 2 * 86400000).toISOString() }).eq("id", carePlanId), "simulate two-day Care Plan pause");
    await rpc(admin, "admin_control_care_plan", { p_care_plan_id: carePlanId, p_action: "resume", p_note: "E2E controlled resume", p_new_caretaker_id: null });
    const afterResume = await one(service.from("rooster_care_plans").select("status,end_date,schedule_shift_days").eq("id", carePlanId).single(), "Care Plan after resume");
    const addedShift = Number(afterResume.schedule_shift_days) - Number(beforePause.schedule_shift_days);
    const endDateShift = Math.round((Date.parse(afterResume.end_date) - Date.parse(beforePause.end_date)) / 86400000);
    if (afterResume.status !== "active" || addedShift < 1 || addedShift !== endDateShift) fail("pause/resume did not shift the remaining schedule by the exact paused days");
    const missionCountAfterResume = await service.from("rooster_daily_missions").select("id", { count: "exact", head: true }).eq("care_plan_id", carePlanId);
    if (missionCountAfterResume.error) fail(`mission count after resume: ${missionCountAfterResume.error.message}`);
    if (missionCountAfterResume.count !== missionCountBeforePause.count) fail("pause/resume changed the purchased mission count");
    checks.push("WATCH escalation, no premature inventory deduction, and exact pause/resume schedule shift");

    const cancellation = await rpc(admin, "admin_control_care_plan", { p_care_plan_id: carePlanId, p_action: "cancel", p_note: "E2E paid cancellation and unused-service refund", p_new_caretaker_id: null });
    if (Number(cancellation.refund_due_amount) <= 0) fail("paid Care Plan cancellation did not calculate unused service refund");
    await rpc(admin, "admin_record_care_plan_refund", { p_care_plan_id: carePlanId, p_reference: `E2E-REFUND-${Date.now()}`, p_note: "E2E external refund completed" });
    const closedPlan = await one(customer.from("rooster_care_plans").select("status,refund_status").eq("id", carePlanId).single(), "closed Care Plan visibility");
    if (closedPlan.status !== "cancelled" || closedPlan.refund_status !== "completed") fail("Care Plan cancellation/refund audit did not close");
    checks.push("Care Plan request, quote, exact payment, activation, daily scheduler, full proof, inventory deduction, cancellation, and refund");

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
    const withdrawalPin = "246810";
    const pinSetup = await rpc(customer, "change_wallet_pin", { p_current_pin: null, p_new_pin: withdrawalPin });
    if (pinSetup !== true) fail("first-time Wallet PIN setup failed");
    const withdrawalOperationKey = `e2e-withdrawal-${Date.now()}`;
    const wrongPinResult = await rpc(customer, "customer_submit_withdrawal_request_guarded", { p_amount: 100, p_payout_method: "GCash", p_payout_holder: "E2E Customer", p_payout_account: "09000000001", p_customer_note: "E2E wrong PIN", p_idempotency_key: `${withdrawalOperationKey}-wrong`, p_wallet_pin: "000000" });
    if (wrongPinResult.error !== "WALLET_PIN_INVALID") fail("wrong Wallet PIN was not rejected by the server");
    const untouched = await one(service.from("profiles").select("wallet_balance,wallet_on_hold,wallet_pin_failed_attempts").eq("id", profileId).single(), "wrong PIN wallet safety");
    if (Number(untouched.wallet_balance) !== 500 || Number(untouched.wallet_on_hold) !== 0 || Number(untouched.wallet_pin_failed_attempts) !== 1) fail("wrong Wallet PIN changed funds or did not persist the failed attempt");
    const withdrawalResult = await rpc(customer, "customer_submit_withdrawal_request_guarded", { p_amount: 100, p_payout_method: "GCash", p_payout_holder: "E2E Customer", p_payout_account: "09000000001", p_customer_note: "E2E withdrawal", p_idempotency_key: withdrawalOperationKey, p_wallet_pin: withdrawalPin });
    const withdrawalId = withdrawalResult.id;
    const duplicateWithdrawal = await rpc(customer, "customer_submit_withdrawal_request_guarded", { p_amount: 100, p_payout_method: "GCash", p_payout_holder: "E2E Customer", p_payout_account: "09000000001", p_customer_note: "E2E repeated withdrawal", p_idempotency_key: withdrawalOperationKey, p_wallet_pin: withdrawalPin });
    if (!duplicateWithdrawal.duplicate || duplicateWithdrawal.id !== withdrawalId) fail("withdrawal retry created a duplicate wallet hold");
    const held = await one(service.from("profiles").select("wallet_balance,wallet_on_hold").eq("id", profileId).single(), "withdrawal hold");
    if (Number(held.wallet_balance) !== 400 || Number(held.wallet_on_hold) !== 100) fail("withdrawal did not reserve wallet funds exactly once");
    await rpc(admin, "admin_review_withdrawal_request_guarded", { p_withdrawal_request_id: withdrawalId, p_decision: "rejected", p_admin_note: "E2E refund check", p_admin_reference_number: null, p_admin_receipt_url: null, p_admin_receipt_file_name: null });
    const duplicateWithdrawalReview = await rpc(admin, "admin_review_withdrawal_request_guarded", { p_withdrawal_request_id: withdrawalId, p_decision: "rejected", p_admin_note: "E2E repeated refund check", p_admin_reference_number: null, p_admin_receipt_url: null, p_admin_receipt_file_name: null });
    if (!duplicateWithdrawalReview.duplicate) fail("repeated withdrawal rejection was not handled idempotently");
    const refunded = await one(service.from("profiles").select("wallet_balance,wallet_on_hold").eq("id", profileId).single(), "withdrawal refund");
    if (Number(refunded.wallet_balance) !== 500 || Number(refunded.wallet_on_hold) !== 0) fail("rejected withdrawal did not refund held funds");
    checks.push("Server-verified Wallet PIN, withdrawal retry, hold, decision retry, and rejection refund are balanced");

    const completionReference = `E2E-WITHDRAWAL-COMPLETE-${Date.now()}`;
    const completionWithdrawal = await rpc(customer, "customer_submit_withdrawal_request_guarded", {
      p_amount: 100,
      p_payout_method: "GCash",
      p_payout_holder: "E2E Customer",
      p_payout_account: "09000000001",
      p_customer_note: "E2E completion notification",
      p_idempotency_key: `e2e-withdrawal-complete-${Date.now()}`,
      p_wallet_pin: withdrawalPin,
    });
    await rpc(admin, "admin_review_withdrawal_request_guarded", {
      p_withdrawal_request_id: completionWithdrawal.id,
      p_decision: "approved",
      p_admin_note: "E2E payout sent",
      p_admin_reference_number: completionReference,
      p_admin_receipt_url: "e2e://withdrawal-payout-proof.png",
      p_admin_receipt_file_name: "e2e-withdrawal-payout-proof.png",
    });
    await rpc(customer, "customer_confirm_withdrawal_result", {
      p_withdrawal_request_id: completionWithdrawal.id,
      p_received: true,
      p_customer_note: "E2E customer confirmed payout received.",
    });
    const completedWithdrawal = await one(service.from("withdrawal_requests").select("status,customer_confirmed_at").eq("id", completionWithdrawal.id).single(), "completed withdrawal");
    if (completedWithdrawal.status !== "completed" || !completedWithdrawal.customer_confirmed_at) fail("customer payout confirmation did not complete the withdrawal");
    const completedWallet = await one(service.from("profiles").select("wallet_balance,wallet_on_hold").eq("id", profileId).single(), "completed withdrawal wallet");
    if (Number(completedWallet.wallet_balance) !== 400 || Number(completedWallet.wallet_on_hold) !== 0) fail("completed withdrawal did not release the wallet hold correctly");
    const completionNotice = await one(customer.from("inbox_items").select("id,title,body,is_read").eq("profile_id", profileId).eq("title", "Withdrawal Completed").order("created_at", { ascending: false }).limit(1).maybeSingle(), "withdrawal completion notice");
    if (!completionNotice.body?.includes(completionReference) || completionNotice.is_read) fail("withdrawal completion notice is missing its reference or unread state");
    const staleConfirmation = await customer.from("inbox_items").select("id").eq("profile_id", profileId).eq("title", "Confirm Withdrawal Payout").limit(1);
    if (staleConfirmation.error) fail(`stale withdrawal notice check: ${staleConfirmation.error.message}`);
    if ((staleConfirmation.data || []).length) fail("completed withdrawal left an actionable confirmation notice in Inbox");
    checks.push("Withdrawal completion releases the hold and replaces the Inbox confirmation notice");

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
