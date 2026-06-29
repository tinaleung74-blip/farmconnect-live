"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuditLog = {
  id: string;
  admin_name?: string | null;
  admin_email?: string | null;
  action?: string | null;
  module?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  details?: string | null;
  severity?: string | null;
  ip_address?: string | null;
  created_at?: string | null;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("ALL");

  useEffect(() => {
    loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Audit logs error:", error.message);
      setLogs([]);
    } else {
      setLogs(data || []);
    }

    setLoading(false);
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const text = `
        ${log.admin_name || ""}
        ${log.admin_email || ""}
        ${log.action || ""}
        ${log.module || ""}
        ${log.target_type || ""}
        ${log.target_id || ""}
        ${log.details || ""}
        ${log.severity || ""}
      `.toLowerCase();

      const matchSearch = text.includes(search.toLowerCase());
      const matchSeverity =
        severity === "ALL" ||
        (log.severity || "INFO").toUpperCase() === severity;

      return matchSearch && matchSeverity;
    });
  }, [logs, search, severity]);

  const totalLogs = logs.length;
  const criticalLogs = logs.filter(
    (l) => (l.severity || "").toUpperCase() === "CRITICAL"
  ).length;
  const warningLogs = logs.filter(
    (l) => (l.severity || "").toUpperCase() === "WARNING"
  ).length;
  const infoLogs = logs.filter(
    (l) => !l.severity || (l.severity || "").toUpperCase() === "INFO"
  ).length;

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>← Back Admin</Link>
          <p style={eyebrow}>FarmConnect Admin V2</p>
          <h1 style={title}>Audit Logs</h1>
          <p style={subtitle}>
            Executive security trail for admin actions, approvals, risk events,
            system monitoring, and accountability records.
          </p>
        </div>

        <button onClick={loadAuditLogs} style={refreshBtn}>
          Refresh Logs
        </button>
      </section>

      <section style={statsGrid}>
        <StatCard label="Total Logs" value={totalLogs} accent="#2563eb" />
        <StatCard label="Critical" value={criticalLogs} accent="#dc2626" />
        <StatCard label="Warnings" value={warningLogs} accent="#f59e0b" />
        <StatCard label="Info" value={infoLogs} accent="#16a34a" />
      </section>

      <section style={controlCard}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search admin, action, module, target, or details..."
          style={searchInput}
        />

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={selectInput}
        >
          <option value="ALL">All Severity</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>System Activity Trail</h2>
            <p style={sectionDesc}>
              Customer ↔ Admin and Caretaker ↔ Admin activity only. No direct
              customer-to-caretaker interaction is shown here.
            </p>
          </div>
          <span style={pill}>{filteredLogs.length} records</span>
        </div>

        {loading ? (
          <div style={emptyBox}>Loading audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div style={emptyBox}>No audit logs found.</div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date / Time</th>
                  <th style={th}>Admin</th>
                  <th style={th}>Module</th>
                  <th style={th}>Action</th>
                  <th style={th}>Target</th>
                  <th style={th}>Severity</th>
                  <th style={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={tr}>
                    <td style={td}>
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td style={td}>
                      <strong>{log.admin_name || "Admin"}</strong>
                      <br />
                      <span style={muted}>{log.admin_email || "—"}</span>
                    </td>
                    <td style={td}>{log.module || "System"}</td>
                    <td style={td}>
                      <strong>{log.action || "Activity"}</strong>
                    </td>
                    <td style={td}>
                      {log.target_type || "Record"}
                      <br />
                      <span style={muted}>{log.target_id || "—"}</span>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          ...severityBadge,
                          background: getSeverityBg(log.severity),
                          color: getSeverityColor(log.severity),
                        }}
                      >
                        {(log.severity || "INFO").toUpperCase()}
                      </span>
                    </td>
                    <td style={td}>{log.details || "No details provided."}</td>
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

function StatCard({
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
      <div style={{ ...statIcon, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function getSeverityBg(severity?: string | null) {
  const s = (severity || "INFO").toUpperCase();
  if (s === "CRITICAL") return "#fee2e2";
  if (s === "WARNING") return "#fef3c7";
  return "#dcfce7";
}

function getSeverityColor(severity?: string | null) {
  const s = (severity || "INFO").toUpperCase();
  if (s === "CRITICAL") return "#991b1b";
  if (s === "WARNING") return "#92400e";
  return "#166534";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background:
    "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 45%, #fff7ed 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 28,
  borderRadius: 28,
  background: "linear-gradient(135deg, #14532d, #166534, #2563eb)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
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
  fontWeight: 800,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  opacity: 0.85,
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 42,
  fontWeight: 900,
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
  fontWeight: 900,
  color: "#14532d",
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
  padding: 20,
  borderRadius: 22,
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(148,163,184,0.3)",
  boxShadow: "0 14px 30px rgba(15,23,42,0.08)",
};

const statIcon: React.CSSProperties = {
  width: 42,
  height: 8,
  borderRadius: 999,
  marginBottom: 16,
};

const statLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
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
  background: "rgba(255,255,255,0.85)",
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
  fontWeight: 800,
  background: "white",
};

const card: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(148,163,184,0.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,0.08)",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 18,
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
  padding: "9px 13px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#0369a1",
  fontWeight: 900,
  fontSize: 13,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 980,
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

const muted: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const severityBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 950,
};

const emptyBox: React.CSSProperties = {
  padding: 30,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 800,
};
