"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CashInRequest = {
  id: string;
  customer_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  reference_number?: string | null;
  proof_url?: string | null;
  created_at?: string | null;
};

type CashOutRequest = {
  id: string;
  customer_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  status?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  created_at?: string | null;
};

type WalletTransaction = {
  id: string;
  customer_id?: string | null;
  type?: string | null;
  amount?: number | string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string | null;
};

export default function AdminTreasuryPage() {
  const [cashins, setCashins] = useState<CashInRequest[]>([]);
  const [cashouts, setCashouts] = useState<CashOutRequest[]>([]);
  const [walletTx, setWalletTx] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTreasury();
  }, []);

  async function loadTreasury() {
    setLoading(true);

    const [cashinRes, cashoutRes, walletRes] = await Promise.all([
      supabase
        .from("cashin_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("cashout_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (cashinRes.error) console.error(cashinRes.error.message);
    if (cashoutRes.error) console.error(cashoutRes.error.message);
    if (walletRes.error) console.error(walletRes.error.message);

    setCashins(cashinRes.data || []);
    setCashouts(cashoutRes.data || []);
    setWalletTx(walletRes.data || []);
    setLoading(false);
  }

  const treasury = useMemo(() => {
    const approvedCashin = cashins
      .filter((x) => normalizeStatus(x.status) === "APPROVED")
      .reduce((sum, x) => sum + toNumber(x.amount), 0);

    const approvedCashout = cashouts
      .filter((x) => normalizeStatus(x.status) === "APPROVED")
      .reduce((sum, x) => sum + toNumber(x.amount), 0);

    const pendingCashin = cashins
      .filter((x) => normalizeStatus(x.status) === "PENDING")
      .reduce((sum, x) => sum + toNumber(x.amount), 0);

    const pendingCashout = cashouts
      .filter((x) => normalizeStatus(x.status) === "PENDING")
      .reduce((sum, x) => sum + toNumber(x.amount), 0);

    const netTreasury = approvedCashin - approvedCashout;

    return {
      approvedCashin,
      approvedCashout,
      pendingCashin,
      pendingCashout,
      netTreasury,
    };
  }, [cashins, cashouts]);

  const recentActivities = [
    ...cashins.map((x) => ({
      id: `cashin-${x.id}`,
      type: "Cash-In",
      amount: toNumber(x.amount),
      status: x.status || "PENDING",
      reference: x.reference_number || x.id,
      date: x.created_at,
    })),
    ...cashouts.map((x) => ({
      id: `cashout-${x.id}`,
      type: "Cash-Out",
      amount: toNumber(x.amount),
      status: x.status || "PENDING",
      reference: x.id,
      date: x.created_at,
    })),
    ...walletTx.map((x) => ({
      id: `wallet-${x.id}`,
      type: x.type || "Wallet",
      amount: toNumber(x.amount),
      status: x.status || "POSTED",
      reference: x.reference || x.id,
      date: x.created_at,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    )
    .slice(0, 15);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Finance Control</p>
          <h1 style={title}>Treasury Command Center</h1>
          <p style={subtitle}>
            Monitor cash-in, cash-out, wallet movement, pending obligations,
            and platform-controlled treasury flow.
          </p>
        </div>

        <button onClick={loadTreasury} style={refreshBtn}>
          Refresh Treasury
        </button>
      </section>

      <section style={statsGrid}>
        <TreasuryCard
          label="Net Treasury"
          value={treasury.netTreasury}
          accent="#14532d"
          note="Approved cash-in minus approved cash-out"
        />
        <TreasuryCard
          label="Approved Cash-In"
          value={treasury.approvedCashin}
          accent="#16a34a"
          note="Funds received by platform"
        />
        <TreasuryCard
          label="Approved Cash-Out"
          value={treasury.approvedCashout}
          accent="#dc2626"
          note="Released withdrawals"
        />
        <TreasuryCard
          label="Pending Exposure"
          value={treasury.pendingCashin + treasury.pendingCashout}
          accent="#f59e0b"
          note="Requests needing admin review"
        />
      </section>

      <section style={gridTwo}>
        <div style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Cash-In Review</h2>
              <p style={sectionDesc}>Customer funding requests for approval.</p>
            </div>
            <span style={pill}>{cashins.length}</span>
          </div>

          {loading ? (
            <Empty text="Loading cash-in requests..." />
          ) : cashins.length === 0 ? (
            <Empty text="No cash-in requests found." />
          ) : (
            cashins.slice(0, 8).map((item) => (
              <RequestRow
                key={item.id}
                title={item.method || "Cash-In"}
                amount={toNumber(item.amount)}
                status={item.status}
                reference={item.reference_number || item.id}
                date={item.created_at}
              />
            ))
          )}
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Cash-Out Review</h2>
              <p style={sectionDesc}>Customer withdrawal requests for release.</p>
            </div>
            <span style={pill}>{cashouts.length}</span>
          </div>

          {loading ? (
            <Empty text="Loading cash-out requests..." />
          ) : cashouts.length === 0 ? (
            <Empty text="No cash-out requests found." />
          ) : (
            cashouts.slice(0, 8).map((item) => (
              <RequestRow
                key={item.id}
                title={item.bank_name || item.method || "Cash-Out"}
                amount={toNumber(item.amount)}
                status={item.status}
                reference={item.account_name || item.id}
                date={item.created_at}
              />
            ))
          )}
        </div>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Recent Treasury Activity</h2>
            <p style={sectionDesc}>
              Combined treasury, wallet, funding, and withdrawal movement.
            </p>
          </div>
          <span style={pill}>{recentActivities.length} latest</span>
        </div>

        {loading ? (
          <Empty text="Loading activity..." />
        ) : recentActivities.length === 0 ? (
          <Empty text="No treasury activities found." />
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Type</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((item) => (
                  <tr key={item.id} style={tr}>
                    <td style={td}>
                      {item.date ? new Date(item.date).toLocaleString() : "—"}
                    </td>
                    <td style={td}>
                      <strong>{item.type}</strong>
                    </td>
                    <td style={td}>{item.reference}</td>
                    <td style={td}>{money(item.amount)}</td>
                    <td style={td}>
                      <span
                        style={{
                          ...statusBadge,
                          background: getStatusBg(item.status),
                          color: getStatusColor(item.status),
                        }}
                      >
                        {normalizeStatus(item.status)}
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

function TreasuryCard({
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
      <div style={{ ...statTop, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{money(value)}</h2>
      <p style={statNote}>{note}</p>
    </div>
  );
}

function RequestRow({
  title,
  amount,
  status,
  reference,
  date,
}: {
  title: string;
  amount: number;
  status?: string | null;
  reference: string;
  date?: string | null;
}) {
  return (
    <div style={requestRow}>
      <div>
        <strong>{title}</strong>
        <p style={muted}>{reference}</p>
        <p style={dateText}>{date ? new Date(date).toLocaleString() : "—"}</p>
      </div>

      <div style={{ textAlign: "right" }}>
        <strong>{money(amount)}</strong>
        <br />
        <span
          style={{
            ...statusBadge,
            background: getStatusBg(status),
            color: getStatusColor(status),
          }}
        >
          {normalizeStatus(status)}
        </span>
      </div>
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
  return (status || "PENDING").toUpperCase();
}

function getStatusBg(status?: string | null) {
  const s = normalizeStatus(status);
  if (s === "APPROVED" || s === "POSTED" || s === "COMPLETED") return "#dcfce7";
  if (s === "REJECTED" || s === "FAILED") return "#fee2e2";
  if (s === "PROCESSING") return "#dbeafe";
  return "#fef3c7";
}

function getStatusColor(status?: string | null) {
  const s = normalizeStatus(status);
  if (s === "APPROVED" || s === "POSTED" || s === "COMPLETED") return "#166534";
  if (s === "REJECTED" || s === "FAILED") return "#991b1b";
  if (s === "PROCESSING") return "#1d4ed8";
  return "#92400e";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background:
    "linear-gradient(135deg, #ecfdf5 0%, #f8fafc 42%, #fff7ed 100%)",
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
  maxWidth: 720,
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
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(148,163,184,0.28)",
  boxShadow: "0 15px 32px rgba(15,23,42,0.08)",
};

const statTop: React.CSSProperties = {
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
  margin: "8px 0 6px",
  fontSize: 30,
  fontWeight: 950,
};

const statNote: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
};

const gridTwo: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
  marginBottom: 18,
};

const card: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,0.93)",
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
  background: "#ecfeff",
  color: "#0e7490",
  fontWeight: 950,
  fontSize: 12,
};

const requestRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 0",
  borderBottom: "1px solid #f1f5f9",
};

const muted: React.CSSProperties = {
  margin: "4px 0",
  color: "#64748b",
  fontSize: 12,
};

const dateText: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: 11,
};

const statusBadge: React.CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 760,
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
};

const emptyBox: React.CSSProperties = {
  padding: 28,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};