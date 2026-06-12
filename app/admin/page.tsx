"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Stats = {
  customers: number;
  caretakers: number;
  caretakerHires: number;
  flocks: number;
  cashin: number;
  cashout: number;
  wallet: number;
  harvests: number;
  risks: number;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    customers: 0,
    caretakers: 0,
    caretakerHires: 0,
    flocks: 0,
    cashin: 0,
    cashout: 0,
    wallet: 0,
    harvests: 0,
    risks: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function safeCount(table: string) {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    return count || 0;
  }

  async function loadDashboard() {
    setLoading(true);

    const [
      customers,
      caretakers,
      caretakerHires,
      flocks,
      cashin,
      cashout,
      wallet,
      harvests,
      risks,
    ] = await Promise.all([
      safeCount("customers"),
      safeCount("caretakers"),
      safeCount("customer_caretaker_hires"),
      safeCount("flocks"),
      safeCount("cashin_requests"),
      safeCount("cashout_requests"),
      safeCount("wallet_transactions"),
      safeCount("harvests"),
      safeCount("risk_alerts"),
    ]);

    setStats({
      customers,
      caretakers,
      caretakerHires,
      flocks,
      cashin,
      cashout,
      wallet,
      harvests,
      risks,
    });

    setLoading(false);
  }

  const cards = [
    {
      title: "Customers",
      value: stats.customers,
      desc: "Investor / poultry customer accounts",
      href: "/admin/customers",
      icon: "👥",
    },
    {
      title: "Caretakers",
      value: stats.caretakers,
      desc: "Farm operators and assigned handlers",
      href: "/admin/caretakers",
      icon: "🧑‍🌾",
    },
    {
      title: "Caretaker Hire Requests",
      value: stats.caretakerHires,
      desc: "Review, approve, reject, and mark paid",
      href: "/admin/caretaker-hires",
      icon: "✅",
    },
    {
      title: "Active Flocks",
      value: stats.flocks,
      desc: "Chicken batches under monitoring",
      href: "/admin/reports",
      icon: "🐔",
    },
    {
      title: "Cash-In Requests",
      value: stats.cashin,
      desc: "Customer funding requests",
      href: "/admin/transactions/cashin",
      icon: "💰",
    },
    {
      title: "Cash-Out Requests",
      value: stats.cashout,
      desc: "Withdrawal and payout requests",
      href: "/admin/transactions/cashout",
      icon: "🏦",
    },
    {
      title: "Wallet Transactions",
      value: stats.wallet,
      desc: "Ledger and balance movement",
      href: "/admin/wallet",
      icon: "👛",
    },
    {
      title: "Harvest Records",
      value: stats.harvests,
      desc: "Harvest, yield, and ROI tracking",
      href: "/admin/harvest",
      icon: "🌾",
    },
    {
      title: "Risk Alerts",
      value: stats.risks,
      desc: "Mortality, delay, and farm warnings",
      href: "/admin/risk-management",
      icon: "⚠️",
    },
  ];

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Live Admin</p>
          <h1 style={title}>Executive Admin Dashboard V2</h1>
          <p style={subtitle}>
            Central command center for customers, caretakers, caretaker hire
            approvals, flocks, treasury, harvest, wallet, risk monitoring, and
            audit controls.
          </p>
        </div>

        <div style={statusBox}>
          <div style={statusDot}></div>
          <span>{loading ? "Syncing Supabase..." : "System Online"}</span>
        </div>
      </section>

      <section style={summaryGrid}>
        <div style={summaryCard}>
          <p style={summaryLabel}>Platform Status</p>
          <h2 style={summaryValue}>Operational</h2>
          <p style={summaryText}>Customer ↔ Admin / Caretaker ↔ Admin only</p>
        </div>

        <div style={summaryCard}>
          <p style={summaryLabel}>Caretaker Hiring</p>
          <h2 style={summaryValue}>
            {stats.caretakerHires > 0 ? "Needs Review" : "No Pending View"}
          </h2>
          <p style={summaryText}>Approval and payment verification required</p>
        </div>

        <div style={summaryCard}>
          <p style={summaryLabel}>Risk Level</p>
          <h2 style={summaryValue}>
            {stats.risks > 0 ? "Needs Review" : "Normal"}
          </h2>
          <p style={summaryText}>Monitor mortality, reports, and delays</p>
        </div>

        <div style={summaryCard}>
          <p style={summaryLabel}>Treasury Control</p>
          <h2 style={summaryValue}>Admin Managed</h2>
          <p style={summaryText}>Cash-in and cash-out require admin review</p>
        </div>
      </section>

      <section style={grid}>
        {cards.map((card) => (
          <Link key={card.title} href={card.href} style={cardStyle}>
            <div style={icon}>{card.icon}</div>
            <div>
              <p style={cardTitle}>{card.title}</p>
              <h2 style={cardValue}>{loading ? "..." : card.value}</h2>
              <p style={cardDesc}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      <section style={controlPanel}>
        <div>
          <h2 style={sectionTitle}>Admin Control Panel</h2>
          <p style={sectionText}>
            Use these modules for full platform review, caretaker hire
            approvals, audit, financial monitoring, and investor-ready
            reporting.
          </p>
        </div>

        <div style={buttonGrid}>
          <Link href="/admin/caretaker-hires" style={button}>
            Caretaker Hires
          </Link>
          <Link href="/admin/treasury" style={button}>
            Treasury
          </Link>
          <Link href="/admin/transactions" style={button}>
            Transactions
          </Link>
          <Link href="/admin/audit-logs" style={button}>
            Audit Logs
          </Link>
          <Link href="/admin/reports" style={button}>
            Reports
          </Link>
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px",
  background:
    "linear-gradient(135deg, #ecfdf5 0%, #fefce8 45%, #eff6ff 100%)",
  color: "#123524",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "flex-start",
  marginBottom: 28,
};

const eyebrow: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#15803d",
  marginBottom: 8,
};

const title: React.CSSProperties = {
  fontSize: 42,
  fontWeight: 900,
  margin: 0,
};

const subtitle: React.CSSProperties = {
  maxWidth: 780,
  fontSize: 16,
  lineHeight: 1.7,
  color: "#456052",
};

const statusBox: React.CSSProperties = {
  background: "white",
  borderRadius: 999,
  padding: "12px 18px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 800,
  boxShadow: "0 14px 35px rgba(0,0,0,0.08)",
};

const statusDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#22c55e",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 22,
};

const summaryCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(21,128,61,0.12)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 12px 28px rgba(0,0,0,0.06)",
};

const summaryLabel: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 800,
  color: "#15803d",
};

const summaryValue: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 25,
};

const summaryText: React.CSSProperties = {
  margin: 0,
  color: "#5b7165",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 18,
};

const cardStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#123524",
  background: "white",
  borderRadius: 24,
  padding: 22,
  display: "flex",
  gap: 18,
  alignItems: "flex-start",
  boxShadow: "0 18px 38px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.05)",
};

const icon: React.CSSProperties = {
  fontSize: 34,
  width: 58,
  height: 58,
  borderRadius: 18,
  background: "#dcfce7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  fontSize: 16,
};

const cardValue: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 34,
  fontWeight: 900,
};

const cardDesc: React.CSSProperties = {
  margin: 0,
  color: "#66776d",
  fontSize: 14,
  lineHeight: 1.5,
};

const controlPanel: React.CSSProperties = {
  marginTop: 28,
  background: "#123524",
  color: "white",
  borderRadius: 28,
  padding: 28,
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  flexWrap: "wrap",
  boxShadow: "0 18px 38px rgba(0,0,0,0.16)",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
};

const sectionText: React.CSSProperties = {
  maxWidth: 620,
  color: "#d1fae5",
  lineHeight: 1.6,
};

const buttonGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(130px, 1fr))",
  gap: 12,
};

const button: React.CSSProperties = {
  background: "white",
  color: "#123524",
  textDecoration: "none",
  padding: "14px 18px",
  borderRadius: 16,
  fontWeight: 900,
  textAlign: "center",
};