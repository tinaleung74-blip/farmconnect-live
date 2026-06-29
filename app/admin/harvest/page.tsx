"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Harvest = {
  id: string;
  flock_id?: string | null;
  customer_id?: string | null;
  caretaker_id?: string | null;
  harvest_date?: string | null;
  expected_heads?: number | string | null;
  actual_heads?: number | string | null;
  total_weight?: number | string | null;
  price_per_kg?: number | string | null;
  gross_sales?: number | string | null;
  expenses?: number | string | null;
  net_profit?: number | string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export default function AdminHarvestPage() {
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadHarvests();
  }, []);

  async function loadHarvests() {
    setLoading(true);

    const { data, error } = await supabase
      .from("harvests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      console.error("Harvest error:", error.message);
      setHarvests([]);
    } else {
      setHarvests(data || []);
    }

    setLoading(false);
  }

  const summary = useMemo(() => {
    const completed = harvests.filter(
      (h) => normalizeStatus(h.status) === "COMPLETED"
    );

    const totalGross = harvests.reduce(
      (sum, h) => sum + getGrossSales(h),
      0
    );

    const totalExpenses = harvests.reduce(
      (sum, h) => sum + toNumber(h.expenses),
      0
    );

    const totalNet = harvests.reduce(
      (sum, h) => sum + getNetProfit(h),
      0
    );

    return {
      totalHarvests: harvests.length,
      completed: completed.length,
      pending: harvests.filter((h) => normalizeStatus(h.status) === "PENDING")
        .length,
      totalGross,
      totalExpenses,
      totalNet,
    };
  }, [harvests]);

  const filtered = useMemo(() => {
    return harvests.filter((h) => {
      const status = normalizeStatus(h.status);

      const matchFilter = filter === "ALL" || status === filter;

      const text = `
        ${h.id}
        ${h.flock_id || ""}
        ${h.customer_id || ""}
        ${h.caretaker_id || ""}
        ${h.status || ""}
        ${h.notes || ""}
      `.toLowerCase();

      return matchFilter && text.includes(search.toLowerCase());
    });
  }, [harvests, filter, search]);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>← Back Admin</Link>
          <p style={eyebrow}>FarmConnect Production</p>
          <h1 style={title}>Harvest Management</h1>
          <p style={subtitle}>
            Monitor flock harvest schedules, actual output, sales, expenses,
            caretaker reports, and customer investment results through admin
            review.
          </p>
        </div>

        <button onClick={loadHarvests} style={refreshBtn}>
          Refresh Harvest
        </button>
      </section>

      <section style={statsGrid}>
        <HarvestCard
          label="Total Harvest Records"
          value={summary.totalHarvests}
          accent="#2563eb"
        />
        <HarvestCard
          label="Completed Harvests"
          value={summary.completed}
          accent="#16a34a"
        />
        <MoneyCard
          label="Gross Sales"
          value={summary.totalGross}
          accent="#0f766e"
        />
        <MoneyCard
          label="Net Profit"
          value={summary.totalNet}
          accent="#f97316"
        />
      </section>

      <section style={financeStrip}>
        <div>
          <p style={stripLabel}>Total Expenses</p>
          <h3 style={stripValue}>{money(summary.totalExpenses)}</h3>
        </div>
        <div>
          <p style={stripLabel}>Pending Harvests</p>
          <h3 style={stripValue}>{summary.pending}</h3>
        </div>
        <div>
          <p style={stripLabel}>Admin Control Rule</p>
          <h3 style={stripValue}>Customer ↔ Admin ↔ Caretaker</h3>
        </div>
      </section>

      <section style={controlCard}>
        <input
          style={searchInput}
          placeholder="Search harvest ID, flock ID, customer ID, caretaker ID, notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={selectInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Harvests</option>
          <option value="PENDING">Pending</option>
          <option value="READY">Ready</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Harvest Records</h2>
            <p style={sectionDesc}>
              Output and profit records are reviewed by admin before customer
              reporting.
            </p>
          </div>
          <span style={pill}>{filtered.length} records</span>
        </div>

        {loading ? (
          <Empty text="Loading harvest records..." />
        ) : filtered.length === 0 ? (
          <Empty text="No harvest records found." />
        ) : (
          <div style={harvestGrid}>
            {filtered.map((h) => {
              const gross = getGrossSales(h);
              const net = getNetProfit(h);

              return (
                <article key={h.id} style={harvestCard}>
                  <div style={harvestTop}>
                    <span
                      style={{
                        ...statusBadge,
                        background: getStatusBg(h.status),
                        color: getStatusColor(h.status),
                      }}
                    >
                      {normalizeStatus(h.status)}
                    </span>

                    <span style={dateBadge}>
                      {h.harvest_date
                        ? new Date(h.harvest_date).toLocaleDateString()
                        : "No date"}
                    </span>
                  </div>

                  <h3 style={harvestTitle}>Harvest #{shortId(h.id)}</h3>

                  <div style={infoGrid}>
                    <Info label="Flock ID" value={h.flock_id || "—"} />
                    <Info label="Customer ID" value={h.customer_id || "—"} />
                    <Info label="Caretaker ID" value={h.caretaker_id || "—"} />
                    <Info
                      label="Actual Heads"
                      value={`${toNumber(h.actual_heads)} / ${toNumber(
                        h.expected_heads
                      )}`}
                    />
                    <Info
                      label="Total Weight"
                      value={`${toNumber(h.total_weight).toLocaleString()} kg`}
                    />
                    <Info
                      label="Price / KG"
                      value={money(toNumber(h.price_per_kg))}
                    />
                  </div>

                  <div style={moneyBox}>
                    <div>
                      <p style={moneyLabel}>Gross Sales</p>
                      <strong>{money(gross)}</strong>
                    </div>
                    <div>
                      <p style={moneyLabel}>Expenses</p>
                      <strong>{money(toNumber(h.expenses))}</strong>
                    </div>
                    <div>
                      <p style={moneyLabel}>Net Profit</p>
                      <strong>{money(net)}</strong>
                    </div>
                  </div>

                  <p style={notes}>
                    {h.notes || "No harvest notes yet. Admin may review flock performance, caretaker evidence, and customer report before closing."}
                  </p>

                  <p style={createdText}>
                    Created:{" "}
                    {h.created_at
                      ? new Date(h.created_at).toLocaleString()
                      : "—"}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function HarvestCard({
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

function MoneyCard({
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
      <h2 style={statMoneyValue}>{money(value)}</h2>
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

function toNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0);
}

function normalizeStatus(value?: string | null) {
  return (value || "PENDING").toUpperCase();
}

function getGrossSales(h: Harvest) {
  const savedGross = toNumber(h.gross_sales);
  if (savedGross > 0) return savedGross;

  return toNumber(h.total_weight) * toNumber(h.price_per_kg);
}

function getNetProfit(h: Harvest) {
  const savedNet = toNumber(h.net_profit);
  if (savedNet !== 0) return savedNet;

  return getGrossSales(h) - toNumber(h.expenses);
}

function shortId(id: string) {
  return id?.slice(0, 8) || "—";
}

function getStatusBg(value?: string | null) {
  const s = normalizeStatus(value);
  if (s === "COMPLETED") return "#dcfce7";
  if (s === "READY") return "#dbeafe";
  if (s === "SCHEDULED") return "#ecfeff";
  if (s === "CANCELLED") return "#fee2e2";
  return "#fef3c7";
}

function getStatusColor(value?: string | null) {
  const s = normalizeStatus(value);
  if (s === "COMPLETED") return "#166534";
  if (s === "READY") return "#1d4ed8";
  if (s === "SCHEDULED") return "#0e7490";
  if (s === "CANCELLED") return "#991b1b";
  return "#92400e";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background:
    "linear-gradient(135deg, #ecfdf5 0%, #fffbeb 42%, #eff6ff 100%)",
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
  background: "linear-gradient(135deg, #14532d, #16a34a, #f97316)",
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
  color: "#14532d",
  background: "white",
  cursor: "pointer",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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

const statMoneyValue: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 28,
  fontWeight: 950,
};

const financeStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  padding: 18,
  borderRadius: 24,
  background: "linear-gradient(135deg, #ffffff, #f8fafc)",
  border: "1px solid rgba(148,163,184,0.28)",
  marginBottom: 18,
};

const stripLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const stripValue: React.CSSProperties = {
  margin: "5px 0 0",
  fontSize: 18,
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

const sectionDesc: React.CSSProperties = {
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

const harvestGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 16,
};

const harvestCard: React.CSSProperties = {
  padding: 18,
  borderRadius: 22,
  background: "linear-gradient(180deg, #ffffff, #f8fafc)",
  border: "1px solid #e2e8f0",
};

const harvestTop: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 14,
};

const statusBadge: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const dateBadge: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
  background: "#f1f5f9",
  color: "#475569",
};

const harvestTitle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 18,
  fontWeight: 950,
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

const moneyBox: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
  padding: 14,
  borderRadius: 18,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  marginBottom: 12,
};

const moneyLabel: React.CSSProperties = {
  margin: "0 0 4px",
  color: "#9a3412",
  fontSize: 11,
  fontWeight: 900,
};

const notes: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
};

const createdText: React.CSSProperties = {
  margin: "12px 0 0",
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
