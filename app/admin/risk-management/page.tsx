"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type RiskAlert = {
  id: string;
  flock_id?: string | null;
  customer_id?: string | null;
  caretaker_id?: string | null;
  title?: string | null;
  message?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  recommendation?: string | null;
  created_at?: string | null;
};

export default function AdminRiskManagementPage() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadRiskAlerts();
  }, []);

  async function loadRiskAlerts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("risk_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      console.error("Risk alerts error:", error.message);
      setAlerts([]);
    } else {
      setAlerts(data || []);
    }

    setLoading(false);
  }

  const summary = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((a) => normalizeSeverity(a.severity) === "CRITICAL")
        .length,
      high: alerts.filter((a) => normalizeSeverity(a.severity) === "HIGH")
        .length,
      open: alerts.filter((a) => normalizeStatus(a.status) === "OPEN").length,
    };
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((alert) => {
      const severity = normalizeSeverity(alert.severity);
      const status = normalizeStatus(alert.status);

      const matchFilter =
        filter === "ALL" ||
        severity === filter ||
        status === filter ||
        (alert.category || "").toUpperCase() === filter;

      const text = `
        ${alert.title || ""}
        ${alert.message || ""}
        ${alert.category || ""}
        ${alert.severity || ""}
        ${alert.status || ""}
        ${alert.recommendation || ""}
        ${alert.flock_id || ""}
        ${alert.customer_id || ""}
        ${alert.caretaker_id || ""}
      `.toLowerCase();

      return matchFilter && text.includes(search.toLowerCase());
    });
  }, [alerts, filter, search]);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Risk Control</p>
          <h1 style={title}>Risk Management</h1>
          <p style={subtitle}>
            Monitor farm risks, mortality warnings, weight issues, feeding
            gaps, photo compliance, harvest concerns, and admin intervention
            alerts.
          </p>
        </div>

        <button onClick={loadRiskAlerts} style={refreshBtn}>
          Refresh Risks
        </button>
      </section>

      <section style={statsGrid}>
        <RiskCard label="Total Alerts" value={summary.total} accent="#2563eb" />
        <RiskCard label="Critical" value={summary.critical} accent="#dc2626" />
        <RiskCard label="High Risk" value={summary.high} accent="#f97316" />
        <RiskCard label="Open Cases" value={summary.open} accent="#f59e0b" />
      </section>

      <section style={controlCard}>
        <input
          style={searchInput}
          placeholder="Search risk title, flock, customer, caretaker, category, or recommendation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={selectInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Risks</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="MORTALITY">Mortality</option>
          <option value="WEIGHT">Weight</option>
          <option value="FEEDING">Feeding</option>
          <option value="PHOTO">Photo</option>
          <option value="HARVEST">Harvest</option>
        </select>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Risk Alert Board</h2>
            <p style={sectionDesc}>
              Admin reviews all customer and caretaker reports separately. No
              direct customer-to-caretaker connection.
            </p>
          </div>
          <span style={pill}>{filtered.length} alerts</span>
        </div>

        {loading ? (
          <Empty text="Loading risk alerts..." />
        ) : filtered.length === 0 ? (
          <Empty text="No risk alerts found." />
        ) : (
          <div style={riskGrid}>
            {filtered.map((alert) => (
              <article key={alert.id} style={riskCard}>
                <div style={riskTop}>
                  <span
                    style={{
                      ...severityBadge,
                      background: getSeverityBg(alert.severity),
                      color: getSeverityColor(alert.severity),
                    }}
                  >
                    {normalizeSeverity(alert.severity)}
                  </span>

                  <span
                    style={{
                      ...statusBadge,
                      background: getStatusBg(alert.status),
                      color: getStatusColor(alert.status),
                    }}
                  >
                    {normalizeStatus(alert.status)}
                  </span>
                </div>

                <h3 style={riskTitle}>{alert.title || "Risk Alert"}</h3>

                <p style={riskMessage}>
                  {alert.message || "No risk message provided."}
                </p>

                <div style={infoGrid}>
                  <Info label="Category" value={alert.category || "General"} />
                  <Info label="Flock ID" value={alert.flock_id || "—"} />
                  <Info label="Customer ID" value={alert.customer_id || "—"} />
                  <Info label="Caretaker ID" value={alert.caretaker_id || "—"} />
                </div>

                <div style={recommendationBox}>
                  <strong>Admin Recommendation</strong>
                  <p>{alert.recommendation || getDefaultRecommendation(alert)}</p>
                </div>

                <p style={dateText}>
                  {alert.created_at
                    ? new Date(alert.created_at).toLocaleString()
                    : "No date"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function RiskCard({
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBox}>
      <p style={infoLabel}>{label}</p>
      <strong style={infoValue}>{value}</strong>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={emptyBox}>{text}</div>;
}

function normalizeSeverity(value?: string | null) {
  return (value || "LOW").toUpperCase();
}

function normalizeStatus(value?: string | null) {
  return (value || "OPEN").toUpperCase();
}

function getSeverityBg(value?: string | null) {
  const s = normalizeSeverity(value);
  if (s === "CRITICAL") return "#fee2e2";
  if (s === "HIGH") return "#ffedd5";
  if (s === "MEDIUM") return "#fef3c7";
  return "#dcfce7";
}

function getSeverityColor(value?: string | null) {
  const s = normalizeSeverity(value);
  if (s === "CRITICAL") return "#991b1b";
  if (s === "HIGH") return "#9a3412";
  if (s === "MEDIUM") return "#92400e";
  return "#166534";
}

function getStatusBg(value?: string | null) {
  const s = normalizeStatus(value);
  if (s === "RESOLVED" || s === "CLOSED") return "#dcfce7";
  if (s === "INVESTIGATING") return "#dbeafe";
  return "#fef3c7";
}

function getStatusColor(value?: string | null) {
  const s = normalizeStatus(value);
  if (s === "RESOLVED" || s === "CLOSED") return "#166534";
  if (s === "INVESTIGATING") return "#1d4ed8";
  return "#92400e";
}

function getDefaultRecommendation(alert: RiskAlert) {
  const category = (alert.category || "").toUpperCase();

  if (category.includes("MORTALITY")) {
    return "Review mortality logs, verify caretaker report, request updated photos, and escalate if mortality rate exceeds allowed threshold.";
  }

  if (category.includes("WEIGHT")) {
    return "Compare current weight logs against expected growth curve and check feeding consistency.";
  }

  if (category.includes("FEEDING")) {
    return "Check feeding logs, feed inventory movement, and caretaker upload compliance.";
  }

  if (category.includes("PHOTO")) {
    return "Request fresh photo proof from caretaker for admin validation.";
  }

  if (category.includes("HARVEST")) {
    return "Review harvest readiness, flock age, weight records, and buyer/sales schedule.";
  }

  return "Review customer and caretaker records separately, validate evidence, and update risk status after admin assessment.";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background:
    "linear-gradient(135deg, #fff7ed 0%, #fef2f2 38%, #eff6ff 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #7f1d1d, #ea580c, #1d4ed8)",
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
  color: "#7f1d1d",
  background: "white",
  cursor: "pointer",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  margin: "8px 0 0",
  fontSize: 34,
  fontWeight: 950,
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
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 950,
  fontSize: 12,
};

const riskGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const riskCard: React.CSSProperties = {
  padding: 18,
  borderRadius: 22,
  background: "linear-gradient(180deg, #ffffff, #f8fafc)",
  border: "1px solid #e2e8f0",
};

const riskTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 14,
};

const severityBadge: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const statusBadge: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const riskTitle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 18,
  fontWeight: 950,
};

const riskMessage: React.CSSProperties = {
  margin: "0 0 14px",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.6,
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
  marginBottom: 14,
};

const infoBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const infoLabel: React.CSSProperties = {
  margin: "0 0 4px",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
};

const infoValue: React.CSSProperties = {
  fontSize: 13,
};

const recommendationBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#7c2d12",
  fontSize: 13,
  lineHeight: 1.5,
};

const dateText: React.CSSProperties = {
  margin: "14px 0 0",
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 700,
};

const emptyBox: React.CSSProperties = {
  padding: 30,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};