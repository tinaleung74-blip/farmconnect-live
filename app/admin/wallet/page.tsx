"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WalletTransaction = {
  id: string;
  customer_id?: string | null;
  type?: string | null;
  amount?: number | string | null;
  status?: string | null;
  reference?: string | null;
  description?: string | null;
  created_at?: string | null;
};

export default function AdminWalletPage() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    setLoading(true);

    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      console.error("Wallet transactions error:", error.message);
      setTransactions([]);
    } else {
      setTransactions(data || []);
    }

    setLoading(false);
  }

  const summary = useMemo(() => {
    const credits = transactions
      .filter((tx) => isCredit(tx.type))
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const debits = transactions
      .filter((tx) => isDebit(tx.type))
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const pending = transactions
      .filter((tx) => normalizeStatus(tx.status) === "PENDING")
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    return {
      credits,
      debits,
      net: credits - debits,
      pending,
      count: transactions.length,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const type = (tx.type || "").toUpperCase();
      const status = normalizeStatus(tx.status);

      const matchFilter =
        filter === "ALL" ||
        type === filter ||
        status === filter ||
        (filter === "CREDIT" && isCredit(tx.type)) ||
        (filter === "DEBIT" && isDebit(tx.type));

      const text = `
        ${tx.id}
        ${tx.customer_id || ""}
        ${tx.type || ""}
        ${tx.status || ""}
        ${tx.reference || ""}
        ${tx.description || ""}
      `.toLowerCase();

      return matchFilter && text.includes(search.toLowerCase());
    });
  }, [transactions, filter, search]);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Admin Finance</p>
          <h1 style={title}>Wallet Monitoring</h1>
          <p style={subtitle}>
            Central wallet ledger for customer funds, investment movements,
            cash-in credits, cash-out debits, adjustments, and admin-reviewed
            wallet transactions.
          </p>
        </div>

        <button onClick={loadWallet} style={refreshBtn}>
          Refresh Wallet
        </button>
      </section>

      <section style={statsGrid}>
        <WalletCard
          label="Estimated Net Wallet Flow"
          value={summary.net}
          accent="#2563eb"
          note="Credits minus debits"
        />
        <WalletCard
          label="Total Credits"
          value={summary.credits}
          accent="#16a34a"
          note="Cash-in / wallet funding"
        />
        <WalletCard
          label="Total Debits"
          value={summary.debits}
          accent="#dc2626"
          note="Cash-out / deductions"
        />
        <WalletCard
          label="Pending Amount"
          value={summary.pending}
          accent="#f59e0b"
          note="Needs admin review"
        />
      </section>

      <section style={controlCard}>
        <input
          style={searchInput}
          placeholder="Search customer ID, reference, type, status, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={selectInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Transactions</option>
          <option value="CREDIT">Credits</option>
          <option value="DEBIT">Debits</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Wallet Ledger</h2>
            <p style={sectionDesc}>
              Admin-controlled wallet records only. Customer and caretaker are
              not directly connected.
            </p>
          </div>

          <span style={pill}>{filtered.length} records</span>
        </div>

        {loading ? (
          <Empty text="Loading wallet ledger..." />
        ) : filtered.length === 0 ? (
          <Empty text="No wallet transactions found." />
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Customer ID</th>
                  <th style={th}>Type</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Description</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id} style={tr}>
                    <td style={td}>
                      {tx.created_at
                        ? new Date(tx.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td style={td}>
                      <strong>{tx.customer_id || "—"}</strong>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          ...typeBadge,
                          background: isCredit(tx.type) ? "#dcfce7" : "#fee2e2",
                          color: isCredit(tx.type) ? "#166534" : "#991b1b",
                        }}
                      >
                        {tx.type || "WALLET"}
                      </span>
                    </td>
                    <td style={td}>{tx.reference || tx.id}</td>
                    <td style={td}>
                      <strong>{money(toNumber(tx.amount))}</strong>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          ...statusBadge,
                          background: getStatusBg(tx.status),
                          color: getStatusColor(tx.status),
                        }}
                      >
                        {normalizeStatus(tx.status)}
                      </span>
                    </td>
                    <td style={td}>{tx.description || "—"}</td>
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

function WalletCard({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: number;
  accent: string;
  note: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{money(value)}</h2>
      <p style={statNote}>{note}</p>
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

function normalizeStatus(status?: string | null) {
  return (status || "POSTED").toUpperCase();
}

function isCredit(type?: string | null) {
  const t = (type || "").toUpperCase();
  return (
    t.includes("CREDIT") ||
    t.includes("CASHIN") ||
    t.includes("CASH_IN") ||
    t.includes("DEPOSIT") ||
    t.includes("TOPUP") ||
    t.includes("TOP_UP")
  );
}

function isDebit(type?: string | null) {
  const t = (type || "").toUpperCase();
  return (
    t.includes("DEBIT") ||
    t.includes("CASHOUT") ||
    t.includes("CASH_OUT") ||
    t.includes("WITHDRAW") ||
    t.includes("DEDUCTION") ||
    t.includes("PAYMENT")
  );
}

function getStatusBg(status?: string | null) {
  const s = normalizeStatus(status);
  if (s === "APPROVED" || s === "POSTED" || s === "COMPLETED") return "#dcfce7";
  if (s === "FAILED" || s === "REJECTED") return "#fee2e2";
  if (s === "PROCESSING") return "#dbeafe";
  return "#fef3c7";
}

function getStatusColor(status?: string | null) {
  const s = normalizeStatus(status);
  if (s === "APPROVED" || s === "POSTED" || s === "COMPLETED") return "#166534";
  if (s === "FAILED" || s === "REJECTED") return "#991b1b";
  if (s === "PROCESSING") return "#1d4ed8";
  return "#92400e";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background:
    "linear-gradient(135deg, #eff6ff 0%, #f8fafc 42%, #ecfdf5 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #1e3a8a, #2563eb, #059669)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  opacity: 0.88,
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
  color: "#1e3a8a",
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
  background: "rgba(255,255,255,0.93)",
  border: "1px solid rgba(148,163,184,0.28)",
  boxShadow: "0 15px 32px rgba(15,23,42,0.08)",
};

const statBar: React.CSSProperties = {
  width: 50,
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
  margin: "8px 0 6px",
  fontSize: 30,
  fontWeight: 950,
};

const statNote: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
};

const controlCard: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  padding: 16,
  borderRadius: 22,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(148,163,184,0.25)",
  marginBottom: 18,
};

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 260,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 14,
};

const selectInput: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontWeight: 900,
  background: "white",
};

const card: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(148,163,184,0.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,0.08)",
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

const sectionDesc: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const pill: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1d4ed8",
  fontWeight: 950,
  fontSize: 12,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 940,
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

const typeBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const statusBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const emptyBox: React.CSSProperties = {
  padding: 30,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};