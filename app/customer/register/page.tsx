"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CustomerRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegister() {
    setMessage("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !cleanPassword) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id,email,phone")
        .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (existing) {
        setMessage("Email or phone number is already registered.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .insert([
          {
            full_name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            password: cleanPassword,
            wallet_balance: 0,
          },
        ])
        .select()
        .single();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      localStorage.setItem("farmconnect_user", JSON.stringify(data));
      router.push("/customer/dashboard");
    } catch (err) {
      setMessage("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div style={badge}>FARMCONNECT CUSTOMER ONBOARDING</div>

        <h1 style={title}>Create Customer Account</h1>

        <p style={subtitle}>
          Join FarmConnect Live and start tracking your poultry investment,
          wallet activity, harvest progress, and farm updates in one secure
          platform.
        </p>

        <div style={grid}>
          <div style={leftPanel}>
            <h2 style={panelTitle}>Investor Safety Check</h2>

            <div style={riskCard}>
              <span style={riskIcon}>🛡️</span>
              <div>
                <b>Admin monitored account</b>
                <p>Customer activity is handled through admin supervision.</p>
              </div>
            </div>

            <div style={riskCard}>
              <span style={riskIcon}>📊</span>
              <div>
                <b>Wallet & harvest tracking</b>
                <p>Cash-in, cash-out, ROI, and harvest records are organized.</p>
              </div>
            </div>

            <div style={riskCard}>
              <span style={riskIcon}>🐔</span>
              <div>
                <b>No direct caretaker contact</b>
                <p>Farm updates flow through the platform and admin controls.</p>
              </div>
            </div>

            <div style={statusBox}>
              <p>Platform Status</p>
              <h3>Ready for Demo</h3>
              <span>Supabase • Vercel • Admin Dashboard Active</span>
            </div>
          </div>

          <div style={card}>
            <h2 style={formTitle}>Register</h2>
            <p style={formSubtitle}>Fill in your customer details below.</p>

            <label style={label}>Full Name</label>
            <input
              style={input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />

            <label style={label}>Email Address</label>
            <input
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@gmail.com"
            />

            <label style={label}>Phone Number</label>
            <input
              style={input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
            />

            <label style={label}>Password</label>
            <input
              style={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />

            {message && <p style={errorBox}>{message}</p>}

            <button style={button} onClick={handleRegister} disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <button
              style={secondaryButton}
              onClick={() => router.push("/customer/login")}
            >
              Already have an account? Login
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #ecfdf5 0%, #fefce8 45%, #eff6ff 100%)",
  padding: 24,
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  paddingTop: 40,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  padding: "10px 16px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 1,
  marginBottom: 18,
};

const title: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 900,
  margin: 0,
};

const subtitle: React.CSSProperties = {
  maxWidth: 740,
  color: "#475569",
  fontSize: 17,
  lineHeight: 1.7,
  marginTop: 14,
  marginBottom: 30,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.05fr 0.95fr",
  gap: 24,
};

const leftPanel: React.CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 28,
  padding: 28,
  boxShadow: "0 25px 60px rgba(15,23,42,0.08)",
};

const panelTitle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  marginBottom: 20,
};

const riskCard: React.CSSProperties = {
  display: "flex",
  gap: 16,
  background: "white",
  borderRadius: 20,
  padding: 18,
  marginBottom: 14,
  border: "1px solid #e2e8f0",
};

const riskIcon: React.CSSProperties = {
  fontSize: 30,
};

const statusBox: React.CSSProperties = {
  marginTop: 24,
  background: "linear-gradient(135deg, #16a34a, #2563eb)",
  color: "white",
  borderRadius: 24,
  padding: 24,
};

const card: React.CSSProperties = {
  background: "white",
  borderRadius: 30,
  padding: 30,
  boxShadow: "0 30px 80px rgba(15,23,42,0.14)",
  border: "1px solid #e2e8f0",
};

const formTitle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  margin: 0,
};

const formSubtitle: React.CSSProperties = {
  color: "#64748b",
  marginBottom: 22,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 8,
  marginTop: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "15px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  fontSize: 15,
  outline: "none",
};

const button: React.CSSProperties = {
  width: "100%",
  marginTop: 22,
  padding: 16,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #16a34a, #22c55e)",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: 14,
  borderRadius: 18,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 14,
  marginTop: 16,
  fontWeight: 700,
};