"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase.from("profiles").select("*");

    setCustomers(data || []);
    setLoading(false);
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const keyword = search.toLowerCase();

      return (
        String(c.full_name || c.name || "").toLowerCase().includes(keyword) ||
        String(c.email || "").toLowerCase().includes(keyword) ||
        String(c.phone || "").toLowerCase().includes(keyword) ||
        String(c.verification_status || "").toLowerCase().includes(keyword) ||
        String(c.membership_status || "").toLowerCase().includes(keyword) ||
        String(c.account_status || "").toLowerCase().includes(keyword)
      );
    });
  }, [customers, search]);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>
            ← Back to Dashboard
          </Link>

          <p style={eyebrow}>FarmConnect Admin V2</p>
          <h1 style={title}>Customer Management</h1>

          <p style={subtitle}>
            Manage customer accounts, KYC verification, annual investor
            membership, wallet activity, and customer risk status.
          </p>
        </div>

        <div style={heroCard}>
          <span>Total Profiles</span>
          <strong>{customers.length}</strong>
          <small>Customer ↔ Admin only</small>
        </div>
      </section>

      <section style={toolbar}>
        <div>
          <h2 style={sectionTitle}>Customer Directory</h2>
          <p style={muted}>
            Open customer profiles for KYC approval, rejection, and membership
            monitoring.
          </p>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, status..."
          style={searchBox}
        />
      </section>

      <section style={statsGrid}>
        <div style={statCard}>
          <span>👤</span>
          <div>
            <p>Registered Customers</p>
            <strong>{customers.length}</strong>
          </div>
        </div>

        <div style={statCard}>
          <span>🟡</span>
          <div>
            <p>Pending KYC</p>
            <strong>
              {
                customers.filter(
                  (c) => (c.verification_status || "PENDING") === "PENDING"
                ).length
              }
            </strong>
          </div>
        </div>

        <div style={statCard}>
          <span>🟢</span>
          <div>
            <p>Approved KYC</p>
            <strong>
              {
                customers.filter((c) => c.verification_status === "APPROVED")
                  .length
              }
            </strong>
          </div>
        </div>

        <div style={statCard}>
          <span>💳</span>
          <div>
            <p>Membership Unpaid</p>
            <strong>
              {
                customers.filter(
                  (c) => (c.membership_status || "UNPAID") === "UNPAID"
                ).length
              }
            </strong>
          </div>
        </div>
      </section>

      <section style={grid}>
        {loading ? (
          <div style={empty}>Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div style={empty}>No customers found.</div>
        ) : (
          filteredCustomers.map((c) => (
            <Link key={c.id} href={`/admin/customers/${c.id}`} style={card}>
              <div style={topRow}>
                <div style={avatar}>👤</div>
                <span style={getStatusStyle(c.verification_status || "PENDING")}>
                  {c.verification_status || "PENDING"}
                </span>
              </div>

              <h2 style={name}>{c.full_name || c.name || "Unnamed Customer"}</h2>

              <p style={info}>📧 {c.email || "No email"}</p>
              <p style={info}>📞 {c.phone || "No phone number"}</p>
              <p style={info}>🪪 ID: {c.id_type || "Not submitted"}</p>

              <div style={metrics}>
                <div>
                  <strong>{c.account_status || "PENDING"}</strong>
                  <span>Account</span>
                </div>

                <div>
                  <strong>{c.membership_status || "UNPAID"}</strong>
                  <span>Membership</span>
                </div>

                <div>
                  <strong>₱{Number(c.wallet_balance || 0).toLocaleString()}</strong>
                  <span>Wallet</span>
                </div>
              </div>

              <div style={membershipMini}>
                <span>Annual Investor Membership</span>
                <b>₱{Number(c.membership_fee || 999).toLocaleString()} / Year</b>
              </div>

              <button style={button}>Open Customer Account →</button>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

function getStatusStyle(statusValue: string): React.CSSProperties {
  if (statusValue === "APPROVED") {
    return {
      ...status,
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (statusValue === "REJECTED") {
    return {
      ...status,
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    ...status,
    background: "#fef3c7",
    color: "#92400e",
  };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "radial-gradient(circle at top left, #bbf7d0, transparent 30%), radial-gradient(circle at top right, #bae6fd, transparent 28%), linear-gradient(135deg, #f0fdf4 0%, #eff6ff 55%, #fff7ed 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 22,
  alignItems: "center",
  marginBottom: 22,
  background: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(255,255,255,0.9)",
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
  color: "#15803d",
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
  minWidth: 210,
  padding: 24,
  borderRadius: 26,
  background: "linear-gradient(135deg, #16a34a, #22c55e)",
  color: "white",
  display: "grid",
  gap: 8,
  boxShadow: "0 22px 45px rgba(22,163,74,0.3)",
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
  border: "1px solid #bbf7d0",
  outline: "none",
  boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  fontSize: 14,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 22,
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
  background: "linear-gradient(135deg, #38bdf8, #2563eb)",
  display: "grid",
  placeItems: "center",
  fontSize: 28,
  color: "white",
};

const status: React.CSSProperties = {
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

const membershipMini: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 16,
  padding: 12,
  display: "grid",
  gap: 4,
  color: "#14532d",
  fontSize: 13,
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