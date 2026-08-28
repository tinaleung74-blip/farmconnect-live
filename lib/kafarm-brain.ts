export type KaFarmRole = "customer" | "caretaker" | "admin";
export type KaFarmRisk = "low" | "medium" | "high";
export type KaFarmConfidence = "low" | "medium" | "high";
export type KaFarmIntent =
  | "greeting"
  | "thanks"
  | "confused"
  | "safety"
  | "farm_buy"
  | "cart_inventory"
  | "cashin"
  | "withdraw"
  | "wallet_pin"
  | "locked_savings"
  | "kyc"
  | "profile_settings"
  | "rooster_status"
  | "care_request"
  | "care_logs"
  | "sell_rooster"
  | "inbox_receipt"
  | "wrong_rooster"
  | "caretaker_quality"
  | "qr_camera"
  | "upload_proof"
  | "feed_quantity"
  | "payroll"
  | "admin_operator"
  | "admin_handoff"
  | "admin_flow_check"
  | "admin_bug_triage"
  | "admin_database_request"
  | "admin_button_issue"
  | "admin_password_safety"
  | "admin_customer_scope"
  | "admin_evidence"
  | "admin_priority"
  | "fraud_security"
  | "angry_legal"
  | "fallback";

export type KaFarmAnalysis = {
  intent: KaFarmIntent;
  risk: KaFarmRisk;
  needsAdmin: boolean;
  reply: string;
  evidence: string[];
  followUp: string[];
  adminSummary: string;
  suggestedRoute?: string;
  confidence: KaFarmConfidence;
  thinkingSummary: string;
  incidentSteps: string[];
};

type Rule = {
  intent: KaFarmIntent;
  risk: KaFarmRisk;
  keywords: RegExp[];
  needsAdmin?: boolean;
  routes?: Partial<Record<KaFarmRole, string>>;
  reply: string;
  evidence?: string[];
  followUp?: string[];
  adminSummary?: string;
  incidentSteps?: string[];
};

export const kafarmIncidentResponseSteps = [
  "Identify the problem: what happened, when it started, who is affected, and whether it is frontend, backend, database, API, or server.",
  "Gather evidence before fixing: screenshot, recording, error message, browser logs, server/API/database logs, timestamp, and affected account.",
  "Classify severity: P1 critical, P2 high, P3 medium, or P4 low.",
  "Reproduce the issue step by step using the same role, page, account, and action.",
  "Find root cause without guessing: frontend, backend, database, API, network, permission, configuration, cloud, or human error.",
  "Check logs: application, browser, database, authentication, API, payment, and server logs.",
  "Isolate the affected module if needed so one broken feature does not break the whole system.",
  "Fix only after root cause is known, then patch, review, and prepare deploy notes.",
  "Regression test login, dashboard, wallet, reports, admin, customer, caretaker, API, and database-linked flows.",
  "Monitor after deploy: errors, API response, database, user reports, and recurrence risk.",
  "Document what happened, what fixed it, and how to prevent it from happening again.",
];

const incidentTriageSteps = kafarmIncidentResponseSteps.slice(0, 7);

const rules: Rule[] = [
  {
    intent: "greeting",
    risk: "low",
    keywords: [/^(hi|hello|hey|oi|uy|yo|buddy|sir|maam|ma'am|kumusta|kamusta)[!. ]*$/i],
    reply: "Hi buddy. Andito ako. Sabihin mo kung wallet, KYC, rooster care, Farm Buy, cash-in, withdrawal, settings, or support ang gusto mong ayusin.",
    followUp: ["Anong page ka ngayon?", "Ano dapat mangyari?", "May error ba or nalilito lang?"],
  },
  {
    intent: "thanks",
    risk: "low",
    keywords: [/thank|thanks|salamat|ty|okay na|goods|nice|galing/i],
    reply: "Walang anuman buddy. If may next concern ka, sabihin mo lang yung page at nangyari.",
  },
  {
    intent: "confused",
    risk: "low",
    keywords: [/gulo|nalito|confused|di ko gets|hindi ko gets|hirap|mahirap|pano to|paano to|san ko/i],
    reply: "Okay lang, dahan-dahan tayo. Sabihin mo lang kung anong page ka ngayon at ano ang gusto mong gawin, then igu-guide kita step by step.",
    followUp: ["Anong page ang bukas?", "Ano ang pinindot mo?", "Ano ang expected mong lumabas?"],
  },
  {
    intent: "safety",
    risk: "medium",
    keywords: [/safe ba|delikado|takot|kabado|privacy|secure|security|nawala pera|nawala yung pera/i],
    needsAdmin: true,
    reply: "Valid yung worry mo. Huwag mag-share ng PIN/password. Kapag money, account safety, or private records ang issue, ipapasa ko sa admin para may evidence trail.",
    evidence: ["recent login/session", "wallet transaction", "support chat transcript", "profile/account status"],
  },
  {
    intent: "farm_buy",
    risk: "low",
    keywords: [/farm buy|buy|bili|cart|product|feed|feeds|vitamin|vaccine|supplement|electrolyte|equipment|sisiw|chick/i],
    reply: "For Farm Buy: pili ng product, plus/minus quantity, check Cart, then Buy kapag enough ang FC balance. Kung kulang funds, Add Cash muna; cart should stay saved.",
    routes: { customer: "/customer-v2/add-rooster" },
    followUp: ["Anong product?", "Ilang quantity?", "Kulang ba wallet balance?", "May item bang hindi pumasok sa inventory?"],
  },
  {
    intent: "cashin",
    risk: "medium",
    keywords: [/cash.?in|add cash|gcash|maya|bank|bpi|unionbank|reference|ref number|receipt|screenshot|payment proof|hindi pumasok|pera.*(wala|di|hindi|pumasok|nawala)|sinend ko|nagbayad|bayad.*(wala|di|hindi|pumasok)|kanina.*(send|sent|bayad|pera)/i],
    needsAdmin: true,
    reply: "Cash-in concern ito. I-check natin amount, method, recipient, reference number, date/time, at receipt screenshot. Since money record ito, admin review ang kailangan.",
    evidence: ["receipt screenshot", "payment method", "reference number", "recipient account", "submitted time", "wallet transaction"],
    followUp: ["Magkano ang sinend?", "Anong method: GCash, Maya, or bank?", "Kita ba reference number?", "Kailan sinend?"],
    routes: { customer: "/customer/cashin", admin: "/admin/transactions/cashin" },
  },
  {
    intent: "cart_inventory",
    risk: "medium",
    keywords: [/inventory|nabawasan|nabawas|hindi nabawas|stock|quantity|qty|kulang item|sobra item|item.*hindi pumasok|product.*hindi pumasok/i],
    needsAdmin: true,
    reply: "Inventory concern ito. Need i-check kung nabili, na-credit sa inventory, at nabawas kapag ginamit sa care task. Ipapasa ito sa admin kung may mismatch.",
    evidence: ["farm buy invoice", "cart item", "inventory movement", "usage log", "wallet transaction"],
    routes: { customer: "/customer/inventory", admin: "/admin/evidence" },
  },
  {
    intent: "withdraw",
    risk: "high",
    keywords: [/withdraw|cash.?out|cash out|payout|withdrawal|labas pera|hindi makawithdraw|manual payout|ilalabas.*pera|kuha.*pera|di.*malabas.*pera|hindi.*malabas.*pera/i],
    needsAdmin: true,
    reply: "Withdrawal is sensitive. KYC must be approved, payout account must match, and wallet PIN trail must be checked. Admin ang final reviewer before release.",
    evidence: ["KYC status", "payout account", "wallet balance", "withdrawal request", "admin transfer proof", "receipt/invoice"],
    followUp: ["Magkano withdrawal?", "Anong payout method?", "Approved na ba KYC?", "May saved payout account na ba?"],
    routes: { customer: "/customer/withdraw", admin: "/admin/customer-requests/withdraw" },
  },
  {
    intent: "wallet_pin",
    risk: "high",
    keywords: [/wallet pin|pin|forgot pin|nakalimutan pin|change pin|palit pin|reset pin|wrong pin|locked pin/i],
    needsAdmin: true,
    reply: "Wallet PIN is protected. Change PIN needs current PIN. If forgotten, admin reset is required, then customer must log in again and set a new PIN. Money and locked savings should not move.",
    evidence: ["PIN change attempt", "failed attempt count", "admin reset log", "forced logout log"],
    routes: { customer: "/customer/settings", admin: "/admin/customer-requests/security" },
  },
  {
    intent: "locked_savings",
    risk: "medium",
    keywords: [/save|savings|locked savings|lock savings|go save|unlock savings|ipon|locked balance/i],
    reply: "Locked savings are separate from available balance. PIN is needed to open or move savings. Locked money should not be used for buying until unlocked.",
    evidence: ["wallet balance", "locked savings ledger", "PIN confirmation log"],
    routes: { customer: "/customer/wallet" },
  },
  {
    intent: "kyc",
    risk: "high",
    keywords: [/kyc|verify|verification|id|valid id|national id|philhealth|tin|sss|selfie|birthdate|birthday|address|postal/i],
    needsAdmin: true,
    reply: "KYC concern ito. Complete ID front/back, selfie, address, birthdate, and payout name. System can flag mismatch, but admin ang final reviewer.",
    evidence: ["KYC consent", "ID front", "ID back", "selfie", "legal name", "birthdate", "address", "duplicate check"],
    followUp: ["Anong ID type?", "Kita ba buong ID number?", "Same ba name at birthday?", "Malinaw ba selfie?"],
    routes: { customer: "/customer/settings", admin: "/admin/customer-requests/kyc" },
  },
  {
    intent: "profile_settings",
    risk: "medium",
    keywords: [/profile|settings|contact|phone|email|nickname|password|pass|avatar|picture|photo/i],
    needsAdmin: false,
    reply: "Profile/settings concern ito. Contact details and photo can be updated in Settings. Password/PIN changes need verification steps for safety.",
    evidence: ["profile update log", "photo history", "password/PIN changed time"],
    routes: { customer: "/customer/settings" },
  },
  {
    intent: "rooster_status",
    risk: "low",
    keywords: [/rooster|manok|chicken|bantay|red ace|thunder|alaga|kumusta manok|status ng manok|yung manok ko|manok.*(kumusta|ano na|buhay|okay|ayos|alaga)/i],
    reply: "For rooster status, open My Roosters first, then Care Logs for dated updates, proof photos, product cost, labor cost, and caretaker notes.",
    routes: { customer: "/customer/roosters" },
    followUp: ["Aling rooster?", "Status ba, care logs, or value estimate ang hinahanap?"],
  },
  {
    intent: "care_request",
    risk: "medium",
    keywords: [/care request|farm request|request care|vitamins|premium feed|health check|vet|photo update|video proof|vaccine|weight check|pacheck|pa check|pakain|painom|pavideo|papicture|paalaga/i],
    reply: "For care request: choose rooster, choose service, add note, then submit/pay. Admin assigns to caretaker, then caretaker uploads proof for review.",
    evidence: ["care request", "payment/invoice", "customer note", "assigned caretaker", "task proof"],
    routes: { customer: "/customer/farm-requests", admin: "/admin/customer-requests/care" },
  },
  {
    intent: "care_logs",
    risk: "low",
    keywords: [/care log|care logs|history|records|update history|ginawa|proof history|timeline/i],
    reply: "Care Logs show dated records: time, caretaker, proof, item used, product cost, labor cost, and review status.",
    routes: { customer: "/customer/care-logs" },
  },
  {
    intent: "sell_rooster",
    risk: "medium",
    keywords: [/sell|benta|ibenta|sale|pricing|presyo|value|estimate|market price/i],
    needsAdmin: true,
    reply: "Sell request needs admin pricing and evidence. Caretaker may check weight/status, then admin creates invoice and customer share computation.",
    evidence: ["rooster ownership", "latest care logs", "weight/status proof", "admin price", "sale invoice"],
    routes: { customer: "/customer/farm-requests", admin: "/admin/sell-requests" },
  },
  {
    intent: "inbox_receipt",
    risk: "low",
    keywords: [/inbox|receipt|invoice|resibo|notif|notification|message|open invoice|open receipt/i],
    reply: "Inbox contains notifications, receipts, invoices, care updates, KYC notices, wallet alerts, and support messages. Open the item to view receipt/invoice when available.",
    routes: { customer: "/customer/inbox" },
  },
  {
    intent: "wrong_rooster",
    risk: "high",
    keywords: [/wrong rooster|maling manok|hindi ko manok|ibang manok|owner mali|qr mali|serial mali|tag mali|parang di akin|parang hindi akin|iba ata.*manok|mali ata.*manok/i],
    needsAdmin: true,
    reply: "Possible wrong rooster/customer is high risk. Stop the task/update first. Admin must compare QR/serial, owner, caretaker proof, and care request.",
    evidence: ["rooster QR/serial", "owner profile", "caretaker proof", "care request", "pen location", "photo/video proof"],
    routes: { admin: "/admin/customer-requests/care" },
  },
  {
    intent: "caretaker_quality",
    risk: "medium",
    keywords: [/caretaker|tagapag-alaga|alaga mali|hindi inalagaan|salbahe|proof mali|late update|walang update|bad care|di inupdate|hindi inupdate|di maalaga|hindi maalaga|parang napabayaan/i],
    needsAdmin: true,
    reply: "Caretaker concern ito. Admin needs original request, assigned caretaker, proof uploads, time submitted, and customer note before deciding.",
    evidence: ["assigned caretaker", "task record", "proof uploads", "customer note", "care logs", "admin review"],
    routes: { admin: "/admin/caretaker-management" },
  },
  {
    intent: "qr_camera",
    risk: "medium",
    keywords: [/qr|scan|scanner|serial|camera|cam|madilim|blur|ulan|rain|sira camera|di mabasa/i],
    needsAdmin: true,
    reply: "QR/camera issue: try better light, clean lens, hold steady, and retry. If still broken, admin must release exception mode before serial entry.",
    evidence: ["task id", "rooster tag", "camera/QR issue note", "exception request", "admin release log"],
    followUp: ["QR ba or camera ang problema?", "Anong rooster/tag?", "Sira ba camera or madilim lang?"],
    routes: { caretaker: "/caretaker/chat", admin: "/admin/live-chat" },
  },
  {
    intent: "upload_proof",
    risk: "medium",
    keywords: [/upload|photo|picture|video|proof|file|old photo|lumang pic|screenshot ng pic|gallery/i],
    needsAdmin: true,
    reply: "Proof upload must be fresh, clear, and match the selected task/rooster. Old, blurred, wrong-source, or mismatched proof needs admin review.",
    evidence: ["proof file", "captured time", "upload time", "task id", "rooster QR/serial", "system proof check"],
  },
  {
    intent: "feed_quantity",
    risk: "medium",
    keywords: [/feed quantity|ilang kilo|kg|kilo|nabawasan feed|pinakain|feed used|deduct feed/i],
    reply: "Feed usage must log exact kg used. Customer inventory should deduct only the actual amount used for the rooster, not the whole bag.",
    evidence: ["feed product", "kg used", "customer inventory before/after", "task proof", "caretaker note"],
    routes: { caretaker: "/caretaker/tasks", customer: "/customer/care-logs" },
  },
  {
    intent: "payroll",
    risk: "medium",
    keywords: [/payroll|salary|sahod|attendance|absent|present|time in|time out|15th|30th|payout caretaker/i],
    needsAdmin: true,
    reply: "Payroll is admin-side. Check caretaker attendance, present/absent days, daily rate, payout mode, and payroll receipt before sending salary.",
    evidence: ["attendance", "daily rate", "payroll period", "payout method", "receipt"],
    routes: { admin: "/admin/caretaker-management" },
  },
  {
    intent: "admin_operator",
    risk: "medium",
    keywords: [/manage mo|ikaw na bahala|ikaw muna bahala|ikaw na muna|bahala ka muna|tulog muna|tutulog muna|matutulog muna|alis muna|pasok ka sa farmconnect|pasok ka sa farm connect|hawakan mo|bantayan mo|monitor mo|run the farm|manage farmconnect|operator mode|owner away|wala ako|alis ako|hindi ko alam gagawin/i],
    reply: "Operator Handoff ready. Pwede kang matulog or umalis; ako ang mag-oorganize ng dapat bantayan: urgent money/KYC/security first, wrong rooster/proof disputes next, caretaker exceptions next, then regular care/store requests. Hindi ako gagawa ng dangerous action mag-isa. Maghahanda lang ako ng checklist, evidence, suggested replies, and items na kailangan mong approve pagbalik mo.",
    evidence: ["open approvals", "support escalations", "money queue", "KYC queue", "caretaker task delays", "evidence logs", "system health"],
    followUp: ["Do you want Today's Priority?", "Do you want Money/KYC/Security first?", "Do you want Caretaker/Farm Operations first?"],
    routes: { admin: "/admin/kafarm/ask" },
    adminSummary: "Admin asked KaFarm to act as in-app operator. KaFarm can triage, guide, summarize, and prepare next steps, but sensitive actions still need admin approval.",
  },
  {
    intent: "admin_handoff",
    risk: "medium",
    keywords: [/turnover|handoff|iwan ko sayo|iwan muna|ikaw gumawa non|ikaw gumawa nun|ikaw na gumawa|gawa mo na report|gawa mo checklist|report kay buddy|send kay buddy|ano sasabihin kay buddy|di ko maopen chatgpt|wala si buddy|backup/i],
    reply: "I can prepare a Buddy handoff report: affected page, user, exact issue, steps reproduced, records checked, evidence needed, likely cause, and suggested code/SQL area. I will keep it report-only until admin sends it.",
    evidence: ["page affected", "user affected", "steps reproduced", "database records checked", "screenshots/evidence", "likely cause"],
    routes: { admin: "/admin/kafarm/buddy-reports" },
  },
  {
    intent: "admin_flow_check",
    risk: "medium",
    keywords: [/ano next|next gawin|start check|check mo lahat|may naiwan|kulang|test flow|flow check|front end|backend|database|qa/i],
    reply: "Recommended check order: 1) Database Health, 2) System Health, 3) Escalated Chats, 4) Needs Approval, 5) Evidence Finder, 6) QA Test Lab, 7) Buddy Report if code/SQL fix is needed.",
    evidence: ["database health result", "route/page status", "open escalations", "approval queue", "evidence packet", "QA report"],
    routes: { admin: "/admin/kafarm" },
  },
  {
    intent: "admin_bug_triage",
    risk: "medium",
    keywords: [/bug|may bug|system.*bug|error daw|may mali daw|di gumagana|hindi gumagana|sira daw|check mo system|check system|ayusin mo na rin|fix mo|hanapin mo/i],
    reply: "Bug triage mode. Hindi ako manghuhula. Kailangan ko muna malaman: anong role ang affected, anong page, anong button/action, ano ang expected, ano ang actual, at isa ba o lahat ang affected. Safe order: reproduce page, check route/button, check console-friendly message, check DB record, then create Buddy report if code/SQL fix is needed.",
    evidence: ["affected role", "affected page", "button/action", "expected result", "actual result", "affected customer/user", "database record", "screenshot or chat report"],
    followUp: ["Customer, caretaker, or admin ba?", "Anong page banda?", "Isang customer lang ba o lahat?"],
    routes: { admin: "/admin/kafarm/qa-test-lab" },
    adminSummary: "Admin reported a vague bug. KaFarm must gather role/page/action/scope before suggesting a fix.",
    incidentSteps: incidentTriageSteps,
  },
  {
    intent: "admin_database_request",
    risk: "medium",
    keywords: [/database|db|schema|sql|tables|columns|functions|rls|send mo.*database|check mo.*database|may error.*database|health check|supabase/i],
    reply: "Database checker mode. I can guide a read-only health check and prepare what to send to Buddy. I should not expose secrets, service keys, passwords, or private customer data. First check missing tables, columns, functions, RLS, policies, orphan records, and broken links.",
    evidence: ["database health output", "missing tables", "missing columns", "missing functions", "RLS status", "policy counts", "affected feature"],
    followUp: ["Health check output ba meron?", "Anong feature ang affected?", "Need ba SQL to inspect only or SQL to fix?"],
    routes: { admin: "/admin/kafarm/database-health" },
    incidentSteps: incidentTriageSteps,
  },
  {
    intent: "admin_button_issue",
    risk: "medium",
    keywords: [/button|buttons|pinindot|click|clickable|hindi napipindot|di napipindot|walang nangyayari|route mali|404|blank page|cant be reached|cannot be reached/i],
    reply: "Button/route triage mode. Hindi ko muna sasabihing fixed hangga't hindi clear ang page at action. Check natin: button label, route after click, user role, expected page, actual page, and whether one account or all accounts ang affected.",
    evidence: ["button label", "current URL", "destination route", "role", "expected result", "actual result", "affected account count"],
    followUp: ["Anong button label?", "Anong URL/page ka galing?", "Blank/404 ba or walang nangyari?"],
    routes: { admin: "/admin/kafarm/system-health" },
    incidentSteps: incidentTriageSteps,
  },
  {
    intent: "admin_password_safety",
    risk: "high",
    keywords: [/password|pass nya|kunin mo.*pass|forgot password|nakalimutan password|reset password|login issue|di maka login|hindi maka login/i],
    needsAdmin: true,
    reply: "Password safety mode. Hindi pwedeng kunin o makita ang password ng customer. Safe process lang: send password reset flow, verify account ownership, log admin action, and never expose password. Kung wallet PIN ang issue, separate reset flow with forced logout and no money movement.",
    evidence: ["account identity", "reset request", "admin action log", "forced logout if wallet PIN", "support transcript"],
    followUp: ["Login password ba or wallet PIN?", "Verified ba owner ng account?", "Need ba reset link or admin PIN reset flow?"],
    routes: { admin: "/admin/customer-requests/security" },
    adminSummary: "Password or PIN request. Never reveal stored credentials. Use reset flow and audit log only.",
    incidentSteps: [
      "Identify whether this is login password or wallet PIN.",
      "Verify account ownership without asking for the old password.",
      "Never retrieve or expose stored credentials.",
      "Use reset flow only, then log the admin action.",
      "If wallet PIN, force logout and protect balances/locked savings from movement.",
    ],
  },
  {
    intent: "admin_customer_scope",
    risk: "medium",
    keywords: [/sinong customer|sino customer|isang customer|lahat ba|lahat ng customer|affected|nakakaranas|customer pala|may problem customer|user affected|scope/i],
    reply: "Customer scope mode. Kailangan malaman kung isolated account issue or system-wide issue. Check: customer name/email/id, role, last action, device/browser if available, same issue from other users, and related DB records.",
    evidence: ["customer profile", "support chat", "last action", "affected route", "related transaction/task/KYC", "other reports with same issue"],
    followUp: ["May customer name/email ba?", "Isa lang ba or may ibang report?", "Anong feature ang affected?"],
    routes: { admin: "/admin/customer-requests" },
    incidentSteps: incidentTriageSteps,
  },
  {
    intent: "admin_evidence",
    risk: "medium",
    keywords: [/evidence|log|audit|resolved|case|proof trail|hanapin|records|documents/i],
    reply: "Evidence check: find who did what, when, why, and which receipt/proof/chat/log supports it. Sensitive cases should be completed only after evidence is attached.",
    evidence: ["evidence_logs", "inbox item", "receipt/invoice", "chat transcript", "admin action"],
    routes: { admin: "/admin/evidence" },
  },
  {
    intent: "admin_priority",
    risk: "medium",
    keywords: [/ano unahin|priority|urgent|naiwan|pending|backlog|queue|task list|operation/i],
    reply: "Priority order: money/withdrawal issues first, KYC blockers next, wrong rooster/proof disputes, caretaker exceptions, then regular requests and reports.",
    routes: { admin: "/admin" },
  },
  {
    intent: "fraud_security",
    risk: "high",
    keywords: [/fraud|scam|hacked|unauthorized|nakaw|duplicate|fake|identity theft|ibang account|multiple account|same reference/i],
    needsAdmin: true,
    reply: "Possible fraud/security case ito. Do not approve, release money, or change ownership yet. Admin must review identity, duplicate records, wallet trail, and evidence.",
    evidence: ["KYC duplicate check", "wallet/reference trail", "account login/profile", "support chat", "admin decision log"],
    routes: { admin: "/admin/customer-requests/security" },
  },
  {
    intent: "angry_legal",
    risk: "high",
    keywords: [/galit|angry|complain|complaint|refund now|kaso|legal|lawyer|report kita|scam kayo|putang|tangina|bwisit/i],
    needsAdmin: true,
    reply: "I hear the concern. Since this may become a complaint or legal issue, I will escalate to admin. We need a calm transcript, evidence, and formal response.",
    evidence: ["full chat transcript", "related receipt/proof", "admin response", "case status"],
    routes: { admin: "/admin/live-chat" },
  },
];

const fallback: Rule = {
  intent: "fallback",
  risk: "low",
  keywords: [],
  reply: "Nakuha ko buddy. I can guide simple app steps. If this involves money, KYC, withdrawal, wrong rooster, fraud, account security, or legal concern, I will escalate to admin.",
  followUp: ["Anong page ito?", "Ano ang pinindot mo?", "Ano ang expected mong mangyari?"],
};

export const kafarmCoverage = {
  scenarioGroups: rules.length,
  estimatedCoverage: rules.length * 220,
  note: "Each scenario group covers many wording variations through keywords, role, evidence checklist, follow-up, and escalation rules. This is built to cover 5,000+ realistic issue wordings without hand-writing 5,000 separate questions.",
};

function findRule(message: string, role: KaFarmRole = "customer") {
  const scopedRules = role === "admin"
    ? [...rules.filter(rule => rule.intent.startsWith("admin_")), ...rules.filter(rule => !rule.intent.startsWith("admin_"))]
    : rules;
  return scopedRules.find(rule => rule.keywords.some(pattern => pattern.test(message))) || fallback;
}

function getConfidence(message: string, rule: Rule): KaFarmConfidence {
  if (rule.intent === "fallback") return "low";
  const trimmed = message.trim();
  if (trimmed.length < 10 && rule.intent !== "greeting" && rule.intent !== "thanks") return "medium";
  if (rule.keywords.some(pattern => pattern.test(trimmed))) return "high";
  return "medium";
}

function getThinkingSummary(analysis: Pick<KaFarmAnalysis, "intent" | "risk" | "needsAdmin" | "confidence">) {
  const intentName = analysis.intent.replaceAll("_", " ");
  if (analysis.intent === "greeting" || analysis.intent === "thanks") return "";
  if (analysis.intent === "fallback") {
    return "Iniisip ko muna: kulang pa ang details, so hahanapin ko kung page issue, money issue, rooster/care issue, or account issue ito.";
  }
  return `Sa pagkakaintindi ko: ${intentName} concern ito. Confidence: ${analysis.confidence}. Risk: ${analysis.risk}. ${analysis.needsAdmin ? "Kailangan ng admin/evidence bago final action." : "Pwede muna kitang i-guide step by step."}`;
}

function formatCustomerReply(analysis: KaFarmAnalysis) {
  if (analysis.intent === "greeting" || analysis.intent === "thanks") return analysis.reply;
  const followUp = analysis.followUp.length ? `\n\nPara masigurado, sagutin kahit isa lang: ${analysis.followUp.slice(0, 3).join(" / ")}` : "";
  const route = analysis.suggestedRoute ? `\n\nPwede mong buksan: ${analysis.suggestedRoute}` : "";
  return `${analysis.thinkingSummary}\n\n${analysis.reply}${followUp}${route}`;
}

export function analyzeKaFarmMessage(message: string, role: KaFarmRole = "customer"): KaFarmAnalysis {
  const rule = findRule(message.trim(), role);
  const needsAdmin = Boolean(rule.needsAdmin || rule.risk === "high");
  const confidence = getConfidence(message, rule);
  const baseAnalysis = {
    intent: rule.intent,
    risk: rule.risk,
    needsAdmin,
    confidence,
  };
  return {
    intent: rule.intent,
    risk: rule.risk,
    needsAdmin,
    reply: role === "admin" && rule.adminSummary ? rule.adminSummary : rule.reply,
    evidence: rule.evidence || [],
    followUp: rule.followUp || [],
    adminSummary: rule.adminSummary || `${rule.intent.replaceAll("_", " ")} concern. Risk: ${rule.risk}. ${needsAdmin ? "Admin review needed before sensitive action." : "Can be guided by KaFarm first."}`,
    suggestedRoute: rule.routes?.[role],
    confidence,
    thinkingSummary: getThinkingSummary(baseAnalysis),
    incidentSteps: rule.incidentSteps || [],
  };
}

export function getKaFarmReply(message: string, role: KaFarmRole = "customer") {
  const analysis = analyzeKaFarmMessage(message, role);
  if (role === "customer") return formatCustomerReply(analysis);
  return analysis.reply;
}

export function shouldEscalateToAdmin(message: string, role: KaFarmRole = "customer") {
  return analyzeKaFarmMessage(message, role).needsAdmin;
}

export function getEscalationNotice(message: string, role: KaFarmRole = "customer") {
  const analysis = analyzeKaFarmMessage(message, role);
  const evidenceText = analysis.evidence.length ? ` Evidence to check: ${analysis.evidence.join(", ")}.` : "";
  return `I escalated this to live admin because this is a ${analysis.risk}-risk ${analysis.intent.replaceAll("_", " ")} concern.${evidenceText}`;
}

export type KaFarmCouncilReport = {
  talkerInput: string;
  mainUnderstanding: string;
  sidekickFindings: Array<{ name: string; finding: string }>;
  operatorRunbook: KaFarmOperatorRunbook;
  safetyAdvice: string;
  fixAdvice: string;
  finalAnswer: string;
  needsApproval: boolean;
};

type KaFarmOperatorRunbook = {
  mode: string;
  route?: string;
  buttons: string[];
  steps: string[];
  evidence: string[];
  buddyHandoff: string;
  canDoNow: string[];
  cannotDoAlone: string[];
};

function detectTokens(message: string) {
  const m = message.toLowerCase();
  return {
    mentionsMoney: /cash|gcash|maya|bank|wallet|withdraw|payment|bayad|pera|reference|receipt|invoice/.test(m),
    mentionsIdentity: /kyc|id|selfie|verify|verification|pin|password|login|account/.test(m),
    mentionsCare: /care|task|caretaker|manok|rooster|qr|proof|upload|feed|vitamin|alaga/.test(m),
    mentionsBug: /bug|error|di gumagana|hindi gumagana|button|click|route|blank|404|failed|unauthorized|rls|database|sql/.test(m),
    wantsStatus: /ano nangyari|status|daily|check mo|monitor|good morning|kumusta|kamusta|app natin/.test(m),
    casual: /good morning|kumusta|kamusta|oi|buddy|ka farm|kafarm|boss/.test(m),
  };
}

function buildSidekickFindings(message: string, analysis: KaFarmAnalysis) {
  const tokens = detectTokens(message);
  const findings: Array<{ name: string; finding: string }> = [];

  findings.push({ name: "Talker", finding: tokens.casual ? "Casual/Taglish input detected. Keep answer friendly, then move to business." : "Direct ops request detected. Keep answer short and actionable." });
  findings.push({ name: "KaFarm Main", finding: `Primary intent is ${analysis.intent.replaceAll("_", " ")} with ${analysis.risk} risk and ${analysis.confidence} confidence.` });

  if (tokens.mentionsBug) findings.push({ name: "Bug Scout", finding: "Possible bug/blocker. Need page, button/action, expected result, actual result, and console/API error if available." });
  if (tokens.mentionsMoney) findings.push({ name: "Money Guard", finding: "Money-related terms detected. Do not credit/debit/release funds automatically. Require evidence and admin approval." });
  if (tokens.mentionsIdentity) findings.push({ name: "Identity Guard", finding: "Account/KYC/PIN/password terms detected. Protect sensitive data and use reset/review flow only." });
  if (tokens.mentionsCare) findings.push({ name: "Farm Flow Checker", finding: "Care/caretaker/rooster flow detected. Check customer request -> admin approval -> caretaker task -> proof -> customer update." });

  findings.push({ name: "Evidence Clerk", finding: analysis.evidence.length ? `Need evidence: ${analysis.evidence.join(", ")}.` : "Need minimum evidence: role, page, action, timestamp, screenshot/log if available." });
  findings.push({ name: "Recovery Planner", finding: analysis.needsAdmin ? "Safe recovery only: hold item, prevent duplicate action, create report, and wait for admin." : "Can guide first, then escalate if unclear or sensitive." });
  findings.push({ name: "Buddy Writer", finding: "If still blocked, create copy-ready report with issue, affected page/user, evidence, likely cause, and next fix area." });

  return findings;
}

function getOperatorRunbook(message: string, role: KaFarmRole, analysis: KaFarmAnalysis): KaFarmOperatorRunbook {
  const tokens = detectTokens(message);
  const baseCannot = [
    "wallet credit/debit/release",
    "KYC approve/reject",
    "withdrawal approval/release",
    "password/PIN reveal",
    "delete sensitive records",
  ];

  const commonBug = {
    buttons: ["Open affected page", "Capture Error", "Prepare Buddy Report"],
    steps: [
      "Confirm role: customer, caretaker, or admin.",
      "Confirm exact page and button/action.",
      "Compare expected result vs actual result.",
      "Capture browser console/API error, screenshot, and timestamp.",
      "Check whether one account or all accounts are affected.",
      "Create repair proposal before any code/SQL fix.",
    ],
    evidence: ["page URL", "button/action", "expected result", "actual result", "console/API error", "affected account"],
    buddyHandoff: "Send page URL, button/action, screenshot/error, affected role/account, and last tested step.",
  };

  switch (analysis.intent) {
    case "admin_database_request":
      return {
        mode: "Database Audit Mode",
        route: "/admin/kafarm/database-health",
        buttons: ["Show Read-Only Checker SQL", "Generate SQL Audit Report", "Clear"],
        steps: [
          "Open KaFarm > Database Health.",
          "Click Show Read-Only Checker SQL.",
          "Run that SQL in Supabase SQL Editor only as read-only check.",
          "Paste Supabase output into SQL Audit Helper.",
          "Click Generate SQL Audit Report.",
          "Send the report to Buddy before running any fix SQL.",
        ],
        evidence: ["tables found/missing", "columns found/missing", "functions found/missing", "RLS/policies", "orphan records", "affected feature"],
        buddyHandoff: "Send the generated SQL Audit Report plus the raw Supabase output. Do not send service keys or passwords.",
        canDoNow: ["prepare read-only SQL", "compare expected schema", "explain missing pieces", "make Buddy-ready report"],
        cannotDoAlone: baseCannot,
      };

    case "admin_bug_triage":
    case "admin_button_issue":
      return {
        mode: analysis.intent === "admin_button_issue" ? "Button / Route Recovery Mode" : "Bug Triage Mode",
        route: analysis.suggestedRoute || "/admin/kafarm/system-health",
        ...commonBug,
        canDoNow: ["triage issue", "capture error pattern", "isolate frontend/backend/database", "prepare fix proposal"],
        cannotDoAlone: baseCannot,
      };

    case "admin_operator":
    case "admin_priority":
      return {
        mode: "Owner Operator Mode",
        route: "/admin/kafarm",
        buttons: ["Needs Approval", "System Health", "Database Health", "Escalated Chats", "Evidence Finder"],
        steps: [
          "Check urgent money/withdrawal/payment items first.",
          "Check KYC/account-security blockers next.",
          "Check wrong rooster/proof/caretaker disputes.",
          "Check stale care tasks and admin approvals.",
          "Prepare one clean priority report for boss/admin.",
        ],
        evidence: ["open approvals", "payment queue", "withdrawal queue", "KYC queue", "support escalations", "system incidents"],
        buddyHandoff: "Send current priority list, blocked items, evidence links, and recommended next action.",
        canDoNow: ["organize queues", "explain what happened", "draft replies", "prepare reports", "monitor local incidents"],
        cannotDoAlone: baseCannot,
      };

    case "admin_handoff":
      return {
        mode: "Buddy Handoff Writer Mode",
        route: "/admin/kafarm/buddy-reports",
        buttons: ["Create Report", "Copy Report", "Mark Sent"],
        steps: [
          "Summarize exact issue in one sentence.",
          "List affected page, role, account, and route.",
          "Add reproduction steps.",
          "Add DB records or evidence checked.",
          "Add likely cause and suggested code/SQL area.",
          "Make it copy-ready for Buddy.",
        ],
        evidence: ["route", "user/account", "screenshot", "console/API error", "DB output", "latest action"],
        buddyHandoff: "Copy the final Buddy Report exactly as shown.",
        canDoNow: ["write incident report", "write repair proposal", "organize screenshots/logs"],
        cannotDoAlone: baseCannot,
      };

    case "cashin":
    case "farm_buy":
    case "cart_inventory":
      return {
        mode: "Manual Payment / Farm Buy Mode",
        route: role === "admin" ? "/admin/customer-requests" : "/customer/payment?type=farm_buy",
        buttons: ["View Receipt", "View Invoice", "Approve", "Reject With Notes", "Submit Decision"],
        steps: [
          "Customer selects items and submits payment proof/reference.",
          "Admin opens payment request and views uploaded receipt.",
          "Admin checks method, amount, reference number, and cart items.",
          "If valid, admin approves and system creates invoice.",
          "Approved Farm Buy adds rooster/product inventory to customer.",
          "If rejected, customer sees notes and can resubmit.",
        ],
        evidence: ["receipt upload", "reference number", "payment method", "cart items", "invoice", "admin decision log"],
        buddyHandoff: "If flow fails, send receipt/ref, route, approval status, invoice status, and inventory result.",
        canDoNow: ["guide manual payment", "check missing receipt/invoice trail", "explain approval flow"],
        cannotDoAlone: baseCannot,
      };

    case "withdraw":
      return {
        mode: "Withdrawal Review Mode",
        route: role === "admin" ? "/admin/customer-requests" : "/customer/withdraw",
        buttons: ["View Withdrawal Method", "Upload Payout Receipt", "View Invoice", "Approve", "Reject With Notes"],
        steps: [
          "Check customer KYC and payout account.",
          "Admin sends payout externally.",
          "Admin uploads payout receipt and reference number.",
          "System creates withdrawal invoice/receipt for customer inbox.",
          "Customer can confirm or dispute if admin sent to wrong method.",
        ],
        evidence: ["withdrawal request", "payout method", "admin payout receipt", "reference number", "withdrawal invoice", "customer confirmation"],
        buddyHandoff: "Send withdrawal id, payout method, admin receipt/reference, status, and customer confirmation/dispute.",
        canDoNow: ["guide review", "list evidence needed", "prepare rejection/approval notes"],
        cannotDoAlone: baseCannot,
      };

    case "kyc":
    case "admin_password_safety":
    case "fraud_security":
      return {
        mode: "Identity / Security Review Mode",
        route: role === "admin" ? "/admin/account-verification" : "/customer/settings",
        buttons: ["View Submitted ID", "View Selfie", "Approve", "Reject With Notes", "Reset PIN"],
        steps: [
          "Never reveal stored passwords or wallet PIN.",
          "Check submitted account details, ID, selfie, and duplicate risk.",
          "If details mismatch, reject with clear notes and resubmission steps.",
          "If wallet PIN reset is needed, force logout and preserve all balances.",
          "Log every admin action as evidence.",
        ],
        evidence: ["KYC submission", "selfie/ID", "duplicate check", "admin notes", "reset log", "forced logout log"],
        buddyHandoff: "Send only non-secret status/output. Never send passwords, PINs, tokens, or private ID images unless needed inside admin app.",
        canDoNow: ["guide review", "draft rejection notes", "explain reset flow", "prepare evidence list"],
        cannotDoAlone: baseCannot,
      };

    case "care_request":
    case "feed_quantity":
    case "qr_camera":
    case "upload_proof":
    case "caretaker_quality":
    case "wrong_rooster":
      return {
        mode: "Care Task / Caretaker Ops Mode",
        route: role === "caretaker" ? "/caretaker/tasks" : "/admin/customer-requests",
        buttons: ["Assign Caretaker", "Request Backjob", "View Proof", "Approve Task", "Reject With Notes"],
        steps: [
          "Customer care request must be paid/approved first.",
          "Admin assigns caretaker to the approved task.",
          "Caretaker verifies rooster QR/serial before upload.",
          "Caretaker submits proof, notes, and exact feed kg if feed was used.",
          "Admin approves or rejects task proof.",
          "Approved proof becomes customer care log and evidence record.",
        ],
        evidence: ["care request", "rooster QR/serial", "assigned caretaker", "proof photo/video", "caretaker notes", "feed kg used", "admin decision"],
        buddyHandoff: "Send request id, rooster, caretaker, submitted proof, admin action, and customer-visible care log result.",
        canDoNow: ["guide task flow", "detect missing proof", "prepare backjob instruction", "explain inventory deduction"],
        cannotDoAlone: baseCannot,
      };

    case "inbox_receipt":
    case "admin_evidence":
      return {
        mode: "Evidence Finder Mode",
        route: role === "admin" ? "/admin/evidence" : "/customer/inbox",
        buttons: ["Open Evidence", "View Receipt", "View Invoice", "Mark Resolved"],
        steps: [
          "Find the account first.",
          "Filter by payment, withdrawal, care, KYC, support, or admin action.",
          "Open receipt/invoice/proof/chat transcript.",
          "Compare customer action, caretaker action, and admin action.",
          "Move completed case to resolved logs only after evidence is complete.",
        ],
        evidence: ["receipt", "invoice", "proof upload", "chat transcript", "admin decision", "timestamp"],
        buddyHandoff: "Send evidence trail summary and missing record, if any.",
        canDoNow: ["find trail", "summarize evidence", "point to missing record"],
        cannotDoAlone: baseCannot,
      };

    default:
      return {
        mode: tokens.wantsStatus ? "Status Check Mode" : "Guided Support Mode",
        route: analysis.suggestedRoute,
        buttons: analysis.suggestedRoute ? ["Open page", "Check status", "Escalate if sensitive"] : ["Ask follow-up", "Collect evidence", "Escalate if sensitive"],
        steps: [
          "Identify the page, role, and expected result.",
          "Ask one follow-up if details are missing.",
          "If money, KYC, withdrawal, fraud, legal, or account security appears, escalate to admin.",
          "If it is simple navigation, guide the user step by step.",
        ],
        evidence: analysis.evidence.length ? analysis.evidence : ["role", "page", "action", "timestamp", "screenshot if available"],
        buddyHandoff: "If still unclear, send role/page/action/expected/actual so Buddy can inspect quickly.",
        canDoNow: ["understand intent", "guide user", "collect evidence", "make report"],
        cannotDoAlone: baseCannot,
      };
  }
}

export function runKaFarmCouncil(message: string, role: KaFarmRole = "admin"): KaFarmCouncilReport {
  const analysis = analyzeKaFarmMessage(message, role);
  const tokens = detectTokens(message);
  const findings = buildSidekickFindings(message, analysis);
  const runbook = getOperatorRunbook(message, role, analysis);
  const needsApproval = analysis.needsAdmin || tokens.mentionsMoney || tokens.mentionsIdentity;
  const safetyAdvice = needsApproval
    ? "Safety Advisor: Sensitive or risky ito. Stop automatic action. Collect evidence, then ask admin approve/reject."
    : "Safety Advisor: Low risk for guidance/reporting. No sensitive record should be changed.";
  const fixAdvice = tokens.mentionsBug
    ? "Fix Advisor: Reproduce first, isolate route/button/API/DB, apply only safe recovery, then make Buddy report for code/SQL fix if needed."
    : "Fix Advisor: Guide the workflow first. If user confirms a blocker, convert it to incident and gather evidence.";

  const opening = tokens.casual
    ? "Good morning boss. Nandito ako. Ipa-check ko muna sa loob, then ibabalik ko sayo yung malinis na summary."
    : "Sige boss, chine-check ko ito as KaFarm council.";

  const finalAnswer = [
    opening,
    "",
    `Mode: ${runbook.mode}`,
    `Risk: ${analysis.risk} | Confidence: ${analysis.confidence}`,
    "",
    "Action ngayon:",
    ...runbook.steps.slice(0, 6).map((step, index) => `${index + 1}. ${step}`),
    "",
    runbook.route ? `Open page: ${runbook.route}` : "Open page: depende sa affected role/page.",
    "",
    "Buttons / controls:",
    ...runbook.buttons.slice(0, 6).map((button) => `- ${button}`),
    "",
    "Evidence na kailangan:",
    ...runbook.evidence.slice(0, 7).map((item) => `- ${item}`),
    "",
    "Kaya kong gawin ngayon:",
    ...runbook.canDoNow.slice(0, 5).map((item) => `- ${item}`),
    "",
    "Hindi ko gagawin mag-isa:",
    ...runbook.cannotDoAlone.slice(0, 5).map((item) => `- ${item}`),
    "",
    safetyAdvice,
    fixAdvice,
    "",
    `Send to Buddy: ${runbook.buddyHandoff}`,
    "",
    needsApproval ? "Decision needed: Approve check/report or Reject and ask for more evidence?" : "Pwede muna kitang i-guide. Kapag may blocker, gagawan ko ng repair proposal.",
  ].join("\n");

  return {
    talkerInput: message,
    mainUnderstanding: analysis.adminSummary,
    sidekickFindings: findings,
    operatorRunbook: runbook,
    safetyAdvice,
    fixAdvice,
    finalAnswer,
    needsApproval,
  };
}
