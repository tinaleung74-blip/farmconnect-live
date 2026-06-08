"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin() {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    localStorage.setItem(
      "farmconnect_user",
      JSON.stringify({
        email,
        role: "customer",
      })
    );

    alert("Login successful!");
    window.location.href = "/customer/dashboard";
  }

  return (
    <main className="min-h-screen bg-green-50 p-10">
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow">
        <h1 className="text-3xl font-bold text-green-700 mb-6">
          🚜 FarmConnect Login
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
          className="w-full bg-green-600 text-white p-3 rounded-xl"
          onClick={handleLogin}
        >
          Login
        </button>
      </div>
    </main>
  );
}