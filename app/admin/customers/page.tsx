"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  wallet_balance?: number | string | null;
  id_type?: string | null;
  id_number?: string | null;
  id_front_url?: string | null;
  selfie_url?: string | null;
  verification_status?: string | null;
  membership_status?: string | null;
  membership_fee?: number | string | null;
  membership_plan?: string | null;
  membership_expiry?: string | null;
  account_status?: string | null;
  created_at?: string | null;
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Customer load error: ${error.message}`);
      setCustomers([]);
    } else {
      setCustomers((data || []) as Customer[]);
    }

    setLoading(false);
  }

  const summary = useMemo(() => {
    return {
      total: customers.length,
      pendingKyc: customers.filter(
        (c) => clean(c.verification_status || "PENDING") === "PENDING"
      ).length,
      approvedKyc: customers.filter(
        (c) => clean(c.verification_status) === "APPROVED"
      ).length,
      rejectedKyc: customers.filter(
        (c) => clean(c.verification_status) === "REJECTED"
      ).length,
      activeMembers: customers.filter(
        (c) => clean(c.membership_status) === "ACTIVE"
      ).length,
      unpaidMembers: customers.filter(
        (c) =>
          clean(c.membership_status || "UNPAID") === "UNPAID" ||
          clean(c.membership_status) === "PENDING"
      ).length,
      suspended: customers.filter(
        (c) => clean(c.account_status) === "SUSPENDED"
      ).length,
      totalWallet: customers.reduce(
        (sum, c) => sum + Number(c.wallet_balance || 0),
        0
      ),
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const keyword = search.toLowerCase();

      const text = `
        ${c.id}
        ${c.full_name || c.name || ""}
        ${c.email || ""}
        ${c.phone || ""}
        ${c.id_type || ""}
        ${c.id_number || ""}
        ${c.verification_status || ""}
        ${c.membership_status || ""}
        ${c.account_status || ""}
      `.toLowerCase();

      const matchesSearch = text.includes(keyword);

      const matchesFilter =
        statusFilter === "ALL" ||
        clean(c.verification_status) === statusFilter ||
        clean(c.membership_status) === statusFilter ||
        clean(c.account_status) === statusFilter ||
        (statusFilter === "KYC_PENDING" &&
          clean(c.verification_status || "PENDING") === "PENDING") ||
        (statusFilter === "MEMBERSHIP_UNPAID" &&
          ["UNPAID", "PENDING", ""].includes(clean(c.membership_status)));

      return matchesSearch && matchesFilter;
    });
  }, [customers, search, statusFilter]);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>
            ← Back to Dashboard
          </Link>

          <p style={eyebrow}>FarmConnect Admin V26.6</p>
          <h1 style={title}>Customer Intelligence Directory</h1>

          <p style={subtitle}>
            Manage customer profiles, KYC verification, annual membership,
            wallet balances, and anti-scam account monitoring.
          </p>
        </div>

        <div style={heroCard}>
          <span>Total Profiles</span>
          <strong>{customers.length}</strong>
          <small>Customer ↔ Admin only</small>
        </div>
      </section>

      <section style={statsGrid}>
        <StatCard icon="👤" label="Registered Customers" value={summary.total} />
        <StatCard icon="🟡" label="Pending KYC" value={summary.pendingKyc} />
        <StatCard icon="🟢" label="Approved KYC" value={summary.approvedKyc} />
        <StatCard icon="🔴" label="Rejected KYC" value={summary.rejectedKyc} />
        <StatCard icon="💳" label="Active Members" value={summary.activeMembers} />
        <StatCard icon="⚠️" label="Unpaid Membership" value={summary.unpaidMembers} />
        <StatCard icon="🚫" label="Suspended" value={summary.suspended} />
        <StatCard
          icon="💰"
          label="Total Wallet Balance"
          value={`₱${summary.totalWallet.toLocaleString()}`}
        />
      </section>

      <section style={toolbar}>
        <div>
          <h2 style={sectionTitle}>Customer Directory</h2>
          <p style={muted}>
            Open profile to review KYC documents, wallet activity, poultry
            ownership, cash-in/out, sell chicken activity, and risk status.
          </p>
        </div>

        <div style={controls}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, email, phone, KYC, membership..."
            style={searchBox}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectBox}
          >
            <option value="ALL">All Customers</option>
            <option value="KYC_PENDING">KYC Pending</option>
            <option value="APPROVED">KYC Approved</option>
            <option value="REJECTED">KYC Rejected</option>
            <option value="ACTIVE">Active</option>
            <option value="MEMBERSHIP_UNPAID">Membership Unpaid</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <button onClick={loadCustomers} style={refreshBtn}>
            Refresh
          </button>
        </div>
      </section>

      <section style={grid}>
        {loading ? (
          <div style={empty}>Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div style={empty}>No customers found.</div>
        ) : (
          filteredCustomers.map((c) => {
            const displayName = c.full_name || c.name || "Unnamed Customer";
            const kycStatus = clean(c.verification_status || "PENDING");
            const membershipStatus = clean(c.membership_status || "UNPAID");
            const accountStatus = clean(c.account_status || "PENDING");
            const hasKycDocs = Boolean(c.id_front_url || c.selfie_url);

            return (
              <Link key={c.id} href={`/admin/customers/${c.id}`} style={card}>
                <div style={topRow}>
                  <div style={avatar}>👤</div>
                  <div style={badgeColumn}>
                    <span style={getStatusStyle(kycStatus)}>
                      KYC: {kycStatus}
                    </span>
                    <span style={getStatusStyle(accountStatus)}>
                      {accountStatus}
                    </span>
                  </div>
                </div>

                <h2 style={name}>{displayName}</h2>

                <div style={idBlock}>
                  <span>Profile ID</span>
                  <b>{c.id}</b>
                </div>

                <p style={info}>📧 {c.email || "No email"}</p>
                <p style={info}>📞 {c.phone || "No phone number"}</p>
                <p style={info}>🪪 ID Type: {c.id_type || "Not submitted"}</p>
                <p style={info}>🔢 ID No: {c.id_number || "Not submitted"}</p>

                <div style={metrics}>
                  <div>
                    <strong>{accountStatus}</strong>
                    <span>Account</span>
                  </div>

                  <div>
                    <strong>{membershipStatus}</strong>
                    <span>Membership</span>
                  </div>

                  <div>
                    <strong>
                      ₱{Number(c.wallet_balance || 0).toLocaleString()}
                    </strong>
                    <span>Wallet</span>
                  </div>
                </div>

                <div style={kycMini(hasKycDocs)}>
                  <span>{hasKycDocs ? "KYC Documents Uploaded" : "KYC Missing"}</span>
                  <b>{hasKycDocs ? "Ready for Review" : "Needs Submission"}</b>
                </div>

                <div style={membershipMini}>
                  <span>Annual Investor Membership</span>
                  <b>₱{Number(c.membership_fee || 999).toLocaleString()} / Year</b>
                  <small>Expiry: {c.membership_expiry || "Not active"}</small>
                </div>

                <div style={footerRow}>
                  <small>
                    Joined:{" "}
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString()
                      : "—"}
                  </small>

                  <button style={button}>Open Intelligence Profile →</button>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | string;
}) {
  return (
    <div style={statCard}>
      <span style={statIcon}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function clean(value?: string | null) {
  return String(value || "").toUpperCase();
}

function getStatusStyle(statusValue: string): React.CSSProperties {
  const status = clean(statusValue);

  if (["APPROVED", "ACTIVE", "VERIFIED", "PAID"].includes(status)) {
    return {
      ...statusBadge,
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (["REJECTED", "SUSPENDED", "FAILED"].includes(status)) {
    return {
      ...statusBadge,
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    ...statusBadge,
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
  background: "rgba(255,255,255,0.9)",
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
  maxWidth: 820,
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
  alignItems: "flex-start",
  marginBottom: 18,
};

const controls: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
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
  maxWidth: 760,
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

const selectBox: React.CSSProperties = {
  padding: "15px 18px",
  borderRadius: 18,
  border: "1px solid #bbf7d0",
  outline: "none",
  boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  fontSize: 14,
  fontWeight: 900,
  background: "white",
};

const refreshBtn: React.CSSProperties = {
  padding: "15px 18px",
  borderRadius: 18,
  border: "none",
  background: "#14532d",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
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
  background: "rgba(255,255,255,0.9)",
  boxShadow: "0 15px 38px rgba(15,23,42,0.09)",
};

const statIcon: React.CSSProperties = {
  fontSize: 28,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
  gap: 20,
};

const card: React.CSSProperties = {
  textDecoration: "none",
  color: "#0f172a",
  background: "rgba(255,255,255,0.92)",
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
  gap: 12,
  alignItems: "flex-start",
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

const badgeColumn: React.CSSProperties = {
  display: "grid",
  gap: 6,
  justifyItems: "end",
};

const statusBadge: React.CSSProperties = {
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

const idBlock: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 10,
  display: "grid",
  gap: 3,
  fontSize: 12,
  color: "#475569",
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

const kycMini = (ok: boolean): React.CSSProperties => ({
  background: ok ? "#eff6ff" : "#fff7ed",
  border: ok ? "1px solid #bfdbfe" : "1px solid #fed7aa",
  borderRadius: 16,
  padding: 12,
  display: "grid",
  gap: 4,
  color: ok ? "#1d4ed8" : "#9a3412",
  fontSize: 13,
});

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

const footerRow: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 6,
};

const button: React.CSSProperties = {
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