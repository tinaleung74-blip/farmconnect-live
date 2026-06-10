"use client";

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
      <div style={card}>
        <h1 style={title}>Caretaker Login</h1>

        <input
          style={input}
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          style={input}
          placeholder="PIN"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />

        <button style={button} onClick={handleLogin} disabled={loading}>
          {loading ? "Checking..." : "Login"}
        </button>
      </div>
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#020617",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#0f172a",
  padding: 32,
  borderRadius: 20,
};

const title: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  marginBottom: 20,
};

const input: CSSProperties = {
  width: "100%",
  padding: 14,
  marginBottom: 14,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
};

const button: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  fontWeight: 800,
  cursor: "pointer",
};