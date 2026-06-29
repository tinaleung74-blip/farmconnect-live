"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Stats = {
  customers: number;
  memberships: number;
  caretakers: number;
  caretakerHires: number;
  flocks: number;
  cashin: number;
  cashout: number;
  wallet: number;
  sellRequests: number;
  mortalityReports: number;
};

type WalletTx = {
  id: string;
  transaction_type: string | null;
  amount: number | string | null;
  status: string | null;
};

const REVENUE_TYPES = [
  "MEMBERSHIP_PAYMENT_APPROVED",
  "FARMCONNECT_TECHNICAL_FEE",
  "FARMCONNECT_CASHOUT_FEE",
  "FARMCONNECT_SELL_CHICKEN_FEE",
];

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [walletTx, setWalletTx] = useState<WalletTx[]>([]);
  const [stats, setStats] = useState<Stats>({
    customers: 0,
    memberships: 0,
    caretakers: 0,
    caretakerHires: 0,
    flocks: 0,
    cashin: 0,
    cashout: 0,
    wallet: 0,
    sellRequests: 0,
    mortalityReports: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function safeCount(table: string) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error(`${table} count error:`, error.message);
      return 0;
    }

    return count || 0;
  }

  async function loadDashboard() {
    setLoading(true);

    const [
      customers,
      memberships,
      caretakers,
      caretakerHires,
      flocks,
      cashin,
      cashout,
      wallet,
      sellRequests,
      mortalityReports,
      walletRes,
    ] = await Promise.all([
      safeCount("profiles"),
      safeCount("membership_payments"),
      safeCount("caretakers"),
      safeCount("customer_caretaker_hires"),
      safeCount("flocks"),
      safeCount("cashin_requests"),
      safeCount("cashout_requests"),
      safeCount("wallet_transactions"),
      safeCount("sell_chicken_requests"),
      safeCount("mortality_logs"),
      supabase
        .from("wallet_transactions")
        .select("id,transaction_type,amount,status")
        .limit(500),
    ]);

    setStats({
      customers,
      memberships,
      caretakers,
      caretakerHires,
      flocks,
      cashin,
      cashout,
      wallet,
      sellRequests,
      mortalityReports,
    });

    setWalletTx((walletRes.data || []) as WalletTx[]);
    setLoading(false);
  }

  const revenue = useMemo(() => {
    const completed = walletTx.filter((tx) =>
      ["COMPLETED", "APPROVED", "PAID"].includes(clean(tx.status))
    );

    const total = completed
      .filter((tx) => REVENUE_TYPES.includes(String(tx.transaction_type || "")))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const membership = completed
      .filter((tx) => tx.transaction_type === "MEMBERSHIP_PAYMENT_APPROVED")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const fees = completed
      .filter((tx) =>
        [
          "FARMCONNECT_TECHNICAL_FEE",
          "FARMCONNECT_CASHOUT_FEE",
          "FARMCONNECT_SELL_CHICKEN_FEE",
        ].includes(String(tx.transaction_type || ""))
      )
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    return { total, membership, fees };
  }, [walletTx]);

  const cards = [
    {
      title: "Analytics",
      value: "V28",
      desc: "Revenue, sales, customers, flocks, and business intelligence",
      href: "/admin/analytics",
      icon: "📊",
    },
    {
      title: "Customers",
      value: stats.customers,
      desc: "Profiles, KYC, membership, and anti-scam review",
      href: "/admin/customers",
      icon: "👥",
    },
    {
      title: "Membership Requests",
      value: stats.memberships,
      desc: "Approve Annual Investor Membership payments",
      href: "/admin/memberships",
      icon: "💳",
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
      desc: "Review, approve, reject, and refund",
      href: "/admin/caretaker-hires",
      icon: "✅",
    },
    {
      title: "Operations",
      value: stats.flocks,
      desc: "Live flock, caretaker, cash, inventory, and sell activity feed",
      href: "/admin/operations",
      icon: "🐔",
    },
    {
      title: "Sell Requests",
      value: stats.sellRequests,
      desc: "Approve or reject chicken selling requests",
      href: "/admin/sell-requests",
      icon: "🐓",
    },
    {
      title: "Sell Price",
      value: "Policy",
      desc: "Admin live sell price and technical fee policy screen",
      href: "/admin/sell-price",
      icon: "🏷️",
    },
    {
      title: "Transactions Center",
      value: "Live",
      desc: "Unified cash-in, cash-out, wallet, and sell credit activity",
      href: "/admin/transactions",
      icon: "🔁",
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
      desc: "Ledger, fees, revenue, and balance movement",
      href: "/admin/wallet",
      icon: "👛",
    },
    {
      title: "Risk Management",
      value: stats.mortalityReports,
      desc: "Mortality, compliance, and farm risk alerts for admin review",
      href: "/admin/risk-management",
      icon: "⚠️",
    },
    {
      title: "Reports",
      value: "Live",
      desc: "Production farm reports from operations and caretaker activity",
      href: "/admin/reports",
      icon: "📋",
    },
    {
      title: "Harvest",
      value: "Live",
      desc: "Harvest output, schedules, expenses, and production results",
      href: "/admin/harvest",
      icon: "🌾",
    },
    {
      title: "Audit Logs",
      value: "Audit",
      desc: "Admin accountability trail and security activity logs",
      href: "/admin/audit-logs",
      icon: "🧾",
    },
    {
      title: "Treasury",
      value: money(revenue.total),
      desc: "Membership revenue and FarmConnect platform fees",
      href: "/admin/treasury",
      icon: "🏛️",
    },
  ];

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Live Admin V28</p>
          <h1 style={title}>Executive Admin Dashboard</h1>
          <p style={subtitle}>
            Central command center for analytics, customers, KYC, memberships,
            caretakers, sell chicken approvals, treasury, wallet, poultry
            monitoring, mortality reports, and audit controls.
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
          <p style={summaryLabel}>FarmConnect Revenue</p>
          <h2 style={summaryValue}>{money(revenue.total)}</h2>
          <p style={summaryText}>Membership + platform technical fees</p>
        </div>

        <div style={summaryCard}>
          <p style={summaryLabel}>Membership Revenue</p>
          <h2 style={summaryValue}>{money(revenue.membership)}</h2>
          <p style={summaryText}>Annual Investor Membership approvals</p>
        </div>

        <div style={summaryCard}>
          <p style={summaryLabel}>Technical Fees</p>
          <h2 style={summaryValue}>{money(revenue.fees)}</h2>
          <p style={summaryText}>Caretaker, cash-out, and sell chicken fees</p>
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
            Use these modules for analytics, customer profiling, membership
            approval, caretaker hire approvals, sell chicken approvals,
            treasury, audit, financial monitoring, mortality reports, and
            investor-ready reporting.
          </p>
        </div>

        <div style={buttonGrid}>
          <Link href="/admin/analytics" style={button}>Analytics</Link>
          <Link href="/admin/customers" style={button}>Customers</Link>
          <Link href="/admin/memberships" style={button}>Memberships</Link>
          <Link href="/admin/caretakers" style={button}>Caretakers</Link>
          <Link href="/admin/caretaker-hires" style={button}>Caretaker Hires</Link>
          <Link href="/admin/transactions" style={button}>Transactions</Link>
          <Link href="/admin/transactions/cashin" style={button}>Cash-In</Link>
          <Link href="/admin/transactions/cashout" style={button}>Cash-Out</Link>
          <Link href="/admin/wallet" style={button}>Wallet</Link>
          <Link href="/admin/treasury" style={button}>Treasury</Link>
          <Link href="/admin/sell-price" style={button}>Sell Price</Link>
          <Link href="/admin/sell-requests" style={button}>Sell Requests</Link>
          <Link href="/admin/operations" style={button}>Operations</Link>
          <Link href="/admin/reports" style={button}>Reports</Link>
          <Link href="/admin/harvest" style={button}>Harvest</Link>
          <Link href="/admin/risk-management" style={button}>Risk</Link>
          <Link href="/admin/audit-logs" style={button}>Audit Logs</Link>
        </div>
      </section>
    </main>
  );
}

function clean(value?: string | null) {
  return String(value || "").toUpperCase();
}

function money(value: number) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
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
  flexWrap: "wrap",
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
  flexWrap: "wrap",
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
  flexWrap: "wrap",
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
  flexWrap: "wrap",
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
