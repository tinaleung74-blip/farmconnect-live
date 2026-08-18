"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { analyzeKaFarmMessage, kafarmCoverage, kafarmIncidentResponseSteps, runKaFarmCouncil } from "@/lib/kafarm-brain";
import generatedSnapshot from "@/lib/kafarm-system-snapshot.generated.json";
import { supabase } from "@/lib/supabase";

type Tone = "approval" | "read" | "safe" | "report";
type AdminGateState =
  | { status: "checking" }
  | { status: "allowed" }
  | { status: "login_required"; message: string }
  | { status: "blocked"; message: string };type Row = { left: string; middle: string; right: string; tone?: Tone };
type DbIncident = {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  app_role: string;
  route: string | null;
  message: string;
  http_status: number | null;
  request_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

type LocalIncident = {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  affected: string;
  appRole?: string;
  route?: string;
  message: string;
  httpStatus?: number;
  requestUrl?: string;
  createdAt: string;
  synced?: boolean;
};

type LiveDatabaseSnapshot = {
  generated_at?: string;
  expected_objects?: Array<{ kind?: string; object_name?: string; exists?: boolean }>;
  missing_objects?: Array<{ kind?: string; object_name?: string }>;
  tables?: Array<{ table_name?: string; rls_enabled?: boolean; columns?: number; policies?: number }>;
  functions?: Array<{ function_name?: string }>;
  policies?: Array<{ table_name?: string; policy_name?: string }>;
  findings?: Array<{ severity?: string; title?: string; meaning?: string; evidence?: unknown; next_action?: string }>;
};

type CarePlanHealthSnapshot = {
  catalog_days?: number;
  open_plans?: number;
  active_plans?: number;
  overdue_missions?: number;
  unreviewed_proofs?: number;
  active_supply_conversion_missing?: number;
  negative_inventory?: number;
  pending_refunds?: number;
  manual_expired_reservations?: number;
  manual_unreviewed_proofs?: number;
  manual_consumed_without_usage?: number;
  manual_approved_with_active_reservation?: number;
  paid_manual_open_conflicts?: number;
  generated_at?: string;
};

type InventoryComparison = {
  module: string;
  pages: string;
  codeObjects: string[];
  liveObjects: string[];
  predictedObjects: string[];
  confirmedMissingObjects: string[];
  activeErrors: Array<{ title: string; status: number | null; route: string; message: string }>;
  status: "CLEAR" | "PREDICTED" | "CONFIRMED";
};

const lockedLiveTestVerdict = {
  lockId: "LIVE-20260813-E2E-01",
  testedAt: "2026-08-13",
  environment: "FarmConnect production",
  verdict: "PASSED",
  buddyReviewer: "Buddy Pogi — PASSED",
  ownerReviewer: "Master Pogi — PASSED",
  workflows: [
    "Customer signup and KYC approval",
    "Farm Buy, payment approval, Inventory, and My Roosters",
    "Paid Care Request, Admin assignment, Caretaker proof, and verification",
    "Sell Request, reviewed sale price, and Wallet credit",
    "Wallet withdrawal and completed Inbox notification",
  ],
  rule: "This lock records the tested baseline only. Newer confirmed runtime/API evidence overrides the historical pass and must be investigated.",
} as const;

function isIgnoredKaFarmIncident(incident: {
  title?: string;
  message?: string;
  requestUrl?: string | null;
  request_url?: string | null;
  httpStatus?: number | null;
  http_status?: number | null;
  affected?: string;
  route?: string | null;
  status?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
}) {
  const requestUrl = String(incident.requestUrl || incident.request_url || "");
  const title = String(incident.title || "");
  const message = String(incident.message || "");
  const route = String(incident.route || incident.affected || "");
  const status = incident.httpStatus ?? incident.http_status;
  const lifecycleStatus = String(incident.status || "").toLowerCase();
  const createdAt = Date.parse(String(incident.createdAt || incident.created_at || ""));
  const snapshotAt = Date.parse(String((generatedSnapshot as { generatedAt?: string }).generatedAt || ""));
  const closedIncident = ["resolved", "ignored", "completed"].includes(lifecycleStatus);
  const olderThanCurrentBuild = Number.isFinite(createdAt) && Number.isFinite(snapshotAt) && createdAt < snapshotAt;
  const expectedLoginFailure = requestUrl.includes("/auth/v1/token") && (status === 400 || /400|grant_type=password|invalid login/i.test(message));
  const combined = `${title} ${message} ${requestUrl} ${route}`.toLowerCase();
  const localRscRequest = requestUrl.includes("localhost:3000") && requestUrl.includes("_rsc=");
  const rscFallback = combined.includes("failed to fetch rsc payload") && combined.includes("falling back to browser navigation");
  const oldMonitorCompileError =
    combined.includes("kafarmclientmonitor.tsx") &&
    (combined.includes("expected ';', '}' or <eof>") || combined.includes("parsing ecmascript source code failed"));
  const genericDevFetch =
    title === "Network/API request blocked" &&
    message === "Failed to fetch" &&
    (!requestUrl || localRscRequest || /localhost:3000|\/caretaker\/signup|\/admin\/kafarm/i.test(route));
  const oldKaFarmSelfClick =
    title === "Button click produced no visible action" &&
    /\/admin\/kafarm/i.test(`${route} ${requestUrl} ${message}`) &&
    /clicked "(database|system|customer|caretaker|admin|flow|production error|investigation|findings|copy|run|clear logs|approve|reject|\d+\.\s|network\/api request blocked|.*needs check)/i.test(message);

  const staleKaFarmToolReport =
    /\/admin\/kafarm/i.test(`${route} ${requestUrl} ${message}`) &&
    /clicked .*no route change, modal, or visible page update/i.test(message);

  return closedIncident || olderThanCurrentBuild || expectedLoginFailure || localRscRequest || rscFallback || oldMonitorCompileError || genericDevFetch || oldKaFarmSelfClick || staleKaFarmToolReport;
}

function filterKaFarmIncidents<T extends { message?: string; requestUrl?: string | null; request_url?: string | null; httpStatus?: number | null; http_status?: number | null }>(items: T[]) {
  return items.filter((item) => !isIgnoredKaFarmIncident(item));
}

const KAFARM_MASCOT = "/farmconnect/kafarm/ka-farm-mascot.png";

type CardConfig = {
  slug: string;
  title: string;
  label: string;
  tone: Tone;
  summary: string;
  willShow: string[];
};

const toneClass: Record<Tone, string> = {
  approval: "border-amber-300 bg-amber-50 text-amber-900",
  read: "border-sky-300 bg-sky-50 text-sky-900",
  safe: "border-emerald-300 bg-emerald-50 text-emerald-900",
  report: "border-slate-300 bg-slate-50 text-slate-900",
};

const cards: CardConfig[] = [
  { slug: "ask", title: "Ask KaFarm", label: "Read Only", tone: "read", summary: "Admin command box for questions, status checks, bug triage, and work guidance.", willShow: ["Admin question", "KaFarm answer", "Evidence checklist", "Next route"] },
  { slug: "approvals", title: "Needs Approval", label: "Needs Admin Approval", tone: "approval", summary: "KYC, withdrawal, PIN reset, fraud, ownership, and exception decisions that admin must approve.", willShow: ["Sensitive request", "Risk reason", "Evidence needed", "Admin decision"] },
  { slug: "daily-briefing", title: "Daily Briefing", label: "Report Only", tone: "report", summary: "Daily business summary for money, KYC, care delays, support, and system issues.", willShow: ["Money issues", "Pending approvals", "Caretaker delays", "Suggested actions"] },
  { slug: "system-health", title: "System Health", label: "Safe Check", tone: "safe", summary: "Broken pages, failed flows, stale tasks, customer/admin/caretaker app warnings.", willShow: ["Route status", "Flow status", "UI warnings", "Next QA action"] },
  { slug: "database-health", title: "Database Health", label: "Safe Check", tone: "safe", summary: "Missing tables, columns, functions, RLS, links, storage, and orphan records.", willShow: ["Schema checks", "RLS checks", "Linked records", "SQL handoff"] },
  { slug: "qa-test-lab", title: "QA Test Lab", label: "Safe Check", tone: "safe", summary: "Manual scenario runner for flows like customer cash-in to farm buy.", willShow: ["Scenario", "Steps", "Expected result", "Blocker report"] },
  { slug: "evidence-finder", title: "Evidence Finder", label: "Read Only", tone: "read", summary: "Receipts, invoices, care proof, chat logs, support transcript, and admin action packet.", willShow: ["User", "Related record", "Timeline", "Evidence packet"] },
  { slug: "auto-fixed-logs", title: "Auto-Fixed Logs", label: "Report Only", tone: "report", summary: "Safe reversible actions only. Dangerous fixes stay disabled until admin approves.", willShow: ["Safe action", "Before/after", "Reason", "Rollback note"] },
  { slug: "escalated-chats", title: "Escalated Chats", label: "Needs Admin Approval", tone: "approval", summary: "Chats passed from KaFarm because they are sensitive, unclear, angry, money, KYC, or fraud related.", willShow: ["User message", "KaFarm summary", "Risk reason", "Admin join status"] },
  { slug: "buddy-reports", title: "Buddy Reports", label: "Report Only", tone: "report", summary: "Clean handoff reports for original Buddy when code, SQL, or deeper debugging is needed.", willShow: ["Page affected", "Steps reproduced", "Records checked", "Suggested fix"] },
];

const approvalRows: Row[] = [
  { left: "KYC Review", middle: "ID/selfie mismatch or duplicate account risk", right: "Admin approve/reject only", tone: "approval" },
  { left: "Withdrawal Release", middle: "Payout name/account must match customer KYC", right: "Manual proof needed", tone: "approval" },
  { left: "Wallet PIN Reset", middle: "Force logout, preserve balance and locked savings", right: "Account Security", tone: "approval" },
  { left: "Fraud Marking", middle: "Duplicate reference, fake identity, or ownership dispute", right: "Hold account", tone: "approval" },
  { left: "QR Exception", middle: "Caretaker scanner/camera failed; admin releases serial mode", right: "Exception only", tone: "approval" },
];

const dailyRows: Row[] = [
  { left: "Money", middle: "2 cash-in checks, 1 withdrawal proof pending", right: "Review first", tone: "approval" },
  { left: "KYC", middle: "1 duplicate risk, 1 ID quality review", right: "Needs evidence", tone: "approval" },
  { left: "Care", middle: "1 wrong-proof concern, 2 normal updates due today", right: "Check caretaker", tone: "safe" },
  { left: "Support", middle: "KaFarm handled simple questions; sensitive chats routed to admin", right: "Monitor", tone: "report" },
  { left: "System", middle: "Build passed; core routes reachable; no horizontal overflow found", right: "Healthy", tone: "safe" },
];

const systemRows: Row[] = [
  { left: "Customer App", middle: "dashboard, roosters, farm buy, requests, wallet, support", right: "Passed local QA", tone: "safe" },
  { left: "Admin App", middle: "customer requests, live chat, KaFarm, evidence routes", right: "Passed local QA", tone: "safe" },
  { left: "Caretaker App", middle: "dashboard, tasks, chat, completed, profile", right: "Passed local QA", tone: "safe" },
  { left: "Known Watch", middle: "Deep backend wiring still needs real-account live testing", right: "Manual test next", tone: "report" },
];

const databaseRows: Row[] = [
  { left: "Required Tables", middle: "animals, products, cart, support chat, KYC, customer animals", right: "Health check passed", tone: "safe" },
  { left: "KYC Safety", middle: "No public KYC bucket/policy left; dangerous profile update removed", right: "Passed", tone: "safe" },
  { left: "Support Chat", middle: "sessions/messages/functions present; KaFarm sender role available", right: "Ready", tone: "safe" },
  { left: "Next DB Need", middle: "Real QA record checks after user/account live testing", right: "Read-only first", tone: "report" },
];

const qaRows: Row[] = [
  { left: "Customer cash-in to farm buy", middle: "cash-in proof -> wallet -> farm buy -> inventory -> invoice -> inbox", right: "Manual ready", tone: "safe" },
  { left: "Care request to caretaker", middle: "request -> admin/caretaker task -> proof -> care logs -> customer inbox", right: "Manual ready", tone: "safe" },
  { left: "Support escalation", middle: "customer/caretaker -> KaFarm reply -> admin queue -> admin reply -> complete", right: "DB backed", tone: "safe" },
  { left: "KYC blocker", middle: "settings KYC -> system checks -> Account Verification -> inbox notice", right: "Needs live record", tone: "approval" },
];

const evidenceRows: Row[] = [
  { left: "Payment Evidence", middle: "receipt screenshot, method, sender, reference, time submitted", right: "Customer Requests > Payment", tone: "read" },
  { left: "Care Evidence", middle: "rooster, service, customer note, caretaker proof, QR/serial", right: "Customer Requests > Care", tone: "read" },
  { left: "KYC Evidence", middle: "ID front/back, selfie, legal name, birthdate, duplicate risk", right: "Account Verification", tone: "read" },
  { left: "Support Evidence", middle: "customer message, KaFarm replies, admin join/reply/end timestamps", right: "Live chat", tone: "read" },
];

const autoRows: Row[] = [
  { left: "Allowed Now", middle: "Prepare reports, sort queues, show reminders, generate checklists", right: "Safe", tone: "safe" },
  { left: "Blocked Now", middle: "Move money, approve KYC, reset PIN, delete records, mark fraud", right: "Admin approval", tone: "approval" },
  { left: "Future Safe Fix", middle: "Resend inbox notice, rebuild missing local notification, retry read-only check", right: "Phase later", tone: "report" },
];

const chatRows: Row[] = [
  { left: "Money Chat", middle: "Cash-in did not enter wallet; KaFarm asks amount/method/reference", right: "Escalate", tone: "approval" },
  { left: "KYC Chat", middle: "Withdraw blocked by unverified identity or payout mismatch", right: "Escalate", tone: "approval" },
  { left: "Caretaker Chat", middle: "QR/camera/upload issue; admin exception may be needed", right: "Escalate", tone: "approval" },
  { left: "Simple Chat", middle: "How to cash-in, where to see roosters, how to open care logs", right: "KaFarm answers", tone: "safe" },
];

const buddyRows: Row[] = [
  { left: "Page affected", middle: "/customer/support or exact route from report", right: "Required", tone: "read" },
  { left: "Steps reproduced", middle: "1. Login 2. Open page 3. Click action 4. Actual result", right: "Required", tone: "read" },
  { left: "Records checked", middle: "support session, wallet transaction, KYC, invoice, evidence log", right: "Required", tone: "read" },
  { left: "Likely cause", middle: "frontend route, backend function, RLS, missing record, UI state", right: "Report only", tone: "report" },
];

const pageRows: Record<string, Row[]> = {
  approvals: approvalRows,
  "daily-briefing": dailyRows,
  "system-health": systemRows,
  "database-health": databaseRows,
  "qa-test-lab": qaRows,
  "evidence-finder": evidenceRows,
  "auto-fixed-logs": autoRows,
  "escalated-chats": chatRows,
  "buddy-reports": buddyRows,
};

const pageLinks: Record<string, Array<{ label: string; href: string }>> = {
  approvals: [
    { label: "Account Verification", href: "/admin/account-verification" },
    { label: "Withdrawal Review", href: "/admin/customer-requests/withdraw" },
    { label: "Issue Management", href: "/admin/issue-management" },
  ],
  "daily-briefing": [
    { label: "Dashboard", href: "/admin" },
    { label: "Customer Requests", href: "/admin/customer-requests" },
    { label: "Caretaker Management", href: "/admin/caretaker-management" },
  ],
  "system-health": [
    { label: "Customer App", href: "/customer/dashboard" },
    { label: "Admin App", href: "/admin" },
    { label: "Caretaker App", href: "/caretaker/dashboard" },
  ],
  "database-health": [
    { label: "Evidence Logs", href: "/admin/evidence" },
    { label: "Support Chats", href: "/admin/live-chat" },
    { label: "Buddy Report", href: "/admin/kafarm/buddy-reports" },
  ],
  "qa-test-lab": [
    { label: "Farm Buy", href: "/customer/farm-buy" },
    { label: "Support", href: "/customer/support" },
    { label: "Live Chat", href: "/admin/live-chat" },
  ],
  "evidence-finder": [
    { label: "Evidence Logs", href: "/admin/evidence" },
    { label: "Completed Issues", href: "/admin/issue-management" },
    { label: "Inbox Invoice", href: "/customer/inbox/invoice/farm-buy" },
  ],
  "auto-fixed-logs": [
    { label: "System Health", href: "/admin/kafarm/system-health" },
    { label: "Needs Approval", href: "/admin/kafarm/approvals" },
  ],
  "escalated-chats": [
    { label: "Admin Live Chat", href: "/admin/live-chat" },
    { label: "Customer Support", href: "/customer/support" },
    { label: "Caretaker Chat", href: "/caretaker/chat" },
  ],
  "buddy-reports": [
    { label: "QA Test Lab", href: "/admin/kafarm/qa-test-lab" },
    { label: "Database Health", href: "/admin/kafarm/database-health" },
    { label: "Evidence Finder", href: "/admin/kafarm/evidence-finder" },
  ],
};

const askSamples = [
  "Tutulog muna ako KaFarm, ikaw na muna bahala.",
  "KaFarm may bug daw sa system, check mo kung saan.",
  "KaFarm check mo database natin kung may error.",
  "KaFarm nakalimutan password ng customer, ano safe gawin?",
  "KaFarm di daw gumagana yung wallet button, route ba o account issue?",
  "KaFarm sinong customer ang affected, isa lang ba o lahat?",
  "May cash-in ba na hindi pumasok?",
  "Check mo kung may wrong rooster or caretaker proof problem.",
  "Gawan mo ako ng Buddy report kung may database issue.",
];

const operatorPlan = [
  { title: "1. Money Risk", text: "Payment, withdrawal, wallet alerts, duplicate references, missing receipts, failed payouts.", href: "/admin/customer-requests/payment" },
  { title: "2. Identity Risk", text: "KYC, duplicate accounts, payout name mismatch, PIN reset, account locks.", href: "/admin/customer-requests/kyc" },
  { title: "3. Farm Risk", text: "Wrong rooster, care proof disputes, caretaker exceptions, QR/camera issues, delayed tasks.", href: "/admin/customer-requests/care" },
  { title: "4. Evidence", text: "Gather invoice, receipt, chat transcript, proof uploads, and admin action logs.", href: "/admin/evidence" },
  { title: "5. Handoff", text: "Create a Buddy report with exact page, steps, records, and likely cause.", href: "/admin/kafarm/buddy-reports" },
];


type SqlAuditModule = {
  module: string;
  pages: string;
  tables: string[];
  functions: string[];
  views: string[];
  policies: string[];
  storage?: string[];
};

const sqlAuditModules: SqlAuditModule[] = [
  { module: "Auth / Role Guardian", pages: "login, signup, admin/caretaker/customer route guard", tables: ["profiles", "caretakers"], functions: ["current_profile_id", "is_admin"], views: [], policies: ["profiles self read", "profiles owner safe update"] },
  { module: "Customer KYC", pages: "/customer/settings, /admin/customer-requests/kyc", tables: ["customer_kyc_profiles"], functions: ["customer_submit_kyc", "run_kyc_system_checks", "admin_review_customer_kyc", "customer_record_kyc_consent"], views: [], policies: ["kyc"] },
  { module: "Wallet / PIN / Payout", pages: "/customer/wallet, /customer/withdraw, /admin/customer-requests/security", tables: ["profiles.wallet_balance", "wallet_transactions", "withdrawal_requests"], functions: ["change_wallet_pin", "admin_reset_wallet_pin"], views: [], policies: ["wallet"] },
  { module: "Manual Payments / Invoice", pages: "/customer/payment, /admin/customer-requests/payment", tables: ["manual_payment_requests", "payment_evidence_logs", "inbox_items"], functions: ["customer_submit_manual_payment", "admin_review_manual_payment"], views: [], policies: ["payment evidence read linked"] },
  { module: "Withdrawal Review", pages: "/customer/withdraw, /admin/customer-requests/withdraw", tables: ["withdrawal_requests", "withdrawal_evidence_logs"], functions: ["customer_submit_withdrawal_request", "admin_review_withdrawal_request"], views: [], policies: ["withdrawal evidence read linked"] },
  { module: "Farm Buy / Inventory", pages: "/customer/farm-buy, /customer/inventory", tables: ["farm_products", "farm_cart_items", "customer_inventory_items", "customer_animals"], functions: ["customer_buy_cart"], views: [], policies: ["inventory"] },
  { module: "Roosters / Ownership", pages: "/customer/roosters, /customer/care-logs", tables: ["animals", "customer_animals", "animal_photos", "animal_weights", "farm_care_requests", "caretaker_tasks", "task_proofs"], functions: [], views: [], policies: ["customer animals"] },
  { module: "Care Requests / Task Assignment", pages: "/customer/farm-requests, /admin/customer-requests/task, /caretaker/tasks", tables: ["farm_care_requests", "caretaker_tasks", "task_proofs"], functions: ["customer_create_care_request", "admin_assign_care_request", "caretaker_submit_task_proof", "admin_review_task_proof"], views: [], policies: ["care task"] },
  { module: "Caretaker Registration", pages: "/caretaker/signup, /admin/caretaker-management", tables: ["caretaker_applications", "caretakers"], functions: ["submit_caretaker_application", "admin_review_caretaker_application"], views: [], policies: ["caretaker"] },
  { module: "Support Chat / Escalation", pages: "/customer/support, /caretaker/chat, /admin/live-chat", tables: ["support_chat_sessions", "support_chat_messages"], functions: ["customer_support_send_message", "caretaker_support_send_message", "kafarm_support_send_message", "admin_support_join_chat", "admin_support_send_message", "admin_support_complete_chat"], views: ["admin_support_escalated_chats"], policies: ["support sessions read own", "support messages read own"] },
  { module: "Evidence Logs", pages: "/admin/evidence, inbox receipts/invoices", tables: ["payment_evidence_logs", "withdrawal_evidence_logs", "support_chat_messages", "task_proofs"], functions: [], views: [], policies: ["evidence"] },
  { module: "KaFarm Monitor", pages: "/admin/kafarm/system-health, /admin/kafarm/database-health", tables: ["kafarm_incidents"], functions: ["kafarm_record_incident", "admin_kafarm_update_incident_status"], views: ["admin_kafarm_incident_queue"], policies: ["kafarm incidents admin read all", "kafarm incidents owner read own"] },
];

function normalizeInventoryName(value: string) {
  return value.replace(/^profiles\./, "profiles").trim().toLowerCase();
}

function compareCodeAndSupabaseInventory(snapshot: LiveDatabaseSnapshot | null, incidents: DbIncident[]): InventoryComparison[] {
  if (!snapshot) return [];
  const liveNames = new Set<string>();
  (snapshot.tables || []).forEach((item) => item.table_name && liveNames.add(normalizeInventoryName(item.table_name)));
  (snapshot.functions || []).forEach((item) => item.function_name && liveNames.add(normalizeInventoryName(item.function_name)));
  (snapshot.policies || []).forEach((item) => item.policy_name && liveNames.add(normalizeInventoryName(item.policy_name)));
  (snapshot.expected_objects || []).filter((item) => item.exists).forEach((item) => item.object_name && liveNames.add(normalizeInventoryName(item.object_name)));
  const explicitlyMissing = new Set(
    (snapshot.missing_objects || []).flatMap((item) => item.object_name ? [normalizeInventoryName(item.object_name)] : []),
  );

  return sqlAuditModules.map((module) => {
    const codeObjects = getSqlAuditExpected(module);
    const unmatchedObjects = codeObjects.filter((name) => {
      const normalized = normalizeInventoryName(name);
      if (module.policies.includes(name)) {
        return !Array.from(liveNames).some((live) => live.includes(normalized) || normalized.includes(live));
      }
      return !liveNames.has(normalized);
    });
    const moduleText = `${module.module} ${module.pages} ${codeObjects.join(" ")}`.toLowerCase();
    const activeErrors = incidents.filter((incident) => {
      const status = String(incident.status || "").toLowerCase();
      if (["resolved", "ignored", "completed"].includes(status)) return false;
      const incidentText = `${incident.title} ${incident.message} ${incident.route || ""} ${incident.request_url || ""}`.toLowerCase();
      const incidentRoute = String(incident.route || "").split("?")[0].toLowerCase();
      const moduleRoutes = module.pages.split(",").map((page) => page.trim().toLowerCase()).filter((page) => page.startsWith("/"));
      const exactRouteMatch = Boolean(incidentRoute) && moduleRoutes.some((page) => incidentRoute === page || incidentRoute.startsWith(`${page}/`));
      const genericUiIncident = /button click produced no visible action|button\/link route did not open/i.test(String(incident.title || ""));
      if (genericUiIncident && incidentRoute) return exactRouteMatch;
      return exactRouteMatch
        || codeObjects.some((name) => incidentText.includes(normalizeInventoryName(name)))
        || (moduleText.includes("database") && Boolean(incident.http_status && incident.http_status >= 400));
    }).map((incident) => ({
      title: incident.title,
      status: incident.http_status,
      route: incident.route || "unknown route",
      message: incident.message,
    }));
    const confirmedMissingObjects = unmatchedObjects.filter((name) => explicitlyMissing.has(normalizeInventoryName(name)));
    const predictedObjects = unmatchedObjects.filter((name) => !explicitlyMissing.has(normalizeInventoryName(name)));
    const status: InventoryComparison["status"] = activeErrors.length || confirmedMissingObjects.length
      ? "CONFIRMED"
      : predictedObjects.length
        ? "PREDICTED"
        : "CLEAR";
    return {
      module: module.module,
      pages: module.pages,
      codeObjects,
      liveObjects: codeObjects.filter((name) => !unmatchedObjects.includes(name)),
      predictedObjects,
      confirmedMissingObjects,
      activeErrors,
      status,
    };
  });
}

const sqlAuditCheckerSql = `-- FarmConnect read-only SQL audit checker. Safe to run; no data changes.
with expected_objects(kind, object_name) as (
  values
${sqlAuditModules.flatMap((item) => [
  ...item.tables.map((name) => `    ('table','${name}')`),
  ...item.functions.map((name) => `    ('function','${name}')`),
  ...item.views.map((name) => `    ('view','${name}')`),
]).join(",\n")}
), object_status as (
  select kind, object_name,
    case
      when kind = 'table' then to_regclass('public.' || object_name) is not null
      when kind = 'view' then exists (select 1 from information_schema.views where table_schema='public' and table_name=object_name)
      when kind = 'function' then exists (select 1 from information_schema.routines where routine_schema='public' and routine_name=object_name)
      else false
    end as exists
  from expected_objects
), policy_status as (
  select 'policy'::text as kind, p as object_name,
    exists (select 1 from pg_policies where schemaname='public' and lower(policyname) like '%' || lower(p) || '%') as exists
  from unnest(array[
${Array.from(new Set(sqlAuditModules.flatMap((item) => item.policies))).map((name) => `    '${name.replaceAll("'", "''")}'`).join(",\n")}
  ]) p
)
select kind, object_name, exists
from object_status
union all
select kind, object_name, exists
from policy_status
order by kind, object_name;`;

function getSqlAuditExpected(module: SqlAuditModule) {
  return [...module.tables, ...module.functions, ...module.views, ...module.policies, ...(module.storage || [])];
}

function itemLooksMissing(raw: string, item: string) {
  if (!raw.trim()) return true;
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lower = raw.toLowerCase();
  if (!lower.includes(item.toLowerCase())) return true;
  const jsonFalse = new RegExp(`"object_name"\\s*:\\s*"${escaped}"[\\s\\S]{0,120}"exists"\\s*:\\s*false`, "i");
  const csvFalse = new RegExp(`(^|\\n)[^\\n]*${escaped}[^\\n]*(false|missing|not found|,0)(\\n|$)`, "i");
  return jsonFalse.test(raw) || csvFalse.test(raw);
}

function analyzeSqlAudit(raw: string) {
  return sqlAuditModules.map((module) => {
    const expected = getSqlAuditExpected(module);
    const missing = expected.filter((item) => itemLooksMissing(raw, item));
    const found = expected.filter((item) => !missing.includes(item));
    const status: "OK" | "Partial" | "Needs Output" = !raw.trim() ? "Needs Output" : missing.length === 0 ? "OK" : "Partial";
    return { module: module.module, pages: module.pages, expected, found, missing, status };
  });
}

function buildSqlAuditReport(raw: string) {
  const results = analyzeSqlAudit(raw);
  const missingModules = results.filter((item) => item.missing.length);
  return [
    "FarmConnect KaFarm SQL Audit Report",
    `Generated: ${new Date().toLocaleString()}`,
    `Modules checked: ${results.length}`,
    `Modules with missing/unclear objects: ${missingModules.length}`,
    "",
    ...results.map((item) => [
      `Module: ${item.module}`,
      `Status: ${item.status}`,
      `Pages affected: ${item.pages}`,
      `Missing/unclear: ${item.missing.length ? item.missing.join(", ") : "None"}`,
      "",
    ].join("\n")),
    "Next safe step: run/fix missing objects only. Do not run destructive SQL. Keep admin approval for wallet, KYC, withdrawal, fraud, and ownership changes.",
  ].join("\n");
}

const incidentTypes = ["Payment", "Withdrawal", "KYC", "Care Task", "Caretaker", "Login", "Database", "Button"];

const monitoringIncidents = [
  {
    id: "PAY-QUEUE-001",
    title: "Payment proof waiting for admin review",
    category: "Payment",
    severity: "High",
    status: "Blocked",
    affected: "Customer payment page -> admin customer requests",
    message: "Customer submitted receipt/reference. Admin must approve or reject before inventory/rooster changes.",
    evidence: ["Receipt upload", "Reference number", "Farm Buy invoice draft", "Customer queue item"],
    proposedFix: "Keep request in review queue, prevent duplicate submit, show payment status to customer, and require admin decision.",
    safeRecovery: "Create admin alert and keep customer on payment status page instead of crashing or charging wallet automatically.",
  },
  {
    id: "CARE-TASK-002",
    title: "Approved care request needs caretaker assignment",
    category: "Care Task",
    severity: "Medium",
    status: "Needs admin",
    affected: "Customer care request -> task management -> caretaker app",
    message: "Paid care request must become a task only after admin assignment.",
    evidence: ["Care request", "Rooster tag/QR", "Customer note", "Payment approval"],
    proposedFix: "Show caretaker list, assign one caretaker, then create visible task in caretaker app with notes and required proof.",
    safeRecovery: "Hold task as Awaiting Assignment and notify admin until caretaker is selected.",
  },
  {
    id: "BUG-ROUTE-003",
    title: "Button or route not working",
    category: "Button",
    severity: "Medium",
    status: "Checking",
    affected: "Any customer/admin/caretaker page",
    message: "KaFarm should capture page, button, user role, expected result, and actual result.",
    evidence: ["Current route", "Button label", "Console/API error", "User role"],
    proposedFix: "Log the blocked action, retry safe read, then prepare Buddy report if route or handler needs code fix.",
    safeRecovery: "Show friendly fallback and keep user draft/data intact.",
  },
  {
    id: "DB-RLS-004",
    title: "Supabase permission or missing record warning",
    category: "Database",
    severity: "High",
    status: "Needs Buddy",
    affected: "RPC/RLS/data relation",
    message: "If DB blocks a flow, KaFarm must not guess. It gathers SQL output and creates a copy-ready fix report.",
    evidence: ["RPC name", "HTTP status", "RLS policy", "Table/function involved"],
    proposedFix: "Run read-only health check, identify missing link/table/policy, then ask admin before any SQL fix.",
    safeRecovery: "Mark transaction/task as Needs Review and prevent repeated submit.",
  },
];

const recoveryTools = [
  { name: "Error Reader", label: "Safe Check", text: "Captures route, action, message, API/RPC, status code, role, and timestamp." },
  { name: "Incident Queue", label: "Monitoring", text: "Turns every blocker into New, Checking, Needs Admin, Needs Buddy, or Resolved." },
  { name: "Evidence Finder", label: "Read Only", text: "Links receipts, invoices, references, task proof, chat transcript, and admin logs." },
  { name: "Temporary Recovery", label: "Safe Recovery", text: "Friendly fallback, save draft, prevent duplicate submit, create admin alert, keep status page." },
  { name: "Repair Proposal", label: "Approve/Reject", text: "KaFarm proposes the fix, then waits for admin approval or rejection." },
  { name: "Buddy Report", label: "Report Only", text: "Copy-ready report with exact issue, evidence, likely cause, and test steps." },
];

type KaFarmToolKey = "database" | "system" | "customer" | "caretaker" | "admin" | "flow" | "production";

const kaFarmTools: Array<{ key: KaFarmToolKey; title: string; label: string; description: string }> = [
  { key: "database", title: "Database", label: "SQL / RLS", description: "Tables, columns, functions, policies, relations, and Supabase blockers." },
  { key: "system", title: "System", label: "App Health", description: "Broken pages, buttons, console errors, API/RPC failures, and local incidents." },
  { key: "customer", title: "Customer", label: "Client Flow", description: "Payments, farm buy, withdrawal, KYC, inbox, care logs, and support." },
  { key: "caretaker", title: "Caretaker", label: "Worker Flow", description: "Applications, assigned tasks, QR/proof upload, backjobs, and completed tasks." },
  { key: "admin", title: "Admin", label: "Ops Flow", description: "Approvals, rejection notes, invoices, evidence, account verification, and issue handling." },
  { key: "flow", title: "Flow", label: "Role Bridge", description: "Customer → Admin → Caretaker → Admin → Customer connection checks." },
  { key: "production", title: "Production Error", label: "Live App", description: "Production-only checklist before asking Buddy/code/SQL fix." },
];

const productionChecklist = [
  "Production Error Logs",
  "Production Database",
  "Environment Variables",
  "Deployed Version",
  "Actual Browser Behavior",
  "User Session and Permissions",
  "External Services",
  "Webhook Delivery",
  "File and Media Storage",
  "Traffic and Performance",
  "Scheduled Automations",
  "Exact User Actions",
];

const toolSolutions: Record<KaFarmToolKey, string[]> = {
  database: [
    "Run read-only SQL audit first.",
    "Mark missing table/function/RLS before writing fix SQL.",
    "Block sensitive actions until admin approves SQL change.",
    "Send exact false rows/output to Buddy if schema fix is needed.",
  ],
  system: [
    "Capture page route, button label, browser console, and API/RPC status.",
    "Decide if the issue is frontend, backend, database, permission, or deployment.",
    "Create repair proposal before code change.",
    "Regression-test customer, caretaker, admin routes after fix.",
  ],
  customer: [
    "Trace customer action from request/payment/proof to admin queue.",
    "Check receipt, reference, invoice, inbox item, inventory, wallet, and care log.",
    "If rejected, make customer-facing note clear enough for resubmission.",
    "If approved, verify customer-visible result appears.",
  ],
  caretaker: [
    "Check applicant/task queue first.",
    "Verify selfie/resume/proof uploads are viewable.",
    "Reject task with notes if proof is missing or wrong.",
    "Approved task must update admin evidence and customer care log.",
  ],
  admin: [
    "Keep approval action specific: payment approve, withdrawal proof, task assign, or KYC review.",
    "Avoid one generic approve button for different actions.",
    "Require notes for reject/hold decisions.",
    "Every admin action must create evidence trail.",
  ],
  flow: [
    "Follow one record across all roles.",
    "Customer request should create admin queue item.",
    "Admin approval should create caretaker task or customer result.",
    "Caretaker proof should return to admin review before customer update.",
  ],
  production: [
    "Collect production evidence before code changes.",
    "Compare deployed version vs local version.",
    "Check live auth/session/RLS behavior with the affected role.",
    "Use report-only mode until admin approves fix.",
  ],
};

export function KafarmCommandCenter() {
  const router = useRouter();
  const initialCommand = "Good morning KaFarm, ano nangyari sa app natin?";
  const [question, setQuestion] = useState(initialCommand);
  const [clientIncidents, setClientIncidents] = useState<KaFarmIncident[]>([]);
  const incidentQueue = useMemo(() => [...clientIncidents, ...monitoringIncidents], [clientIncidents]);
  const [selectedIncident, setSelectedIncident] = useState<KaFarmIncident>(monitoringIncidents[0]);
  const [selectedTool, setSelectedTool] = useState<KaFarmToolKey | null>(null);
  const [databaseSnapshot, setDatabaseSnapshot] = useState<LiveDatabaseSnapshot | null>(null);
  const [inventoryIncidents, setInventoryIncidents] = useState<DbIncident[]>([]);
  const [databaseReaderStatus, setDatabaseReaderStatus] = useState("Database reader not run yet.");
  const [issueFilter, setIssueFilter] = useState<"problems" | "solutions">("problems");
  const [problemEngineRan, setProblemEngineRan] = useState(false);
  const [solutionEngineRan, setSolutionEngineRan] = useState(false);
  const [panelActionNote, setPanelActionNote] = useState("Choose a tool, then run Investigation or open Findings.");
  const [copyStatus, setCopyStatus] = useState("Copy");
  const [simpleCopyStatus, setSimpleCopyStatus] = useState("Copy");
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");
  const [adminNote, setAdminNote] = useState("Admin note or rejected reason...");
  const [adminGate, setAdminGate] = useState<AdminGateState>({ status: "checking" });  const analysis = useMemo(() => analyzeKaFarmMessage(question || selectedIncident.message, "admin"), [question, selectedIncident.message]);
  const buddyReport = useMemo(() => buildKaFarmRepairReport(selectedIncident, analysis, decision, adminNote), [selectedIncident, analysis, decision, adminNote]);
  const selectedToolConfig = kaFarmTools.find((tool) => tool.key === selectedTool) || null;
  const incidentToolFindings = useMemo(
    () => selectedTool ? getKaFarmToolFindings(selectedTool, clientIncidents) : [],
    [selectedTool, clientIncidents],
  );
  const databaseSnapshotFindings = useMemo(
    () => selectedTool === "database" && databaseSnapshot ? getKaFarmDatabaseSnapshotFindings(databaseSnapshot) : [],
    [selectedTool, databaseSnapshot],
  );
  const inventoryComparison = useMemo(
    () => compareCodeAndSupabaseInventory(databaseSnapshot, inventoryIncidents),
    [databaseSnapshot, inventoryIncidents],
  );
  const confirmedInventoryModules = useMemo(
    () => inventoryComparison.filter((item) => item.status === "CONFIRMED"),
    [inventoryComparison],
  );
  const predictedInventoryModules = useMemo(
    () => inventoryComparison.filter((item) => item.status === "PREDICTED"),
    [inventoryComparison],
  );
  const inventoryValidationReport = useMemo(() => databaseSnapshot ? [
    "KAFARM CODE ↔ SUPABASE PREDICTION AND VALIDATION",
    `Run at: ${new Date().toISOString()}`,
    `Verdict: ${confirmedInventoryModules.length ? "CONFIRMED ISSUE — NEWER EVIDENCE OVERRIDES LOCK" : "PASSED — LOCKED LIVE-TEST EVIDENCE"}`,
    `Code modules compared: ${inventoryComparison.length}`,
    `Predicted modules: ${predictedInventoryModules.length}`,
    `Confirmed modules: ${confirmedInventoryModules.length}`,
    confirmedInventoryModules.length
      ? "Testing rule: Investigate the new confirmed evidence. Do not repeat sensitive production transactions automatically."
      : "Testing rule: No repeat production transaction is required. Predictions are inventory notes only because the covered end-to-end workflows already passed the locked live test.",
    "",
    ...inventoryComparison.flatMap((item) => [
      `[${item.status}] ${item.module}`,
      `Affected pages/actions: ${item.pages}`,
      `Predicted/unverified: ${item.predictedObjects.length ? item.predictedObjects.join(", ") : "None"}`,
      `Confirmed missing: ${item.confirmedMissingObjects.length ? item.confirmedMissingObjects.join(", ") : "None"}`,
      `Runtime confirmation: ${item.activeErrors.length ? item.activeErrors.map((error) => `${error.status ? `HTTP ${error.status} ` : ""}${error.title} @ ${error.route}`).join(" | ") : "None"}`,
      item.status === "CONFIRMED" ? "Result: Exact live metadata or runtime evidence confirmed a newer issue." : item.status === "PREDICTED" ? "Result: Inventory note only. The locked live test passed the covered workflow; do not repeat production transactions unless relevant code changes or new runtime evidence appears." : "Result: No issue found from the current inventory and runtime evidence.",
      "",
    ]),
  ].join("\n") : "KAFARM CODE ↔ SUPABASE PREDICTION AND VALIDATION\nNot run yet.", [databaseSnapshot, inventoryComparison, confirmedInventoryModules, predictedInventoryModules]);
  const toolFindings = useMemo(
    () => selectedTool === "database" ? [...databaseSnapshotFindings, ...incidentToolFindings] : incidentToolFindings,
    [selectedTool, databaseSnapshotFindings, incidentToolFindings],
  );
  const actionProcedure = useMemo(
    () => `${inventoryValidationReport}\n\nLOCKED LIVE-TEST VERDICT HISTORY\nLock ID: ${lockedLiveTestVerdict.lockId}\nTested at: ${lockedLiveTestVerdict.testedAt}\nEnvironment: ${lockedLiveTestVerdict.environment}\nVerdict: ${lockedLiveTestVerdict.verdict}\nReviewer 1: ${lockedLiveTestVerdict.buddyReviewer}\nReviewer 2: ${lockedLiveTestVerdict.ownerReviewer}\nPassed workflows:\n${lockedLiveTestVerdict.workflows.map((item) => `- ${item}`).join("\n")}\nLock rule: ${lockedLiveTestVerdict.rule}\n\nCURRENT DISPOSITION\n${confirmedInventoryModules.length ? "A newer confirmed issue exists. Send this report to Buddy for scoped investigation before relying on the affected workflow." : "GOOD: The locked production live-test baseline remains valid. No new confirmed blocker was detected, and no production transaction needs to be repeated."}`,
    [inventoryValidationReport, selectedToolConfig, toolFindings, incidentQueue, selectedIncident, decision, adminNote],
  );
  const simpleExplanation = useMemo(() => {
    if (!databaseSnapshot) {
      return [
        "QUICK EXPLANATION",
        "Hindi pa nababasa ni KaFarm ang app. Pindutin ang Run para magsimula.",
        "",
        "SAVED LIVE-TEST HISTORY",
        `${lockedLiveTestVerdict.lockId}: ${lockedLiveTestVerdict.verdict}`,
        `${lockedLiveTestVerdict.buddyReviewer} · ${lockedLiveTestVerdict.ownerReviewer}`,
        "Naka-save ang dating successful end-to-end live test bilang baseline.",
        "",
        "WHY KAFARM SAYS THIS",
        "Wala pang bagong code inventory, Supabase inventory, at runtime evidence na galing sa kasalukuyang scan.",
      ].join("\n");
    }
    if (confirmedInventoryModules.length) {
      const names = confirmedInventoryModules.map((item) => item.module).join(", ");
      const evidence = confirmedInventoryModules.flatMap((item) => [
        ...item.confirmedMissingObjects.map((name) => `${item.module}: missing ${name}`),
        ...item.activeErrors.map((error) => `${item.module}: ${error.status ? `HTTP ${error.status} ` : ""}${error.title}`),
      ]).slice(0, 6);
      return [
        "QUICK EXPLANATION",
        `May ${confirmedInventoryModules.length} bagong kumpirmadong problema. Apektado: ${names}. Mas bago ang current evidence kaysa sa dating PASSED baseline, kaya kailangan itong imbestigahan.`,
        "",
        "SAVED LIVE-TEST HISTORY",
        `${lockedLiveTestVerdict.lockId}: PASSED noong ${lockedLiveTestVerdict.testedAt}, pero hindi nito tinatakpan ang bagong confirmed error.`,
        "",
        "WHY KAFARM SAYS THIS",
        "Tinawag itong confirmed dahil may eksaktong live Supabase metadata o aktuwal na runtime/API error na tumutugma sa affected module.",
        ...(evidence.length ? evidence.map((line) => `• ${line}`) : ["• May linked runtime evidence sa Technical Report."]),
      ].join("\n");
    }
    if (predictedInventoryModules.length) {
      const names = predictedInventoryModules.map((item) => item.module).join(", ");
      const predictions = predictedInventoryModules.flatMap((item) => item.predictedObjects.map((name) => `${item.module}: ${name}`)).slice(0, 6);
      return [
        "QUICK EXPLANATION",
        `May ${predictedInventoryModules.length} inventory note sa ${names}, pero hindi ito totoong error at walang bagong confirmed blocker. Hindi kailangang ulitin ang production transactions dahil pumasa na ang covered workflows sa locked live test.`,
        "",
        "SAVED LIVE-TEST HISTORY",
        `${lockedLiveTestVerdict.lockId}: ${lockedLiveTestVerdict.verdict}`,
        `${lockedLiveTestVerdict.buddyReviewer} · ${lockedLiveTestVerdict.ownerReviewer}`,
        "Pumasa na ang listed end-to-end workflows; ang prediction ay hindi automatic na nagpapawalang-bisa sa lock hangga't walang confirmed error.",
        "",
        "WHY KAFARM SAYS THIS",
        "May code requirement na hindi kayang patunayan ng kasalukuyang inventory snapshot nang mag-isa. Nanatiling valid ang PASSED baseline hangga't walang relevant code change, matching runtime/API failure, o authoritative missing-object result.",
        ...predictions.map((line) => `• Needs verification: ${line}`),
      ].join("\n");
    }
    return [
      "QUICK EXPLANATION",
      "Maayos ang resulta ng kasalukuyang scan. Walang nakitang problemang kailangang ayusin ngayon.",
      "",
      "SAVED LIVE-TEST HISTORY",
      `${lockedLiveTestVerdict.lockId}: ${lockedLiveTestVerdict.verdict}`,
      `${lockedLiveTestVerdict.buddyReviewer} · ${lockedLiveTestVerdict.ownerReviewer}`,
      "Ang current scan ay consistent sa naka-lock na successful end-to-end live-test baseline.",
      "",
      "WHY KAFARM SAYS THIS",
      `Nag-match ang code at live Supabase inventory sa ${inventoryComparison.length} module(s), at walang nakitang linked runtime/API error sa kasalukuyang evidence.`,
    ].join("\n");
  }, [databaseSnapshot, confirmedInventoryModules, predictedInventoryModules, inventoryComparison.length]);
  const [thread, setThread] = useState<Array<{ id: string; role: "admin" | "kafarm"; body: string; risk?: string }>>([
    { id: "hello-admin", role: "admin", body: "Good morning KaFarm." },
    { id: "hello-kafarm", role: "kafarm", body: "Good morning boss. Ready ako. Sabihin mo lang kung gusto mo daily status, bug check, payment queue, caretaker tasks, or Buddy report.", risk: "low" },
  ]);

  useEffect(() => {
    const loadIncidents = () => {
      try {
        const raw = window.localStorage.getItem("farmconnect_kafarm_incidents");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          const cleaned = filterKaFarmIncidents(parsed).slice(0, 12);
          if (cleaned.length !== parsed.length) {
            window.localStorage.setItem("farmconnect_kafarm_incidents", JSON.stringify(cleaned));
          }
          setClientIncidents(cleaned.slice(0, 8));
        }
      } catch {
        setClientIncidents([]);
      }
    };
    loadIncidents();
    window.addEventListener("kafarm-incident", loadIncidents);
    return () => window.removeEventListener("kafarm-incident", loadIncidents);
  }, []);

  useEffect(() => {
    if (adminGate.status !== "allowed") return;
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase
        .from("admin_kafarm_incident_queue")
        .select("id,title,category,severity,status,app_role,route,message,http_status,request_url,email,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(80);
      if (active && !error) setInventoryIncidents(filterKaFarmIncidents((data || []) as DbIncident[]));
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("kafarm-incident", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("kafarm-incident", refresh);
    };
  }, [adminGate.status]);

  useEffect(() => {
    let active = true;
    const failSafe = window.setTimeout(() => {
      if (active) {
        setAdminGate({
          status: "blocked",
          message: "Admin profile check timed out. Refresh or login again as admin, then rerun KaFarm.",
        });
      }
    }, 8000);

    async function checkAdminGate() {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;
      const { data: authData, error: authError } = sessionUser
        ? { data: { user: sessionUser }, error: null }
        : await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        window.clearTimeout(failSafe);
        setAdminGate({ status: "login_required", message: "No active admin login found. KaFarm admin tools need an admin session first." });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, account_status")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

      if (!active) return;
      window.clearTimeout(failSafe);
      if (profileError) {
        setAdminGate({ status: "blocked", message: `Admin profile check blocked: ${profileError.message}` });
        return;
      }

      const role = String(profile?.role || "unknown").toLowerCase();
      const status = String(profile?.account_status || "unknown").toLowerCase();
      if (role === "admin" && status === "active") {
        setAdminGate({ status: "allowed" });
        return;
      }

      setAdminGate({ status: "blocked", message: `Current account is ${role} / ${status}. Login with an active admin account.` });
    }

    checkAdminGate();
    return () => {
      active = false;
      window.clearTimeout(failSafe);
    };
  }, []);

  const logoutToHome = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const selectedStatus = !toolFindings.length && problemEngineRan
    ? "No blocker detected"
    : decision === "approved" ? "Approved fix" : decision === "rejected" ? "Rejected fix" : selectedIncident.status;
  const runProblemEngine = (toolKey: KaFarmToolKey) => {
    setSelectedTool(toolKey);
    setIssueFilter("problems");
    setProblemEngineRan(true);
    setSolutionEngineRan(false);
    setPanelActionNote(`Investigation ran for ${kaFarmTools.find((tool) => tool.key === toolKey)?.title || "selected scope"}.`);
    setDecision("pending");
  };

  const runSolutionEngine = () => {
    if (!selectedTool) return;
    setIssueFilter("solutions");
    setSolutionEngineRan(true);
    setPanelActionNote(`Findings opened for ${selectedToolConfig?.title || "selected scope"}.`);
  };

  const selectToolFilter = (toolKey: KaFarmToolKey) => {
    setSelectedTool(toolKey);
    setProblemEngineRan(false);
    setSolutionEngineRan(false);
    setIssueFilter("problems");
    setPanelActionNote(`${kaFarmTools.find((tool) => tool.key === toolKey)?.title || "Scope"} selected. Click Run to investigate.`);
    setDecision("pending");
  };

  async function runDatabaseReader() {
    setDatabaseReaderStatus("Running admin-only read-only database reader...");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      const message = "Admin login/session required before KaFarm can run database reader.";
      const incident = {
        id: `db-admin-session-${Date.now()}`,
        title: "Database reader needs admin session",
        category: "database",
        severity: "Medium",
        status: "Needs Admin Login",
        affected: "Admin KaFarm -> Database Investigation",
        message,
        evidence: ["Supabase auth session", "admin profile role", "kafarm_database_health_snapshot RPC"],
        proposedFix: "Login as an active admin account, then run Database investigation again.",
        safeRecovery: "Do not run database health RPC as anon/customer/caretaker. Keep this read-only.",
      } as KaFarmIncident;
      setDatabaseReaderStatus(message);
      setSelectedIncident(incident);
      setClientIncidents((current) => [incident, ...current].slice(0, 12));
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin" || profile?.account_status !== "active") {
      const roleStatus = profile ? `${profile.role || "unknown"} / ${profile.account_status || "unknown"}` : "profile not found";
      const message = `Admin role check failed before database reader. Current profile: ${roleStatus}.`;
      const incident = {
        id: `db-admin-role-${Date.now()}`,
        title: "Database reader blocked by admin role check",
        category: "database",
        severity: "High",
        status: "Needs Admin Profile",
        affected: "Admin KaFarm -> Database Investigation",
        message: profileError ? `${message} ${profileError.message}` : message,
        evidence: ["profiles.auth_user_id", "profiles.role", "profiles.account_status"],
        proposedFix: "Confirm the logged-in user has profiles.role = admin and account_status = active.",
        safeRecovery: "Do not expose database snapshot to non-admin sessions.",
      } as KaFarmIncident;
      setDatabaseReaderStatus(message);
      setSelectedIncident(incident);
      setClientIncidents((current) => [incident, ...current].slice(0, 12));
      return;
    }

    const [snapshotResult, carePlanResult, incidentResult] = await Promise.all([
      supabase.rpc("kafarm_database_health_snapshot"),
      supabase.rpc("kafarm_care_plan_health_snapshot"),
      supabase
        .from("admin_kafarm_incident_queue")
        .select("id,title,category,severity,status,app_role,route,message,http_status,request_url,email,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);
    const { data, error } = snapshotResult;
    if (error) {
      const message = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ");
      const incident = {
        id: `db-reader-${Date.now()}`,
        title: "KaFarm database reader blocked",
        category: "Database",
        severity: /admin_required|401|403|permission|rls/i.test(message) ? "High" : "Medium",
        status: "Checking",
        affected: "Admin KaFarm -> Database Investigation",
        message: message || "Database reader failed.",
        evidence: ["kafarm_database_health_snapshot RPC", "admin session", "Supabase schema cache"],
        proposedFix: "Run SQL 022 and confirm admin login/RLS before production investigation.",
        safeRecovery: "Do not change data. Use read-only SQL verification until database reader works.",
      } as KaFarmIncident;
      setDatabaseReaderStatus(`Database reader blocked: ${message || "Unknown error"}`);
      setSelectedIncident(incident);
      setClientIncidents((current) => [incident, ...current].slice(0, 12));
      return;
    }
    const careHealth = carePlanResult.data as CarePlanHealthSnapshot | null;
    const careFindings: NonNullable<LiveDatabaseSnapshot["findings"]> = [];
    if (carePlanResult.error) {
      careFindings.push({
        severity: "High",
        title: "Care Plan health reader unavailable",
        meaning: carePlanResult.error.message,
        evidence: "kafarm_care_plan_health_snapshot RPC",
        next_action: "Apply and verify Care Plan migrations 058-062 before production use.",
      });
    } else if (careHealth) {
      if (Number(careHealth.catalog_days || 0) !== 180) careFindings.push({ severity: "High", title: "Care Plan mission catalog incomplete", meaning: `${Number(careHealth.catalog_days || 0)} of 180 days are installed.`, evidence: careHealth, next_action: "Apply migration 059 and rerun the reader." });
      if (Number(careHealth.active_supply_conversion_missing || 0) > 0) careFindings.push({ severity: "High", title: "Active Care Plan has unsafe feed conversion", meaning: "At least one active plan cannot convert inventory packs to exact kilograms.", evidence: careHealth, next_action: "Pause the affected plan and repair its verified supply requirement before another proof approval." });
      if (Number(careHealth.negative_inventory || 0) > 0) careFindings.push({ severity: "High", title: "Negative customer inventory detected", meaning: "An inventory balance is below zero.", evidence: careHealth, next_action: "Stop the affected approval flow and reconcile its immutable usage ledger." });
      if (Number(careHealth.overdue_missions || 0) > 0) careFindings.push({ severity: "Medium", title: "Overdue Care Plan missions need action", meaning: `${Number(careHealth.overdue_missions || 0)} mission(s) remain overdue.`, evidence: careHealth, next_action: "Open Care Plans, verify caretaker coverage, and resolve or reassign overdue work." });
      if (Number(careHealth.unreviewed_proofs || 0) > 0) careFindings.push({ severity: "Medium", title: "Care Plan proofs await admin review", meaning: `${Number(careHealth.unreviewed_proofs || 0)} proof(s) are pending.`, evidence: careHealth, next_action: "Review the full welfare checklist and exact feed usage in Task Verification." });
      if (Number(careHealth.pending_refunds || 0) > 0) careFindings.push({ severity: "Medium", title: "Care Plan refunds await evidence", meaning: `${Number(careHealth.pending_refunds || 0)} refund(s) are pending.`, evidence: careHealth, next_action: "Complete the external refund and record its reference on the Care Plan." });
      if (Number(careHealth.manual_expired_reservations || 0) > 0) careFindings.push({ severity: "Medium", title: "Manual-care inventory reservation expired", meaning: `${Number(careHealth.manual_expired_reservations || 0)} premium manual request(s) were not assigned before their stock hold expired.`, evidence: careHealth, next_action: "Ask the customer to submit a fresh request so current inventory can be checked and reserved again." });
      if (Number(careHealth.manual_unreviewed_proofs || 0) > 0) careFindings.push({ severity: "Medium", title: "Manual premium-care proofs await review", meaning: `${Number(careHealth.manual_unreviewed_proofs || 0)} caretaker proof(s) are pending.`, evidence: careHealth, next_action: "Review the same mission checklist, safety result, and actual inventory usage used by the paid Care Plan flow." });
      if (Number(careHealth.manual_consumed_without_usage || 0) > 0) careFindings.push({ severity: "High", title: "Manual-care deduction ledger mismatch", meaning: "A reservation is marked consumed without its immutable usage record.", evidence: careHealth, next_action: "Stop further approval for the affected request and reconcile its proof, reservation, and inventory ledger." });
      if (Number(careHealth.manual_approved_with_active_reservation || 0) > 0) careFindings.push({ severity: "High", title: "Approved manual-care proof did not close inventory reservation", meaning: "A proof is approved but its reserved stock is still active.", evidence: careHealth, next_action: "Inspect the guarded manual proof review RPC and reconcile the exact inventory equation before another approval." });
      if (Number(careHealth.paid_manual_open_conflicts || 0) > 0) careFindings.push({ severity: "High", title: "Paid and manual care overlap detected", meaning: "The same rooster has an open manual request while a paid automated Care Plan is active.", evidence: careHealth, next_action: "Do not assign duplicate work. Resolve the manual request and preserve only the paid automated mission path." });
    }
    const mergedSnapshot = {
      ...(data as LiveDatabaseSnapshot),
      findings: [...((data as LiveDatabaseSnapshot)?.findings || []), ...careFindings],
    };
    setDatabaseSnapshot(mergedSnapshot);
    if (!incidentResult.error) setInventoryIncidents(filterKaFarmIncidents((incidentResult.data || []) as DbIncident[]));
    const count = mergedSnapshot.findings.length;
    setDatabaseReaderStatus(count ? `Database reader found ${count} database finding(s).` : "Database reader found no database blockers.");
  }

  const runSelectedEngine = async () => {
    const effectiveTool: KaFarmToolKey = selectedTool || "production";
    if (!selectedTool) setSelectedTool(effectiveTool);
    await runDatabaseReader();
    if (issueFilter === "problems") {
      setProblemEngineRan(true);
      setSolutionEngineRan(false);
      setPanelActionNote(`Whole-app scan completed. Reports are ready below.`);
      return;
    }
    setProblemEngineRan(true);
    setSolutionEngineRan(true);
    setPanelActionNote(`Findings opened for ${selectedToolConfig?.title || "selected scope"}.`);
  };

  const copyProcedure = async () => {
    try {
      await navigator.clipboard.writeText(actionProcedure);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus("Copy"), 1200);
    } catch {
      setCopyStatus("Copy failed");
      window.setTimeout(() => setCopyStatus("Copy"), 1200);
    }
  };

  const copySimpleExplanation = async () => {
    try {
      await navigator.clipboard.writeText(simpleExplanation);
      setSimpleCopyStatus("Copied");
      window.setTimeout(() => setSimpleCopyStatus("Copy"), 1200);
    } catch {
      setSimpleCopyStatus("Copy failed");
      window.setTimeout(() => setSimpleCopyStatus("Copy"), 1200);
    }
  };

  const clearCapturedLogs = () => {
    window.localStorage.removeItem("farmconnect_kafarm_incidents");
    window.localStorage.removeItem("farmconnect_kafarm_incident_throttle");
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith("kafarm_throttle_"))
      .forEach((key) => window.sessionStorage.removeItem(key));
    setClientIncidents([]);
    setDatabaseSnapshot(null);
    setInventoryIncidents([]);
    setDatabaseReaderStatus("Database reader not run yet.");
    setPanelActionNote("Captured logs cleared. Choose a tool, then run Investigation again.");
    setSelectedIncident(monitoringIncidents[0]);
    setQuestion(initialCommand);
  };

  const submitKaFarmQuestion = () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const council = runKaFarmCouncil(trimmed, "admin");
    const result = analyzeKaFarmMessage(trimmed, "admin");
    setThread((current) => [
      ...current,
      { id: `admin-${Date.now()}`, role: "admin", body: trimmed },
      { id: `kafarm-${Date.now()}`, role: "kafarm", body: council.finalAnswer, risk: result.risk },
    ]);
    setQuestion("");
  };

  if (adminGate.status !== "allowed") {
    const isChecking = adminGate.status === "checking";
    const title = isChecking ? "Checking Admin Profile" : adminGate.status === "login_required" ? "Admin Login Required" : "Admin Profile Blocked";
    const message = isChecking ? "KaFarm is checking your admin session before opening system tools." : adminGate.message;

    return (
      <main className="min-h-screen bg-[linear-gradient(135deg,#eef8ec_0%,#f8f4df_52%,#e4f4ff_100%)] p-4 text-[#14241b]">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl items-center justify-center">
          <section className="w-full rounded-[28px] border border-white bg-white/90 p-6 shadow-xl shadow-[#163d8f]/10 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-3xl bg-[#eef8df] ring-4 ring-white">
                <img src={KAFARM_MASCOT} alt="KaFarm" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#1d7a45]">Admin protected area</p>
                <h1 className="text-3xl font-black text-[#0f3f2c]">{title}</h1>
                <p className="mt-2 text-sm font-bold text-[#637064]">{message}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4 text-sm font-bold text-[#425045]">
              KaFarm database reader, incident tools, and system reports are read-only but admin-only. Login muna with an active admin profile para hindi exposed sa customer/caretaker session.
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/" className="rounded-2xl bg-[#1d7a45] px-5 py-3 text-sm font-black text-white">Go To Login</Link>
              {!isChecking && <button onClick={logoutToHome} className="rounded-2xl bg-[#eee8d8] px-5 py-3 text-sm font-black text-[#14241b]">Logout / Switch Account</button>}
            </div>
          </section>
        </div>
      </main>
    );
  }

  const simpleReportView = true;
  if (simpleReportView) {
    return (
      <main className="min-h-screen bg-[linear-gradient(135deg,#eef8ec_0%,#f8f4df_52%,#e4f4ff_100%)] p-4 text-[#14241b]">
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#163d8f]/10 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-3xl bg-[#eef8df] ring-4 ring-white">
                  <img src={KAFARM_MASCOT} alt="KaFarm" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#1d7a45]">FarmConnect whole-app reader</p>
                  <h1 className="text-3xl font-black text-[#0f3f2c]">KaFarm Report</h1>
                  <p className="text-sm font-bold text-[#637064]">Pindutin ang Run. Lalabas ang dalawang report sa ibaba.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/kafarm/guardian" className="rounded-2xl bg-[#6b2fb8] px-5 py-4 text-xs font-black text-white shadow-md">Guardian</Link>
                <button
                  type="button"
                  data-kafarm-monitor-ignore="true"
                  onClick={runSelectedEngine}
                  className="rounded-2xl bg-[#f8c51c] px-8 py-4 text-base font-black text-[#14241b] shadow-lg transition hover:-translate-y-0.5"
                >
                  Run
                </button>
                <Link href="/admin/kafarm/whole-app-reader" className="rounded-2xl bg-[#163d8f] px-5 py-4 text-xs font-black text-white shadow-md">Whole-App Reader V2</Link>
                <Link href="/admin/kafarm/troubleshooting" className="rounded-2xl bg-[#9a6200] px-5 py-4 text-xs font-black text-white shadow-md">Troubleshooting</Link>
                <Link href="/admin" className="rounded-2xl bg-[#0f3f2c] px-5 py-4 text-xs font-black text-white shadow-md">Admin Home</Link>
              </div>
            </div>
            <p className="mt-4 rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] px-4 py-3 text-xs font-bold text-[#637064]">{databaseReaderStatus}</p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#163d8f]/10 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#0f3f2c]">Technical Report</h2>
                  <p className="text-xs font-bold text-[#637064]">I-copy at ipadala kay Buddy.</p>
                </div>
                <button type="button" data-kafarm-monitor-ignore="true" onClick={copyProcedure} className="rounded-2xl bg-[#163d8f] px-4 py-3 text-xs font-black text-white">{copyStatus}</button>
              </div>
              <textarea readOnly value={actionProcedure} className="mt-4 h-[62vh] min-h-96 w-full resize-none rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4 font-mono text-xs leading-5 text-[#14241b] outline-none" />
            </div>

            <div className="rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-[#1d7a45]/10 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#0f3f2c]">Simple Explanation</h2>
                  <p className="text-xs font-bold text-[#637064]">Quick explanation + teacher-style evidence justification.</p>
                </div>
                <button type="button" data-kafarm-monitor-ignore="true" onClick={copySimpleExplanation} className="rounded-2xl bg-[#1d7a45] px-4 py-3 text-xs font-black text-white">{simpleCopyStatus}</button>
              </div>
              <textarea readOnly value={simpleExplanation} className="mt-4 h-[62vh] min-h-96 w-full resize-none rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-5 text-base font-bold leading-8 text-[#14241b] outline-none" />
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#eef8ec_0%,#f8f4df_52%,#e4f4ff_100%)] p-4 text-[#14241b]">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-[28px] border border-white bg-white/85 p-4 shadow-xl shadow-[#163d8f]/10 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-3xl bg-[#eef8df] ring-4 ring-white">
                <img src={KAFARM_MASCOT} alt="KaFarm" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#1d7a45]">FarmConnect control helper</p>
                <h1 className="text-3xl font-black text-[#0f3f2c]">KaFarm Tools</h1>
                <p className="text-sm font-bold text-[#637064]">Pili muna ng tool para narrowed down agad ang issue.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/kafarm/whole-app-reader" className="rounded-2xl bg-[#163d8f] px-4 py-3 text-xs font-black text-white">Whole-App Reader V2</Link>
              <Link href="/admin" className="rounded-2xl bg-[#0f3f2c] px-4 py-3 text-xs font-black text-white">Admin Home</Link>
            </div>
          </div>
        </header>

        <section className={`rounded-[28px] border p-5 shadow-xl backdrop-blur-xl ${!databaseSnapshot ? "border-slate-200 bg-white/90" : confirmedInventoryModules.length ? "border-red-300 bg-red-50/95 shadow-red-900/10" : predictedInventoryModules.length ? "border-amber-300 bg-amber-50/95" : "border-emerald-300 bg-emerald-50/95 shadow-emerald-900/10"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#163d8f]">Predict, test, then confirm</p>
              <h2 className="mt-1 text-2xl font-black text-[#14241b]">Code Inventory ↔ Supabase Inventory</h2>
              <p className="mt-2 max-w-4xl text-sm font-bold leading-6 text-[#637064]">
                Kino-compare ang code requirements at live Supabase inventory para magbigay ng prediction. Hindi nito bina-block ang action: ituloy ang normal test, at magiging CONFIRMED lamang kapag may eksaktong live metadata o runtime/API evidence.
              </p>
            </div>
            <button
              type="button"
              data-kafarm-monitor-ignore="true"
              onClick={runDatabaseReader}
              className="rounded-2xl bg-[#163d8f] px-5 py-3 text-xs font-black text-white shadow-md"
            >
              Refresh Comparison
            </button>
          </div>

          {!databaseSnapshot ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm font-bold text-slate-600">
              Not checked yet. Click Refresh Comparison or run any investigation scope.
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-white/80 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Code modules</p><p className="mt-1 text-2xl font-black">{inventoryComparison.length}</p></div>
                <div className="rounded-2xl bg-white/80 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Live objects matched</p><p className="mt-1 text-2xl font-black">{inventoryComparison.reduce((sum, item) => sum + item.liveObjects.length, 0)}</p></div>
                <div className="rounded-2xl bg-white/80 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Predicted / test needed</p><p className="mt-1 text-2xl font-black text-amber-700">{inventoryComparison.reduce((sum, item) => sum + item.predictedObjects.length, 0)}</p></div>
                <div className="rounded-2xl bg-white/80 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Confirmed evidence</p><p className="mt-1 text-2xl font-black text-red-700">{inventoryComparison.reduce((sum, item) => sum + item.confirmedMissingObjects.length + item.activeErrors.length, 0)}</p></div>
              </div>

              <div className={`mt-4 rounded-2xl border p-4 ${confirmedInventoryModules.length ? "border-red-300 bg-red-100 text-red-950" : predictedInventoryModules.length ? "border-amber-300 bg-amber-100 text-amber-950" : "border-emerald-300 bg-emerald-100 text-emerald-950"}`}>
                <p className="text-lg font-black">
                  {confirmedInventoryModules.length
                    ? `CONFIRMED: ${confirmedInventoryModules.length} module(s) have exact supporting evidence.`
                    : predictedInventoryModules.length
                      ? `PREDICTED: Test ${predictedInventoryModules.length} affected module(s) to confirm or clear.`
                      : "CLEAR: No mismatch or runtime problem found in the current evidence."}
                </p>
                <p className="mt-1 text-xs font-bold">
                  Actions remain usable. KaFarm watches the actual test and only confirms an issue when the runtime/API result or authoritative live metadata supports it. Live snapshot: {databaseSnapshot.generated_at || "current admin read"}
                </p>
              </div>

              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {inventoryComparison.map((item) => (
                  <details key={item.module} open={item.status !== "CLEAR"} className={`rounded-2xl border bg-white/85 p-4 ${item.status === "CONFIRMED" ? "border-red-300" : item.status === "PREDICTED" ? "border-amber-300" : "border-emerald-200"}`}>
                    <summary className="cursor-pointer list-none text-sm font-black text-[#14241b]">
                      <span className={`mr-2 rounded-full px-2 py-1 text-[10px] ${item.status === "CONFIRMED" ? "bg-red-700 text-white" : item.status === "PREDICTED" ? "bg-amber-500 text-amber-950" : "bg-emerald-700 text-white"}`}>{item.status}</span>
                      {item.module}
                    </summary>
                    <p className="mt-3 text-xs font-bold text-[#637064]">Affected pages/actions: {item.pages}</p>
                    {item.predictedObjects.length ? <p className="mt-2 text-xs font-black text-amber-800">Prediction only — test required: {item.predictedObjects.join(", ")}</p> : null}
                    {item.confirmedMissingObjects.length ? <p className="mt-2 text-xs font-black text-red-800">Confirmed missing by live metadata: {item.confirmedMissingObjects.join(", ")}</p> : null}
                    {item.activeErrors.map((error, index) => (
                      <div key={`${error.title}-${index}`} className="mt-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-900">
                        <p>Runtime confirmed: {error.status ? `HTTP ${error.status} — ` : ""}{error.title}</p>
                        <p className="mt-1">Route: {error.route}</p>
                        <p className="mt-1 break-words">{error.message}</p>
                      </div>
                    ))}
                    {!item.predictedObjects.length && !item.confirmedMissingObjects.length && !item.activeErrors.length ? <p className="mt-2 text-xs font-bold text-emerald-800">No mismatch or runtime problem found from the current evidence.</p> : null}
                  </details>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-[28px] border border-white bg-white/85 p-4 shadow-xl shadow-[#1d7a45]/10 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#0f3f2c]">1. Choose Tool</h2>
              <p className="text-xs font-bold text-[#637064]">Database, system, role, flow, or production error.</p>
            </div>
            <span className="rounded-full bg-[#e8fff2] px-3 py-1 text-[10px] font-black uppercase text-[#1d7a45]">{selectedToolConfig ? selectedToolConfig.label : "No scope selected"}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            {kaFarmTools.map((tool) => (
              <button
                key={tool.key}
                data-kafarm-monitor-ignore="true"
                onClick={() => selectToolFilter(tool.key)}
                className={"rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md " + (selectedTool === tool.key ? "border-[#1d7a45] bg-[#e8fff2] shadow-md" : "border-[#dbe6d7] bg-[#fbfbf6]")}
              >
                <p className="text-sm font-black text-[#14241b]">{tool.title}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-[#1d7a45]">{tool.label}</p>
                <p className="mt-2 line-clamp-3 text-xs font-bold leading-5 text-[#637064]">{tool.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[28px] border border-white bg-white/85 p-4 shadow-lg shadow-[#163d8f]/10 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#0f3f2c]">2A. Investigation</h2>
                <p className="text-xs font-bold text-[#637064]">Preventive whole-app guard. Lalabas lang ang possible blocker bago maging user problem.</p>
              </div>
              <div className="flex rounded-2xl bg-[#f4f1e6] p-1">
                <button
                  data-kafarm-monitor-ignore="true"
                  onClick={() => {
                    setIssueFilter("problems");
                    setPanelActionNote(selectedTool ? `Investigation view opened for ${selectedToolConfig?.title}. Click Run to refresh checks.` : "Choose a tool first, then run Investigation.");
                  }}
                  className={"rounded-xl px-3 py-2 text-xs font-black " + (issueFilter === "problems" ? "bg-[#1d7a45] text-white" : "text-[#637064]")}
                >
                  Investigation
                </button>
                <button
                  data-kafarm-monitor-ignore="true"
                  onClick={() => {
                    setIssueFilter("solutions");
                    setSolutionEngineRan(Boolean(selectedTool));
                    setPanelActionNote(selectedTool ? `Findings panel opened for ${selectedToolConfig?.title}.` : "Choose a tool first, then Findings will show the result summary.");
                  }}
                  className={"rounded-xl px-3 py-2 text-xs font-black " + (issueFilter === "solutions" ? "bg-[#163d8f] text-white" : "text-[#637064]")}
                >
                  Findings
                </button>
                <button data-kafarm-monitor-ignore="true" onClick={runSelectedEngine} className="rounded-xl bg-[#f8c51c] px-5 py-2 text-xs font-black text-[#14241b]">Run Whole App</button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-[#dbe6d7] bg-white/80 px-4 py-3 text-xs font-black text-[#0f3f2c]">
              {panelActionNote}
            </div>

            {selectedTool && problemEngineRan ? (
              <div className={"mt-4 rounded-2xl border px-4 py-3 text-sm font-black " + (toolFindings.length ? "border-[#ffd28c] bg-[#fff8d7] text-[#8a5100]" : "border-[#bfe8cd] bg-[#e8fff2] text-[#0f5a33]")}>
                {toolFindings.length
                  ? `${toolFindings.length} finding(s) found for ${selectedToolConfig?.title}. Open the line below or copy the report.`
                  : `Safe: no ${selectedToolConfig?.title.toLowerCase()} blockers detected in captured app signals.`}
                {selectedTool === "database" ? <span className="ml-2 text-xs font-bold text-[#637064]">{databaseReaderStatus}</span> : null}
              </div>
            ) : null}

            {!selectedTool || !problemEngineRan ? (
              <div className="mt-4 flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-[#cfdcc9] bg-[#fbfbf6] p-6 text-center">
                <div>
                  <p className="text-lg font-black text-[#0f3f2c]">Blank muna</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#637064]">Pindutin ang Run Whole App. Babasahin ni KaFarm ang app at Supabase, tapos ilalagay ang dalawang output sa Report Boxes sa ibaba.</p>
                </div>
              </div>
            ) : selectedTool === "production" ? (
              <div className="mt-4 max-h-[520px] overflow-y-auto rounded-2xl bg-[#fbfbf6] p-4 pr-2 text-sm font-bold leading-7 text-[#14241b]">
                <p className="mb-3 text-lg font-black text-[#0f3f2c]">Problem Status: ✅ / ❌ / N/A</p>
                {toolFindings.length ? toolFindings.map((finding, index) => {
                  const itemNumber = productionChecklist.indexOf(finding.item) + 1;
                  return (
                    <div key={`${finding.item}-${finding.incident?.id || index}`} className="border-b border-[#e1ead9] py-3 last:border-b-0">
                      <p className="font-black">{itemNumber}. {finding.item} — ❌</p>
                      <p className="text-xs text-[#637064]">Evidence: {finding.evidence}</p>
                      <p className="text-xs text-[#637064]">Finding: {finding.finding}</p>
                      <div className="mt-2 rounded-xl bg-white p-3">
                        <p className="text-xs font-black uppercase text-[#9a6200]">Root Cause Investigation</p>
                        <div className="mt-2 space-y-1">
                          {finding.rootCause.map((line: string) => (
                            <p key={line} className="text-xs text-[#637064]">{line}</p>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-[#637064]">Next action: {finding.nextAction}</p>
                    </div>
                  );
                }) : (
                  <div className="py-8 text-center">
                  <p className="font-black text-[#0f3f2c]">Safe: no production blockers detected.</p>
                    <p className="mt-2 text-xs text-[#637064]">Walang lalabas dito kapag walang detected error sa 1-12 checks.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 max-h-[520px] overflow-y-auto rounded-2xl bg-[#fbfbf6] p-4 pr-2 text-sm leading-7 text-[#14241b]">
                <p className="font-black">{selectedToolConfig?.title} investigation</p>
                <p className="mb-3 text-xs font-bold text-[#637064]">Walang lalabas kapag walang detected risk. Click a line only if a finding appears.</p>
                {selectedTool === "database" && <p className="mb-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#1d7a45]">{databaseReaderStatus}</p>}
                {toolFindings.length ? toolFindings.map((finding, index) => (
                  <button
                    key={`${finding.item}-${index}`}
                    data-kafarm-monitor-ignore="true"
                    onClick={() => {
                      const incident = finding.incident;
                      if (!incident) return;
                      setSelectedIncident(incident);
                      setDecision("pending");
                      setQuestion(`KaFarm, check this incident: ${incident.title}`);
                    }}
                    className="block w-full border-b border-[#e1ead9] py-3 text-left text-[#14241b] transition last:border-b-0 hover:bg-white/70"
                  >
                    <p className="font-black">{index + 1}. {finding.item} <span className="text-xs uppercase text-[#9a6200]">Needs check</span></p>
                    <p className="text-xs font-bold text-[#637064]">Evidence: {finding.evidence}</p>
                    <p className="text-xs font-bold text-[#637064]">Finding: {issueFilter === "problems" ? finding.finding : finding.nextAction}</p>
                    {issueFilter === "problems" ? (
                      <div className="mt-2 rounded-xl bg-white p-3">
                        <p className="text-[10px] font-black uppercase text-[#9a6200]">Root Cause Investigation</p>
                        <div className="mt-2 space-y-1">
                          {finding.rootCause.map((line: string) => (
                            <p key={line} className="text-xs font-bold text-[#637064]">{line}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </button>
                )) : (
                  <div className="py-8 text-center">
                    <p className="font-black text-[#0f3f2c]">Safe: no {(selectedToolConfig?.title || "selected tool").toLowerCase()} blockers detected.</p>
                    <p className="mt-2 text-xs font-bold text-[#637064]">Walang lalabas dito kapag walang detected risk.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white bg-white/85 p-4 shadow-lg shadow-[#1d7a45]/10 backdrop-blur-xl">
            <h2 className="text-xl font-black text-[#0f3f2c]">2B. Findings / Risks</h2>
            <p className="text-xs font-bold text-[#637064]">Summary ng nakita sa investigation. Hindi muna auto-fix.</p>
            {!selectedTool || !solutionEngineRan ? (
              <div className="mt-4 flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-[#cfdcc9] bg-[#fbfbf6] p-6 text-center">
                <div>
                  <p className="text-lg font-black text-[#0f3f2c]">Blank muna</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#637064]">Kapag may selected scope na, pindutin ang Findings para makita ang risk, meaning, at next safe action.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-3">
                  {toolFindings.length ? toolFindings.slice(0, 6).map((finding, index) => (
                    <div key={`${finding.item}-${index}`} className="rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4">
                      <p className="text-sm font-black text-[#14241b]">{index + 1}. {humanizeKaFarmFinding(finding.finding)}</p>
                      <p className="mt-2 text-xs font-bold leading-5 text-[#637064]">Affected: {finding.incident?.affected || selectedToolConfig?.description}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[#637064]">Next: {finding.nextAction}</p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4 text-center">
                      <p className="text-sm font-black text-[#0f3f2c]">No findings for this scope.</p>
                      <p className="mt-2 text-xs font-bold leading-5 text-[#637064]">Ready for manual test sa selected area.</p>
                    </div>
                  )}
                </div>

                {toolFindings.length ? (
                  <div className="mt-4 rounded-2xl border border-[#f6da76] bg-[#fff8d7] p-4">
                    <p className="text-xs font-black uppercase text-[#9a6200]">Selected investigation anchor</p>
                    <p className="mt-1 text-lg font-black text-[#14241b]">{selectedIncident.title}</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#6f4b00]">{selectedIncident.safeRecovery}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[28px] border border-white bg-white/85 p-4 shadow-xl shadow-[#163d8f]/10 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#0f3f2c]">3A. Buddy Technical Report</h2>
                <p className="text-xs font-bold text-[#637064]">Kumpletong technical output. I-copy at ipadala kay Buddy.</p>
              </div>
              <div className="flex gap-2">
                <button data-kafarm-monitor-ignore="true" onClick={copyProcedure} className="rounded-2xl bg-[#163d8f] px-4 py-3 text-xs font-black text-white">{copyStatus}</button>
                <button data-kafarm-monitor-ignore="true" onClick={clearCapturedLogs} className="rounded-2xl bg-[#f4f1e6] px-4 py-3 text-xs font-black text-[#14241b]">Clear Logs</button>
              </div>
            </div>
            <textarea readOnly value={actionProcedure} className="mt-4 h-80 w-full rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4 font-mono text-xs leading-5 text-[#14241b] outline-none" />
          </div>

          <div className="rounded-[28px] border border-white bg-white/85 p-4 shadow-lg shadow-[#1d7a45]/10 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-[#0f3f2c]">3B. Simple Explanation</h3>
                <p className="mt-1 text-xs font-bold text-[#637064]">Madaling basahin: ano ang nakita at ano ang susunod na gagawin.</p>
              </div>
              <button data-kafarm-monitor-ignore="true" onClick={copySimpleExplanation} className="rounded-2xl bg-[#1d7a45] px-4 py-3 text-xs font-black text-white">{simpleCopyStatus}</button>
            </div>
            <textarea readOnly value={simpleExplanation} className="mt-4 h-80 w-full rounded-2xl border border-[#dbe6d7] bg-[#fbfbf6] p-4 text-base font-bold leading-7 text-[#14241b] outline-none" />
          </div>
        </section>
      </div>
    </main>
  );
}
type KaFarmIncident = (typeof monitoringIncidents)[number];
type RootCauseCandidate = {
  cause: string;
  whyPossible: string;
  confirmBy: string;
  notProvenYet: string;
};

function getRootCauseInvestigation(incident: KaFarmIncident): RootCauseCandidate[] {
  const requestUrl = "requestUrl" in incident && typeof incident.requestUrl === "string" ? incident.requestUrl : "";
  const text = `${incident.title} ${incident.category} ${incident.status} ${incident.message} ${requestUrl}`.toLowerCase();
  const candidates: RootCauseCandidate[] = [];

  if (/admin role check|admin session|admin login|needs admin profile|needs admin login|profile not found|current profile/.test(text)) {
    candidates.push(
      {
        cause: "Logged-in account is not an active admin profile",
        whyPossible: "KaFarm database reader is admin-only, so it must see profiles.role = admin and account_status = active for the current auth user.",
        confirmBy: "Login again as admin, then verify the current auth user has a matching profiles.auth_user_id row with role admin and active status.",
        notProvenYet: "If the profile is already admin/active, the remaining cause is likely stale browser session or profile SELECT policy.",
      },
      {
        cause: "Browser session is stale or using a different account",
        whyPossible: "The page can remain open after switching accounts, but Supabase auth may still point to an old customer/caretaker/anon session.",
        confirmBy: "Logout, login as admin again, hard refresh /admin/kafarm, clear logs, then rerun Database investigation.",
        notProvenYet: "Need fresh session evidence before changing database policies.",
      },
      {
        cause: "Profile read policy blocks the preflight check",
        whyPossible: "KaFarm checks profiles.role/account_status before calling the admin-only RPC. If profiles SELECT policy blocks this user, the reader stops safely.",
        confirmBy: "Check profiles SELECT policy for authenticated admin/self read and confirm is_admin()/current_profile_id() behavior.",
        notProvenYet: "Do not weaken profile policies until the exact current user/profile row is confirmed.",
      },
    );
    return candidates;
  }

  if (/button click produced no visible action|no visible action|button|click/.test(text)) {
    candidates.push(
      {
        cause: "Missing or blocked button handler",
        whyPossible: "KaFarm saw a click but no route change, modal, or visible page update after the click.",
        confirmBy: "Inspect the clicked component and check if onClick, form submit, or router action is actually wired.",
        notProvenYet: "It can still be valid if the button only triggers hidden validation or a delayed API response.",
      },
      {
        cause: "Validation or disabled-state mismatch",
        whyPossible: "The UI may look clickable but form validation or disabled logic may silently stop the action.",
        confirmBy: "Check required fields, disabled props, aria-disabled, form validity, and validation messages.",
        notProvenYet: "Need exact field state and click steps before declaring this the root cause.",
      },
      {
        cause: "Overlay or modal is eating the click",
        whyPossible: "A high z-index overlay/backdrop can block interaction even when the button is visible.",
        confirmBy: "Run overlay checker and inspect pointer-events, z-index, modal/backdrop state.",
        notProvenYet: "If no overlay is detected, remove this from root cause list.",
      },
    );
  }

  if (/route did not open|404|not found|route/.test(text)) {
    candidates.push(
      {
        cause: "Missing or wrong route path",
        whyPossible: "The clicked link expected a route but the app stayed on the same page or returned not found.",
        confirmBy: "Compare href/router.push path with the actual Next.js app route file and deployed route list.",
        notProvenYet: "Could also be blocked by auth guard or preventDefault, so route file alone is not enough.",
      },
      {
        cause: "Auth/role guard redirected or blocked navigation",
        whyPossible: "Protected admin/customer/caretaker pages can deny route access if session role is wrong.",
        confirmBy: "Check current profile role, auth session, route guard, and expected destination role.",
        notProvenYet: "Need session/role evidence before saying guard is the root cause.",
      },
    );
  }

  if (/401|403|unauthorized|forbidden|access denied|permission|rls/.test(text)) {
    candidates.push(
      {
        cause: "RLS or policy blocked the request",
        whyPossible: "Unauthorized/access-denied errors usually happen when Supabase policy does not allow the role/action.",
        confirmBy: "Check table policy, RPC security definer, current_profile_id(), is_admin(), and authenticated role.",
        notProvenYet: "Could also be expired auth session or wrong user role, so policy output is required.",
      },
      {
        cause: "Wrong or missing logged-in profile",
        whyPossible: "The app may have auth.user but no matching profiles row or wrong role.",
        confirmBy: "Check profiles.auth_user_id, role, account_status, and route being opened.",
        notProvenYet: "Do not expose private data; only verify IDs/status needed for debugging.",
      },
    );
  }

  if (/post code error|post error|api|rpc|400|409|422|429|500|502|503|failed api|request failed/.test(text)) {
    candidates.push(
      {
        cause: "Invalid API/RPC payload",
        whyPossible: "POST/RPC errors can happen when required fields are missing, wrong type, or malformed.",
        confirmBy: "Compare submitted payload with function arguments/table constraints and browser network request.",
        notProvenYet: "Need exact request body/status before changing backend code.",
      },
      {
        cause: "Backend function/table relationship mismatch",
        whyPossible: "A working UI can still fail if the function expects a missing table/column or old schema.",
        confirmBy: "Run read-only SQL audit for function, table, columns, constraints, and RLS.",
        notProvenYet: "Do not run fix SQL until the missing object is confirmed.",
      },
    );
  }

  if (/storage|quota|upload|file|media|image/.test(text)) {
    candidates.push(
      {
        cause: "File stored in the wrong place or too large for browser storage",
        whyPossible: "Receipt/proof uploads can fail when base64/localStorage is used instead of storage URL.",
        confirmBy: "Check whether upload goes to Supabase Storage and DB saves only URL/metadata.",
        notProvenYet: "Need file size, bucket/policy, and DB record check.",
      },
      {
        cause: "Storage bucket or policy blocks upload/read",
        whyPossible: "A file can upload fail or preview fail if bucket policy does not match user role.",
        confirmBy: "Check storage bucket, object path, upload policy, read policy, and linked DB record.",
        notProvenYet: "Could be UI preview issue if file exists but image URL is wrong.",
      },
    );
  }

  if (/overlay|blocking overlay|blocked/.test(text)) {
    candidates.push(
      {
        cause: "Stuck modal/backdrop/loading layer",
        whyPossible: "KaFarm detected a high-layer element that may cover the active page.",
        confirmBy: "Inspect element z-index, pointer-events, visibility, modal state, and close/back action.",
        notProvenYet: "Some overlays are valid while loading or confirming sensitive actions.",
      },
    );
  }

  if (/performance|slow|timeout|traffic/.test(text)) {
    candidates.push(
      {
        cause: "Heavy page assets or repeated client renders",
        whyPossible: "Slow timing can be caused by large images/backgrounds, too much client JS, or rerender loops.",
        confirmBy: "Check Network/Performance tab, image sizes, repeated state updates, and bundle size.",
        notProvenYet: "Need timing breakdown before optimizing code.",
      },
      {
        cause: "Slow API/RPC blocking the page",
        whyPossible: "A page can look slow when it waits for Supabase/API responses before rendering usable UI.",
        confirmBy: "Check failed/slow fetch incidents and route-level loading state.",
        notProvenYet: "If network is fast, root cause is more likely UI rendering/assets.",
      },
    );
  }

  if (/runtime|fatal|system error|stop error|crash|exception/.test(text)) {
    candidates.push(
      {
        cause: "Frontend runtime crash",
        whyPossible: "Runtime/fatal errors commonly happen from undefined data, bad imports, or component state mismatch.",
        confirmBy: "Check stack trace, component line, props/state, and whether DB data shape changed.",
        notProvenYet: "Need the exact stack/file line before editing.",
      },
      {
        cause: "Client/server hydration or environment mismatch",
        whyPossible: "Next.js pages can fail when browser-only code runs during server render or env variables are missing.",
        confirmBy: "Check server/client boundary, useEffect usage, env values, and production build logs.",
        notProvenYet: "If it only happens after click, it may be handler/payload instead.",
      },
    );
  }

  if (!candidates.length) {
    candidates.push(
      {
        cause: "Unknown until evidence is collected",
        whyPossible: "The incident has limited data, so KaFarm should not guess a single cause.",
        confirmBy: "Collect route, role, exact action, console output, API status, DB/RLS result, and screenshot.",
        notProvenYet: "No root cause is proven until one candidate is confirmed by evidence.",
      },
      {
        cause: "Frontend/backend/database boundary issue",
        whyPossible: "Most app blockers come from UI handler, API/RPC, permission, or missing linked record.",
        confirmBy: "Trace expected flow from button -> route/API -> DB record -> user-visible result.",
        notProvenYet: "Need step-by-step reproduction first.",
      },
    );
  }

  return candidates.slice(0, 5);
}

function formatRootCauseLines(incident: KaFarmIncident) {
  return getRootCauseInvestigation(incident).flatMap((candidate, index) => [
    `${index + 1}. Possible cause: ${candidate.cause}`,
    `   Why possible: ${candidate.whyPossible}`,
    `   Confirm by: ${candidate.confirmBy}`,
    `   Not proven yet: ${candidate.notProvenYet}`,
  ]);
}

function InfoBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
      <h4 className="text-sm font-black uppercase text-[#163d8f]">{title}</h4>
      <div className="mt-3 space-y-2">
        {lines.map((line) => (
          <div key={line} className="rounded-xl bg-[#f8fbf5] px-3 py-2 text-xs font-bold leading-5 text-[#4d5d76]">{line}</div>
        ))}
      </div>
    </div>
  );
}

function buildKaFarmRepairReport(
  incident: KaFarmIncident,
  analysis: ReturnType<typeof analyzeKaFarmMessage>,
  decision: "pending" | "approved" | "rejected",
  adminNote: string,
) {
  return [
    "FarmConnect KaFarm Repair Report",
    "",
    `Status: ${decision === "pending" ? "Waiting for admin approve/reject" : decision === "approved" ? "Approved by admin" : "Rejected by admin"}`,
    `Incident ID: ${incident.id}`,
    `Issue Type: ${incident.category}`,
    `Severity: ${incident.severity}`,
    `Affected: ${incident.affected}`,
    "",
    "What Happened:",
    incident.message,
    "",
    "KaFarm Analysis:",
    `Intent: ${analysis.intent}`,
    `Risk: ${analysis.risk}`,
    `Needs Admin: ${analysis.needsAdmin ? "yes" : "no"}`,
    analysis.reply,
    "",
    "Evidence Needed:",
    ...incident.evidence.map((item) => `- ${item}`),
    "",
    "Root Cause Investigation:",
    ...formatRootCauseLines(incident),
    "",
    "Proposed Fix:",
    incident.proposedFix,
    "",
    "Safe Temporary Recovery:",
    incident.safeRecovery,
    "",
    "Admin Note / Rejection Reason:",
    adminNote || "None yet.",
    "",
    "KaFarm Rule:",
    "Do not move money, approve KYC, reset PIN, release withdrawal, mark fraud, change ownership, or delete sensitive records without admin approval.",
    "",
    "Next For Buddy If Needed:",
    "Check affected route, button handler, API/RPC, RLS policy, evidence log, and linked customer/caretaker/admin records.",
  ].join("\n");
}

function buildKaFarmActionProcedure(
  tool: { key: KaFarmToolKey; title: string; label: string; description: string },
  incident: KaFarmIncident,
  decision: "pending" | "approved" | "rejected",
  adminNote: string,
) {
  const status = decision === "pending" ? "Waiting for admin decision" : decision === "approved" ? "Approved by admin" : "Rejected by admin";
  const lines = [
    "FarmConnect KaFarm Procedure Report",
    "",
    `Tool: ${tool.title}`,
    `Mode: ${tool.label}`,
    `Status: ${status}`,
    `Incident: ${incident.id} - ${incident.title}`,
    `Affected: ${incident.affected}`,
    "",
    "Step-by-step procedure:",
    "1. Confirm affected role, page, account, and exact action.",
    "2. Collect evidence first before any fix.",
    "3. Check if this is frontend, backend, database, permission, or production-only.",
    "4. Apply only safe temporary recovery while checking.",
    "5. If admin approves, continue controlled fix/testing.",
    "6. If admin rejects or issue is unclear, send this report to Buddy.",
    "",
    "Evidence needed:",
    ...incident.evidence.map((item) => `- ${item}`),
    "",
    "Root cause investigation:",
    ...formatRootCauseLines(incident),
    "",
    "What KaFarm can do:",
    "- organize issue",
    "- create checklist",
    "- prepare SQL/read-only checks",
    "- prepare Buddy report",
    "- guide admin decision",
    "",
    "What KaFarm must not do alone:",
    "- move money",
    "- approve/reject KYC",
    "- release withdrawal",
    "- reset/reveal password or PIN",
    "- delete sensitive records",
    "",
    "Consequence if approved:",
    "KaFarm will continue the safe check/fix path and produce evidence or next SQL/code instruction.",
    "",
    "Consequence if rejected:",
    "No change is applied. Send this report to Buddy for external code/database review.",
    "",
    "Affected pages / records:",
    `- ${tool.description}`,
    `- ${incident.affected}`,
    "",
    "Possible outcome:",
    "Pros: clearer evidence, less guessing, safer fix path, easier Buddy handoff.",
    "Cons: slower than direct fixing because sensitive actions need admin approval first.",
    "",
    "Admin note:",
    adminNote || "None.",
  ];

  if (tool.key === "production") {
    lines.push("", "Production Error Checklist:");
    productionChecklist.forEach((item, index) => {
      lines.push("", `${index + 1}. ${item} — ✅ / ❌ / N/A`, "Evidence:", "Finding:", "Next action:");
    });
  }

  return lines.join("\n");
}

function humanizeKaFarmFinding(finding: string) {
  const text = finding || "Possible blocker detected.";
  if (/admin role check|admin login\/session required|needs admin session|needs admin profile|current profile/i.test(text)) {
    return "KaFarm Database reader is protected. Kailangan naka-login ang current browser session sa active admin profile bago siya makabasa ng database snapshot.";
  }
  if (/schema cache|could not find the function|pgrst202/i.test(text)) {
    return "May SQL/RPC na hindi pa nakikita ng app, kaya pwedeng hindi masave ang request sa database.";
  }
  if (/401|403|unauthorized|permission|rls|access denied/i.test(text)) {
    return "May permission/RLS blocker, kaya pwedeng hindi mabasa o maisulat ng tamang role ang data.";
  }
  if (/404|not found/i.test(text)) {
    return "May route/API na hindi nahanap, kaya pwedeng may maling path o hindi deployed na function/page.";
  }
  if (/duplicate key|same key|non-unique keys/i.test(text)) {
    return "May duplicate UI key, kaya pwedeng magdoble, mawala, o mali ang render ng list.";
  }
  if (/runtime|referenceerror|typeerror|cannot read|undefined|null/i.test(text)) {
    return "May frontend runtime risk, kaya pwedeng mag-crash ang page kapag may kulang o maling data.";
  }
  if (/payment|wallet|withdraw|receipt|invoice/i.test(text)) {
    return "May money-flow risk, kaya kailangan i-check ang receipt, invoice, approval, at evidence trail.";
  }
  if (/caretaker|application|task|proof|resume|selfie/i.test(text)) {
    return "May caretaker-flow risk, kaya kailangan i-check signup, verification, task assignment, proof, at approval.";
  }
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function buildWholeAppInvestigationReport(
  tool: { key: KaFarmToolKey; title: string; label: string; description: string },
  findings: ReturnType<typeof getKaFarmToolFindings>,
  allIncidents: KaFarmIncident[],
  selectedIncident: KaFarmIncident,
  decision: "pending" | "approved" | "rejected",
  adminNote: string,
) {
  const status = decision === "pending" ? "Investigation only / waiting admin decision" : decision === "approved" ? "Admin approved next safe action" : "Admin rejected / send to Buddy";
  const scopedFindings = findings.slice(0, 12);
  const severityRank: Record<string, number> = { Critical: 1, High: 2, Medium: 3, Low: 4 };
  const templateIds = new Set(monitoringIncidents.map((incident) => incident.id));
  const scopedIncidents = scopedFindings.map((finding) => finding.incident).filter(Boolean) as KaFarmIncident[];
  const currentIncidents = allIncidents.filter((incident) => !templateIds.has(incident.id) && !isIgnoredKaFarmIncident(incident));
  const topIncidents = [...(scopedIncidents.length ? scopedIncidents : currentIncidents)]
    .sort((a, b) => (severityRank[a.severity] || 9) - (severityRank[b.severity] || 9))
    .slice(0, 8);
  const anchorIncident = scopedIncidents[0] || topIncidents[0] || selectedIncident;

  const lines = [
    "FarmConnect KaFarm Whole-App Investigation Report",
    "",
    `Scope: ${tool.title}`,
    `Mode: ${tool.label}`,
    `Status: ${status}`,
    `Generated For: Buddy/code-SQL review`,
    "",
    "Goal:",
    "Prevent user-facing problems by checking the existing app, routes, Supabase/RPC/RLS, role flows, evidence logs, and deployment behavior before manual/live testing.",
    "",
    "Simple Summary:",
    scopedFindings.length
      ? `${scopedFindings.length} possible blocker/risk item(s) found in this scope. Fix or confirm these before saying the app is ready for manual/live test.`
      : "No blockers detected in this scope from currently captured incidents. Ready for manual test, then run investigation again after testing.",
    "",
    "What KaFarm Checked Conceptually:",
    "- Functional behavior",
    "- Logic and workflow",
    "- Customer/Admin/Caretaker bridges",
    "- System-level integration",
    "- Database tables/functions/RLS/policies",
    "- API/RPC calls",
    "- Authentication and authorization",
    "- Validation and error handling",
    "- Payment/transaction and evidence trail",
    "- UI/visual, usability, state/session, performance, deployment, and regression risks",
    "",
    "Findings / Risks:",
  ];

  if (!scopedFindings.length) {
    lines.push("- No findings shown. If manual test finds an issue, use Problem mode and paste exact screenshot/error.");
  } else {
    scopedFindings.forEach((finding, index) => {
      lines.push(
        "",
        `${index + 1}. ${finding.item}`,
        `Meaning: ${humanizeKaFarmFinding(finding.finding)}`,
        `Affected: ${finding.incident?.affected || tool.description}`,
        `Evidence: ${finding.evidence}`,
        "Root cause candidates:",
        ...finding.rootCause.map((line: string) => `- ${line}`),
        `Next safe action: ${finding.nextAction}`,
      );
    });
  }

  if (scopedFindings.length) {
    lines.push(
      "",
      "Highest Priority Incidents In Queue:",
      ...topIncidents.map((incident, index) => `${index + 1}. [${incident.severity}] ${incident.title} / ${incident.affected}`),
      "",
      "Selected Anchor Incident:",
      `${anchorIncident.id} - ${anchorIncident.title}`,
      anchorIncident.message,
      "",
      "Admin Note:",
      adminNote || "None.",
    );
  }

  lines.push(
    "",
    "Rules:",
    "- KaFarm investigates and reports first.",
    "- No wallet movement, KYC decision, withdrawal release, PIN reset, account lock, fraud marking, ownership change, or sensitive delete without admin approval.",
    "- If approved, fix safely then rerun investigation.",
    "- If rejected/unclear, send this report to Buddy.",
    "",
    "Next Loop:",
    "Run Investigation -> fix every finding -> Run Investigation again -> Manual test -> log Problem if user sees issue -> fix -> Run Investigation again -> Live test.",
  );

  return lines.join("\n");
}

function getKaFarmDatabaseSnapshotFindings(snapshot: any) {
  const findings = Array.isArray(snapshot?.findings) ? snapshot.findings : [];
  const missingObjects = Array.isArray(snapshot?.missing_objects) ? snapshot.missing_objects : [];
  const rlsReview = Array.isArray(snapshot?.rls_review) ? snapshot.rls_review : [];
  const generated = snapshot?.generated_at ? `Generated ${snapshot.generated_at}` : "Generated by KaFarm database reader";

  const output = findings.map((finding: any, index: number) => {
    const title = finding?.title || `Database finding ${index + 1}`;
    const evidence = finding?.evidence ? JSON.stringify(finding.evidence).slice(0, 1200) : "database reader snapshot";
    return {
      item: title,
      evidence,
      finding: finding?.meaning || title,
      rootCause: [
        `1. Possible cause: ${title}`,
        `   Why possible: ${finding?.meaning || "KaFarm database reader found this from live metadata."}`,
        `   Confirm by: Review SQL 022 snapshot evidence and compare with database/applied files.`,
        "   Not proven yet: Confirm live Supabase output before changing SQL/code.",
      ],
      nextAction: finding?.next_action || "Confirm with read-only SQL, then ask admin before any fix.",
      incident: {
        id: `db-snapshot-${index}`,
        title,
        category: "Database",
        severity: finding?.severity || "Medium",
        status: "Checking",
        affected: "Supabase database / app backend wiring",
        message: finding?.meaning || title,
        evidence: [generated, evidence],
        proposedFix: finding?.next_action || "Prepare SQL/code fix after admin approval.",
        safeRecovery: "Keep feature in review/manual testing until this finding is cleared.",
      } as KaFarmIncident,
    };
  });

  if (!output.length && (missingObjects.length || rlsReview.length)) {
    output.push({
      item: "Database reader returned review items",
      evidence: JSON.stringify({ missingObjects, rlsReview }).slice(0, 1200),
      finding: "May database review items na kailangan i-confirm before production.",
      rootCause: [
        "1. Possible cause: schema/RLS mismatch",
        "   Why possible: Snapshot returned missing or policy review items.",
        "   Confirm by: Open Database Health details and compare with expected app flow.",
        "   Not proven yet: Some tables may be intentionally internal or admin-only.",
      ],
      nextAction: "Review snapshot output, then only fix confirmed missing objects/policies.",
      incident: monitoringIncidents[0],
    });
  }

  return output;
}

function getKaFarmToolFindings(tool: KaFarmToolKey, incidents: KaFarmIncident[]) {
  const keywords: Record<KaFarmToolKey, RegExp> = {
    database: /database|db|sql|rls|rpc|relation|schema|policy|supabase|unauthorized|access denied|permission|401|403/i,
    system: /system|runtime|fatal|stop|browser|access denied|permission|http|post code|post error|button|click|route|blank|overlay|blocked|performance|slow|404|500|error|failed|failure|crash|frontend|api|rpc/i,
    customer: /customer|client|wallet|payment|cash|withdraw|kyc|farm buy|inventory|inbox|support/i,
    caretaker: /caretaker|task|proof|qr|upload|resume|selfie|worker|backjob/i,
    admin: /admin|approve|reject|decision|invoice|evidence|verification/i,
    flow: /flow|customer.*admin|admin.*caretaker|caretaker.*customer|request|assignment|linked|bridge/i,
    production: /production|vercel|deploy|live|environment|env|browser|session|access denied|permission|http|post code|post error|webhook|storage|traffic|performance|slow|runtime|fatal|stop|overlay|button|click|route|scheduled|error|failed|failure|404|500/i,
  };

  return incidents
    .filter((incident) => !isIgnoredKaFarmIncident(incident))
    .filter((incident) => {
      const haystack = `${incident.title} ${incident.category} ${incident.affected} ${incident.message} ${incident.status}`;
      return keywords[tool].test(haystack);
    })
    .map((incident) => {
      const item = tool === "production" ? getProductionChecklistItem(incident) : incident.title;
      return {
        item,
        evidence: incident.evidence?.length ? incident.evidence.join(", ") : "route, role, timestamp, and related record",
        finding: incident.message,
        rootCause: formatRootCauseLines(incident),
        nextAction: incident.proposedFix || incident.safeRecovery || "Collect evidence, isolate cause, then ask admin before fix.",
        incident,
      };
    });
}

function getProductionChecklistItem(incident: KaFarmIncident) {
  const text = `${incident.title} ${incident.category} ${incident.affected} ${incident.message}`.toLowerCase();
  if (/database|db|sql|rls|rpc|supabase|relation/.test(text)) return "Production Database";
  if (/env|environment|secret|key/.test(text)) return "Environment Variables";
  if (/deploy|version|build|vercel/.test(text)) return "Deployed Version";
  if (/browser|button|click|ui|route|blank|overlay|visible action|runtime|fatal|stop|404/.test(text)) return "Actual Browser Behavior";
  if (/session|permission|auth|access denied|401|403|unauthorized|forbidden/.test(text)) return "User Session and Permissions";
  if (/external|service|api/.test(text)) return "External Services";
  if (/webhook/.test(text)) return "Webhook Delivery";
  if (/storage|file|media|upload|image/.test(text)) return "File and Media Storage";
  if (/traffic|performance|slow|timeout/.test(text)) return "Traffic and Performance";
  if (/scheduled|automation|cron/.test(text)) return "Scheduled Automations";
  if (/action|steps|reproduce/.test(text)) return "Exact User Actions";
  return "Production Error Logs";
}


export function KafarmFocusPage({ slug }: { slug: string }) {
  const card = cards.find((item) => item.slug === slug) ?? cards[0];
  const [question, setQuestion] = useState("Buddy pasok ka sa FarmConnect ko, manage mo para sakin. Ano uunahin mo?");
  const [selectedRow, setSelectedRow] = useState<Row>((pageRows[slug] || [])[0] || approvalRows[0]);
  const [report, setReport] = useState("");
  const [sqlAuditInput, setSqlAuditInput] = useState("");
  const analysis = useMemo(() => analyzeKaFarmMessage(question, "admin"), [question]);
  const sqlAuditResults = useMemo(() => analyzeSqlAudit(sqlAuditInput), [sqlAuditInput]);
  const sqlAuditMissingCount = sqlAuditResults.reduce((total, item) => total + item.missing.length, 0);
  const sqlAuditOkCount = sqlAuditResults.filter((item) => item.status === "OK").length;
  const rows = pageRows[slug] || [];
  const links = pageLinks[slug] || [];
  const [dbIncidents, setDbIncidents] = useState<DbIncident[]>([]);
  const [localIncidents, setLocalIncidents] = useState<LocalIncident[]>([]);
  const [incidentLoadNote, setIncidentLoadNote] = useState("Loading saved incidents...");
  const [lastHealthCheck, setLastHealthCheck] = useState("Not checked yet");
  const [healthRefreshKey, setHealthRefreshKey] = useState(0);

  useEffect(() => {
    if (slug !== "system-health") return;
    let active = true;

    const loadLocalIncidents = () => {
      try {
        const raw = window.localStorage.getItem("farmconnect_kafarm_incidents");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          const cleaned = filterKaFarmIncidents(parsed).slice(0, 30);
          if (cleaned.length !== parsed.length) {
            window.localStorage.setItem("farmconnect_kafarm_incidents", JSON.stringify(cleaned));
          }
          setLocalIncidents(cleaned.slice(0, 20));
        }
      } catch {
        setLocalIncidents([]);
      }
      setLastHealthCheck(new Date().toLocaleString());
    };

    loadLocalIncidents();
    window.addEventListener("kafarm-incident", loadLocalIncidents);

    supabase
      .from("admin_kafarm_incident_queue")
      .select("id,title,category,severity,status,app_role,route,message,http_status,request_url,email,created_at,updated_at")
      .limit(30)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setIncidentLoadNote("DB monitor not ready or admin session missing. Local browser monitor is active.");
          setDbIncidents([]);
          return;
        }
        const currentBuildIncidents = filterKaFarmIncidents((data || []) as DbIncident[]);
        setDbIncidents(currentBuildIncidents);
        setIncidentLoadNote(currentBuildIncidents.length ? "DB monitor active. Current-build incidents loaded from Supabase." : "DB monitor active. No current-build incidents yet.");
      });

    return () => {
      active = false;
      window.removeEventListener("kafarm-incident", loadLocalIncidents);
    };
  }, [slug, healthRefreshKey]);

  const localUnsyncedCount = localIncidents.filter((incident) => !incident.synced).length;
  const highRiskIncidentCount = [
    ...dbIncidents.map((incident) => incident.severity),
    ...localIncidents.map((incident) => incident.severity),
  ].filter((severity) => severity?.toLowerCase() === "high").length;

  return (
    <main className="min-h-screen bg-[#eef4ea] px-4 py-5 text-[#14241b]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Header eyebrow={card.label} title={card.title} text={card.summary} />
          <Link href="/admin/kafarm" className="rounded-xl bg-[#163d8f] px-4 py-3 text-sm font-black text-white">Back to Command Center</Link>
        </div>

        {slug === "ask" ? (
          <AskKaFarm question={question} setQuestion={setQuestion} analysis={analysis} />
        ) : (
          <section className="mt-5 grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_340px]">
            <aside className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${toneClass[card.tone]}`}>{card.label}</span>
              <h2 className="mt-4 text-xl font-black">What KaFarm Tracks</h2>
              <div className="mt-4 space-y-2">
                {card.willShow.map((item) => (
                  <div key={item} className="rounded-xl border border-[#dbe6d7] bg-[#f8fbf5] px-3 py-2 text-sm font-bold">{item}</div>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                {links.map(link => (
                  <Link key={link.href} href={link.href} className="block rounded-xl bg-white px-3 py-2 text-sm font-black text-[#163d8f] shadow-sm">{link.label}</Link>
                ))}
              </div>
            </aside>

            <section className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black">{slug === "qa-test-lab" ? "Manual Test Runner" : slug === "buddy-reports" ? "Handoff Builder" : "Operational Queue"}</h2>
                <span className="rounded-full bg-[#eef4ea] px-3 py-1 text-xs font-black uppercase text-[#1d7a45]">Usable now</span>
              </div>
              {slug === "system-health" && (
                <div className="mt-4 rounded-2xl border border-[#c9d8ff] bg-[#f4f7ff] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">Saved KaFarm Incidents</h3>
                      <p className="mt-1 text-xs font-bold text-[#4d5d76]">{incidentLoadNote}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-[#163d8f]">DB Monitor</span>
                  </div>
                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {dbIncidents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#c9d8ff] bg-white/80 p-4 text-sm font-bold text-[#4d5d76]">
                        Empty pa. Kapag may failed button/API/frontend crash, isi-save ni KaFarm dito after SQL is run.
                      </div>
                    ) : (
                      dbIncidents.map((incident) => (
                        <button
                          key={incident.id}
                          onClick={() =>
                            setSelectedRow({
                              left: incident.title,
                              middle: `${incident.app_role} ${incident.route || "unknown route"} - ${incident.message}`,
                              right: incident.status,
                              tone: incident.severity.toLowerCase() === "high" ? "approval" : "report",
                            })
                          }
                          className="w-full rounded-xl border border-[#dbe6d7] bg-white p-3 text-left transition hover:bg-[#f8fbf5]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-black text-[#14241b]">{incident.title}</span>
                            <span className="rounded-full bg-[#fff3bd] px-2 py-1 text-[10px] font-black uppercase text-[#9a6200]">{incident.severity}</span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-[#5d6b62]">{incident.app_role} {"->"} {incident.route || "unknown route"}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-bold text-[#4d5d76]">{incident.message}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                            <span className="rounded-full bg-[#eef4ea] px-2 py-1 text-[#1d7a45]">{incident.status}</span>
                            {incident.http_status ? <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">HTTP {incident.http_status}</span> : null}
                            {incident.email ? <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-800">{incident.email}</span> : null}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {slug === "database-health" && (
                <div className="mt-4 space-y-4 rounded-2xl border border-[#c9d8ff] bg-[#f4f7ff] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">KaFarm SQL Audit Helper</h3>
                      <p className="mt-1 text-xs font-bold text-[#4d5d76]">Paste Supabase output here. KaFarm will mark what is OK, missing, partial, or needs SQL.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-[#163d8f]">Read Only First</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-[#637064]">Modules</p>
                      <p className="mt-1 text-2xl font-black text-[#163d8f]">{sqlAuditResults.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-[#637064]">OK Modules</p>
                      <p className="mt-1 text-2xl font-black text-[#1d7a45]">{sqlAuditOkCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-[#637064]">Missing / Unclear</p>
                      <p className="mt-1 text-2xl font-black text-[#e32932]">{sqlAuditMissingCount}</p>
                    </div>
                  </div>

                  <textarea
                    value={sqlAuditInput}
                    onChange={(event) => setSqlAuditInput(event.target.value)}
                    placeholder="Paste Supabase SQL audit output here..."
                    className="min-h-44 w-full rounded-2xl border border-[#c9d8ff] bg-white p-4 text-sm font-bold leading-6 outline-none focus:border-[#163d8f]"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSqlAuditInput(sqlAuditCheckerSql)} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-[#163d8f] shadow-sm">Show Read-Only Checker SQL</button>
                    <button onClick={() => setReport(buildSqlAuditReport(sqlAuditInput))} className="rounded-xl bg-[#163d8f] px-4 py-2 text-sm font-black text-white shadow-sm">Generate SQL Audit Report</button>
                    <button onClick={() => { setSqlAuditInput(""); setReport(""); }} className="rounded-xl bg-[#efe9dc] px-4 py-2 text-sm font-black text-[#14241b] shadow-sm">Clear</button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {sqlAuditResults.map((item) => (
                      <button
                        key={item.module}
                        onClick={() =>
                          setSelectedRow({
                            left: item.module,
                            middle: item.missing.length ? `Missing/unclear: ${item.missing.join(", ")}` : `All expected objects visible for ${item.pages}`,
                            right: item.status,
                            tone: item.status === "OK" ? "safe" : item.status === "Needs Output" ? "report" : "approval",
                          })
                        }
                        className="rounded-2xl border border-[#dbe6d7] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h4 className="font-black text-[#14241b]">{item.module}</h4>
                          <Badge tone={item.status === "OK" ? "safe" : item.status === "Needs Output" ? "report" : "approval"}>{item.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs font-bold leading-5 text-[#5d6b62]">{item.pages}</p>
                        <p className="mt-3 text-xs font-black uppercase text-[#637064]">Missing / unclear</p>
                        <p className="mt-1 line-clamp-3 text-sm font-bold text-[#4d5d76]">{item.missing.length ? item.missing.join(", ") : "None"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-xl border border-[#dbe6d7]">
                <div className="grid grid-cols-[1fr_1.5fr_1fr] bg-[#163d8f] px-3 py-2 text-xs font-black uppercase text-white">
                  <span>Item</span>
                  <span>Meaning</span>
                  <span>Status</span>
                </div>
                {rows.map((row) => (
                  <button key={`${row.left}-${row.middle}`} onClick={() => setSelectedRow(row)} className={"grid w-full grid-cols-[1fr_1.5fr_1fr] gap-2 border-t border-[#dbe6d7] px-3 py-3 text-left text-sm font-bold transition hover:bg-[#f8fbf5] " + (selectedRow.left === row.left ? "bg-emerald-50" : "bg-white")}>
                    <span>{row.left}</span>
                    <span className="text-[#5d6b62]">{row.middle}</span>
                    <span><Badge tone={row.tone || card.tone}>{row.right}</Badge></span>
                  </button>
                ))}
              </div>

              {(slug === "qa-test-lab" || slug === "buddy-reports" || slug === "database-health") && (
                <div className="mt-4 rounded-2xl border border-[#c9d8ff] bg-[#f4f7ff] p-4">
                  <h3 className="font-black">{slug === "qa-test-lab" ? "Test Report Notes" : slug === "database-health" ? "SQL / DB Notes" : "Buddy Handoff Draft"}</h3>
                  <textarea value={report} onChange={event => setReport(event.target.value)} placeholder="Write blocker, SQL output, screenshot note, or exact reproduction steps here..." className="mt-3 h-32 w-full rounded-xl border border-[#c9d8ff] bg-white p-3 text-sm font-bold outline-none" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => setReport(buildReport(slug, selectedRow))} className="rounded-xl bg-[#163d8f] px-4 py-2 text-sm font-black text-white">Generate Report</button>
                    <button onClick={() => setReport("")} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-[#163d8f]">Clear</button>
                  </div>
                </div>
              )}
            </section>

            <aside className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm">
              <h2 className="text-xl font-black">Selected Detail</h2>
              <div className="mt-4 rounded-2xl border border-[#dbe6d7] bg-[#f8fbf5] p-4">
                <p className="text-xs font-black uppercase text-[#1d7a45]">{selectedRow.left}</p>
                <h3 className="mt-2 text-2xl font-black">{selectedRow.right}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-[#5d6b62]">{selectedRow.middle}</p>
              </div>
              <h3 className="mt-5 font-black">Safe Next Step</h3>
              <ol className="mt-3 space-y-2 text-sm font-bold leading-6 text-[#5d6b62]">
                {safeSteps(slug).map((step, index) => (
                  <li key={step} className="grid grid-cols-[28px_1fr] gap-2 rounded-xl bg-[#f8fbf5] px-3 py-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dbe6d7] text-xs font-black">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

function AskKaFarm({ question, setQuestion, analysis }: { question: string; setQuestion: (value: string) => void; analysis: ReturnType<typeof analyzeKaFarmMessage> }) {
  return (
    <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">Ask KaFarm Operator</h2>
          <span className="rounded-full bg-[#eef4ea] px-3 py-1 text-xs font-black uppercase text-[#1d7a45]">Hardcoded Backbone</span>
        </div>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-4 min-h-28 w-full rounded-2xl border border-[#c9d7c2] bg-[#f8fbf5] p-4 text-sm font-bold leading-6 outline-none focus:border-[#163d8f]" />
        <div className="mt-4 rounded-2xl border border-[#c9d8ff] bg-[#f4f7ff] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="read">{analysis.intent.replaceAll("_", " ")}</Badge>
            <Badge tone={analysis.risk === "high" ? "approval" : analysis.risk === "medium" ? "report" : "safe"}>{analysis.risk} risk</Badge>
            <Badge tone={analysis.needsAdmin ? "approval" : "safe"}>{analysis.needsAdmin ? "Admin Approval Needed" : "Guide Only"}</Badge>
          </div>
          <div className="mt-4 flex items-start gap-4">
            <div className="h-28 w-24 shrink-0 overflow-hidden rounded-3xl border-4 border-white bg-[#eef4ea] shadow-sm">
              <img src={KAFARM_MASCOT} alt="KaFarm mascot" className="h-full w-full object-contain p-1" />
            </div>
            <div className="min-w-0 flex-1 rounded-3xl rounded-tl-sm bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-black">KaFarm Says</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eef4ea] px-3 py-1 text-[11px] font-black uppercase text-[#1d7a45]">
                  typing <span className="animate-pulse">...</span>
                </span>
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-[#4d5d76]">{analysis.reply}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {operatorPlan.map((step) => (
            <Link key={step.title} href={step.href} className="rounded-2xl border border-[#dbe6d7] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <h3 className="font-black">{step.title}</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-[#5d6b62]">{step.text}</p>
            </Link>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-black text-amber-950">Incident Response</h3>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-2">
            {(analysis.incidentSteps.length ? analysis.incidentSteps : kafarmIncidentResponseSteps).map((step, index) => (
              <div key={step} className="grid grid-cols-[32px_1fr] gap-3 rounded-xl bg-white px-3 py-2 text-sm font-bold leading-6 text-[#5d4b16]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-200 text-xs font-black">{index + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <aside className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm">
        <h2 className="text-xl font-black">Try These</h2>
        <div className="mt-3 space-y-2">
          {askSamples.map((sample) => (
            <button key={sample} onClick={() => setQuestion(sample)} className="w-full rounded-xl bg-[#f8fbf5] px-3 py-2 text-left text-xs font-black text-[#4d5d76] shadow-sm">{sample}</button>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-[#dbe6d7] bg-[#f8fbf5] p-4">
          <h3 className="font-black">Evidence To Check</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(analysis.evidence.length ? analysis.evidence : ["support chats", "money queue", "KYC queue", "care tasks", "evidence logs"]).map((item) => (
              <span key={item} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#4d5d76]">{item}</span>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold leading-5 text-[#5d6b62]">Coverage: {kafarmCoverage.estimatedCoverage.toLocaleString()}+ realistic issue wordings.</p>
        </div>
      </aside>
    </section>
  );
}

function safeSteps(slug: string) {
  if (slug === "approvals") return ["Open related page", "Check evidence packet", "Write decision reason", "Complete only after admin approval"];
  if (slug === "qa-test-lab") return ["Run scenario manually", "Record blocker exactly", "Check linked role/page", "Create Buddy report if code/SQL issue"];
  if (slug === "database-health") return ["Run read-only SQL", "Compare missing tables/columns/functions", "Check RLS policy count", "Ask admin before fix SQL"];
  if (slug === "escalated-chats") return ["Read KaFarm summary", "Join chat only if needed", "Reply clearly", "End/complete with transcript"];
  if (slug === "buddy-reports") return ["Name exact page", "List reproduction steps", "Attach DB/evidence notes", "Suggest code/SQL area"];
  return ["Open related page", "Read queue item", "Gather evidence", "Report or route to admin decision"];
}

function buildReport(slug: string, row: Row) {
  return [
    `KaFarm ${slug.replaceAll("-", " ")} report`,
    `Item: ${row.left}`,
    `Issue/meaning: ${row.middle}`,
    `Status: ${row.right}`,
    "Evidence checked: route, user role, related record, timestamp, transcript/proof if available.",
    "Sensitive action: blocked until admin approval.",
    "Next: test manually, then send exact blocker to Buddy if code/SQL fix is needed.",
  ].join("\n");
}

function Metric({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-sm">
      <p className="text-xs font-black uppercase text-[#5d6b62]">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase ${toneClass[tone]}`}>{tone}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/95 p-5 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({ tone = "read", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${toneClass[tone]}`}>{children}</span>;
}

function Header({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <header className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-sm">
      <p className="text-xs font-black uppercase text-[#1d7a45]">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-black tracking-normal md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#5d6b62]">{text}</p>
    </header>
  );
}

function MascotBubble({ text }: { text: string }) {
  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-sm">
      <div className="grid gap-4 p-4 md:grid-cols-[150px_1fr] md:items-center">
        <div className="mx-auto h-44 w-36 overflow-hidden rounded-[28px] border-4 border-[#dbe6d7] bg-[#eef4ea] shadow-sm">
          <img src={KAFARM_MASCOT} alt="KaFarm mascot" className="h-full w-full object-contain p-1" />
        </div>
        <div className="rounded-3xl rounded-tl-sm border border-[#dbe6d7] bg-[#f8fbf5] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-lg">KaFarm</b>
            <span className="rounded-full bg-[#1d7a45] px-3 py-1 text-[11px] font-black uppercase text-white">typing assistant</span>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-[#4d5d76]">{text}</p>
        </div>
      </div>
    </section>
  );
}














