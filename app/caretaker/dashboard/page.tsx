"use client";

import Link from "next/link";

export default function CaretakerDashboard() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
        padding: 24,
      }}
    >
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        Caretaker Dashboard
      </h1>

      <p
        style={{
          color: "#94a3b8",
          marginBottom: 30,
        }}
      >
        Daily Farm Operations Portal
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
          gap: 20,
        }}
      >
        <DashboardCard
          title="Feeding Logs"
          icon="🌽"
          href="/caretaker/feeding"
        />

        <DashboardCard
          title="Mortality Reports"
          icon="⚠️"
          href="/caretaker/mortality"
        />

        <DashboardCard
          title="Weight Updates"
          icon="📈"
          href="/caretaker/weight"
        />

        <DashboardCard
          title="Photo Uploads"
          icon="📸"
          href="/caretaker/photos"
        />
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  icon,
  href,
}: {
  title: string;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        background: "#0f172a",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: 24,
        textDecoration: "none",
        color: "white",
      }}
    >
      <div
        style={{
          fontSize: 42,
          marginBottom: 12,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
    </Link>
  );
}