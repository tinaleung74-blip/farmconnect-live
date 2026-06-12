"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PaidAssignment = {
  id: string;
  profile_id: string;
  caretaker_id: string;
  caretaker_name: string;
  flock_id: string | null;
  duration_days: number;
  rate_per_chick: number;
  total_chicks: number;
  total_fee: number;
  status: string;
  payment_status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type CaretakerProfile = {
  id: string;
  full_name: string;
  status: string | null;
  level: string | null;
};

const cards = [
  {
    title: "Feeding Update",
    icon: "🌽",
    desc: "Record feeds given today",
    href: "/caretaker/feeding",
    color: "#facc15",
  },
  {
    title: "Weight Update",
    icon: "⚖️",
    desc: "Upload latest flock weight",
    href: "/caretaker/weight",
    color: "#38bdf8",
  },
  {
    title: "Photo Update",
    icon: "📸",
    desc: "Upload chicken/farm photo",
    href: "/caretaker/photos",
    color: "#fb7185",
  },
  {
    title: "Mortality Report",
    icon: "🐔",
    desc: "Report dead/lost chickens",
    href: "/caretaker/mortality",
    color: "#f97316",
  },
  {
    title: "Notes / Concern",
    icon: "📝",
    desc: "Send concern to admin",
    href: "/caretaker/notes",
    color: "#a78bfa",
  },
];

export default function CaretakerDashboard() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<PaidAssignment[]>([]);
  const [caretaker, setCaretaker] = useState<CaretakerProfile | null>(null);
  const [caretakerId, setCaretakerId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeAssignmentCount = assignments.length;

  const totalChicks = useMemo(() => {
    return assignments.reduce((sum, item) => sum + Number(item.total_chicks || 0), 0);
  }, [assignments]);

  useEffect(() => {
    initializeDashboard();
  }, []);

  async function initializeDashboard() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const detectedCaretaker = getCurrentCaretaker();

    if (!detectedCaretaker.id) {
      setCaretakerId("");
      setAssignments([]);
      setErrorMessage(
        "Missing caretaker ID. Please login again so FarmConnect can load your paid assignments."
      );
      setLoading(false);
      return;
    }

    setCaretakerId(detectedCaretaker.id);

    await loadCaretakerProfile(detectedCaretaker.id);
    await loadPaidAssignments(detectedCaretaker.id);

    setLoading(false);
  }

  function getCurrentCaretaker() {
    if (typeof window === "undefined") {
      return { id: "", name: "" };
    }

    const directCaretakerId =
      localStorage.getItem("farmconnect_caretaker_id") ||
      localStorage.getItem("caretaker_id") ||
      "";

    let detectedId = directCaretakerId;
    let detectedName = "";

    const rawCaretaker =
      localStorage.getItem("farmconnect_caretaker") ||
      localStorage.getItem("caretaker_user") ||
      localStorage.getItem("farmconnect_user") ||
      "";

    if (rawCaretaker) {
      try {
        const parsedCaretaker = JSON.parse(rawCaretaker);

        detectedId =
          detectedId ||
          parsedCaretaker?.caretaker_id ||
          parsedCaretaker?.id ||
          "";

        detectedName =
          parsedCaretaker?.full_name ||
          parsedCaretaker?.name ||
          parsedCaretaker?.email ||
          "";
      } catch {
        detectedName = rawCaretaker;
      }
    }

    if (detectedId) {
      localStorage.setItem("farmconnect_caretaker_id", detectedId);
      localStorage.setItem("caretaker_id", detectedId);
    }

    return {
      id: detectedId,
      name: detectedName,
    };
  }

  async function loadCaretakerProfile(currentCaretakerId: string) {
    const { data, error } = await supabase
      .from("caretakers")
      .select("id,full_name,status,level")
      .eq("id", currentCaretakerId)
      .maybeSingle();

    if (error) {
      setCaretaker(null);
      setErrorMessage(`Caretaker profile load error: ${error.message}`);
      return;
    }

    if (data) {
      setCaretaker(data as CaretakerProfile);
    }
  }

  async function loadPaidAssignments(currentCaretakerId: string) {
    const { data, error } = await supabase
      .from("customer_caretaker_hires")
      .select(
        "id,profile_id,caretaker_id,caretaker_name,flock_id,duration_days,rate_per_chick,total_chicks,total_fee,status,payment_status,start_date,end_date,created_at"
      )
      .eq("caretaker_id", currentCaretakerId)
      .eq("status", "ACTIVE")
      .eq("payment_status", "PAID")
      .order("created_at", { ascending: false });

    if (error) {
      setAssignments([]);
      setErrorMessage(`Paid assignment load error: ${error.message}`);
      return;
    }

    setAssignments((data || []) as PaidAssignment[]);
  }

  function formatPeso(amount: number | null | undefined) {
    const safeAmount = Number(amount || 0);

    return safeAmount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    });
  }

  function formatDate(date: string | null) {
    if (!date) return "Pending";

    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={small}>FarmConnect Caretaker</p>
          <h1 style={title}>Good day, Ka-Farm! 🌾</h1>
          <p style={subtitle}>
            {caretaker?.full_name
              ? `Welcome back, ${caretaker.full_name}.`
              : "Simple upload lang. Piliin ang gagawin today."}
          </p>
        </div>
        <div style={sun}>☀️</div>
      </section>

      <section style={statusBox}>
        <div>
          <b>Today&apos;s Status</b>
          <p style={muted}>
            {loading
              ? "Checking your FarmConnect assignments..."
              : activeAssignmentCount > 0
              ? "You have active paid customer assignments."
              : "No paid assignment yet. Wait for FarmConnect Admin assignment."}
          </p>
        </div>
        <span style={badge}>
          {activeAssignmentCount > 0 ? "ASSIGNED" : "ACTIVE"}
        </span>
      </section>

      <section style={summaryGrid}>
        <div style={summaryCard}>
          <p style={summaryLabel}>Paid Assignments</p>
          <h2 style={summaryValue}>{loading ? "..." : activeAssignmentCount}</h2>
          <p style={summaryText}>ACTIVE + PAID only</p>
        </div>

        <div style={summaryCard}>
          <p style={summaryLabel}>Total Chicks Under Care</p>
          <h2 style={summaryValue}>{loading ? "..." : totalChicks}</h2>
          <p style={summaryText}>Customer-owned poultry assets</p>
        </div>

        <div style={summaryCard}>
          <p style={summaryLabel}>Caretaker ID</p>
          <h2 style={summarySmallValue}>
            {caretakerId ? caretakerId.slice(0, 8) : "Missing"}
          </h2>
          <p style={summaryText}>Used for assignment matching</p>
        </div>
      </section>

      {message && <div style={successBox}>{message}</div>}

      {errorMessage && <div style={errorBox}>{errorMessage}</div>}

      <section style={assignmentPanel}>
        <div style={sectionHeader}>
          <div>
            <p style={smallDark}>New Paid Assignments</p>
            <h2 style={sectionTitle}>Caretaker Job Notifications</h2>
            <p style={sectionText}>
              Approved and paid customer hire requests appear here automatically.
            </p>
          </div>

          <button onClick={initializeDashboard} style={refreshButton}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={emptyBox}>Loading paid assignments...</div>
        ) : assignments.length === 0 ? (
          <div style={emptyBox}>
            No new paid assignment yet. Once Admin approves and marks paid, the
            job will appear here.
          </div>
        ) : (
          <div style={assignmentGrid}>
            {assignments.map((assignment) => (
              <div key={assignment.id} style={assignmentCard}>
                <div style={assignmentTop}>
                  <div>
                    <p style={assignmentLabel}>PAID CUSTOMER ASSIGNMENT</p>
                    <h3 style={assignmentTitle}>
                      {assignment.total_chicks} Premium Chicks
                    </h3>
                  </div>

                  <div style={paidBadge}>PAID</div>
                </div>

                <div style={assignmentDetails}>
                  <div style={detailBox}>
                    <p style={detailLabel}>Customer/Profile</p>
                    <p style={detailValue}>{assignment.profile_id.slice(0, 8)}</p>
                  </div>

                  <div style={detailBox}>
                    <p style={detailLabel}>Duration</p>
                    <p style={detailValue}>{assignment.duration_days} days</p>
                  </div>

                  <div style={detailBox}>
                    <p style={detailLabel}>Total Fee</p>
                    <p style={detailValue}>{formatPeso(assignment.total_fee)}</p>
                  </div>

                  <div style={detailBox}>
                    <p style={detailLabel}>Start</p>
                    <p style={detailValue}>{formatDate(assignment.start_date)}</p>
                  </div>
                </div>

                <div style={assignmentNote}>
                  FarmConnect Admin has approved and verified this customer
                  caretaker request. Complete daily updates for this assignment.
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={grid}>
        {cards.map((card) => (
          <Link key={card.title} href={card.href} style={cardBox}>
            <div style={{ ...iconBox, background: card.color }}>
              {card.icon}
            </div>
            <h2 style={cardTitle}>{card.title}</h2>
            <p style={cardDesc}>{card.desc}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #ecfccb 0%, #fef9c3 35%, #dbeafe 100%)",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg, #22c55e, #84cc16)",
  color: "white",
  borderRadius: 28,
  padding: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 20px 40px rgba(34,197,94,0.25)",
};

const small: React.CSSProperties = {
  margin: 0,
  opacity: 0.9,
  fontWeight: 700,
};

const smallDark: React.CSSProperties = {
  margin: 0,
  color: "#15803d",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 34,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
};

const sun: React.CSSProperties = {
  fontSize: 54,
};

const statusBox: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(255,255,255,0.85)",
  borderRadius: 22,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid rgba(34,197,94,0.2)",
};

const muted: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
};

const badge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "8px 14px",
  borderRadius: 999,
  fontWeight: 900,
};

const summaryGrid: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const summaryCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  borderRadius: 22,
  padding: 18,
  border: "1px solid rgba(34,197,94,0.18)",
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const summaryLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const summaryValue: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 34,
  fontWeight: 900,
  color: "#14532d",
};

const summarySmallValue: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 28,
  fontWeight: 900,
  color: "#14532d",
};

const summaryText: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
};

const successBox: React.CSSProperties = {
  marginTop: 18,
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 20,
  padding: 16,
  textAlign: "center",
  fontWeight: 900,
};

const errorBox: React.CSSProperties = {
  marginTop: 18,
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 20,
  padding: 16,
  textAlign: "center",
  fontWeight: 900,
};

const assignmentPanel: React.CSSProperties = {
  marginTop: 20,
  background: "rgba(255,255,255,0.95)",
  borderRadius: 28,
  padding: 22,
  border: "1px solid rgba(34,197,94,0.16)",
  boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const sectionTitle: React.CSSProperties = {
  margin: "6px 0",
  fontSize: 26,
  color: "#14532d",
  fontWeight: 900,
};

const sectionText: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
};

const refreshButton: React.CSSProperties = {
  border: "none",
  background: "#15803d",
  color: "white",
  borderRadius: 14,
  padding: "12px 18px",
  fontWeight: 900,
  cursor: "pointer",
};

const emptyBox: React.CSSProperties = {
  marginTop: 18,
  background: "#f8fafc",
  borderRadius: 20,
  padding: 18,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 800,
};

const assignmentGrid: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gap: 14,
};

const assignmentCard: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid rgba(34,197,94,0.18)",
  borderRadius: 22,
  padding: 18,
};

const assignmentTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const assignmentLabel: React.CSSProperties = {
  margin: 0,
  color: "#15803d",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.1,
};

const assignmentTitle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 22,
  color: "#14532d",
  fontWeight: 900,
};

const paidBadge: React.CSSProperties = {
  background: "#16a34a",
  color: "white",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 900,
};

const assignmentDetails: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
};

const detailBox: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: 14,
};

const detailLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
};

const detailValue: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#0f172a",
  fontWeight: 900,
};

const assignmentNote: React.CSSProperties = {
  marginTop: 14,
  background: "white",
  borderRadius: 16,
  padding: 14,
  color: "#334155",
  fontWeight: 700,
  lineHeight: 1.5,
};

const grid: React.CSSProperties = {
  marginTop: 20,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
};

const cardBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: 24,
  padding: 20,
  textDecoration: "none",
  color: "#0f172a",
  border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
};

const iconBox: React.CSSProperties = {
  width: 62,
  height: 62,
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 34,
  marginBottom: 14,
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
};

const cardDesc: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
};