"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister() {
    const { error } = await supabase.from("profiles").insert({
      full_name: fullName,
      email,
      phone,
      password,
      role: "customer",
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Registration successful!");
  }

  return (
    <main className="min-h-screen bg-green-50 p-10">
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow">
        <h1 className="text-3xl font-bold text-green-700 mb-6">
          🚜 FarmConnect Registration
        </h1>

        <input className="w-full border p-3 rounded mb-4" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="w-full border p-3 rounded mb-4" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border p-3 rounded mb-4" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input type="password" className="w-full border p-3 rounded mb-4" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="w-full bg-green-600 text-white p-3 rounded-xl" onClick={handleRegister}>
          Register
        </button>
      </div>
    </main>
  );
}