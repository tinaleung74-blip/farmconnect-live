"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminCustomerDetailPage() {
  const params = useParams();

  const [customer, setCustomer] = useState<any>(null);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [walletTx, setWalletTx] = useState<any[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerProfile();
  }, []);

  async function loadCustomerProfile() {
    const customerId = String(params.id);

    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    const { data: flockData } = await supabase
      .from("flocks")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    const { data: walletData } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(8);

    const { data: riskData } = await supabase
      .from("risk_alerts")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(6);

    setCustomer(customerData);
    setFlocks(flockData || []);
    setWalletTx(walletData || []);
    setRiskAlerts(riskData || []);
    setLoading(false);
  }

  if (loading) {
    return <main style={page}>Loading customer account...</main>;
  }

  if (!customer) {
    return <main style={page}>Customer not found.</main>;
  }

  return (
    <main style={page}>
      <Link href="/admin/customers" style={back}>
        ← Back to Customers
      </Link>

      <section style={profileHero}>
        <div style={avatar}>👤</div>

        <div>
          <p style={eyebrow}>Customer Account</p>
          <h1 style={title}>{customer.full_name || customer.name || "Unnamed Customer"}</h1>
          <p style={subtitle}>
            Admin-controlled customer account. Customer has no direct caretaker access.
          </p>
        </div>

        <span style={status}>{customer.status || "ACTIVE"}</span>
      </section>

      <section style={summaryGrid}>
        <div style={summaryCard}>
          <span style={summaryIcon}>💳</span>
          <p>Wallet Balance</p>
          <strong>₱{Number(customer.wallet_balance || 0).toLocaleString()}</strong>
        </div>

        <div style={summaryCard}>
          <span style={summaryIcon}>🐔</span>
          <p>Total Flocks</p>
          <strong>{flocks.length}</strong>
        </div>

        <div style={summaryCard}>
          <span style={summaryIcon}>⚠️</span>
          <p>Risk Alerts</p>
          <strong>{riskAlerts.length}</strong>
        </div>

        <div style={summaryCard}>
          <span style={summaryIcon}>🛡️</span>
          <p>Risk Score</p>
          <strong>{customer.risk_score || 0}</strong>
        </div>
      </section>

      <section style={twoGrid}>
        <div style={card}>
          <h2 style={cardTitle}>Customer Information</h2>

          <div style={infoList}>
            <p>📧 Email: {customer.email || "No email"}</p>
            <p>📞 Phone: {customer.phone || "No phone number"}</p>
            <p>📍 Address: {customer.address || "No address"}</p>
            <p>🪪 Customer ID: {customer.id}</p>
            <p>
              📅 Registered:{" "}
              {customer.created_at
                ? new Date(customer.created_at).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Admin Relationship Rule</h2>

          <div style={ruleBox}>
            <strong>Customer ↔ Admin only</strong>
            <p>
              This account is managed only by the Admin. The customer should not
              directly contact or access caretaker records.
            </p>
          </div>

          <div style={ruleBoxOrange}>
            <strong>No Customer ↔ Caretaker connection</strong>
            <p>
              All reports, updates, complaints, wallet activity, and farm
              monitoring must pass through Admin.
            </p>
          </div>
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <p style={eyebrow}>Livestock Ownership</p>
            <h2 style={sectionTitle}>Customer Flocks</h2>
          </div>
          <span style={smallBadge}>{flocks.length} Records</span>
        </div>

        {flocks.length === 0 ? (
          <p style={muted}>No flock records found for this customer.</p>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Flock Name</th>
                  <th style={th}>Animal Type</th>
                  <th style={th}>Quantity</th>
                  <th style={th}>Status</th>
                  <th style={th}>Harvest Date</th>
                </tr>
              </thead>
              <tbody>
                {flocks.map((f) => (
                  <tr key={f.id}>
                    <td style={td}>{f.name || f.flock_name || "Unnamed Flock"}</td>
                    <td style={td}>{f.animal_type || f.livestock_type || "Chicken"}</td>
                    <td style={td}>{f.quantity || 0}</td>
                    <td style={td}>{f.status || "GROWING"}</td>
                    <td style={td}>
                      {f.harvest_date
                        ? new Date(f.harvest_date).toLocaleDateString()
                        : "Not set"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={twoGrid}>
        <div style={panel}>
          <h2 style={sectionTitle}>Recent Wallet Transactions</h2>

          {walletTx.length === 0 ? (
            <p style={muted}>No wallet transactions found.</p>
          ) : (
            <div style={list}>
              {walletTx.map((tx) => (
                <div key={tx.id} style={listItem}>
                  <div>
                    <strong>{tx.type || "TRANSACTION"}</strong>
                    <p>{tx.description || tx.reference || "Wallet movement"}</p>
                  </div>
                  <span style={amount}>
                    ₱{Number(tx.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={panel}>
          <h2 style={sectionTitle}>Risk Alerts</h2>

          {riskAlerts.length === 0 ? (
            <p style={muted}>No risk alerts found.</p>
          ) : (
            <div style={list}>
              {riskAlerts.map((r) => (
                <div key={r.id} style={riskItem}>
                  <strong>⚠️ {r.title || r.alert_type || "Risk Alert"}</strong>
                  <p>{r.description || r.message || "No description provided"}</p>
                  <small>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "No date"}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "radial-gradient(circle at top left, #bbf7d0, transparent 30%), radial-gradient(circle at top right, #bfdbfe, transparent 30%), linear-gradient(135deg, #f0fdf4 0%, #eff6ff 55%, #fff7ed 100%)",
  color: "#0f172a",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 20,
  color: "#166534",
  fontWeight: 950,
  textDecoration: "none",
};

const profileHero: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 22,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(255,255,255,0.95)",
  borderRadius: 32,
  padding: 30,
  boxShadow: "0 24px 65px rgba(15,23,42,0.13)",
  marginBottom: 22,
};

const avatar: React.CSSProperties = {
  width: 86,
  height: 86,
  borderRadius: 28,
  background: "linear-gradient(135deg, #38bdf8, #2563eb)",
  color: "white",
  display: "grid",
  placeItems: "center",
  fontSize: 42,
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
  fontSize: 40,
  lineHeight: 1.05,
  fontWeight: 950,
  color: "#14532d",
};

const subtitle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  lineHeight: 1.5,
};

const status: React.CSSProperties = {
  marginLeft: "auto",
  background: "#dcfce7",
  color: "#166534",
  padding: "10px 16px",
  borderRadius: 999,
  fontWeight: 950,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 22,
};

const summaryCard: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  background: "rgba(255,255,255,0.88)",
  boxShadow: "0 16px 38px rgba(15,23,42,0.1)",
};

const summaryIcon: React.CSSProperties = {
  fontSize: 28,
};

const twoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
  marginBottom: 22,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 18px 45px rgba(15,23,42,0.1)",
};

const cardTitle: React.CSSProperties = {
  marginTop: 0,
  color: "#14532d",
  fontWeight: 950,
};

const infoList: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#475569",
};

const ruleBox: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#14532d",
  marginBottom: 12,
};

const ruleBoxOrange: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 18px 45px rgba(15,23,42,0.1)",
  marginBottom: 22,
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 14,
};

const sectionTitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#14532d",
  fontWeight: 950,
  fontSize: 26,
};

const smallBadge: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 950,
};

const muted: React.CSSProperties = {
  color: "#64748b",
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 14,
  background: "#ecfdf5",
  color: "#166534",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
};

const list: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const listItem: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const amount: React.CSSProperties = {
  color: "#166534",
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const riskItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 16,
  borderRadius: 18,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
};