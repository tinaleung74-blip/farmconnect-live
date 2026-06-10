"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CashIn = {
  id: string;
  customer_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  reference_number?: string | null;
  created_at?: string | null;
};

type CashOut = {
  id: string;
  customer_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  created_at?: string | null;
};

type WalletTx = {
  id: string;
  customer_id?: string | null;
  type?: string | null;
  amount?: number | string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string | null;
};

export default function AdminTransactionsPage() {
  const [cashins, setCashins] = useState<CashIn[]>([]);
  const [cashouts, setCashouts] = useState<CashOut[]>([]);
  const [wallets, setWallets] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);

    const [cashinRes, cashoutRes, walletRes] = await Promise.all([
      supabase.from("cashin_requests").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("cashout_requests").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(120),
    ]);

    if (cashinRes.error) console.error(cashinRes.error.message);
    if (cashoutRes.error) console.error(cashoutRes.error.message);
    if (walletRes.error) console.error(walletRes.error.message);

    setCashins(cashinRes.data || []);
    setCashouts(cashoutRes.data || []);
    setWallets(walletRes.data || []);
    setLoading(false);
  }

  const summary = useMemo(() => {
    const cashinTotal = cashins.reduce((sum, x) => sum + toNumber(x.amount), 0);
    const cashoutTotal = cashouts.reduce((sum, x) => sum + toNumber(x.amount), 0);
    const walletTotal = wallets.reduce((sum, x) => sum + toNumber(x.amount), 0);

    const pending =
      cashins.filter((x) => status(x.status) === "PENDING").length +
      cashouts.filter((x) => status(x.status) === "PENDING").length +
      wallets.filter((x) => status(x.status) === "PENDING").length;

    return {
      cashinTotal,
      cashoutTotal,
      walletTotal,
      net: cashinTotal - cashoutTotal,
      pending,
      count: cashins.length + cashouts.length + wallets.length,
    };
  }, [cashins, cashouts, wallets]);

  const recent = [
    ...cashins.map((x) => ({
      id: `cashin-${x.id}`,
      date: x.created_at,
      category: "Cash-In",
      customer: x.customer_id || "—",
      reference: x.reference_number || x.id,
      amount: toNumber(x.amount),
      status: x.status || "PENDING",
    })),
    ...cashouts.map((x) => ({
      id: `cashout-${x.id}`,
      date: x.created_at,
      category: "Cash-Out",
      customer: x.customer_id || "—",
      reference: x.account_name || x.bank_name || x.id,
      amount: toNumber(x.amount),
      status: x.status || "PENDING",
    })),
    ...wallets.map((x) => ({
      id: `wallet-${x.id}`,
      date: x.created_at,
      category: x.type || "Wallet",
      customer: x.customer_id || "—",
      reference: x.reference || x.id,
      amount: toNumber(x.amount),
      status: x.status || "POSTED",
    })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 20);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Financial Operations</p>
          <h1 style={title}>Transactions Center</h1>
          <p style={subtitle}>
            Central transaction command page for cash-in, cash-out, wallet ledger, approvals,
            and customer fund movement under admin control.
          </p>
        </div>

        <button onClick={loadTransactions} style={refreshBtn}>Refresh</button>
      </section>

      <section style={navGrid}>
        <Link href="/admin/transactions/cashin" style={navCard}>
          <span style={navIcon}>⬇️</span>
          <strong>Cash-In Requests</strong>
          <p>Review customer funding and proof of payment.</p>
        </Link>

        <Link href="/admin/transactions/cashout" style={navCard}>
          <span style={navIcon}>⬆️</span>
          <strong>Cash-Out Requests</strong>
          <p>Review withdrawals, bank details, and releases.</p>
        </Link>

        <Link href="/admin/wallet" style={navCard}>
          <span style={navIcon}>💳</span>
          <strong>Wallet Ledger</strong>
          <p>Monitor wallet credits, debits, and adjustments.</p>
        </Link>
      </section>

      <section style={statsGrid}>
        <MoneyCard label="Net Transaction Flow" value={summary.net} accent="#2563eb" />
        <MoneyCard label="Cash-In Volume" value={summary.cashinTotal} accent="#16a34a" />
        <MoneyCard label="Cash-Out Volume" value={summary.cashoutTotal} accent="#dc2626" />
        <CountCard label="Pending Reviews" value={summary.pending} accent="#f59e0b" />
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Recent Transaction Activity</h2>
            <p style={sectionDesc}>
              Customer transactions are reviewed by admin. Caretakers do not transact directly with customers.
            </p>
          </div>
          <span style={pill}>{summary.count} total</span>
        </div>

        {loading ? (
          <Empty text="Loading transactions..." />
        ) : recent.length === 0 ? (
          <Empty text="No transactions found." />
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Category</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr key={tx.id} style={tr}>
                    <td style={td}>{tx.date ? new Date(tx.date).toLocaleString() : "—"}</td>
                    <td style={td}><strong>{tx.category}</strong></td>
                    <td style={td}>{tx.customer}</td>
                    <td style={td}>{tx.reference}</td>
                    <td style={td}><strong>{money(tx.amount)}</strong></td>
                    <td style={td}>
                      <span style={{ ...badge, background: statusBg(tx.status), color: statusColor(tx.status) }}>
                        {status(tx.status)}
                      </span>
                    </td>
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

function MoneyCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statMoney}>{money(value)}</h2>
    </div>
  );
}

function CountCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={emptyBox}>{text}</div>;
}

function toNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0);
}

function status(value?: string | null) {
  return (value || "PENDING").toUpperCase();
}

function statusBg(value?: string | null) {
  const s = status(value);
  if (s === "APPROVED" || s === "POSTED" || s === "COMPLETED") return "#dcfce7";
  if (s === "REJECTED" || s === "FAILED") return "#fee2e2";
  return "#fef3c7";
}

function statusColor(value?: string | null) {
  const s = status(value);
  if (s === "APPROVED" || s === "POSTED" || s === "COMPLETED") return "#166534";
  if (s === "REJECTED" || s === "FAILED") return "#991b1b";
  return "#92400e";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 45%, #ecfdf5 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #0f172a, #2563eb, #16a34a)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,.18)",
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", opacity: .88 };
const title: React.CSSProperties = { margin: "8px 0", fontSize: 42, fontWeight: 950 };
const subtitle: React.CSSProperties = { margin: 0, maxWidth: 760, fontSize: 15, lineHeight: 1.6, opacity: .92 };

const refreshBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "13px 18px",
  fontWeight: 950,
  color: "#0f172a",
  background: "white",
  cursor: "pointer",
};

const navGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const navCard: React.CSSProperties = {
  textDecoration: "none",
  color: "#0f172a",
  padding: 20,
  borderRadius: 24,
  background: "rgba(255,255,255,.94)",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 15px 32px rgba(15,23,42,.08)",
};

const navIcon: React.CSSProperties = {
  display: "block",
  fontSize: 30,
  marginBottom: 10,
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
  background: "rgba(255,255,255,.93)",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 15px 32px rgba(15,23,42,.08)",
};

const statBar: React.CSSProperties = { width: 50, height: 8, borderRadius: 999, marginBottom: 14 };
const statLabel: React.CSSProperties = { margin: 0, color: "#64748b", fontSize: 13, fontWeight: 900 };
const statMoney: React.CSSProperties = { margin: "8px 0 0", fontSize: 27, fontWeight: 950 };
const statValue: React.CSSProperties = { margin: "8px 0 0", fontSize: 34, fontWeight: 950 };

const card: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,.94)",
  border: "1px solid rgba(148,163,184,.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,.08)",
};

const cardHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", marginBottom: 16 };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 22, fontWeight: 950 };
const sectionDesc: React.CSSProperties = { margin: "6px 0 0", color: "#64748b", fontSize: 14 };
const pill: React.CSSProperties = { padding: "8px 12px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontWeight: 950, fontSize: 12 };

const tableWrap: React.CSSProperties = { overflowX: "auto" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 850 };
const th: React.CSSProperties = { textAlign: "left", padding: "14px 12px", fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: .8, borderBottom: "1px solid #e2e8f0" };
const tr: React.CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: React.CSSProperties = { padding: "15px 12px", fontSize: 14, verticalAlign: "top" };
const badge: React.CSSProperties = { display: "inline-block", padding: "7px 10px", borderRadius: 999, fontSize: 11, fontWeight: 950 };
const emptyBox: React.CSSProperties = { padding: 30, borderRadius: 18, background: "#f8fafc", color: "#64748b", textAlign: "center", fontWeight: 850 };