"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UpdateRecord = {
  type: string;
  status?: string;
  photoName?: string;
  feedPhoto?: string;
  averageWeight?: string;
  sampleCount?: string;
  count?: string;
  reason?: string;
  category?: string;
  message?: string;
  note?: string;
  date?: string;
  created_at?: string;
};

export default function AdminCaretakerUpdatesPage() {
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("caretaker_updates") || "[]");
    setUpdates(saved);
  }, []);

  const feeding = updates.filter((u) => u.type === "feeding").length;
  const weight = updates.filter((u) => u.type === "weight").length;
  const photo = updates.filter((u) => u.type === "photo").length;
  const mortality = updates.filter((u) => u.type === "mortality").length;
  const notes = updates.filter((u) => u.type === "note").length;

  function clearUpdates() {
    localStorage.removeItem("caretaker_updates");
    setUpdates([]);
  }

  return (
    <main style={page}>
      <div style={topbar}>
        <div>
          <p style={small}>FarmConnect Admin</p>
          <h1 style={title}>Caretaker Monitoring 🐔</h1>
          <p style={subtitle}>
            All caretaker uploads, reports, and concerns in one dashboard.
          </p>
        </div>

        <Link href="/admin/dashboard" style={backBtn}>
          ← Admin Dashboard
        </Link>
      </div>

      <section style={statsGrid}>
        <Stat title="Total Updates" value={updates.length} icon="📋" />
        <Stat title="Feeding" value={feeding} icon="🌽" />
        <Stat title="Weight" value={weight} icon="⚖️" />
        <Stat title="Photos" value={photo} icon="📸" />
        <Stat title="Mortality" value={mortality} icon="🐔" />
        <Stat title="Concerns" value={notes} icon="📝" />
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <h2 style={panelTitle}>Latest Caretaker Updates</h2>

          <button onClick={clearUpdates} style={clearBtn}>
            Clear Demo Data
          </button>
        </div>

        {updates.length === 0 ? (
          <div style={emptyBox}>
            <div style={{ fontSize: 54 }}>🌾</div>
            <h3>No caretaker updates yet</h3>
            <p>Submit from caretaker pages first.</p>
          </div>
        ) : (
          <div style={list}>
            {updates.map((item, index) => (
              <div key={index} style={updateCard}>
                <div style={updateTop}>
                  <span style={typeBadge}>{getIcon(item.type)} {labelType(item.type)}</span>
                  <span style={dateText}>
                    {new Date(item.date || item.created_at || "").toLocaleString()}
                  </span>
                </div>

                <div style={detailsGrid}>
                  {item.status && <Detail label="Status" value={item.status} />}
                  {item.photoName && <Detail label="Camera Photo" value={item.photoName} />}
                  {item.feedPhoto && <Detail label="Photo" value={item.feedPhoto} />}
                  {item.averageWeight && <Detail label="Average Weight" value={item.averageWeight} />}
                  {item.sampleCount && <Detail label="Sample Count" value={item.sampleCount} />}
                  {item.count && <Detail label="Mortality Count" value={item.count} />}
                  {item.reason && <Detail label="Reason" value={item.reason} />}
                  {item.category && <Detail label="Concern Type" value={item.category} />}
                  {item.message && <Detail label="Message" value={item.message} />}
                  {item.note && <Detail label="Note" value={item.note} />}
                </div>

                <div style={actionRow}>
                  <button style={approveBtn}>Review ✅</button>
                  <button style={flagBtn}>Flag ⚠️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div style={statCard}>
      <div style={statIcon}>{icon}</div>
      <div>
        <div style={statValue}>{value}</div>
        <div style={statTitle}>{title}</div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailBox}>
      <div style={detailLabel}>{label}</div>
      <div style={detailValue}>{value}</div>
    </div>
  );
}

function getIcon(type: string) {
  if (type === "feeding") return "🌽";
  if (type === "weight") return "⚖️";
  if (type === "photo") return "📸";
  if (type === "mortality") return "🐔";
  if (type === "note") return "📝";
  return "📋";
}

function labelType(type: string) {
  if (type === "feeding") return "Feeding Update";
  if (type === "weight") return "Weight Update";
  if (type === "photo") return "Photo Update";
  if (type === "mortality") return "Mortality Report";
  if (type === "note") return "Caretaker Concern";
  return "Update";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 20,
  fontFamily: "Arial, sans-serif",
  background:
    "linear-gradient(135deg, #ecfccb 0%, #dbeafe 45%, #fef9c3 100%)",
};

const topbar: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto 20px",
  background: "linear-gradient(135deg, #16a34a, #0284c7)",
  borderRadius: 28,
  padding: 24,
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  boxShadow: "0 20px 45px rgba(2,132,199,0.22)",
};

const small: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  opacity: 0.9,
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 36,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  opacity: 0.95,
};

const backBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.18)",
  color: "white",
  padding: "12px 16px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 900,
};

const statsGrid: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto 20px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
  gap: 14,
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: 22,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
};

const statIcon: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  background: "#dcfce7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
};

const statValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#14532d",
};

const statTitle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
};

const panel: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  background: "rgba(255,255,255,0.95)",
  borderRadius: 28,
  padding: 20,
  boxShadow: "0 20px 45px rgba(15,23,42,0.1)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  color: "#14532d",
  fontSize: 24,
  fontWeight: 900,
};

const clearBtn: React.CSSProperties = {
  border: "none",
  background: "#fee2e2",
  color: "#991b1b",
  padding: "11px 14px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const emptyBox: React.CSSProperties = {
  padding: 50,
  textAlign: "center",
  color: "#64748b",
};

const list: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const updateCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff, #f8fafc)",
};

const updateTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const typeBadge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 900,
};

const dateText: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const detailsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
};

const detailBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 12,
};

const detailLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 900,
  textTransform: "uppercase",
};

const detailValue: React.CSSProperties = {
  marginTop: 5,
  color: "#0f172a",
  fontWeight: 800,
  wordBreak: "break-word",
};

const actionRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 10,
};

const approveBtn: React.CSSProperties = {
  border: "none",
  background: "#22c55e",
  color: "white",
  padding: "11px 14px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const flagBtn: React.CSSProperties = {
  border: "none",
  background: "#fef3c7",
  color: "#92400e",
  padding: "11px 14px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
};