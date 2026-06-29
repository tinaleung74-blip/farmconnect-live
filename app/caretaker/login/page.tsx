"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

export default function CaretakerLoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);

    const { data, error } = await supabase
      .from("caretakers")
      .select("*")
      .eq("phone", phone.trim())
      .eq("pin", pin.trim())
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      alert("Invalid phone or PIN");
      return;
    }

    localStorage.setItem("farmconnect_caretaker", JSON.stringify(data));
    router.push("/caretaker/dashboard");
  }

  return (
    <main style={page}>
      <section style={shell}>
        <div style={heroPanel}>
          <Link href="/caretaker" style={backLink}>
            ← Caretaker Portal
          </Link>

          <div style={badge}>FarmConnect Live</div>
          <h1 style={heroTitle}>Caretaker Login</h1>
          <p style={heroText}>
            Sign in to open the caretaker dashboard, review active jobs, and
            continue daily chicken care updates.
          </p>

          <div style={stepsCard}>
            <p style={stepsTitle}>Before logging in</p>
            <p style={stepsText}>Use the phone number and PIN issued for your caretaker profile.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <div style={iconCircle}>🧑‍🌾</div>
            <div>
              <h2 style={title}>Welcome back</h2>
              <p style={subtitle}>Enter your caretaker credentials.</p>
            </div>
          </div>

          <label style={label}>Phone Number</label>
          <input
            style={input}
            placeholder="Example: 09XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />

          <label style={label}>PIN</label>
          <input
            style={input}
            placeholder="Enter PIN"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />

          <button style={button} onClick={handleLogin} disabled={loading}>
            {loading ? "Checking..." : "Login to Dashboard"}
          </button>

          <p style={helpText}>
            Having trouble logging in? Contact FarmConnect Admin to verify your caretaker access.
          </p>
        </div>
      </section>
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(250,204,21,0.32), transparent 34%), linear-gradient(135deg, #020617, #0f172a 48%, #14532d)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const shell: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 22,
  alignItems: "stretch",
};

const heroPanel: CSSProperties = {
  borderRadius: 30,
  padding: 28,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.16)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
  backdropFilter: "blur(14px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: 420,
};

const backLink: CSSProperties = {
  alignSelf: "flex-start",
  color: "#fde68a",
  textDecoration: "none",
  fontWeight: 900,
};

const badge: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  marginTop: 36,
  background: "rgba(250,204,21,0.16)",
  color: "#fde68a",
  border: "1px solid rgba(250,204,21,0.28)",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.4,
  textTransform: "uppercase",
};

const heroTitle: CSSProperties = {
  margin: "14px 0 0",
  fontSize: "clamp(38px, 7vw, 64px)",
  lineHeight: 1,
  fontWeight: 950,
};

const heroText: CSSProperties = {
  margin: "16px 0 0",
  color: "#cbd5e1",
  fontSize: 17,
  lineHeight: 1.7,
  maxWidth: 520,
};

const stepsCard: CSSProperties = {
  marginTop: 30,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 22,
  padding: 18,
};

const stepsTitle: CSSProperties = {
  margin: 0,
  color: "#fde68a",
  fontWeight: 900,
};

const stepsText: CSSProperties = {
  margin: "8px 0 0",
  color: "#e2e8f0",
  lineHeight: 1.6,
};

const card: CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.96)",
  color: "#0f172a",
  padding: 28,
  borderRadius: 30,
  boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
  alignSelf: "center",
};

const cardHeader: CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  marginBottom: 24,
};

const iconCircle: CSSProperties = {
  width: 58,
  height: 58,
  display: "grid",
  placeItems: "center",
  borderRadius: 18,
  background: "#fef3c7",
  fontSize: 30,
};

const title: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  margin: 0,
};

const subtitle: CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontWeight: 700,
};

const label: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#334155",
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  padding: "15px 16px",
  marginBottom: 16,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 16,
  outlineColor: "#ca8a04",
  boxSizing: "border-box",
};

const button: CSSProperties = {
  width: "100%",
  padding: 16,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #ca8a04, #eab308)",
  color: "white",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 16px 30px rgba(202,138,4,0.25)",
};

const helpText: CSSProperties = {
  margin: "16px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.6,
  textAlign: "center",
};
