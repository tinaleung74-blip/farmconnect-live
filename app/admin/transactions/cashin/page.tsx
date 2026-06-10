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
  admin_notes?: string | null;
  created_at?: string | null;
};

export default function AdminCashInPage() {
  const [requests, setRequests] = useState<CashInRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCashins();
  }, []);

  async function loadCashins() {
    setLoading(true);

    const { data, error } = await supabase
      .from("cashin_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      console.error("Cash-in error:", error.message);
      setRequests([]);
    } else {
      setRequests(data || []);
    }

    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("cashin_requests")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCashins();
  }

  const summary = useMemo(() => {
    return {
      total: requests.length,
      amount: requests.reduce((sum, r) => sum + toNumber(r.amount), 0),
      pending: requests.filter((r) => status(r.status) === "PENDING").length,
      approved: requests.filter((r) => status(r.status) === "APPROVED").length,
    };
  }, [requests]);

  const filtered = requests.filter((r) => {
    const matchFilter = filter === "ALL" || status(r.status) === filter;
    const text = `${r.id} ${r.customer_id || ""} ${r.method || ""} ${
      r.reference_number || ""
    } ${r.status || ""}`.toLowerCase();

    return matchFilter && text.includes(search.toLowerCase());
  });

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Transactions</p>
          <h1 style={title}>Cash-In Requests</h1>
          <p style={subtitle}>
            Review customer funding requests, payment references, and proof
            before approving wallet credit.
          </p>
        </div>

        <button onClick={loadCashins} style={refreshBtn}>
          Refresh
        </button>
      </section>

      <section style={statsGrid}>
        <Card label="Total Requests" value={summary.total} accent="#2563eb" />
        <MoneyCard label="Total Amount" value={summary.amount} accent="#16a34a" />
        <Card label="Pending" value={summary.pending} accent="#f59e0b" />
        <Card label="Approved" value={summary.approved} accent="#15803d" />
      </section>

      <section style={controlCard}>
        <input
          style={searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer ID, method, reference, status..."
        />

        <select
          style={selectInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Requests</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PROCESSING">Processing</option>
        </select>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Funding Approval Queue</h2>
            <p style={sectionDesc}>
              Admin validates cash-in only. Customer does not directly transact
              with caretaker.
            </p>
          </div>
          <span style={pill}>{filtered.length} records</span>
        </div>

        {loading ? (
          <Empty text="Loading cash-in requests..." />
        ) : filtered.length === 0 ? (
          <Empty text="No cash-in requests found." />
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Method</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Proof</th>
                  <th style={th}>Status</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={tr}>
                    <td style={td}>
                      {r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td style={td}>{r.customer_id || "—"}</td>
                    <td style={td}>{r.method || "Manual Cash-In"}</td>
                    <td style={td}>{r.reference_number || r.id}</td>
                    <td style={td}>
                      <strong>{money(toNumber(r.amount))}</strong>
                    </td>
                    <td style={td}>
                      {r.proof_url ? (
                        <a href={r.proof_url} target="_blank" style={link}>
                          View Proof
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          ...badge,
                          background: statusBg(r.status),
                          color: statusColor(r.status),
                        }}
                      >
                        {status(r.status)}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={actions}>
                        <button
                          style={approveBtn}
                          onClick={() => updateStatus(r.id, "APPROVED")}
                        >
                          Approve
                        </button>
                        <button
                          style={rejectBtn}
                          onClick={() => updateStatus(r.id, "REJECTED")}
                        >
                          Reject
                        </button>
                      </div>
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

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statMoney}>{money(value)}</h2>
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
  if (s === "APPROVED") return "#dcfce7";
  if (s === "REJECTED") return "#fee2e2";
  if (s === "PROCESSING") return "#dbeafe";
  return "#fef3c7";
}

function statusColor(value?: string | null) {
  const s = status(value);
  if (s === "APPROVED") return "#166534";
  if (s === "REJECTED") return "#991b1b";
  if (s === "PROCESSING") return "#1d4ed8";
  return "#92400e";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background:
    "linear-gradient(135deg, #ecfdf5 0%, #eff6ff 45%, #f8fafc 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #14532d, #16a34a, #2563eb)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,.18)",
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
  color: "#14532d",
  background: "white",
  cursor: "pointer",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
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
  margin: "8px 0 0",
  fontSize: 34,
  fontWeight: 950,
};

const statMoney: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 27,
  fontWeight: 950,
};

const controlCard: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  padding: 16,
  borderRadius: 22,
  background: "rgba(255,255,255,.86)",
  border: "1px solid rgba(148,163,184,.25)",
  marginBottom: 18,
};

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 260,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  outline: "none",
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

const sectionDesc: React.CSSProperties = {
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

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 920,
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

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const approveBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 12px",
  background: "#16a34a",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const rejectBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 12px",
  background: "#dc2626",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const link: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 900,
  textDecoration: "none",
};

const emptyBox: React.CSSProperties = {
  padding: 30,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};