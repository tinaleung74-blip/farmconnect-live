import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const foundationPath = path.join(
  root,
  "database",
  "applied",
  "058_care_plan_mission_engine_foundation.sql",
);
const seedPath = path.join(
  root,
  "database",
  "applied",
  "059_care_mission_catalog_seed.sql",
);
const generatorPath = path.join(
  root,
  "scripts",
  "care-plan",
  "build-mission-seed.mjs",
);
const proofPath = path.join(
  root,
  "database",
  "applied",
  "060_care_plan_mission_proof_inventory_guard.sql",
);
const quotePath = path.join(
  root,
  "database",
  "applied",
  "061_care_plan_quote_payment_activation.sql",
);
const lifecyclePath = path.join(
  root,
  "database",
  "applied",
  "062_care_plan_production_lifecycle.sql",
);
const unifiedCarePath = path.join(
  root,
  "database",
  "applied",
  "063_unified_care_plan_manual_mission_inventory_guard.sql",
);
const taskAssignmentPath = path.join(
  root,
  "database",
  "applied",
  "064_care_plan_task_management_assignment.sql",
);
const fixedPackagePath = path.join(
  root,
  "database",
  "applied",
  "065_fixed_5000_care_plan_package_day1_readiness.sql",
);
const checklistCompatibilityPath = path.join(
  root,
  "database",
  "applied",
  "066_care_plan_task_checklist_compatibility.sql",
);
const customerFeedContractPath = path.join(
  root,
  "database",
  "applied",
  "069_care_plan_customer_feed_balance_pricing_contract.sql",
);
const healthClassificationPath = path.join(
  root,
  "database",
  "applied",
  "070_kafarm_care_plan_health_qr_classification.sql",
);
const appSourcePath = path.join(root, "lib", "farmconnect-v1.tsx");
const customerRoutePath = path.join(
  root,
  "app",
  "customer",
  "care-plans",
  "page.tsx",
);
const adminRoutePath = path.join(
  root,
  "app",
  "admin",
  "care-plans",
  "page.tsx",
);
const cronRoutePath = path.join(
  root,
  "app",
  "api",
  "care-plans",
  "daily",
  "route.ts",
);
const vercelPath = path.join(root, "vercel.json");
const businessFlowPath = path.join(root, "scripts", "qa", "business-flow-contract.mjs");
const isolatedTargetGuardPath = path.join(root, "scripts", "qa", "isolated-supabase-guard.mjs");

for (const filePath of [
  foundationPath,
  seedPath,
  generatorPath,
  proofPath,
  quotePath,
  lifecyclePath,
  unifiedCarePath,
  taskAssignmentPath,
  fixedPackagePath,
  checklistCompatibilityPath,
  customerFeedContractPath,
  healthClassificationPath,
  appSourcePath,
  customerRoutePath,
  adminRoutePath,
  cronRoutePath,
  vercelPath,
  businessFlowPath,
  isolatedTargetGuardPath,
]) {
  if (!fs.existsSync(filePath))
    throw new Error(`Missing required Care Plan artifact: ${filePath}`);
}

const foundation = fs.readFileSync(foundationPath, "utf8");
const seed = fs.readFileSync(seedPath, "utf8");
const proof = fs.readFileSync(proofPath, "utf8");
const quote = fs.readFileSync(quotePath, "utf8");
const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
const unifiedCare = fs.readFileSync(unifiedCarePath, "utf8");
const taskAssignment = fs.readFileSync(taskAssignmentPath, "utf8");
const fixedPackage = fs.readFileSync(fixedPackagePath, "utf8");
const checklistCompatibility = fs.readFileSync(checklistCompatibilityPath, "utf8");
const customerFeedContract = fs.readFileSync(customerFeedContractPath, "utf8");
const healthClassification = fs.readFileSync(healthClassificationPath, "utf8");
const appSource = fs.readFileSync(appSourcePath, "utf8");
const cronRoute = fs.readFileSync(cronRoutePath, "utf8");
const businessFlow = fs.readFileSync(businessFlowPath, "utf8");
const isolatedTargetGuard = fs.readFileSync(isolatedTargetGuardPath, "utf8");
const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
const exactDays = [...seed.matchAll(/^\((\d+),/gm)].map((match) =>
  Number(match[1]),
);
const uniqueDays = new Set(exactDays);

const assertions = [
  [
    exactDays.length === 180,
    `Expected 180 mission seed rows, found ${exactDays.length}`,
  ],
  [uniqueDays.size === 180, "Mission seed contains duplicate days"],
  [
    [...Array(180)].every((_, index) => uniqueDays.has(index + 1)),
    "Mission seed does not cover Day 1 through Day 180",
  ],
  [
    /unique \(care_plan_id, plan_day\)/i.test(foundation),
    "Missing per-plan/day duplicate guard",
  ],
  [
    /unique \(care_plan_id, mission_date\)/i.test(foundation),
    "Missing per-plan/date duplicate guard",
  ],
  [
    /uq_inventory_usage_proof_item/i.test(foundation),
    "Missing idempotent inventory usage guard",
  ],
  [
    /timezone text not null default 'Asia\/Manila'/i.test(foundation),
    "Missing Asia/Manila scheduling contract",
  ],
  [
    /if auth\.uid\(\) is not null and not public\.is_admin\(\)/i.test(
      foundation,
    ),
    "Mission generator is not role guarded",
  ],
  [
    /No direct client writes to care-plan tables/i.test(foundation),
    "Missing no-direct-write contract",
  ],
  [
    /file_size_limit=52428800/i.test(foundation) &&
      /video\/webm/i.test(foundation),
    "Proof storage does not match the 50 MB video UI contract",
  ],
  [
    /v_request\.status <> 'paid_pending_assignment'/i.test(foundation),
    "Care assignment is not restricted to paid requests",
  ],
  [
    /v_request\.assigned_task_id is not null/i.test(foundation),
    "Care assignment lacks an idempotent existing-task return",
  ],
  [
    /EXACTLY_ONE_FEED_USAGE_REQUIRED/i.test(proof),
    "Mission proof can omit exact feed usage",
  ],
  [
    /HOUSING_CHECKLIST_INCOMPLETE/i.test(proof) &&
      /VACCINE_AUTHORITY_CHECKLIST_INCOMPLETE/i.test(proof),
    "Mission proof does not enforce the full welfare checklist",
  ],
  [
    /care_mission_checklist_passes/i.test(proof) &&
      /actual\.item->>'label' is distinct from expected\.label/i.test(proof),
    "Mission PASS checklists can replace authoritative catalog labels",
  ],
  [
    /source_type in \('farm_buy','care_request','care_plan','cashin','other'\)/i.test(
      lifecycle,
    ),
    "Manual payment schema does not accept Care Plans",
  ],
  [
    /CARE_PLAN_PAYMENT_OWNER_MISMATCH/i.test(lifecycle) &&
      /CARE_PLAN_PAYMENT_AMOUNT_MISMATCH/i.test(lifecycle),
    "Care Plan payment is not bound to owner and locked quote",
  ],
  [
    /quote_expires_at=now\(\)\+interval '24 hours'/i.test(lifecycle) &&
      /CARE_PLAN_QUOTE_EXPIRED_REQUOTE_REQUIRED/i.test(lifecycle),
    "Unpaid Care Plan quotes do not expire safely",
  ],
  [
    /requirement\.reservation_status in \('quoted','active'\)/i.test(
      lifecycle,
    ) &&
      /other_plan\.status in \('payment_submitted','paid_pending_setup','ready','active','paused'\)/i.test(
        lifecycle,
      ),
    "Open Care Plans can double-count the same feed stock",
  ],
  [
    /new\.status='approved' and v_plan\.status in \('payment_for_review','payment_submitted'\)/i.test(
      lifecycle,
    ),
    "Late payment updates can regress an active Care Plan",
  ],
  [
    /new\.status='needs_info'[\s\S]*then 'payment_submitted'/i.test(lifecycle),
    "Needs-info payment can lose its reserved package while customer corrects evidence",
  ],
  [
    /kg_per_inventory_unit/i.test(lifecycle) &&
      /MISSION_USAGE_MUST_BE_POSITIVE_KG/i.test(lifecycle),
    "Exact pack-to-kilogram inventory conversion is missing",
  ],
  [
    /purchase_fulfilled_at/i.test(lifecycle) &&
      /CARE_PLAN_FEED_STOCK_INSUFFICIENT/i.test(lifecycle),
    "Paid missing-feed fulfillment is not stock guarded",
  ],
  [
    /new\.status='approved'[\s\S]*perform public\.fulfill_care_plan_feed\(v_plan\.id\)/i.test(
      lifecycle,
    ) &&
      /revoke all on function public\.fulfill_care_plan_feed\(uuid\) from public,anon,authenticated/i.test(
        lifecycle,
      ),
    "Payment approval does not atomically fulfill private Care Plan feed",
  ],
  [
    /p_feed_inventory_item_id uuid,[\s\S]*p_feed_product_id text/i.test(
      lifecycle,
    ) && /CHOOSE_ONE_FEED_SOURCE/i.test(lifecycle),
    "Customers with zero feed inventory cannot receive a verified package",
  ],
  [
    /purchase_quantity=0/i.test(lifecycle) &&
      /reserved_inventory_units=required_inventory_units/i.test(lifecycle) &&
      /owned_quantity_snapshot=owned_quantity_snapshot\+\(purchase_inventory_units\*kg_per_inventory_unit\)/i.test(
        lifecycle,
      ),
    "Purchased feed is not fulfilled and reserved in one constraint-safe update",
  ],
  [
    /definition ilike '%purchase_quantity%greatest%required_quantity%reserved_quantity%'/i.test(
      lifecycle,
    ),
    "Obsolete quote-only supply constraint can block completion or cancellation",
  ],
  [
    /overdue_mission_recovered/i.test(lifecycle) &&
      /for v_plan_day in 1\.\.v_plan\.duration_days/i.test(lifecycle),
    "Scheduler cannot backfill exact paid plan days",
  ],
  [
    /schedule_shift_days=schedule_shift_days\+v_paused_days/i.test(lifecycle) &&
      /v_date:=v_plan\.start_date\+\(v_plan_day-1\)\+coalesce\(v_plan\.schedule_shift_days,0\)/i.test(
        lifecycle,
      ),
    "Paused plans do not shift only their remaining exact-day schedule",
  ],
  [
    /MISSION_REJECT_USE_BACKJOB_OR_CANCEL_PLAN/i.test(lifecycle),
    "A rejected mission can permanently strand an otherwise active plan",
  ],
  [
    /refund_status/i.test(lifecycle) &&
      /admin_record_care_plan_refund/i.test(lifecycle),
    "Cancellation/refund audit lifecycle is missing",
  ],
  [
    /kafarm_care_plan_health_snapshot/i.test(lifecycle),
    "KaFarm Care Plan health reader is missing",
  ],
  [
    /null,v_plan\.animal_name,v_plan\.animal_code/.test(lifecycle) &&
      !/v_plan\.customer_animal_id,v_plan\.animal_name,v_plan\.animal_code/.test(lifecycle),
    "Daily scheduler writes a customer-animal UUID into the legacy caretaker task animal foreign key",
  ],
  [
    /BROODING_FEED_ALLOWANCE_REQUIRED/i.test(lifecycle),
    "Unquantified brooding feed days are not explicitly quoted",
  ],
  [
    /CARE_PLAN_FEED_ITEM_REQUIRED/i.test(lifecycle),
    "Care Plan can reserve a non-feed inventory item",
  ],
  [
    /CARE_PLAN_FEED_PRICE_REQUIRED/i.test(lifecycle),
    "Missing Care Plan feed can be quoted at zero price",
  ],
  [
    /CRON_SECRET_NOT_CONFIGURED/i.test(cronRoute) &&
      /SUPABASE_SERVICE_ROLE_KEY/i.test(cronRoute),
    "Daily scheduler route is not secret/service-role guarded",
  ],
  [
    /E2E_PRODUCTION_DATABASE_BLOCKED/i.test(isolatedTargetGuard) &&
      /bfckjrqrixbtqqvsxgjq\.supabase\.co/i.test(isolatedTargetGuard),
    "Care Plan E2E writes are not permanently blocked from production",
  ],
  [
    /CARE_PLAN_QUOTE_EXPIRED_REQUOTE_REQUIRED/i.test(businessFlow) &&
      /CARE_PLAN_PAYMENT_AMOUNT_MISMATCH/i.test(businessFlow),
    "Isolated E2E does not verify expired and mismatched Care Plan payments",
  ],
  [
    /HEALTH_ESCALATION_CANNOT_BE_APPROVED/i.test(businessFlow) &&
      /pause\/resume did not shift the remaining schedule/i.test(businessFlow),
    "Isolated E2E does not verify health escalation and pause/resume behavior",
  ],
  [
    vercel.crons?.some(
      (entry) =>
        entry.path === "/api/care-plans/daily" &&
        entry.schedule === "5 16 * * *",
    ),
    "Vercel daily Manila scheduler is missing",
  ],
  [
    /status=case when new\.status='approved' then 'paid_pending_setup'/i.test(
      quote,
    ),
    "Approved Care Plan payments do not advance setup status",
  ],
  [
    /PAID_CARE_PLAN_ALREADY_AUTOMATES_ROOSTER/i.test(unifiedCare),
    "Paid Care Plans do not block duplicate manual care requests",
  ],
  [
    /manual_care_inventory_reservations/i.test(unifiedCare) &&
      /CARE_INVENTORY_INSUFFICIENT/i.test(unifiedCare),
    "Manual premium care lacks atomic inventory preflight and reservation",
  ],
  [
    /manual_expired_reservations/i.test(unifiedCare) &&
      /manual_approved_with_active_reservation/i.test(unifiedCare) &&
      /paid_manual_open_conflicts/i.test(unifiedCare),
    "KaFarm does not monitor unified paid/manual care invariants",
  ],
  [
    /workflow_type='manual_standard_mission'/i.test(unifiedCare) &&
      /caretaker_submit_manual_mission_proof/i.test(unifiedCare),
    "Unpaid/manual care does not receive the authoritative mission procedure",
  ],
  [
    /admin_review_manual_mission_proof_guarded/i.test(unifiedCare) &&
      /quantity=quantity-v_deduct_units/i.test(unifiedCare) &&
      /Actual mission use:/i.test(unifiedCare),
    "Manual care inventory is not deducted atomically after admin approval",
  ],
  [
    /Care Plan \(30 Days\)/.test(appSource) &&
      /Today.*Standard Care/.test(appSource),
    "Farm Requests does not expose paid automation and manual premium care",
  ],
  [
    !/\["Care Plans", "\/customer\/care-plans"/.test(appSource) &&
      /label="Care Plan"/.test(appSource),
    "Customer Care Plan navigation was not consolidated into Farm Requests and My Roosters",
  ],
  [
    /CARE_PLAN_NOT_READY_FOR_TASK_ASSIGNMENT/i.test(taskAssignment) &&
      /APPROVED_EXACT_PAYMENT_REQUIRED/i.test(taskAssignment) &&
      /ACTIVE_CARETAKER_REQUIRED/i.test(taskAssignment),
    "Care Plan Task Management assignment lacks payment, status, or caretaker guards",
  ],
  [
    /perform public\.fulfill_care_plan_feed\(v_plan\.id\)/i.test(taskAssignment) &&
      /CARE_PLAN_SUPPLIES_INCOMPLETE/i.test(taskAssignment),
    "Care Plan assignment can activate without guarded feed reservation",
  ],
  [
    /v_generation:=public\.generate_due_care_plan_missions\(v_today\)/i.test(taskAssignment) &&
      /plan_assigned_and_activated/i.test(taskAssignment),
    "One-time Care Plan assignment does not start automatic daily missions",
  ],
  [
    /assignAdminCarePlan/.test(appSource) &&
      !/\["Care Plans", "\/admin\/care-plans"/.test(appSource) &&
      !/Open Care Plan Operations/.test(appSource),
    "Admin normal flow still exposes the separate Care Plan Operations step",
  ],
  [
    /package_total=5000/i.test(customerFeedContract) &&
      /round\(5000::numeric\/30,2\)/i.test(customerFeedContract) &&
      /amountExpected: 5000/.test(appSource) &&
      /Pay ₱5,000 Care Plan/.test(appSource),
    "The 30-day Care Plan is not locked to PHP 5,000 / PHP 166.67 average per day across database and customer UI",
  ],
  [
    /round\(sum\(feed_grams_max\)\/1000,3\)/i.test(customerFeedContract) &&
      /MISSION_CATALOG_FEED_QUANTITY_INCOMPLETE/i.test(customerFeedContract) &&
      /CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT/i.test(customerFeedContract) &&
      /manual_care_inventory_reservations/i.test(customerFeedContract) &&
      /v_required_units,v_required_units,0,'quoted'/i.test(customerFeedContract),
    "The fixed package does not calculate, cross-reservation-check, and reserve exact customer-owned 30-day feed",
  ],
  [
    /substring\(lower\(coalesce\(item\.unit_label/i.test(customerFeedContract) &&
      /substring\(lower\(coalesce\(v_inventory_item\.unit_label/i.test(customerFeedContract),
    "Numeric kilogram pack labels are not converted to exact inventory units",
  ],
  [
    /v_plan\.status='payment_for_review'[\s\S]*v_plan\.quote_expires_at>=now\(\)[\s\S]*'duplicate',true/i.test(customerFeedContract),
    "A payment-page retry can duplicate the locked quote and Inbox notice",
  ],
  [
    /revoke all on function public\.admin_prepare_care_plan_quote_v2[\s\S]*authenticated/i.test(customerFeedContract),
    "The legacy Admin custom quote can still override the fixed customer-owned-feed contract",
  ],
  [
    /'paid_manual_open_conflicts'[\s\S]*request\.workflow_type='manual_standard_mission'/i.test(healthClassification) &&
      /kafarm_care_plan_health_classifier_version/i.test(healthClassification),
    "KaFarm still reports QR/system setup tasks as paid/manual Care Plan conflicts",
  ],
  [
    /start_day_source','official_acquired_at'/i.test(customerFeedContract) &&
      /v_animal\.acquired_at at time zone 'Asia\/Manila'/i.test(customerFeedContract) &&
      /CARE_PLAN_CATALOG_WINDOW_EXHAUSTED/i.test(customerFeedContract),
    "The customer can still understate the rooster program day or exceed the 180-day catalog",
  ],
  [
    !/package_total\) !== 350/.test(businessFlow) &&
      /package_total\) !== 5000/.test(businessFlow) &&
      /CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT/.test(businessFlow),
    "The isolated business E2E still tests the removed PHP 350 quote instead of the customer-feed PHP 5,000 contract",
  ],
  [
    /care_plan_package_items/i.test(fixedPackage) &&
      /Biosecurity and sanitation kit/i.test(fixedPackage) &&
      /Electrolyte and vitamin reserve/i.test(fixedPackage) &&
      /Rooster ID and evidence kit/i.test(fixedPackage),
    "The complete standard 30-day package catalog is missing",
  ],
  [
    /care_plan_preparation_required/i.test(fixedPackage) &&
      /Care Plan Ready \+ Day 1/i.test(fixedPackage) &&
      /trg_sync_care_plan_day1_readiness/i.test(fixedPackage),
    "Day 1 does not combine package readiness, initial care, and the later-mission gate",
  ],
  [
    /status='ready'/i.test(fixedPackage) &&
      /new\.status='approved'/i.test(fixedPackage) &&
      /schedule_shift_days=v_shift/i.test(fixedPackage),
    "Later daily missions can start before Day 1 preparation is verified",
  ],
  [
    /v_expected:=coalesce\(v_task\.task_metadata,'\{\}'::jsonb\)/i.test(checklistCompatibility) &&
      /v_expected->'operations_checklist'/i.test(checklistCompatibility) &&
      /care_mission_checklist_passes/i.test(checklistCompatibility),
    "Paid Care Plan proof validation ignores the exact checklist frozen on the assigned task",
  ],
];

const failures = assertions
  .filter(([passed]) => !passed)
  .map(([, message]) => message);
const report = {
  passed: failures.length === 0,
  generatedAt: new Date().toISOString(),
  missionRows: exactDays.length,
  uniqueDays: uniqueDays.size,
  firstDay: Math.min(...exactDays),
  lastDay: Math.max(...exactDays),
  failures,
};

const reportDir = path.join(root, "test-results", "kafarm");
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  path.join(reportDir, "care-plan-contract.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
if (failures.length) throw new Error(failures.join("; "));
console.log(
  `[Care Plan Contract] PASS: ${exactDays.length} unique mission days and all safety guards found.`,
);
