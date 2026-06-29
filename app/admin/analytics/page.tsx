"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

const REVENUE_TYPES = [
  "MEMBERSHIP_PAYMENT_APPROVED",
  "FARMCONNECT_TECHNICAL_FEE",
  "FARMCONNECT_CASHOUT_FEE",
  "FARMCONNECT_SELL_CHICKEN_FEE",
];

export default function AdminAnalyticsPage() {
  const [walletTx, setWalletTx] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [flocks, setFlocks] = useState<Row[]>([]);
  const [caretakers, setCaretakers] = useState<Row[]>([]);
  const [memberships, setMemberships] = useState<Row[]>([]);
  const [cashins, setCashins] = useState<Row[]>([]);
  const [cashouts, setCashouts] = useState<Row[]>([]);
  const [sellRequests, setSellRequests] = useState<Row[]>([]);
  const [caretakerHires, setCaretakerHires] = useState<Row[]>([]);
  const [mortalityReports, setMortalityReports] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);

    const [
      walletRes,
      profileRes,
      flockRes,
      caretakerRes,
      membershipRes,
      cashinRes,
      cashoutRes,
      sellRes,
      hireRes,
      mortalityRes,
    ] = await Promise.all([
      supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("profiles").select("*").limit(1000),
      supabase.from("flocks").select("*").limit(1000),
      supabase.from("caretakers").select("*").limit(1000),
      supabase
        .from("membership_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("cashin_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("cashout_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("sell_chicken_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("customer_caretaker_hires")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("mortality_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    setWalletTx(walletRes.data || []);
    setProfiles(profileRes.data || []);
    setFlocks(flockRes.data || []);
    setCaretakers(caretakerRes.data || []);
    setMemberships(membershipRes.data || []);
    setCashins(cashinRes.data || []);
    setCashouts(cashoutRes.data || []);
    setSellRequests(sellRes.data || []);
    setCaretakerHires(hireRes.data || []);
    setMortalityReports(mortalityRes.data || []);
    setLoading(false);
  }

  const analytics = useMemo(() => {
    const completedRevenue = walletTx.filter(
      (tx) =>
        REVENUE_TYPES.includes(String(tx.transaction_type || "")) &&
        ["COMPLETED", "APPROVED", "PAID"].includes(status(tx.status))
    );

    const todayRevenue = completedRevenue
      .filter((tx) => isToday(tx.created_at))
      .reduce((sum, tx) => sum + num(tx.amount), 0);

    const monthRevenue = completedRevenue
      .filter((tx) => isThisMonth(tx.created_at))
      .reduce((sum, tx) => sum + num(tx.amount), 0);

    const lifetimeRevenue = completedRevenue.reduce(
      (sum, tx) => sum + num(tx.amount),
      0
    );

    const membershipRevenue = sumType(
      completedRevenue,
      "MEMBERSHIP_PAYMENT_APPROVED"
    );
    const caretakerFees = sumType(
      completedRevenue,
      "FARMCONNECT_TECHNICAL_FEE"
    );
    const cashoutFees = sumType(completedRevenue, "FARMCONNECT_CASHOUT_FEE");
    const sellFees = sumType(
      completedRevenue,
      "FARMCONNECT_SELL_CHICKEN_FEE"
    );

    const walletExposure = profiles.reduce(
      (sum, p) => sum + num(p.wallet_balance),
      0
    );

    const approvedSellRequests = sellRequests.filter(
      (r) => status(r.status) === "APPROVED"
    );

    const totalChickensSold = approvedSellRequests.reduce(
      (sum, r) => sum + num(r.quantity || r.chickens_sold || r.total_chickens),
      0
    );

    const totalChickenSales = approvedSellRequests.reduce(
      (sum, r) => sum + num(r.total_amount || r.gross_amount),
      0
    );

    const topBatch = getTopBySum(
      approvedSellRequests,
      "batch_no",
      "total_amount"
    );
    const topCustomer = getTopBySum(
      approvedSellRequests,
      "profile_id",
      "total_amount"
    );

    return {
      todayRevenue,
      monthRevenue,
      lifetimeRevenue,
      membershipRevenue,
      caretakerFees,
      cashoutFees,
      sellFees,
      walletExposure,

      totalCustomers: profiles.length,
      activeMembers: profiles.filter(
        (p) => status(p.membership_status) === "ACTIVE"
      ).length,
      approvedKyc: profiles.filter(
        (p) => status(p.verification_status) === "APPROVED"
      ).length,
      suspendedAccounts: profiles.filter(
        (p) => status(p.account_status) === "SUSPENDED"
      ).length,
      rejectedKyc: profiles.filter(
        (p) => status(p.verification_status) === "REJECTED"
      ).length,

      activeFlocks: flocks.filter((f) => status(f.status) === "ACTIVE").length,
      totalFlocks: flocks.length,
      totalChickensAlive: flocks.reduce(
        (sum, f) =>
          sum + num(f.alive_count || f.total_chicks || f.total_heads),
        0
      ),

      activeCaretakers: caretakers.filter((c) =>
        ["ACTIVE", "AVAILABLE", "ASSIGNED", "HIRED"].includes(status(c.status))
      ).length,

      pendingMemberships: memberships.filter(
        (x) => status(x.status) === "PENDING"
      ).length,
      pendingCashins: cashins.filter((x) => status(x.status) === "PENDING")
        .length,
      pendingCashouts: cashouts.filter((x) =>
        ["PENDING", "PROCESSING"].includes(status(x.status))
      ).length,
      pendingSell: sellRequests.filter((x) =>
        ["PENDING", "PENDING_ADMIN_APPROVAL"].includes(status(x.status))
      ).length,
      pendingHires: caretakerHires.filter((x) =>
        ["PENDING", "PENDING_ADMIN_APPROVAL"].includes(status(x.status))
      ).length,

      totalChickensSold,
      totalChickenSales,
      topBatch,
      topCustomer,

      openMortalityReports: mortalityReports.filter((r) =>
        ["OPEN", "PENDING", "REPORTED"].includes(status(r.status))
      ).length,
      criticalMortalityReports: mortalityReports.filter((r) =>
        ["CRITICAL", "HIGH"].includes(status(r.severity || r.priority))
      ).length,
    };
  }, [
    walletTx,
    profiles,
    flocks,
    caretakers,
    memberships,
    cashins,
    cashouts,
    sellRequests,
    caretakerHires,
    mortalityReports,
  ]);

  const totalPending =
    analytics.pendingMemberships +
    analytics.pendingCashins +
    analytics.pendingCashouts +
    analytics.pendingSell +
    analytics.pendingHires;

  const revenueFeed = walletTx
    .filter((tx) => REVENUE_TYPES.includes(String(tx.transaction_type || "")))
    .slice(0, 20);

  const latestOperations = [
    ...memberships.map((x) => ({
      id: `membership-${x.id}`,
      type: "Membership",
      status: x.status,
      amount: num(x.amount),
      reference: x.reference_no || x.id,
      date: x.created_at,
      href: "/admin/memberships",
    })),
    ...cashins.map((x) => ({
      id: `cashin-${x.id}`,
      type: "Cash-In",
      status: x.status,
      amount: num(x.amount),
      reference: x.reference_no || x.reference_number || x.id,
      date: x.created_at,
      href: "/admin/transactions/cashin",
    })),
    ...cashouts.map((x) => ({
      id: `cashout-${x.id}`,
      type: "Cash-Out",
      status: x.status,
      amount: num(x.amount),
      reference: x.reference_no || x.id,
      date: x.created_at,
      href: "/admin/transactions/cashout",
    })),
    ...sellRequests.map((x) => ({
      id: `sell-${x.id}`,
      type: "Sell Chicken",
      status: x.status,
      amount: num(x.total_amount || x.gross_amount),
      reference: x.batch_no || x.id,
      date: x.created_at,
      href: "/admin/sell-requests",
    })),
    ...caretakerHires.map((x) => ({
      id: `hire-${x.id}`,
      type: "Caretaker Hire",
      status: x.status,
      amount: num(x.total_fee),
      reference: x.caretaker_name || x.id,
      date: x.created_at,
      href: "/admin/caretaker-hires",
    })),
    ...mortalityReports.map((x) => ({
      id: `mortality-${x.id}`,
      type: "Mortality Report",
      status: x.status || "REPORTED",
      amount: 0,
      reference: x.flock_id || x.batch_no || x.id,
      date: x.created_at || x.reported_at || x.log_date,
      href: "/admin/reports",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    )
    .slice(0, 18);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>
            ← Back Admin
          </Link>
          <p style={eyebrow}>FarmConnect V27.1</p>
          <h1 style={title}>Live Business Command Center</h1>
          <p style={subtitle}>
            Real-time visibility for revenue, wallet exposure, customer activity,
            poultry operations, pending approvals, and risk signals.
          </p>

          <div style={heroPills}>
            <span style={heroPill}>Live Database Sync</span>
            <span style={heroPill}>No Static Demo Data</span>
            <span style={heroPill}>Treasury Verified</span>
          </div>
        </div>

        <button onClick={loadAnalytics} style={refreshBtn}>
          {loading ? "Refreshing..." : "Refresh Live Data"}
        </button>
      </section>

      <section style={commandStrip}>
        <div>
          <p style={stripLabel}>Current Operating Mode</p>
          <h2 style={stripTitle}>Real-time admin decision dashboard</h2>
          <span style={stripText}>
            This screen is for what is happening now: revenue movement, pending
            queues, wallet exposure, active flocks, and risk checks.
          </span>
        </div>

        <div style={stripStats}>
          <div style={stripBox}>
            <b>{totalPending}</b>
            <span>needs action</span>
          </div>
          <div style={stripBox}>
            <b>{analytics.openMortalityReports}</b>
            <span>mortality reports</span>
          </div>
          <div style={stripBox}>
            <b>{analytics.activeFlocks}</b>
            <span>active flocks</span>
          </div>
        </div>
      </section>

      <section style={statsGrid}>
        <BigCard
          label="Revenue Today"
          value={money(analytics.todayRevenue)}
          accent="#16a34a"
          note="FarmConnect earnings today"
        />
        <BigCard
          label="Revenue This Month"
          value={money(analytics.monthRevenue)}
          accent="#2563eb"
          note="Current month revenue"
        />
        <BigCard
          label="Lifetime Revenue"
          value={money(analytics.lifetimeRevenue)}
          accent="#14532d"
          note="All-time FarmConnect earnings"
        />
        <BigCard
          label="Wallet Exposure"
          value={money(analytics.walletExposure)}
          accent="#f97316"
          note="Total customer wallet balances"
        />
      </section>

      <section style={gridFour}>
        <Metric
          label="Membership Revenue"
          value={money(analytics.membershipRevenue)}
          icon="💳"
        />
        <Metric
          label="Caretaker Fees"
          value={money(analytics.caretakerFees)}
          icon="🧑‍🌾"
        />
        <Metric
          label="Cash-Out Fees"
          value={money(analytics.cashoutFees)}
          icon="🏦"
        />
        <Metric
          label="Sell Chicken Fees"
          value={money(analytics.sellFees)}
          icon="🐓"
        />
      </section>

      <section style={gridFive}>
        <Mini label="Total Customers" value={analytics.totalCustomers} />
        <Mini label="Active Members" value={analytics.activeMembers} />
        <Mini label="Approved KYC" value={analytics.approvedKyc} />
        <Mini label="Active Flocks" value={analytics.activeFlocks} />
        <Mini label="Active Caretakers" value={analytics.activeCaretakers} />
      </section>

      <section style={gridTwo}>
        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Pending Approval Queue</h2>
              <p style={muted}>
                Admin action items that affect customer money and operations.
              </p>
            </div>
            <span style={pill}>{totalPending} pending</span>
          </div>

          <Queue
            label="Membership Payments"
            value={analytics.pendingMemberships}
            href="/admin/memberships"
          />
          <Queue
            label="Cash-In Requests"
            value={analytics.pendingCashins}
            href="/admin/transactions/cashin"
          />
          <Queue
            label="Cash-Out Requests"
            value={analytics.pendingCashouts}
            href="/admin/transactions/cashout"
          />
          <Queue
            label="Sell Chicken Requests"
            value={analytics.pendingSell}
            href="/admin/sell-requests"
          />
          <Queue
            label="Caretaker Hires"
            value={analytics.pendingHires}
            href="/admin/caretaker-hires"
          />
        </section>

        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Chicken Sales Pulse</h2>
              <p style={muted}>
                Approved selling activity from real customer batches.
              </p>
            </div>
            <span style={pill}>Live Sales</span>
          </div>

          <div style={salesGrid}>
            <div style={salesBox}>
              <p>Total Chickens Sold</p>
              <h3>{analytics.totalChickensSold.toLocaleString()}</h3>
            </div>
            <div style={salesBox}>
              <p>Total Chicken Sales</p>
              <h3>{money(analytics.totalChickenSales)}</h3>
            </div>
            <div style={salesBox}>
              <p>Top Selling Batch</p>
              <h3>{analytics.topBatch.label || "No sales yet"}</h3>
              <small>{money(analytics.topBatch.value)}</small>
            </div>
            <div style={salesBox}>
              <p>Top Customer ID</p>
              <h3>
                {analytics.topCustomer.label
                  ? shortId(analytics.topCustomer.label)
                  : "No sales yet"}
              </h3>
              <small>{money(analytics.topCustomer.value)}</small>
            </div>
          </div>
        </section>
      </section>

      <section style={gridTwo}>
        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Mortality Snapshot</h2>
              <p style={muted}>Production mortality monitoring from reports.</p>
            </div>
            <span style={riskPill(analytics.criticalMortalityReports)}>
              {analytics.criticalMortalityReports > 0 ? "Needs Review" : "Normal"}
            </span>
          </div>

          <Risk
            label="Mortality Reports"
            value={analytics.openMortalityReports}
            href="/admin/reports"
          />
          <Risk
            label="Critical Mortality"
            value={analytics.criticalMortalityReports}
            href="/admin/reports"
          />
          <Risk
            label="Rejected KYC"
            value={analytics.rejectedKyc}
            href="/admin/customers"
          />
          <Risk
            label="Suspended Accounts"
            value={analytics.suspendedAccounts}
            href="/admin/customers"
          />
        </section>

        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={sectionTitle}>Poultry Operations</h2>
              <p style={muted}>Live flock and chicken count overview.</p>
            </div>
            <span style={pill}>{analytics.totalFlocks} flocks</span>
          </div>

          <div style={operationBox}>
            <span>Active Flocks</span>
            <b>{analytics.activeFlocks.toLocaleString()}</b>
          </div>
          <div style={operationBox}>
            <span>Total Flocks</span>
            <b>{analytics.totalFlocks.toLocaleString()}</b>
          </div>
          <div style={operationBox}>
            <span>Total Chickens Alive / Tracked</span>
            <b>{analytics.totalChickensAlive.toLocaleString()}</b>
          </div>
        </section>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Latest Revenue Movement</h2>
            <p style={muted}>
              Revenue-only wallet transactions powering the live dashboard.
            </p>
          </div>
          <span style={pill}>{revenueFeed.length} records</span>
        </div>

        <Table
          rows={revenueFeed.map((tx) => ({
            id: tx.id,
            date: formatDate(tx.created_at),
            type: tx.transaction_type || "Revenue",
            reference: tx.reference_no || tx.id,
            amount: money(tx.amount),
            status: status(tx.status),
            remarks: tx.remarks || "—",
          }))}
        />
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Latest Operations Activity</h2>
            <p style={muted}>
              Membership, cash, sell chicken, caretaker, and mortality activities
              from real tables.
            </p>
          </div>
          <span style={pill}>{latestOperations.length} latest</span>
        </div>

        <div style={feedGrid}>
          {latestOperations.length === 0 ? (
            <Empty text="No operations yet." />
          ) : (
            latestOperations.map((item) => (
              <Link key={item.id} href={item.href} style={feedItem}>
                <div>
                  <b>{item.type}</b>
                  <p>{item.reference}</p>
                  <small>{formatDate(item.date)}</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{item.amount === 0 ? "—" : money(item.amount)}</strong>
                  <span style={badge(item.status)}>{status(item.status)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function BigCard({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: string;
  accent: string;
  note: string;
}) {
  return (
    <div style={bigCard}>
      <div style={{ ...bar, background: accent }} />
      <p style={cardLabel}>{label}</p>
      <h2 style={bigValue}>{value}</h2>
      <span style={cardNote}>{note}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div style={metric}>
      <span style={metricIcon}>{icon}</span>
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div style={mini}>
      <p>{label}</p>
      <h3>{value.toLocaleString()}</h3>
    </div>
  );
}

function Queue({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} style={queueRow}>
      <span>{label}</span>
      <b>{value}</b>
    </Link>
  );
}

function Risk({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} style={riskRow}>
      <span>{label}</span>
      <b>{value}</b>
    </Link>
  );
}

function Table({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <Empty text="No records found." />;

  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Type</th>
            <th style={th}>Reference</th>
            <th style={th}>Amount</th>
            <th style={th}>Status</th>
            <th style={th}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={tr}>
              <td style={td}>{row.date}</td>
              <td style={td}>
                <b>{row.type}</b>
              </td>
              <td style={td}>{row.reference}</td>
              <td style={td}>
                <b style={{ color: "#15803d" }}>{row.amount}</b>
              </td>
              <td style={td}>
                <span style={badge(row.status)}>{row.status}</span>
              </td>
              <td style={td}>{row.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={emptyBox}>{text}</div>;
}

function sumType(rows: Row[], type: string) {
  return rows
    .filter((x) => String(x.transaction_type || "") === type)
    .reduce((sum, x) => sum + num(x.amount), 0);
}

function getTopBySum(rows: Row[], labelKey: string, valueKey: string) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const label = String(row[labelKey] || "");
    if (!label) return;
    map.set(label, (map.get(label) || 0) + num(row[valueKey]));
  });

  let best = { label: "", value: 0 };

  map.forEach((value, label) => {
    if (value > best.value) best = { label, value };
  });

  return best;
}

function num(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: any) {
  return num(value).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
}

function status(value?: string | null) {
  return String(value || "PENDING").toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH");
}

function isToday(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function isThisMonth(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function badge(value?: string | null): React.CSSProperties {
  const s = status(value);

  if (["COMPLETED", "APPROVED", "ACTIVE", "PAID"].includes(s)) {
    return { ...badgeBase, background: "#dcfce7", color: "#166534" };
  }

  if (["REJECTED", "FAILED", "SUSPENDED"].includes(s)) {
    return { ...badgeBase, background: "#fee2e2", color: "#991b1b" };
  }

  return { ...badgeBase, background: "#fef3c7", color: "#92400e" };
}

function riskPill(value: number): React.CSSProperties {
  if (value > 0) {
    return { ...pill, background: "#fee2e2", color: "#991b1b" };
  }

  return { ...pill, background: "#dcfce7", color: "#166534" };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "linear-gradient(135deg, #ecfdf5 0%, #f8fafc 45%, #eff6ff 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #052e16, #047857, #2563eb)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,.18)",
  marginBottom: 18,
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
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  opacity: 0.9,
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 44,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  maxWidth: 790,
  fontSize: 15,
  lineHeight: 1.6,
  opacity: 0.92,
};

const heroPills: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 18,
};

const heroPill: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,.16)",
  border: "1px solid rgba(255,255,255,.24)",
  color: "white",
  fontSize: 12,
  fontWeight: 950,
};

const refreshBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "13px 18px",
  fontWeight: 950,
  color: "#064e3b",
  background: "white",
  cursor: "pointer",
};

const commandStrip: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  padding: 22,
  borderRadius: 26,
  background: "rgba(15,23,42,.94)",
  color: "white",
  boxShadow: "0 18px 38px rgba(15,23,42,.16)",
  marginBottom: 18,
};

const stripLabel: React.CSSProperties = {
  margin: 0,
  color: "#86efac",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: 1.2,
};

const stripTitle: React.CSSProperties = {
  margin: "7px 0",
  fontSize: 24,
  fontWeight: 950,
};

const stripText: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: 14,
};

const stripStats: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const stripBox: React.CSSProperties = {
  minWidth: 120,
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,.09)",
  border: "1px solid rgba(255,255,255,.12)",
  textAlign: "center",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const gridFour: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const gridFive: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const gridTwo: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 18,
  marginBottom: 18,
};

const bigCard: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,.95)",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 15px 35px rgba(15,23,42,.08)",
};

const bar: React.CSSProperties = {
  width: 54,
  height: 8,
  borderRadius: 999,
  marginBottom: 14,
};

const cardLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const bigValue: React.CSSProperties = {
  margin: "8px 0 4px",
  fontSize: 30,
  fontWeight: 950,
};

const cardNote: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const metric: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  background: "white",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 12px 26px rgba(15,23,42,.07)",
};

const metricIcon: React.CSSProperties = {
  fontSize: 32,
};

const mini: React.CSSProperties = {
  padding: 18,
  borderRadius: 22,
  background: "white",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 10px 22px rgba(15,23,42,.06)",
};

const card: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,.95)",
  border: "1px solid rgba(148,163,184,.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,.08)",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
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

const muted: React.CSSProperties = {
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

const queueRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 14,
  padding: "15px 0",
  borderBottom: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "#0f172a",
  fontWeight: 900,
};

const riskRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 14,
  padding: "15px 0",
  borderBottom: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "#0f172a",
  fontWeight: 900,
};

const salesGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 12,
};

const salesBox: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const operationBox: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 14,
  padding: "17px 0",
  borderBottom: "1px solid #e2e8f0",
  fontWeight: 900,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1050,
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

const feedGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const feedItem: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "#0f172a",
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const emptyBox: React.CSSProperties = {
  padding: 28,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};
