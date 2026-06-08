"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!fullName || !email || !phone || !password) {
      alert("Please complete all fields");
      return;
    }

    try {
      setLoading(true);

      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        alert("Email already registered");
        return;
      }

      const { error } = await supabase.from("profiles").insert({
        full_name: fullName,
        email,
        mobile: phone,
        password_hash: password,
        role: "subscriber",
      });

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      alert("Registration successful!");

      router.push("/customer/login");
    } catch (err) {
      console.error(err);
      alert("Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-green-50 p-10">
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow">

        <h1 className="text-3xl font-bold text-green-700 mb-6">
          🐔 FarmConnect Registration
        </h1>

        <input
          className="w-full border p-3 rounded mb-4"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          className="w-full border p-3 rounded mb-4"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-3 rounded mb-4"
          placeholder="Mobile Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-3 rounded mb-4"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-green-600 text-white p-3 rounded-xl font-semibold"
        >
          {loading ? "Creating Account..." : "Register"}
        </button>

      </div>
    </main>
  );
}