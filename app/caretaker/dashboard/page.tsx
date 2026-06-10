"use client";

import Link from "next/link";

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
  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={small}>FarmConnect Caretaker</p>
          <h1 style={title}>Good day, Ka-Farm! 🌾</h1>
          <p style={subtitle}>
            Simple upload lang. Piliin ang gagawin today.
          </p>
        </div>
        <div style={sun}>☀️</div>
      </section>

      <section style={statusBox}>
        <div>
          <b>Today&apos;s Status</b>
          <p style={muted}>Please complete daily farm update.</p>
        </div>
        <span style={badge}>ACTIVE</span>
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