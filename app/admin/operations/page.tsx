"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;

export default function AdminOperationsPage() {
  const [weightLogs, setWeightLogs] = useState<Row[]>([]);
  const [photoLogs, setPhotoLogs] = useState<Row[]>([]);
  const [mortalityLogs, setMortalityLogs] = useState<Row[]>([]);
  const [usageLogs, setUsageLogs] = useState<Row[]>([]);
  const [hires, setHires] = useState<Row[]>([]);
  const [walletTx, setWalletTx] = useState<Row[]>([]);
  const [sellRequests, setSellRequests] = useState<Row[]>([]);
  const [risks, setRisks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOperations();
  }, []);

  async function loadOperations() {
    setLoading(true);

    const [
      weightRes,
      photoRes,
      mortalityRes,
      usageRes,
      hireRes,
      walletRes,
      sellRes,
      riskRes,
    ] = await Promise.all([
      supabase.from("weight_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("photo_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("mortality_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("inventory_usage_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("customer_caretaker_hires").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("sell_chicken_requests").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("risk_alerts").select("*").order("created_at", { ascending: false }).limit(300),
    ]);

    setWeightLogs(weightRes.data || []);
    setPhotoLogs(photoRes.data || []);
    setMortalityLogs(mortalityRes.data || []);
    setUsageLogs(usageRes.data || []);
    setHires(hireRes.data || []);
    setWalletTx(walletRes.data || []);
    setSellRequests(sellRes.data || []);
    setRisks(riskRes.data || []);
    setLoading(false);
  }

  const stats = useMemo(() => {
    return {
      weight: weightLogs.length,
      photos: photoLogs.length,
      mortality: mortalityLogs.length,
      usage: usageLogs.length,
      hires: hires.length,
      cash: walletTx.length,
      sell: sellRequests.length,
      risks: risks.filter((r) => ["OPEN", "PENDING"].includes(status(r.status))).length,
    };
  }, [weightLogs, photoLogs, mortalityLogs, usageLogs, hires, walletTx, sellRequests, risks]);

  const activity = [
    ...weightLogs.map((x) => ({
      id: `weight-${x.id}`,
      type: "Weight Log",
      title: `${x.weight_kg || x.weight || "—"} kg`,
      desc: x.note || x.remarks || x.flock_id || "Caretaker weight update",
      date: x.created_at,
      status: x.status || "RECORDED",
    })),
    ...photoLogs.map((x) => ({
      id: `photo-${x.id}`,
      type: "Photo Log",
      title: x.caption || "Photo update",
      desc: x.flock_id || x.animal_id || "Caretaker photo update",
      date: x.created_at,
      status: x.status || "UPLOADED",
    })),
    ...mortalityLogs.map((x) => ({
      id: `mortality-${x.id}`,
      type: "Mortality Log",
      title: `${x.count || x.dead_count || 0} mortality`,
      desc: x.reason || x.note || x.flock_id || "Mortality monitoring",
      date: x.created_at,
      status: x.status || "RECORDED",
    })),
    ...usageLogs.map((x) => ({
      id: `usage-${x.id}`,
      type: "Inventory Usage",
      title: x.item_name || "Supply used",
      desc: `${x.qty_used || x.quantity || 0} ${x.unit || ""} used by ${x.used_by || "farm"}`,
      date: x.used_at || x.created_at,
      status: x.status || "USED",
    })),
    ...hires.map((x) => ({
      id: `hire-${x.id}`,
      type: "Caretaker Activity",
      title: x.caretaker_name || "Caretaker hire",
      desc: `${x.duration_days || 0} days / ${money(x.total_fee)}`,
      date: x.created_at,
      status: x.status || "PENDING",
    })),
    ...walletTx.map((x) => ({
      id: `cash-${x.id}`,
      type: "Cash Activity",
      title: x.transaction_type || "Wallet transaction",
      desc: `${money(x.amount)} ${x.reference_no || ""}`,
      date: x.created_at,
      status: x.status || "COMPLETED",
    })),
    ...sellRequests.map((x) => ({
      id: `sell-${x.id}`,
      type: "Sell Activity",
      title: x.batch_no || "Sell chicken request",
      desc: `${x.quantity || x.total_chickens || 0} chickens / ${money(x.total_amount || x.gross_amount)}`,
      date: x.created_at,
      status: x.status || "PENDING",
    })),
    ...risks.map((x) => ({
      id: `risk-${x.id}`,
      type: "Risk Signal",
      title: x.title || x.risk_type || "Risk alert",
      desc: x.description || x.severity || "Risk monitoring",
      date: x.created_at,
      status: x.status || "OPEN",
    })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 80);

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>? Back Admin</Link>
          <p style={eyebrow}>FarmConnect V27.2</p>
          <h1 style={title}>Operational Intelligence Center</h1>
          <p style={subtitle}>
            Live farm activity monitoring for caretaker updates, flock health,
            inventory usage, money movement, sell activity, and risk signals.
          </p>
        </div>

        <button onClick={loadOperations} style={refreshBtn}>
          {loading ? "Refreshing..." : "Refresh Operations"}
        </button>
      </section>

      <section style={grid}>
        <Card label="Weight Logs" value={stats.weight} icon="??" />
        <Card label="Photo Logs" value={stats.photos} icon="??" />
        <Card label="Mortality Logs" value={stats.mortality} icon="??" />
        <Card label="Inventory Usage" value={stats.usage} icon="??" />
        <Card label="Caretaker Activities" value={stats.hires} icon="?????" />
        <Card label="Cash Activities" value={stats.cash} icon="??" />
        <Card label="Sell Activities" value={stats.sell} icon="??" />
        <Card label="Open Risks" value={stats.risks} icon="??" danger={stats.risks > 0} />
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={sectionTitle}>Live Operations Feed</h2>
            <p style={muted}>
              Latest real database activity across farm operations and treasury.
            </p>
          </div>
          <span style={pill}>{activity.length} latest</span>
        </div>

        {activity.length === 0 ? (
          <div style={empty}>No operations activity yet.</div>
        ) : (
          <div style={feed}>
            {activity.map((item) => (
              <div key={item.id} style={feedItem}>
                <div>
                  <span style={typeBadge}>{item.type}</span>
                  <h3 style={feedTitle}>{item.title}</h3>
                  <p style={feedDesc}>{item.desc}</p>
                  <small style={dateText}>{formatDate(item.date)}</small>
                </div>
                <span style={badge(item.status)}>{status(item.status)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Card({
  label,
  value,
  icon,
  danger,
}: {
  label: string;
  value: number;
  icon: string;
  danger?: boolean;
}) {
  return (
    <div style={{ ...card, borderColor: danger ? "#fecaca" : "rgba(148,163,184,.28)" }}>
      <span style={iconStyle}>{icon}</span>
      <p>{label}</p>
      <h2 style={{ color: danger ? "#dc2626" : "#0f172a" }}>
        {value.toLocaleString()}
      </h2>
    </div>
  );
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

function badge(value?: string | null): React.CSSProperties {
  const s = status(value);

  if (["COMPLETED", "APPROVED", "ACTIVE", "PAID", "RECORDED", "UPLOADED", "USED"].includes(s)) {
    return { ...badgeBase, background: "#dcfce7", color: "#166534" };
  }

  if (["REJECTED", "FAILED", "SUSPENDED", "CRITICAL"].includes(s)) {
    return { ...badgeBase, background: "#fee2e2", color: "#991b1b" };
  }

  return { ...badgeBase, background: "#fef3c7", color: "#92400e" };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "linear-gradient(135deg, #ecfdf5 0%, #f8fafc 45%, #eff6ff 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #052e16, #047857, #2563eb)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,.18)",
  marginBottom: 22,
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
  fontSize: 42,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  maxWidth: 790,
  fontSize: 15,
  lineHeight: 1.6,
  opacity: 0.92,
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

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const card: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  background: "rgba(255,255,255,.96)",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 14px 30px rgba(15,23,42,.08)",
};

const iconStyle: React.CSSProperties = {
  fontSize: 32,
};

const panel: React.CSSProperties = {
  padding: 22,
  borderRadius: 28,
  background: "rgba(255,255,255,.96)",
  border: "1px solid rgba(148,163,184,.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,.08)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  marginBottom: 18,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 23,
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

const feed: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

const feedItem: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  padding: 17,
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const typeBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 9px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#075985",
  fontSize: 11,
  fontWeight: 950,
};

const feedTitle: React.CSSProperties = {
  margin: "10px 0 4px",
  fontSize: 16,
  fontWeight: 950,
};

const feedDesc: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 13,
};

const dateText: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  color: "#64748b",
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  height: "fit-content",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const empty: React.CSSProperties = {
  padding: 28,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};

