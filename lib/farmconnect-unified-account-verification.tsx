"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  adminReviewCaretakerApplication,
  adminReviewCustomerKyc,
  createPrivateEvidenceUrl,
  getCaretakerApplications,
  getCustomerKycVerificationRecords,
  submitCaretakerApplication,
  uploadPrivateEvidenceFile,
} from "@/lib/farmconnect-data";
import { createIsolatedSupabaseClient, supabase } from "@/lib/supabase";

type VerificationMode = "customer" | "caretaker";
type VerificationTab = "queue" | "verified";
type RiskLevel = "Low" | "Medium" | "High";
type AdminGateState =
  | { status: "checking" }
  | { status: "allowed" }
  | { status: "login_required"; reason: string }
  | { status: "blocked"; reason: string };
type ResolvedAdminGateState = Exclude<AdminGateState, { status: "checking" }>;

type VerificationFile = {
  label: string;
  kind: "image" | "document" | "resume";
  bucket: string;
  value: string;
};

type VerificationRow = {
  id: string;
  source: VerificationMode;
  name: string;
  legalName: string;
  birthdate: string;
  email: string;
  phone: string;
  submitted: string;
  status: string;
  details: string;
  files: VerificationFile[];
  risk: RiskLevel;
};

type UnknownRow = Record<string, unknown>;

const cardClass = "rounded-2xl border border-[#e3ded0] bg-white p-4 shadow-sm";

function valueText(value: unknown, fallback = "Not recorded") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function recordValue(row: UnknownRow, key: string) {
  return row[key];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "FC";
}

function displayDate(value: unknown) {
  const text = valueText(value, "");
  if (!text) return "Not recorded";
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function displayDateOnly(value: unknown) {
  const text = valueText(value, "");
  if (!text) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString("en-PH", { dateStyle: "long" });
}

function adminGateReason(reason: string) {
  const messages: Record<string, string> = {
    NO_AUTH_SESSION: "No authenticated session was found in this browser.",
    NO_PROFILE_FOR_AUTH_SESSION: "This login has no connected FarmConnect profile.",
    DUPLICATE_PROFILES_FOR_AUTH_SESSION: "This login has duplicate profile records and is blocked for safety.",
    PROFILE_ROLE_IS_NOT_ADMIN: "The current login is not an admin account.",
    ADMIN_PROFILE_NOT_ACTIVE: "The current admin profile is not active.",
  };
  return messages[reason] || `Admin session was blocked: ${reason}`;
}

async function readAdminGate(): Promise<ResolvedAdminGateState> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return { status: "login_required", reason: "No active admin login session. Sign in again using the admin account." };
  }

  const { data, error } = await supabase.rpc("admin_session_guard_status");
  if (error) {
    return { status: "blocked", reason: `Admin session check failed: ${error.message}` };
  }

  const result = (data || {}) as { ok?: boolean; reason?: string };
  if (result.ok === true) return { status: "allowed" };
  const reason = valueText(result.reason, "ADMIN_REQUIRED");
  if (reason === "NO_AUTH_SESSION") return { status: "login_required", reason: adminGateReason(reason) };
  return { status: "blocked", reason: adminGateReason(reason) };
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const toneClass = tone === "good"
    ? "bg-emerald-100 text-emerald-800"
    : tone === "warn"
      ? "bg-amber-100 text-amber-900"
      : tone === "bad"
        ? "bg-red-100 text-red-800"
        : "bg-[#eee8d9] text-[#535c55]";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${toneClass}`}>{children}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f6f3e8] p-3"><p className="text-[11px] font-black uppercase text-[#667267]">{label}</p><p className="mt-1 break-words text-sm font-black text-[#17251d]">{value}</p></div>;
}

function AdminVerificationShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const links = [
    ["Dashboard", "/admin"],
    ["Customer Requests", "/admin/customer-requests"],
    ["Caretaker Management", "/admin/caretaker-management"],
    ["Farm Operations", "/admin/farm-operations"],
    ["Issue Management", "/admin/issue-management"],
    ["Account Verification", "/admin/account-verification"],
  ];
  async function logout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  return <main className="min-h-screen bg-[#f6f3e8] bg-cover bg-center bg-no-repeat text-[#17251d]" style={{ backgroundImage: "linear-gradient(180deg,rgba(255,253,247,.24),rgba(246,243,232,.18)),url('/farmconnect/farmconnect-hero-wallpaper.jpg')", backgroundAttachment: "fixed" }}>
    <header className="sticky top-0 z-40 border-b-4 border-[#ffd43b] bg-gradient-to-r from-[#075c3a]/95 via-[#0b6fba]/94 to-[#075c3a]/95 text-white shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/admin" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl">FC</span><span><b className="block">FarmConnect</b><small className="font-bold text-white/80">Account Verification</small></span></Link>
        <nav className="hidden items-center gap-1 lg:flex">{links.map(([label,href])=><Link key={href} href={href} className={`rounded-xl px-3 py-2 text-xs font-black transition hover:bg-white/15 ${href === "/admin/account-verification" ? "bg-white/20" : ""}`}>{label}</Link>)}</nav>
        <div className="flex gap-2"><Link href="/admin/kafarm" className="rounded-xl bg-white/90 px-3 py-2 text-xs font-black text-[#075c3a]">KaFarm</Link><button type="button" onClick={logout} className="rounded-xl bg-white/90 px-3 py-2 text-xs font-black text-[#075c3a]">Logout</button></div>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
  </main>;
}

function mapCustomerRows(rows: UnknownRow[]): VerificationRow[] {
  return rows.map(row => {
    const profile = (recordValue(row, "profile") || {}) as UnknownRow;
    const documents = Array.isArray(recordValue(row, "documents")) ? recordValue(row, "documents") as UnknownRow[] : [];
    const riskSource = valueText(recordValue(profile, "kyc_risk_level"), valueText(recordValue(row, "auto_check_status"), "low")).toLowerCase();
    const risk: RiskLevel = riskSource.includes("high") || riskSource.includes("failed")
      ? "High"
      : riskSource.includes("medium") || riskSource.includes("review") || riskSource.includes("duplicate")
        ? "Medium"
        : "Low";
    return {
      id: valueText(recordValue(row, "id"), "missing-id"),
      source: "customer",
      name: valueText(recordValue(profile, "display_name"), valueText(recordValue(profile, "full_name"), valueText(recordValue(row, "legal_name"), valueText(recordValue(profile, "email"), "Customer")))),
      legalName: valueText(recordValue(row, "legal_name"), valueText(recordValue(profile, "full_name"))),
      birthdate: displayDateOnly(recordValue(row, "birthdate") || recordValue(profile, "birthdate")),
      email: valueText(recordValue(profile, "email"), "No email"),
      phone: valueText(recordValue(profile, "phone"), "No phone"),
      submitted: displayDate(recordValue(row, "submitted_at") || recordValue(row, "updated_at") || recordValue(row, "created_at")),
      status: valueText(recordValue(row, "status"), "draft"),
      details: `${valueText(recordValue(row, "id_type"), "ID not set")} / ${valueText(recordValue(row, "city"), "City not set")}, ${valueText(recordValue(row, "province"), "Province not set")}`,
      files: documents.map(document => ({
        label: valueText(recordValue(document, "document_type"), "KYC document").replaceAll("_", " "),
        kind: valueText(recordValue(document, "document_type")) === "selfie" ? "image" : "document",
        bucket: "farmconnect-customer-kyc",
        value: valueText(recordValue(document, "file_url"), ""),
      })),
      risk,
    };
  });
}

function mapCaretakerRows(rows: UnknownRow[]): VerificationRow[] {
  return rows.map(row => ({
    id: valueText(recordValue(row, "id"), "missing-id"),
    source: "caretaker",
    name: valueText(recordValue(row, "display_name"), valueText(recordValue(row, "full_name"), valueText(recordValue(row, "email"), "Caretaker applicant"))),
    legalName: valueText(recordValue(row, "full_name")),
    birthdate: displayDateOnly(recordValue(row, "birthdate")),
    email: valueText(recordValue(row, "email"), "No email"),
    phone: valueText(recordValue(row, "phone"), "No phone"),
    submitted: displayDate(recordValue(row, "updated_at") || recordValue(row, "created_at")),
    status: valueText(recordValue(row, "status"), "pending_approval"),
    details: `${valueText(recordValue(row, "farm_role"), "Farm role not set")} / ${valueText(recordValue(row, "payment_method"), "Payment method not set")}`,
    files: [
      { label: "Selfie photo", kind: "image", bucket: "caretaker-resumes", value: valueText(recordValue(row, "avatar_url"), "") },
      { label: "Resume", kind: "resume", bucket: "caretaker-resumes", value: valueText(recordValue(row, "resume_url"), "") },
    ],
    risk: valueText(recordValue(row, "status")) === "needs_info" ? "Medium" : "Low",
  }));
}

export function UnifiedAccountVerificationPage() {
  const [adminGate,setAdminGate]=useState<AdminGateState>({ status:"checking" });
  const [tab,setTab]=useState<VerificationTab>("queue");
  const [mode,setMode]=useState<VerificationMode>("customer");
  const [customers,setCustomers]=useState<VerificationRow[]>([]);
  const [caretakers,setCaretakers]=useState<VerificationRow[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [adminNote,setAdminNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [verificationNote,setVerificationNote]=useState("Loading live verification records...");
  const [viewer,setViewer]=useState<null | { title:string; kind:VerificationFile["kind"]; url?:string; error?:string }>(null);

  async function load() {
    setLoading(true);
    const [customerResult, caretakerResult] = await Promise.allSettled([
      getCustomerKycVerificationRecords(),
      getCaretakerApplications(),
    ]);
    setCustomers(customerResult.status === "fulfilled" ? mapCustomerRows(customerResult.value as unknown as UnknownRow[]) : []);
    setCaretakers(caretakerResult.status === "fulfilled" ? mapCaretakerRows(caretakerResult.value as unknown as UnknownRow[]) : []);
    const failureCount = [customerResult, caretakerResult].filter(result => result.status === "rejected").length;
    setVerificationNote(failureCount === 0
      ? "Live records loaded. Approved/rejected accounts leave the queue automatically."
      : failureCount === 1
        ? "One source could not load. Check the admin session and RLS before deciding."
        : "Verification sources could not load. Check the admin session and database functions.");
    setLoading(false);
  }

  async function initialize() {
    setAdminGate({ status:"checking" });
    setLoading(true);
    const nextGate = await readAdminGate();
    setAdminGate(nextGate);
    if (nextGate.status === "allowed") {
      await load();
      return;
    }
    setCustomers([]);
    setCaretakers([]);
    setVerificationNote(nextGate.reason);
    setLoading(false);
  }

  useEffect(()=>{ initialize(); }, []);

  const queueRows = useMemo(() => mode === "customer"
    ? customers.filter(row => !["draft", "approved", "rejected"].includes(row.status))
    : caretakers.filter(row => ["pending_approval", "needs_info"].includes(row.status)), [mode, customers, caretakers]);
  const verifiedRows = useMemo(() => (mode === "customer" ? customers : caretakers).filter(row => row.status === "approved"), [mode, customers, caretakers]);
  const activeRows = tab === "queue" ? queueRows : verifiedRows;
  const selected = activeRows.find(row=>row.id === selectedId) || activeRows[0] || null;

  useEffect(()=>{ setSelectedId(activeRows[0]?.id || ""); setAdminNote(""); }, [tab, mode, activeRows.length]);

  async function decide(decision: "approved" | "rejected") {
    if (!selected || saving) return;
    if (decision === "rejected" && !adminNote.trim()) {
      setVerificationNote("Write the rejection reason first so the applicant knows what to correct.");
      return;
    }
    setSaving(true);
    setVerificationNote(`Saving ${decision} decision for ${selected.name}...`);
    try {
      const currentGate = await readAdminGate();
      if (currentGate.status !== "allowed") {
        setAdminGate(currentGate);
        setVerificationNote(currentGate.reason);
        return;
      }
      if (selected.source === "customer") await adminReviewCustomerKyc(selected.id, decision, adminNote, selected.risk.toLowerCase() as "low" | "medium" | "high");
      else await adminReviewCaretakerApplication(selected.id, decision, adminNote);
      setAdminNote("");
      await load();
      setVerificationNote(`${selected.name} ${decision}. Database records/logs refreshed and the item left the queue.`);
    } catch (error: unknown) {
      const source = error as { message?: string; details?: string; hint?: string };
      setVerificationNote(`Decision failed: ${source.message || source.details || source.hint || "Unknown verification error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function openFile(file: VerificationFile) {
    if (!file.value || (!file.value.includes("/") && !/^https?:\/\//i.test(file.value))) {
      setViewer({ title:file.label, kind:file.kind, error:"Legacy filename only—no uploaded file exists. Ask the applicant to re-upload and resubmit." });
      return;
    }
    setViewer({ title:file.label, kind:file.kind });
    try {
      const url = await createPrivateEvidenceUrl(file.bucket, file.value);
      setViewer({ title:file.label, kind:file.kind, url });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Evidence could not open";
      const legacy = message === "legacy_filename_only" || message === "legacy_browser_url";
      setViewer({ title:file.label, kind:file.kind, error:legacy ? "This old record has no permanent Storage file. Applicant re-upload is required." : `Secure file could not open: ${message}` });
    }
  }

  if (adminGate.status !== "allowed") {
    const checking = adminGate.status === "checking";
    const reason = checking ? "Checking the current browser session against the active-admin guard..." : adminGate.reason;
    return <AdminVerificationShell>
      <section className="mx-auto max-w-2xl rounded-[28px] border border-[#e3ded0] bg-white/95 p-7 shadow-xl">
        <p className="text-xs font-black uppercase text-[#1f6b45]">Protected Admin Desk</p>
        <h1 className="mt-1 text-3xl font-black">{checking ? "Checking Admin Session" : "Admin Login Required"}</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">KaFarm: {reason}</p>
        {!checking && <div className="mt-5 flex flex-wrap gap-3"><Link href="/admin/login" className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">Open Admin Login</Link><button type="button" onClick={initialize} className="rounded-xl bg-[#eee8d9] px-5 py-3 font-black">Check Again</button></div>}
        <p className="mt-5 text-sm font-bold leading-6 text-[#667267]">Applicant and admin sessions must use separate browser profiles or an Incognito window. No verification records or decision buttons are exposed until the active-admin check passes.</p>
      </section>
    </AdminVerificationShell>;
  }

  return <AdminVerificationShell>
    <section className="rounded-[28px] border border-[#e3ded0] bg-white/95 p-5 shadow-sm"><p className="text-xs font-black uppercase text-[#1f6b45]">FarmConnect Operations</p><h1 className="mt-1 text-4xl font-black">Account Verification</h1><p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#27577c]">One approval page for customer KYC and caretaker activation. KaFarm may explain findings, but only admin can approve or reject.</p></section>
    <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">KaFarm: {verificationNote}</section>
    <div className="mt-4 grid gap-3 md:grid-cols-2"><button onClick={()=>setTab("queue")} className={`rounded-2xl border p-4 text-left ${tab === "queue" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95"}`}><b>Verification Queue</b><p className="text-xs font-bold text-[#667267]">Waiting for a real admin decision.</p></button><button onClick={()=>setTab("verified")} className={`rounded-2xl border p-4 text-left ${tab === "verified" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95"}`}><b>Verified Accounts</b><p className="text-xs font-bold text-[#667267]">Approved customers and caretakers.</p></button></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_340px]">
      <section className={`${cardClass} min-h-[620px]`}><div className="flex items-center justify-between"><h2 className="text-lg font-black">{tab === "queue" ? "Accounts On Queue" : "Verified Type"}</h2><Badge tone={tab === "queue" ? "warn" : "good"}>{activeRows.length}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setMode("customer")} className={`rounded-xl px-3 py-3 text-sm font-black ${mode === "customer" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]"}`}>Customers</button><button onClick={()=>setMode("caretaker")} className={`rounded-xl px-3 py-3 text-sm font-black ${mode === "caretaker" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]"}`}>Caretakers</button></div><div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto pr-2">{activeRows.map(row=><button key={row.id} onClick={()=>setSelectedId(row.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]"}`}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{initials(row.name)}</span><span className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="block truncate text-xs font-bold text-[#667267]">{row.submitted}</span></span><Badge tone={tab === "verified" ? "good" : row.risk === "High" ? "bad" : row.risk === "Medium" ? "warn" : "neutral"}>{tab === "verified" ? "Approved" : row.risk}</Badge></button>)}{loading && <p className="rounded-xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Loading live records...</p>}{!loading && activeRows.length === 0 && <p className="rounded-xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">{tab === "queue" ? "No account waiting in this queue." : "No approved account in this list yet."}</p>}</div></section>
      <section className={`${cardClass} min-h-[620px]`}>{selected ? <><p className="text-xs font-black uppercase text-[#667267]">{tab === "queue" ? "Submitted Account Details" : "Verified Account Details"}</p><h2 className="mt-1 text-3xl font-black">{selected.name}</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Info label="Legal Name" value={selected.legalName} /><Info label="Birthdate" value={selected.birthdate} /><Info label="Role" value={selected.source === "customer" ? "Customer" : "Caretaker"} /><Info label="Status" value={selected.status.replaceAll("_", " ")} /><Info label="Email" value={selected.email} /><Info label="Phone" value={selected.phone} /><Info label="Submitted" value={selected.submitted} /><Info label="Details" value={selected.details} /></div><div className="mt-4 grid gap-3 md:grid-cols-2">{selected.files.map((file,index)=><button key={`${file.label}-${index}`} onClick={()=>openFile(file)} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Open {file.label}</button>)}{selected.files.length === 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900 md:col-span-2">No document row is connected to this submission.</p>}</div></> : <div className="grid min-h-[500px] place-items-center text-center"><div><h2 className="text-2xl font-black">No selected record</h2><p className="mt-2 text-sm font-bold text-[#667267]">Choose another type or wait for a submission.</p></div></div>}</section>
      <section className={`${cardClass} min-h-[620px]`}>{tab === "queue" && selected ? <><p className="text-xs font-black uppercase text-[#667267]">Admin Verification</p><h2 className="mt-1 text-2xl font-black">Approve or Reject</h2><Badge tone="warn">{selected.status.replaceAll("_", " ")}</Badge><label className="mt-4 block text-sm font-black">Admin Notes</label><textarea value={adminNote} onChange={event=>setAdminNote(event.target.value)} placeholder="Required for rejection; recommended for approval." className="mt-2 min-h-40 w-full rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 text-sm font-bold" /><div className="mt-4 grid grid-cols-2 gap-3"><button disabled={saving} onClick={()=>decide("approved")} className="rounded-2xl bg-[#1f6b45] px-4 py-7 font-black text-white disabled:opacity-60">{saving ? "Saving..." : "Approve"}</button><button disabled={saving} onClick={()=>decide("rejected")} className="rounded-2xl bg-red-600 px-4 py-7 font-black text-white disabled:opacity-60">Reject</button></div><p className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]">The real review RPC updates status, access, and evidence logs. Approved/rejected records are then removed from this queue.</p></> : <><p className="text-xs font-black uppercase text-[#667267]">Total Verified</p><h2 className="mt-2 text-5xl font-black text-[#1f6b45]">{activeRows.length}</h2><p className="mt-2 text-sm font-bold text-[#667267]">{mode === "customer" ? "verified customers" : "verified caretakers"}</p></>}</section>
    </div>
    {viewer && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase text-[#667267]">Private Evidence</p><h2 className="mt-1 text-2xl font-black">{viewer.title}</h2></div><button onClick={()=>setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">Close</button></div>{viewer.error ? <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-900">{viewer.error}</p> : !viewer.url ? <p className="mt-5 rounded-2xl bg-[#f6f3e8] p-5 text-sm font-bold text-[#667267]">Creating a short-lived secure link...</p> : <div className="mt-5"><a href={viewer.url} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Open Secure File</a>{viewer.kind === "image" && <img src={viewer.url} alt={viewer.title} className="mt-4 max-h-[65vh] w-full rounded-2xl object-contain" />}</div>}</div></div>}
  </AdminVerificationShell>;
}

type CaretakerForm = {
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  birthdate: string;
  addressLine: string;
  farmRole: string;
  paymentMethod: string;
  paymentAccountName: string;
  paymentAccountNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  password: string;
  confirmPassword: string;
};

export function SecureCaretakerSignupPage() {
  const [form,setForm]=useState<CaretakerForm>({ fullName:"", displayName:"", email:"", phone:"", birthdate:"", addressLine:"", farmRole:"", paymentMethod:"GCash", paymentAccountName:"", paymentAccountNumber:"", emergencyContactName:"", emergencyContactPhone:"", password:"", confirmPassword:"" });
  const [avatarFile,setAvatarFile]=useState<File | null>(null);
  const [resumeFile,setResumeFile]=useState<File | null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("Caretaker signup is an application. Account Verification approval is required before the caretaker app opens. Admin testers must use a separate Incognito window because this form signs the browser into the applicant account.");
  const update = (key:keyof CaretakerForm,value:string) => setForm(current=>({...current,[key]:value}));

  async function submit() {
    if (!form.fullName || !form.birthdate || !form.email || !form.phone || !avatarFile || !resumeFile || !form.password) { setMessage("Complete legal name, birthdate, email, phone, selfie, resume, and password."); return; }
    if (form.password !== form.confirmPassword) { setMessage("Password and confirmation do not match."); return; }
    const resumeTypes=["image/jpeg","image/png","image/webp","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!resumeTypes.includes(resumeFile.type) || resumeFile.size > 10*1024*1024) { setMessage("Resume must be PDF, DOC, DOCX, JPG, PNG, or WebP and no larger than 10 MB."); return; }
    if (avatarFile && (!['image/jpeg','image/png','image/webp'].includes(avatarFile.type) || avatarFile.size > 5*1024*1024)) { setMessage("Selfie must be JPG, PNG, or WebP and no larger than 5 MB."); return; }
    setLoading(true);
    setMessage("Creating login and preparing secure evidence upload...");
    try {
      const normalizedEmail=form.email.trim().toLowerCase();
      const applicantClient=createIsolatedSupabaseClient();
      let auth=await applicantClient.auth.signUp({ email:normalizedEmail, password:form.password, options:{ data:{ full_name:form.fullName, display_name:form.displayName, birthdate:form.birthdate, phone:form.phone, role:"caretaker_applicant" } } });
      if (auth.error) {
        const text=auth.error.message.toLowerCase();
        if (!text.includes("already") && !text.includes("registered") && !text.includes("exists")) throw auth.error;
        auth=await applicantClient.auth.signInWithPassword({ email:normalizedEmail, password:form.password });
      }
      if (auth.error) throw auth.error;
      if (!auth.data.session) {
        throw new Error("Confirm the applicant email first, then return to Login and reopen the caretaker registration link to submit the application.");
      }
      setMessage("Login ready. Uploading private selfie and resume...");
      const [resumePath,avatarPath]=await Promise.all([
        uploadPrivateEvidenceFile({ bucket:"caretaker-resumes", folder:"applications", kind:"resume", file:resumeFile, maxBytes:10*1024*1024, allowedMimeTypes:resumeTypes }, applicantClient),
        uploadPrivateEvidenceFile({ bucket:"caretaker-resumes", folder:"applications", kind:"avatar", file:avatarFile, maxBytes:5*1024*1024, allowedMimeTypes:["image/jpeg","image/png","image/webp"] }, applicantClient),
      ]);
      await submitCaretakerApplication({ fullName:form.fullName, displayName:form.displayName, phone:form.phone, birthdate:form.birthdate || null, addressLine:form.addressLine, avatarUrl:avatarPath, resumeUrl:resumePath, farmRole:form.farmRole, paymentMethod:form.paymentMethod, paymentAccountName:form.paymentAccountName, paymentAccountNumber:form.paymentAccountNumber, emergencyContactName:form.emergencyContactName, emergencyContactPhone:form.emergencyContactPhone, workPinSet:false }, applicantClient);
      setMessage("Application submitted with private evidence. Admin will review it in Account Verification.");
    } catch (error:unknown) {
      const source=error as { message?:string; details?:string; hint?:string };
      const rawMessage=source.message || source.details || source.hint || "Unknown application error";
      const normalizedMessage=rawMessage.toLowerCase();
      setMessage(
        normalizedMessage.includes("already") || normalizedMessage.includes("registered") || normalizedMessage.includes("exists")
          ? "This email already has an account. Use the correct existing password or return to Login. No duplicate application was created."
          : normalizedMessage.includes("password") && (normalizedMessage.includes("short") || normalizedMessage.includes("weak") || normalizedMessage.includes("characters"))
            ? "Use a stronger password that meets the required minimum length, then submit again."
            : `Application not submitted: ${rawMessage}`
      );
    } finally { setLoading(false); }
  }

  const inputClass="rounded-xl border border-[#ded8c9] bg-white p-3 font-bold";
  return <main className="min-h-screen bg-[#f6f3e8] bg-cover bg-center px-4 py-8 text-[#17251d]" style={{backgroundImage:"linear-gradient(180deg,rgba(255,253,247,.55),rgba(246,243,232,.46)),url('/farmconnect/farmconnect-hero-wallpaper.jpg')"}}><section className="mx-auto max-w-4xl rounded-[28px] border border-[#e3ded0] bg-white/95 p-6 shadow-xl"><p className="text-xs font-black uppercase text-[#1f6b45]">FarmConnect Worker Registration</p><h1 className="mt-1 text-4xl font-black">Caretaker Application</h1><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Admin reviews identity photo, resume, role, and payment details. No caretaker access opens before approval.</p><div className="mt-5 grid gap-3 md:grid-cols-2"><input className={inputClass} value={form.fullName} onChange={event=>update("fullName",event.target.value)} placeholder="Full name" /><input className={inputClass} value={form.displayName} onChange={event=>update("displayName",event.target.value)} placeholder="Nickname" /><input className={inputClass} value={form.email} onChange={event=>update("email",event.target.value)} placeholder="Email" type="email" /><input className={inputClass} value={form.phone} onChange={event=>update("phone",event.target.value)} placeholder="Phone" /><input className={inputClass} value={form.birthdate} onChange={event=>update("birthdate",event.target.value)} type="date" /><input className={inputClass} value={form.farmRole} onChange={event=>update("farmRole",event.target.value)} placeholder="Farm role / job type" /><input className={`${inputClass} md:col-span-2`} value={form.addressLine} onChange={event=>update("addressLine",event.target.value)} placeholder="Address" /><label className={inputClass}>Selfie photo (required)<input className="mt-2 block w-full text-sm" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={event=>setAvatarFile(event.target.files?.[0] || null)} />{avatarFile && <small className="mt-2 block text-[#1f6b45]">{avatarFile.name}</small>}</label><label className={inputClass}>Resume file (required)<input className="mt-2 block w-full text-sm" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={event=>setResumeFile(event.target.files?.[0] || null)} />{resumeFile && <small className="mt-2 block text-[#1f6b45]">{resumeFile.name}</small>}</label><select className={inputClass} value={form.paymentMethod} onChange={event=>update("paymentMethod",event.target.value)}><option>GCash</option><option>Maya</option><option>UnionBank</option><option>GoTyme</option><option>BPI</option><option>Other Bank</option></select><input className={inputClass} value={form.paymentAccountName} onChange={event=>update("paymentAccountName",event.target.value)} placeholder="Payment account name" /><input className={inputClass} value={form.paymentAccountNumber} onChange={event=>update("paymentAccountNumber",event.target.value)} placeholder="Payment account number/mobile" /><input className={inputClass} value={form.emergencyContactName} onChange={event=>update("emergencyContactName",event.target.value)} placeholder="Emergency contact name" /><input className={inputClass} value={form.emergencyContactPhone} onChange={event=>update("emergencyContactPhone",event.target.value)} placeholder="Emergency contact number" /><input className={inputClass} value={form.password} onChange={event=>update("password",event.target.value)} placeholder="Password" type="password" /><input className={inputClass} value={form.confirmPassword} onChange={event=>update("confirmPassword",event.target.value)} placeholder="Confirm password" type="password" /></div><p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">KaFarm: {message}</p><div className="mt-4 flex gap-3"><button disabled={loading} onClick={submit} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">{loading ? "Submitting..." : "Submit Application"}</button><Link href="/login" className="rounded-xl bg-[#eee8d9] px-5 py-3 font-black">Back to Login</Link></div></section></main>;
}
