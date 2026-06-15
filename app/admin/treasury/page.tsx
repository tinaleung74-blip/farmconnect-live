"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

const REVENUE_TYPES = [
  "MEMBERSHIP_PAYMENT_APPROVED",
  "FARMCONNECT_TECHNICAL_FEE",
  "FARMCONNECT_CASHOUT_FEE",
  "FARMCONNECT_SELL_CHICKEN_FEE",
];

export default function AdminTreasuryPage() {
  const [walletTx, setWalletTx] = useState<Row[]>([]);
  const [cashins, setCashins] = useState<Row[]>([]);
  const [cashouts, setCashouts] = useState<Row[]>([]);
  const [memberships, setMemberships] = useState<Row[]>([]);
  const [sellRequests, setSellRequests] = useState<Row[]>([]);
  const [caretakerHires, setCaretakerHires] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTreasury();
  }, []);

  async function loadTreasury() {
    setLoading(true);

    const [
      walletRes,
      cashinRes,
      cashoutRes,
      membershipRes,
      sellRes,
      hireRes,
      profileRes,
    ] = await Promise.all([
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("cashin_requests").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("cashout_requests").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("membership_payments").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("sell_chicken_requests").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("customer_caretaker_hires").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id,full_name,email,wallet_balance,membership_status,verification_status,account_status"),
    ]);

    setWalletTx(walletRes.data || []);
    setCashins(cashinRes.data || []);
    setCashouts(cashoutRes.data || []);
    setMemberships(membershipRes.data || []);
    setSellRequests(sellRes.data || []);
    setCaretakerHires(hireRes.data || []);
    setProfiles(profileRes.data || []);
    setLoading(false);
  }

  const data = useMemo(() => {
    const completed = walletTx.filter((x) =>
      ["COMPLETED", "APPROVED", "PAID"].includes(status(x.status))
    );

    const membershipRevenue = sumType(completed, "MEMBERSHIP_PAYMENT_APPROVED");
    const caretakerFees = sumType(completed, "FARMCONNECT_TECHNICAL_FEE");
    const cashoutFees = sumType(completed, "FARMCONNECT_CASHOUT_FEE");
    const sellFees = sumType(completed, "FARMCONNECT_SELL_CHICKEN_FEE");

    const totalRevenue =
      membershipRevenue + caretakerFees + cashoutFees + sellFees;

    const totalCustomerWallets = profiles.reduce(
      (sum, p) => sum + num(p.wallet_balance),
      0
    );

    return {
      totalRevenue,
      membershipRevenue,
      caretakerFees,
      cashoutFees,
      sellFees,
      pendingMemberships: memberships.filter((x) => status(x.status) === "PENDING").length,
      pendingCashins: cashins.filter((x) => status(x.status) === "PENDING").length,
      pendingCashouts: cashouts.filter((x) => ["PENDING", "PROCESSING"].includes(status(x.status))).length,
      pendingSell: sellRequests.filter((x) => status(x.status) === "PENDING_ADMIN_APPROVAL").length,
      pendingHires: caretakerHires.filter((x) => status(x.status) === "PENDING_ADMIN_APPROVAL").length,
      activeMembers: profiles.filter((x) => status(x.membership_status) === "ACTIVE").length,
      approvedKyc: profiles.filter((x) => status(x.verification_status) === "APPROVED").length,
      totalCustomerWallets,
    };
  }, [walletTx, cashins, cashouts, memberships, sellRequests, caretakerHires, profiles]);

  const revenueFeed = walletTx
    .filter((x) => REVENUE_TYPES.includes(String(x.transaction_type || "")))
    .slice(0, 20);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>← Back Admin</Link>
          <p style={eyebrow}>FarmConnect V26.6</p>
          <h1 style={title}>Treasury Revenue Dashboard</h1>
          <p style={subtitle}>
            Track FarmConnect earnings, 2% technical fees, membership revenue,
            pending approvals, and customer wallet exposure.
          </p>
        </div>

        <button onClick={loadTreasury} style={refreshBtn}>
          Refresh
        </button>
      </section>

      <section style={statsGrid}>
        <Card label="Total FarmConnect Revenue" value={money(data.totalRevenue)} accent="#14532d" />
        <Card label="Membership Revenue" value={money(data.membershipRevenue)} accent="#2563eb" />
        <Card label="Caretaker 2% Fees" value={money(data.caretakerFees)} accent="#16a34a" />
        <Card label="Cash-Out 2% Fees" value={money(data.cashoutFees)} accent="#dc2626" />
        <Card label="Sell Chicken 2% Fees" value={money(data.sellFees)} accent="#f59e0b" />
        <Card label="Customer Wallet Exposure" value={money(data.totalCustomerWallets)} accent="#0f766e" />
      </section>

      <section style={statsGrid}>
        <SmallCard label="Pending Memberships" value={data.pendingMemberships} href="/admin/memberships" />
        <SmallCard label="Pending Cash-In" value={data.pendingCashins} href="/admin/transactions/cashin" />
        <SmallCard label="Pending Cash-Out" value={data.pendingCashouts} href="/admin/transactions/cashout" />
        <SmallCard label="Pending Sell Requests" value={data.pendingSell} href="/admin/sell-requests" />
        <SmallCard label="Pending Caretaker Hires" value={data.pendingHires} href="/admin/caretaker-hires" />
        <SmallCard label="Active Members" value={data.activeMembers} href="/admin/customers" />
      </section>

      <section style={gridTwo}>
        <section style={card}>
          <h2 style={sectionTitle}>Revenue Breakdown</h2>

          <Breakdown label="Membership Revenue" value={data.membershipRevenue} />
          <Breakdown label="Caretaker Technical Fees" value={data.caretakerFees} />
          <Breakdown label="Cash-Out Technical Fees" value={data.cashoutFees} />
          <Breakdown label="Sell Chicken Technical Fees" value={data.sellFees} />

          <div style={totalBox}>
            <span>Total Revenue</span>
            <b>{money(data.totalRevenue)}</b>
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>Pending Approval Queue</h2>

          <Queue label="Membership Payments" value={data.pendingMemberships} href="/admin/memberships" />
          <Queue label="Cash-In Requests" value={data.pendingCashins} href="/admin/transactions/cashin" />
          <Queue label="Cash-Out Requests" value={data.pendingCashouts} href="/admin/transactions/cashout" />
          <Queue label="Sell Chicken Requests" value={data.pendingSell} href="/admin/sell-requests" />
          <Queue label="Caretaker Hires" value={data.pendingHires} href="/admin/caretaker-hires" />
        </section>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Latest FarmConnect Earnings</h2>
            <p style={muted}>
              Only revenue transactions are shown here: membership, caretaker
              2%, cash-out 2%, and sell chicken 2%.
            </p>
          </div>
          <span style={pill}>{revenueFeed.length} records</span>
        </div>

        {loading ? (
          <Empty text="Loading treasury..." />
        ) : revenueFeed.length === 0 ? (
          <Empty text="No revenue transactions yet." />
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Type</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Status</th>
                  <th style={th}>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {revenueFeed.map((tx) => (
                  <tr key={tx.id} style={tr}>
                    <td style={td}>{formatDate(tx.created_at)}</td>
                    <td style={td}><b>{tx.transaction_type}</b></td>
                    <td style={td}><b style={{ color: "#15803d" }}>{money(tx.amount)}</b></td>
                    <td style={td}>{tx.reference_no || tx.id}</td>
                    <td style={td}>
                      <span style={badge(tx.status)}>{status(tx.status)}</span>
                    </td>
                    <td style={td}>{tx.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function SmallCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} style={smallCard}>
      <p>{label}</p>
      <h2>{value}</h2>
      <span>Review →</span>
    </Link>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div style={row}>
      <span>{label}</span>
      <b>{money(value)}</b>
    </div>
  );
}

function Queue({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} style={queueRow}>
      <span>{label}</span>
      <b>{value}</b>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={emptyBox}>{text}</div>;
}

function sumType(rows: Row[], type: string) {
  return rows
    .filter((x) => String(x.transaction_type || "") === type)
    .reduce((sum, x) => sum + num(x.amount), 0);
}

function num(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: any) {
  return num(value).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
}

function status(value?: string | null) {
  return String(value || "PENDING").toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH");
}

function badge(value?: string | null): React.CSSProperties {
  const s = status(value);

  if (["COMPLETED", "APPROVED", "ACTIVE", "PAID"].includes(s)) {
    return { ...badgeBase, background: "#dcfce7", color: "#166534" };
  }

  if (["REJECTED", "FAILED", "SUSPENDED"].includes(s)) {
    return { ...badgeBase, background: "#fee2e2", color: "#991b1b" };
  }

  return { ...badgeBase, background: "#fef3c7", color: "#92400e" };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "linear-gradient(135deg, #ecfdf5 0%, #f8fafc 45%, #fff7ed 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #064e3b, #047857, #0f766e)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,.18)",
  marginBottom: 24,
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 12,
  color: "white",
  fontWeight: 950,
  textDecoration: "none",
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  opacity: 0.9,
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 42,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 15,
  lineHeight: 1.6,
  opacity: 0.92,
};

const refreshBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "13px 18px",
  fontWeight: 950,
  color: "#064e3b",
  background: "white",
  cursor: "pointer",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const statCard: React.CSSProperties = {
  padding: 21,
  borderRadius: 24,
  background: "rgba(255,255,255,.94)",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 15px 32px rgba(15,23,42,.08)",
};

const statBar: React.CSSProperties = {
  width: 48,
  height: 8,
  borderRadius: 999,
  marginBottom: 14,
};

const statLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const statValue: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 27,
  fontWeight: 950,
};

const smallCard: React.CSSProperties = {
  textDecoration: "none",
  padding: 20,
  borderRadius: 22,
  background: "white",
  color: "#0f172a",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 12px 25px rgba(15,23,42,.07)",
};

const gridTwo: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 18,
  marginBottom: 18,
};

const card: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,.94)",
  border: "1px solid rgba(148,163,184,.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,.08)",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 950,
};

const muted: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const pill: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 950,
  fontSize: 12,
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  padding: "15px 0",
  borderBottom: "1px solid #e2e8f0",
};

const queueRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  padding: "15px 0",
  borderBottom: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "#0f172a",
  fontWeight: 900,
};

const totalBox: React.CSSProperties = {
  marginTop: 16,
  padding: 18,
  borderRadius: 18,
  background: "#dcfce7",
  color: "#14532d",
  display: "flex",
  justifyContent: "space-between",
  fontWeight: 950,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1000,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 12px",
  fontSize: 12,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  borderBottom: "1px solid #e2e8f0",
};

const tr: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
};

const td: React.CSSProperties = {
  padding: "15px 12px",
  fontSize: 14,
  verticalAlign: "top",
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const emptyBox: React.CSSProperties = {
  padding: 28,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};