"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Customer = { id: string; full_name?: string | null; email?: string | null };
type Caretaker = { id: string; full_name?: string | null; phone?: string | null };
type Flock = {
  id: string;
  customer_id?: string | null;
  caretaker_id?: string | null;
  animal_type?: string | null;
  status?: string | null;
  total_heads?: number | string | null;
  created_at?: string | null;
};
type LogRow = {
  id: string;
  flock_id?: string | null;
  customer_id?: string | null;
  caretaker_id?: string | null;
  created_at?: string | null;
};
type Harvest = {
  id: string;
  gross_sales?: number | string | null;
  expenses?: number | string | null;
  net_profit?: number | string | null;
  status?: string | null;
};
type RiskAlert = { id: string; severity?: string | null; status?: string | null };

export default function AdminReportsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<LogRow[]>([]);
  const [mortalityLogs, setMortalityLogs] = useState<LogRow[]>([]);
  const [weightLogs, setWeightLogs] = useState<LogRow[]>([]);
  const [photoLogs, setPhotoLogs] = useState<LogRow[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);

    const [
      customerRes,
      caretakerRes,
      flockRes,
      feedingRes,
      mortalityRes,
      weightRes,
      photoRes,
      harvestRes,
      riskRes,
    ] = await Promise.all([
      supabase.from("customers").select("id, full_name, email").limit(1000),
      supabase.from("caretakers").select("id, full_name, phone").limit(1000),
      supabase.from("flocks").select("*").limit(1000),
      supabase.from("feeding_logs").select("*").limit(1000),
      supabase.from("mortality_logs").select("*").limit(1000),
      supabase.from("weight_logs").select("*").limit(1000),
      supabase.from("photo_logs").select("*").limit(1000),
      supabase.from("harvests").select("*").limit(1000),
      supabase.from("risk_alerts").select("*").limit(1000),
    ]);

    if (customerRes.error) console.error(customerRes.error.message);
    if (caretakerRes.error) console.error(caretakerRes.error.message);
    if (flockRes.error) console.error(flockRes.error.message);
    if (feedingRes.error) console.error(feedingRes.error.message);
    if (mortalityRes.error) console.error(mortalityRes.error.message);
    if (weightRes.error) console.error(weightRes.error.message);
    if (photoRes.error) console.error(photoRes.error.message);
    if (harvestRes.error) console.error(harvestRes.error.message);
    if (riskRes.error) console.error(riskRes.error.message);

    setCustomers(customerRes.data || []);
    setCaretakers(caretakerRes.data || []);
    setFlocks(flockRes.data || []);
    setFeedingLogs(feedingRes.data || []);
    setMortalityLogs(mortalityRes.data || []);
    setWeightLogs(weightRes.data || []);
    setPhotoLogs(photoRes.data || []);
    setHarvests(harvestRes.data || []);
    setRiskAlerts(riskRes.data || []);

    setLoading(false);
  }

  const report = useMemo(() => {
    const totalHeads = flocks.reduce((sum, f) => sum + toNumber(f.total_heads), 0);

    const grossSales = harvests.reduce((sum, h) => sum + toNumber(h.gross_sales), 0);
    const expenses = harvests.reduce((sum, h) => sum + toNumber(h.expenses), 0);
    const netProfit = harvests.reduce(
      (sum, h) => sum + (toNumber(h.net_profit) || toNumber(h.gross_sales) - toNumber(h.expenses)),
      0
    );

    const openRisks = riskAlerts.filter((r) => normalizeStatus(r.status) === "OPEN").length;
    const criticalRisks = riskAlerts.filter(
      (r) => normalizeSeverity(r.severity) === "CRITICAL"
    ).length;

    return {
      totalCustomers: customers.length,
      totalCaretakers: caretakers.length,
      totalFlocks: flocks.length,
      totalHeads,
      totalLogs:
        feedingLogs.length + mortalityLogs.length + weightLogs.length + photoLogs.length,
      feedingCount: feedingLogs.length,
      mortalityCount: mortalityLogs.length,
      weightCount: weightLogs.length,
      photoCount: photoLogs.length,
      harvestCount: harvests.length,
      grossSales,
      expenses,
      netProfit,
      openRisks,
      criticalRisks,
    };
  }, [
    customers,
    caretakers,
    flocks,
    feedingLogs,
    mortalityLogs,
    weightLogs,
    photoLogs,
    harvests,
    riskAlerts,
  ]);

  const flockStatus = useMemo(() => {
    const map = new Map<string, number>();

    flocks.forEach((f) => {
      const status = normalizeStatus(f.status);
      map.set(status, (map.get(status) || 0) + 1);
    });

    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [flocks]);

  const recentFlocks = [...flocks]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .slice(0, 10);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Executive Reports</p>
          <h1 style={title}>Reports Center</h1>
          <p style={subtitle}>
            High-level reporting for customers, caretakers, flock performance,
            farm logs, risks, harvest results, and admin-controlled operations.
          </p>
        </div>

        <button onClick={loadReports} style={refreshBtn}>
          Refresh Reports
        </button>
      </section>

      <section style={statsGrid}>
        <ReportCard label="Customers" value={report.totalCustomers} accent="#2563eb" />
        <ReportCard label="Caretakers" value={report.totalCaretakers} accent="#16a34a" />
        <ReportCard label="Flocks" value={report.totalFlocks} accent="#f97316" />
        <ReportCard label="Total Heads" value={report.totalHeads} accent="#7c3aed" />
      </section>

      <section style={statsGrid}>
        <MoneyCard label="Gross Sales" value={report.grossSales} accent="#0f766e" />
        <MoneyCard label="Expenses" value={report.expenses} accent="#dc2626" />
        <MoneyCard label="Net Profit" value={report.netProfit} accent="#ea580c" />
        <ReportCard label="Critical Risks" value={report.criticalRisks} accent="#991b1b" />
      </section>

      <section style={gridTwo}>
        <div style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Farm Activity Logs</h2>
              <p style={sectionDesc}>Caretaker uploads reviewed through admin.</p>
            </div>
            <span style={pill}>{report.totalLogs} logs</span>
          </div>

          <div style={miniGrid}>
            <MiniMetric label="Feeding Logs" value={report.feedingCount} color="#16a34a" />
            <MiniMetric label="Mortality Logs" value={report.mortalityCount} color="#dc2626" />
            <MiniMetric label="Weight Logs" value={report.weightCount} color="#2563eb" />
            <MiniMetric label="Photo Logs" value={report.photoCount} color="#7c3aed" />
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Flock Status Breakdown</h2>
              <p style={sectionDesc}>Current operational status of all flocks.</p>
            </div>
            <span style={pill}>{flockStatus.length} status</span>
          </div>

          {loading ? (
            <Empty text="Loading status breakdown..." />
          ) : flockStatus.length === 0 ? (
            <Empty text="No flock status data found." />
          ) : (
            <div>
              {flockStatus.map((item) => (
                <div key={item.label} style={statusRow}>
                  <span style={statusName}>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Recent Flock Report</h2>
            <p style={sectionDesc}>
              Customer and caretaker are separated by admin governance.
            </p>
          </div>
          <span style={pill}>{recentFlocks.length} latest</span>
        </div>

        {loading ? (
          <Empty text="Loading report records..." />
        ) : recentFlocks.length === 0 ? (
          <Empty text="No flock records found." />
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Created</th>
                  <th style={th}>Flock ID</th>
                  <th style={th}>Animal</th>
                  <th style={th}>Customer ID</th>
                  <th style={th}>Caretaker ID</th>
                  <th style={th}>Heads</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentFlocks.map((f) => (
                  <tr key={f.id} style={tr}>
                    <td style={td}>
                      {f.created_at ? new Date(f.created_at).toLocaleString() : "—"}
                    </td>
                    <td style={td}>
                      <strong>{shortId(f.id)}</strong>
                    </td>
                    <td style={td}>{f.animal_type || "Chicken"}</td>
                    <td style={td}>{f.customer_id || "—"}</td>
                    <td style={td}>{f.caretaker_id || "—"}</td>
                    <td style={td}>{toNumber(f.total_heads).toLocaleString()}</td>
                    <td style={td}>
                      <span style={statusBadge}>{normalizeStatus(f.status)}</span>
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

function ReportCard({
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
      <h2 style={statValue}>{value.toLocaleString()}</h2>
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
      <h2 style={statMoneyValue}>{money(value)}</h2>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={miniMetric}>
      <div style={{ ...miniDot, background: color }} />
      <p style={miniLabel}>{label}</p>
      <h3 style={miniValue}>{value.toLocaleString()}</h3>
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

function normalizeStatus(value?: string | null) {
  return (value || "ACTIVE").toUpperCase();
}

function normalizeSeverity(value?: string | null) {
  return (value || "LOW").toUpperCase();
}

function shortId(id: string) {
  return id?.slice(0, 8) || "—";
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
  background: "linear-gradient(135deg, #1e3a8a, #2563eb, #16a34a)",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const gridTwo: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
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
  margin: "8px 0 0",
  fontSize: 34,
  fontWeight: 950,
};

const statMoneyValue: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 27,
  fontWeight: 950,
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

const miniGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 12,
};

const miniMetric: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const miniDot: React.CSSProperties = {
  width: 36,
  height: 7,
  borderRadius: 999,
  marginBottom: 10,
};

const miniLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
};

const miniValue: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 24,
  fontWeight: 950,
};

const statusRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 0",
  borderBottom: "1px solid #f1f5f9",
};

const statusName: React.CSSProperties = {
  fontWeight: 900,
  color: "#334155",
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 880,
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

const statusBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
  background: "#dcfce7",
  color: "#166534",
};

const emptyBox: React.CSSProperties = {
  padding: 30,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};