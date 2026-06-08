"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .eq("password_hash", password)
        .single();

      if (error || !data) {
        alert("Invalid email or password");
        return;
      }

      localStorage.setItem(
        "farmconnect_user",
        JSON.stringify({
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          mobile: data.mobile,
          role: data.role,
        })
      );

      alert(`Welcome ${data.full_name}!`);

      router.push("/customer/dashboard");
    } catch (err) {
      console.error(err);
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-green-50 p-10">
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow">

        <h1 className="text-3xl font-bold text-green-700 mb-6">
          🐔 FarmConnect Login
        </h1>

        <input
          className="w-full border p-3 rounded mb-4"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-3 rounded mb-4"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-green-600 text-white p-3 rounded-xl font-semibold"
        >
          {loading ? "Logging In..." : "Login"}
        </button>

      </div>
    </main>
  );
}