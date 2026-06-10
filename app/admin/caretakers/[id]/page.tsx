"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminCaretakersPage() {
  const [caretakers, setCaretakers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCaretakers();
  }, []);

  async function loadCaretakers() {
    const { data } = await supabase
      .from("caretakers")
      .select("*")
      .order("created_at", { ascending: false });

    setCaretakers(data || []);
    setLoading(false);
  }

  const filteredCaretakers = useMemo(() => {
    const keyword = search.toLowerCase();

    return caretakers.filter((c) => {
      return (
        String(c.full_name || c.name || "").toLowerCase().includes(keyword) ||
        String(c.phone || "").toLowerCase().includes(keyword) ||
        String(c.location || "").toLowerCase().includes(keyword) ||
        String(c.farm_area || "").toLowerCase().includes(keyword)
      );
    });
  }, [caretakers, search]);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>
            ← Back to Dashboard
          </Link>

          <p style={eyebrow}>FarmConnect Admin V2</p>
          <h1 style={title}>Caretaker Management</h1>
          <p style={subtitle}>
            Monitor caretaker accounts, farm assignments, field activity,
            report discipline, and operational trust level.
          </p>
        </div>

        <div style={heroCard}>
          <span>Total Caretakers</span>
          <strong>{caretakers.length}</strong>
          <small>Caretaker ↔ Admin only</small>
        </div>
      </section>

      <section style={toolbar}>
        <div>
          <h2 style={sectionTitle}>Caretaker Directory</h2>
          <p style={muted}>
            Admin-only monitoring for field workers and farm operators.
          </p>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search caretaker name, phone, location..."
          style={searchBox}
        />
      </section>

      <section style={statsGrid}>
        <div style={statCard}>
          <span>👨‍🌾</span>
          <div>
            <p>Registered Caretakers</p>
            <strong>{caretakers.length}</strong>
          </div>
        </div>

        <div style={statCard}>
          <span>✅</span>
          <div>
            <p>Active Workers</p>
            <strong>
              {caretakers.filter((c) => (c.status || "ACTIVE") === "ACTIVE").length}
            </strong>
          </div>
        </div>

        <div style={statCard}>
          <span>📋</span>
          <div>
            <p>Report Compliance</p>
            <strong>Tracked</strong>
          </div>
        </div>

        <div style={statCard}>
          <span>🛡️</span>
          <div>
            <p>Admin Supervision</p>
            <strong>Required</strong>
          </div>
        </div>
      </section>

      <section style={rulePanel}>
        <div>
          <strong>Relationship Control Rule</strong>
          <p>
            Caretakers report only to Admin. Customers do not directly access
            caretaker accounts, contact details, reports, or private field logs.
          </p>
        </div>
      </section>

      <section style={grid}>
        {loading ? (
          <div style={empty}>Loading caretakers...</div>
        ) : filteredCaretakers.length === 0 ? (
          <div style={empty}>No caretakers found.</div>
        ) : (
          filteredCaretakers.map((c) => (
            <Link key={c.id} href={`/admin/caretakers/${c.id}`} style={card}>
              <div style={topRow}>
                <div style={avatar}>👨‍🌾</div>
                <span style={status}>{c.status || "ACTIVE"}</span>
              </div>

              <h2 style={name}>{c.full_name || c.name || "Unnamed Caretaker"}</h2>

              <p style={info}>📞 {c.phone || "No phone number"}</p>
              <p style={info}>📍 {c.location || "Farm location not set"}</p>
              <p style={info}>🏡 Farm Area: {c.farm_area || "Not assigned"}</p>
              <p style={info}>🐔 Assigned Flock: {c.assigned_flock || "Not assigned"}</p>

              <div style={metrics}>
                <div>
                  <strong>{c.total_reports || 0}</strong>
                  <span>Reports</span>
                </div>
                <div>
                  <strong>{c.risk_score || 0}</strong>
                  <span>Risk</span>
                </div>
                <div>
                  <strong>{c.rating || "N/A"}</strong>
                  <span>Rating</span>
                </div>
              </div>

              <button style={button}>Open Caretaker Profile →</button>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "radial-gradient(circle at top left, #fde68a, transparent 28%), radial-gradient(circle at top right, #bbf7d0, transparent 30%), linear-gradient(135deg, #fff7ed 0%, #f0fdf4 48%, #eff6ff 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 22,
  alignItems: "center",
  marginBottom: 22,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(255,255,255,0.95)",
  borderRadius: 32,
  padding: 30,
  boxShadow: "0 24px 65px rgba(15,23,42,0.13)",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 14,
  color: "#166534",
  fontWeight: 950,
  textDecoration: "none",
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  color: "#b45309",
  fontWeight: 950,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 42,
  lineHeight: 1.05,
  fontWeight: 950,
  color: "#14532d",
};

const subtitle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  maxWidth: 760,
  fontSize: 16,
  lineHeight: 1.5,
};

const heroCard: React.CSSProperties = {
  minWidth: 220,
  padding: 24,
  borderRadius: 26,
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "white",
  display: "grid",
  gap: 8,
  boxShadow: "0 22px 45px rgba(249,115,22,0.3)",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "center",
  marginBottom: 18,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: "#14532d",
  fontSize: 28,
  fontWeight: 950,
};

const muted: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
};

const searchBox: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: "15px 18px",
  borderRadius: 18,
  border: "1px solid #fed7aa",
  outline: "none",
  boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  fontSize: 14,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const statCard: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  padding: 18,
  borderRadius: 24,
  background: "rgba(255,255,255,0.86)",
  boxShadow: "0 15px 38px rgba(15,23,42,0.09)",
};

const rulePanel: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  marginBottom: 22,
  boxShadow: "0 14px 34px rgba(15,23,42,0.08)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
  gap: 20,
};

const card: React.CSSProperties = {
  textDecoration: "none",
  color: "#0f172a",
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(255,255,255,0.95)",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
  display: "grid",
  gap: 12,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const avatar: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 20,
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  display: "grid",
  placeItems: "center",
  fontSize: 28,
  color: "white",
};

const status: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 950,
};

const name: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 950,
  color: "#14532d",
};

const info: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
};

const metrics: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
  marginTop: 8,
};

const button: React.CSSProperties = {
  marginTop: 8,
  border: "none",
  borderRadius: 16,
  padding: "12px 14px",
  background: "#14532d",
  color: "white",
  fontWeight: 950,
};

const empty: React.CSSProperties = {
  gridColumn: "1 / -1",
  background: "rgba(255,255,255,0.9)",
  borderRadius: 24,
  padding: 30,
  color: "#64748b",
};