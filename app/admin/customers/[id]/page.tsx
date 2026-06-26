"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type BackendRole = "ADMIN" | "CARETAKER" | "CUSTOMER";
type AnyRow = Record<string, any>;

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at?: string | null;
  id_type: string | null;
  id_number: string | null;
  id_front_url: string | null;
  selfie_url: string | null;
  verification_status: string | null;
  verification_notes: string | null;
  membership_plan: string | null;
  membership_fee: number | null;
  membership_status: string | null;
  membership_expiry: string | null;
  account_status: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

const MEMBERSHIP_FEE = 999;

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = String(params.id || "");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [backendRole, setBackendRole] = useState<BackendRole>("CUSTOMER");

  const [walletTransactions, setWalletTransactions] = useState<AnyRow[]>([]);
  const [cashins, setCashins] = useState<AnyRow[]>([]);
  const [cashouts, setCashouts] = useState<AnyRow[]>([]);
  const [sellRequests, setSellRequests] = useState<AnyRow[]>([]);
  const [caretakerHires, setCaretakerHires] = useState<AnyRow[]>([]);
  const [flocks, setFlocks] = useState<AnyRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rejectReason, setRejectReason] = useState("ID Photo Blurry");
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (customerId) loadCustomerCenter();
  }, [customerId]);

  async function loadCustomerCenter() {
    setLoading(true);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", customerId)
      .single();

    if (profileData) {
      setCustomer(profileData as Customer);
      setAdminNote(profileData.verification_notes || "");
    }

    const email = String(profileData?.email || "").trim();

    const [
      walletResult,
      adminResult,
      caretakerResult,
      walletTxResult,
      cashinResult,
      cashoutResult,
      sellResult,
      hireResult,
      flockResult,
    ] = await Promise.all([
      supabase
        .from("wallets")
        .select("*")
        .eq("profile_id", customerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("admins")
        .select("id, admin_profile_id, status")
        .eq("admin_profile_id", customerId)
        .eq("status", "ACTIVE")
        .maybeSingle(),

      supabase
        .from("caretakers")
        .select("id, caretaker_profile_id, email, status")
        .or(`caretaker_profile_id.eq.${customerId},email.eq.${email}`)
        .eq("status", "ACTIVE")
        .maybeSingle(),

      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("profile_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("cashin_requests")
        .select("*")
        .eq("profile_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("cashout_requests")
        .select("*")
        .eq("profile_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("sell_chicken_requests")
        .select("*")
        .eq("profile_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("customer_caretaker_hires")
        .select("*")
        .eq("profile_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("flocks")
        .select("*")
        .eq("profile_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setWallet((walletResult.data as Wallet) || null);
    setBackendRole(adminResult.data ? "ADMIN" : caretakerResult.data ? "CARETAKER" : "CUSTOMER");

    setWalletTransactions(walletTxResult.data || []);
    setCashins(cashinResult.data || []);
    setCashouts(cashoutResult.data || []);
    setSellRequests(sellResult.data || []);
    setCaretakerHires(hireResult.data || []);
    setFlocks(flockResult.data || []);

    setLoading(false);
  }

  const finance = useMemo(() => {
    const totalCashIn = cashins
      .filter((r) => status(r.status) === "APPROVED")
      .reduce((sum, r) => sum + moneyNumber(r.amount), 0);

    const totalCashOut = cashouts
      .filter((r) => ["APPROVED", "RELEASED"].includes(status(r.status)))
      .reduce((sum, r) => sum + moneyNumber(r.amount), 0);

    const totalChickenSales = sellRequests
      .filter((r) => status(r.status) === "APPROVED")
      .reduce((sum, r) => sum + moneyNumber(r.total_amount), 0);

    const totalCaretakerPayments = caretakerHires
      .filter((r) => status(r.payment_status) === "PAID")
      .reduce((sum, r) => sum + moneyNumber(r.total_fee), 0);

    return {
      totalCashIn,
      totalCashOut,
      totalChickenSales,
      totalCaretakerPayments,
      netFlow: totalCashIn + totalChickenSales - totalCashOut - totalCaretakerPayments,
    };
  }, [cashins, cashouts, sellRequests, caretakerHires]);

  const risk = useMemo(() => {
    let score = 0;
    const reasons: string[] = [];

    if (status(customer?.verification_status) === "REJECTED") {
      score += 35;
      reasons.push("KYC rejected");
    }

    if (cashins.filter((r) => status(r.status) === "REJECTED").length >= 2) {
      score += 20;
      reasons.push("Multiple rejected cash-in requests");
    }

    if (cashouts.filter((r) => status(r.status) === "REJECTED").length >= 2) {
      score += 20;
      reasons.push("Multiple rejected cash-out requests");
    }

    if (sellRequests.filter((r) => status(r.status) === "REJECTED").length >= 2) {
      score += 15;
      reasons.push("Multiple rejected sell requests");
    }

    if (moneyNumber(wallet?.balance) >= 100000) {
      score += 10;
      reasons.push("High wallet balance requires monitoring");
    }

    if (status(customer?.account_status) === "SUSPENDED") {
      score += 40;
      reasons.push("Account suspended");
    }

    return {
      score,
      level: score >= 60 ? "HIGH RISK" : score >= 25 ? "MEDIUM RISK" : "LOW RISK",
      reasons: reasons.length ? reasons : ["No major risk flags detected"],
    };
  }, [customer, wallet, cashins, cashouts, sellRequests]);

  async function updateCustomer(payload: Partial<Customer>) {
    if (!customer) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", customer.id);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await loadCustomerCenter();
    setSaving(false);
  }

  async function approveKyc() {
    await updateCustomer({
      verification_status: "APPROVED",
      verification_notes: "Identity verification approved by FarmConnect Admin.",
      account_status:
        status(customer?.membership_status) === "ACTIVE"
          ? "ACTIVE"
          : "PENDING_MEMBERSHIP",
    });
  }

  async function rejectKyc() {
    await updateCustomer({
      verification_status: "REJECTED",
      verification_notes: adminNote.trim()
        ? `${rejectReason}: ${adminNote.trim()}`
        : rejectReason,
      account_status: "REJECTED",
    });
  }

  async function resetPending() {
    await updateCustomer({
      verification_status: "PENDING",
      verification_notes: "KYC reset to pending review by Admin.",
      account_status: "PENDING",
    });
  }

  async function approveMembership() {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);

    await updateCustomer({
      membership_plan: "ANNUAL INVESTOR MEMBERSHIP",
      membership_fee: MEMBERSHIP_FEE,
      membership_status: "ACTIVE",
      membership_expiry: expiry.toISOString().slice(0, 10),
      account_status:
        status(customer?.verification_status) === "APPROVED"
          ? "ACTIVE"
          : "PENDING_KYC",
    });
  }

  async function suspendAccount() {
    if (!confirm("Suspend this customer account?")) return;

    await updateCustomer({
      account_status: "SUSPENDED",
      verification_notes: adminNote.trim()
        ? `Account suspended: ${adminNote.trim()}`
        : "Account suspended by FarmConnect Admin.",
    });
  }

  async function activateAccount() {
    await updateCustomer({
      account_status: "ACTIVE",
      verification_status: "APPROVED",
      membership_status: "ACTIVE",
    });
  }

  function openImage(url?: string | null) {
    if (!url) return alert("No image uploaded.");
    window.open(url, "_blank");
  }

  if (loading) {
    return (
      <main style={page}>
        <h1>Loading Customer Intelligence Center...</h1>
      </main>
    );
  }

  if (!customer) {
    return (
      <main style={page}>
        <h1>Customer not found</h1>
        <button style={backButton} onClick={() => router.push("/admin/customers")}>
          Back to Customers
        </button>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={container}>
        <button style={backButton} onClick={() => router.push("/admin/customers")}>
          ← Back to Customers
        </button>

        <section style={adminLinks}>
          <button onClick={() => router.push("/admin/customers")} style={linkButton}>Customers</button>
          <button onClick={() => router.push("/admin/memberships")} style={linkButton}>Memberships</button>
          <button onClick={() => router.push("/admin/wallet")} style={linkButton}>Wallet</button>
          <button onClick={() => router.push("/admin/transactions")} style={linkButton}>Transactions</button>
          <button onClick={() => router.push("/admin/caretaker-hires")} style={linkButton}>Caretaker Hires</button>
        </section>

        <section style={header}>
          <div>
            <p style={eyebrow}>FARMCONNECT CUSTOMER INTELLIGENCE CENTER</p>
            <h1 style={title}>{customer.full_name || "Unnamed Customer"}</h1>
            <p style={subtitle}>
              Full customer profile, KYC review, membership control, wallet
              activity, poultry ownership, and anti-scam risk monitoring.
            </p>

            <div style={idBox}>
              <b>Profile ID:</b>
              <span>{customer.id}</span>
            </div>
          </div>

          <div style={statusPanel}>
            <Status label="Backend Role" value={backendRole} />
            <Status label="KYC" value={customer.verification_status || "PENDING"} />
            <Status label="Membership" value={customer.membership_status || "UNPAID"} />
            <Status label="Account" value={customer.account_status || "PENDING"} />
            <Status label="Risk" value={risk.level} />
          </div>
        </section>

        <section style={statsGrid}>
          <Stat label="Wallet Balance" value={peso(wallet?.balance)} tone="green" />
          <Stat label="Total Cash-In" value={peso(finance.totalCashIn)} tone="blue" />
          <Stat label="Total Cash-Out" value={peso(finance.totalCashOut)} tone="red" />
          <Stat label="Chicken Sales" value={peso(finance.totalChickenSales)} tone="green" />
          <Stat label="Caretaker Payments" value={peso(finance.totalCaretakerPayments)} tone="orange" />
          <Stat label="Net Flow" value={peso(finance.netFlow)} tone="dark" />
        </section>

        <section style={grid}>
          <section style={card}>
            <h2 style={sectionTitle}>Customer Identity</h2>
            <Info label="Backend Role" value={backendRole} />
            <Info label="Profile ID" value={customer.id} mono />
            <Info label="Full Name" value={customer.full_name} />
            <Info label="Email" value={customer.email} />
            <Info label="Phone" value={customer.phone} />
            <Info label="Created Date" value={formatDate(customer.created_at)} />
            <Info label="Wallet Balance" value={peso(wallet?.balance)} />
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>KYC Verification Center</h2>
            <Info label="ID Type" value={customer.id_type} />
            <Info label="ID Number" value={customer.id_number} />
            <Info label="Verification Status" value={customer.verification_status || "PENDING"} />
            <Info label="Verification Notes" value={customer.verification_notes} />

            <div style={imageGrid}>
              <KycImage title="ID Front Photo" url={customer.id_front_url} onOpen={() => openImage(customer.id_front_url)} />
              <KycImage title="Selfie Photo" url={customer.selfie_url} onOpen={() => openImage(customer.selfie_url)} />
            </div>
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Membership Profile</h2>
            <Info label="Plan" value={customer.membership_plan || "ANNUAL INVESTOR MEMBERSHIP"} />
            <Info label="Fee" value={peso(customer.membership_fee || MEMBERSHIP_FEE)} />
            <Info label="Status" value={customer.membership_status || "UNPAID"} />
            <Info label="Expiry" value={customer.membership_expiry || "-"} />

            <button style={memberButton} onClick={approveMembership} disabled={saving}>
              Approve / Extend Membership 1 Year
            </button>
          </section>

          <section style={riskCard(risk.level)}>
            <h2 style={sectionTitle}>Anti-Scam Risk Profile</h2>
            <h3 style={riskTitle}>{risk.level}</h3>
            <p style={riskScore}>Risk Score: {risk.score}</p>
            <ul style={riskList}>{risk.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </section>
        </section>

        <section style={actionCard}>
          <h2 style={sectionTitle}>Admin Controls</h2>

          <div style={actionGrid}>
            <div style={approvalBox}>
              <h3>Approve KYC</h3>
              <p>Mark identity as approved. Account becomes active only when membership is also active.</p>
              <button style={approveButton} onClick={approveKyc} disabled={saving}>Approve KYC</button>
            </div>

            <div style={rejectBox}>
              <h3>Reject KYC</h3>

              <label style={label}>Rejection Reason</label>
              <select style={input} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                <option>ID Photo Blurry</option>
                <option>Selfie Blurry</option>
                <option>Expired ID</option>
                <option>Information Mismatch</option>
                <option>Duplicate Account</option>
                <option>Incomplete Submission</option>
                <option>Suspicious Identity</option>
                <option>Other</option>
              </select>

              <label style={label}>Admin Notes</label>
              <textarea
                style={textarea}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Example: ID name does not match profile name."
              />

              <button style={rejectButton} onClick={rejectKyc} disabled={saving}>Reject KYC</button>
            </div>

            <div style={controlBox}>
              <h3>Account Status</h3>
              <button style={activateButton} onClick={activateAccount} disabled={saving}>Activate Account</button>
              <button style={suspendButton} onClick={suspendAccount} disabled={saving}>Suspend Account</button>
              <button style={pendingButton} onClick={resetPending} disabled={saving}>Reset KYC Pending</button>
            </div>
          </div>
        </section>

        <section style={activityGrid}>
          <Activity title="Wallet Transactions" rows={walletTransactions} type="wallet" />
          <Activity title="Cash-In Requests" rows={cashins} type="cashin" />
          <Activity title="Cash-Out Requests" rows={cashouts} type="cashout" />
          <Activity title="Sell Chicken Requests" rows={sellRequests} type="sell" />
          <Activity title="Caretaker Hires" rows={caretakerHires} type="hire" />
          <Activity title="Flocks Owned" rows={flocks} type="flock" />
        </section>
      </div>
    </main>
  );
}

function Activity({ title, rows, type }: { title: string; rows: AnyRow[]; type: string }) {
  return (
    <section style={card}>
      <h2 style={sectionTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p style={muted}>No records found.</p>
      ) : (
        <div style={list}>
          {rows.slice(0, 8).map((row) => (
            <div key={row.id} style={listItem}>
              <div>
                <b>{activityMain(row, type)}</b>
                <p style={smallText}>{activitySub(row, type)}</p>
                <p style={smallText}>{formatDate(row.created_at)}</p>
              </div>
              <span style={badge(status(row.status || row.payment_status))}>
                {status(row.status || row.payment_status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function activityMain(row: AnyRow, type: string) {
  if (type === "wallet") return `${row.transaction_type || "Transaction"} ${peso(row.amount)}`;
  if (type === "sell") return `${row.quantity || 0} chicken(s) • ${peso(row.total_amount)}`;
  if (type === "hire") return `${row.caretaker_name || "Caretaker"} • ${peso(row.total_fee)}`;
  if (type === "flock") return `${row.batch_no || row.batch_name || "Flock"} • ${row.breed || "Poultry"}`;
  return `${row.channel || row.payment_method || "Request"} • ${peso(row.amount)}`;
}

function activitySub(row: AnyRow, type: string) {
  if (type === "wallet") return row.remarks || row.reference_no || "-";
  if (type === "sell") return row.batch_no || row.chicken_stage || "-";
  if (type === "hire") return `Duration: ${row.duration_days || 0} days`;
  if (type === "flock") return `Alive: ${row.alive_count || row.chicks_alive || 0}`;
  return row.reference_no || row.account_number || row.admin_notes || "-";
}

function KycImage({ title, url, onOpen }: { title: string; url?: string | null; onOpen: () => void }) {
  return (
    <div style={imageCard}>
      <p style={imageTitle}>{title}</p>
      {url ? (
        <>
          <img src={url} alt={title} style={imagePreview} />
          <button style={viewImageButton} onClick={onOpen}>View Full Image</button>
        </>
      ) : (
        <div style={noImage}>No Upload</div>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div style={infoRow}>
      <span>{label}</span>
      <b style={mono ? monoText : undefined}>{value || "-"}</b>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div style={statusBox}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "green" | "blue" | "red" | "orange" | "dark" }) {
  const color =
    tone === "green" ? "#16a34a" :
    tone === "blue" ? "#2563eb" :
    tone === "red" ? "#dc2626" :
    tone === "orange" ? "#f59e0b" : "#0f172a";

  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: color }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function moneyNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function peso(value: any) {
  return moneyNumber(value).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
}

function status(value?: string | null) {
  return (value || "PENDING").toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH");
}

function badge(value: string): React.CSSProperties {
  if (["APPROVED", "ACTIVE", "COMPLETED", "PAID", "RELEASED"].includes(value)) {
    return { ...badgeBase, background: "#dcfce7", color: "#166534" };
  }
  if (["REJECTED", "SUSPENDED", "FAILED"].includes(value)) {
    return { ...badgeBase, background: "#fee2e2", color: "#991b1b" };
  }
  return { ...badgeBase, background: "#fef3c7", color: "#92400e" };
}

function riskCard(level: string): React.CSSProperties {
  if (level === "HIGH RISK") return { ...card, border: "2px solid #dc2626", background: "#fff1f2" };
  if (level === "MEDIUM RISK") return { ...card, border: "2px solid #f59e0b", background: "#fffbeb" };
  return { ...card, border: "2px solid #16a34a", background: "#f0fdf4" };
}

const page: React.CSSProperties = { minHeight: "100vh", background: "linear-gradient(135deg, #f8fafc, #ecfdf5, #eff6ff)", padding: 24, color: "#0f172a" };
const container: React.CSSProperties = { maxWidth: 1450, margin: "0 auto" };
const backButton: React.CSSProperties = { border: "none", background: "#0f172a", color: "white", padding: "12px 16px", borderRadius: 14, cursor: "pointer", fontWeight: 900, marginBottom: 16 };
const adminLinks: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 };
const linkButton: React.CSSProperties = { border: "none", background: "#14532d", color: "white", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 900 };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", marginBottom: 24, background: "white", borderRadius: 28, padding: 26, boxShadow: "0 20px 45px rgba(15,23,42,0.08)" };
const eyebrow: React.CSSProperties = { color: "#2563eb", fontWeight: 950, letterSpacing: 1, fontSize: 12 };
const title: React.CSSProperties = { fontSize: 42, fontWeight: 950, margin: 0 };
const subtitle: React.CSSProperties = { color: "#475569", fontSize: 16, maxWidth: 780 };
const idBox: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, background: "#f8fafc", padding: 12, borderRadius: 14, fontSize: 13 };
const statusPanel: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: 10, minWidth: 260 };
const statusBox: React.CSSProperties = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 };
const statsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 20 };
const statCard: React.CSSProperties = { background: "white", borderRadius: 22, padding: 18, boxShadow: "0 15px 30px rgba(15,23,42,0.08)" };
const statBar: React.CSSProperties = { width: 48, height: 7, borderRadius: 99, marginBottom: 12 };
const statLabel: React.CSSProperties = { margin: 0, color: "#64748b", fontWeight: 900, fontSize: 13 };
const statValue: React.CSSProperties = { margin: "6px 0 0", fontSize: 24, fontWeight: 950 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 20, marginBottom: 20 };
const activityGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 };
const card: React.CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 26, padding: 24, boxShadow: "0 25px 55px rgba(15,23,42,0.08)" };
const actionCard: React.CSSProperties = { background: "#ffffff", border: "1px solid #bfdbfe", borderRadius: 26, padding: 24, boxShadow: "0 25px 55px rgba(15,23,42,0.1)", marginBottom: 20 };
const sectionTitle: React.CSSProperties = { fontSize: 23, fontWeight: 950, marginTop: 0 };
const infoRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid #e2e8f0", color: "#334155" };
const imageGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 };
const imageCard: React.CSSProperties = { background: "#f8fafc", borderRadius: 18, padding: 12, border: "1px solid #e2e8f0" };
const imageTitle: React.CSSProperties = { margin: "0 0 10px", fontWeight: 900 };
const imagePreview: React.CSSProperties = { width: "100%", height: 170, objectFit: "cover", borderRadius: 14, border: "1px solid #cbd5e1" };
const noImage: React.CSSProperties = { height: 170, display: "grid", placeItems: "center", background: "#e2e8f0", borderRadius: 14, color: "#64748b", fontWeight: 900 };
const viewImageButton: React.CSSProperties = { width: "100%", marginTop: 10, padding: 10, borderRadius: 12, border: "none", background: "#2563eb", color: "white", fontWeight: 900, cursor: "pointer" };
const actionGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 };
const approvalBox: React.CSSProperties = { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: 18 };
const rejectBox: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 20, padding: 18 };
const controlBox: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: 18, display: "grid", gap: 12 };
const label: React.CSSProperties = { display: "block", marginTop: 12, marginBottom: 7, fontWeight: 900, fontSize: 13 };
const input: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 14, border: "1px solid #cbd5e1" };
const textarea: React.CSSProperties = { width: "100%", minHeight: 90, padding: 13, borderRadius: 14, border: "1px solid #cbd5e1", resize: "vertical" };
const approveButton: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 16, border: "none", background: "#16a34a", color: "white", fontWeight: 950, cursor: "pointer" };
const rejectButton: React.CSSProperties = { width: "100%", marginTop: 15, padding: 15, borderRadius: 16, border: "none", background: "#dc2626", color: "white", fontWeight: 950, cursor: "pointer" };
const pendingButton: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 16, border: "none", background: "#f59e0b", color: "white", fontWeight: 950, cursor: "pointer" };
const activateButton: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 16, border: "none", background: "#16a34a", color: "white", fontWeight: 950, cursor: "pointer" };
const suspendButton: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 16, border: "none", background: "#991b1b", color: "white", fontWeight: 950, cursor: "pointer" };
const memberButton: React.CSSProperties = { width: "100%", marginTop: 18, padding: 14, borderRadius: 16, border: "none", background: "#14532d", color: "white", fontWeight: 950, cursor: "pointer" };
const riskTitle: React.CSSProperties = { fontSize: 32, margin: "10px 0", fontWeight: 950 };
const riskScore: React.CSSProperties = { fontWeight: 900, color: "#475569" };
const riskList: React.CSSProperties = { paddingLeft: 20, color: "#334155", fontWeight: 700 };
const list: React.CSSProperties = { display: "grid", gap: 10 };
const listItem: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" };
const smallText: React.CSSProperties = { margin: "4px 0 0", color: "#64748b", fontSize: 12 };
const badgeBase: React.CSSProperties = { alignSelf: "flex-start", padding: "7px 10px", borderRadius: 999, fontSize: 11, fontWeight: 950 };
const monoText: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, wordBreak: "break-all" };
const muted: React.CSSProperties = { color: "#64748b", fontWeight: 700 };