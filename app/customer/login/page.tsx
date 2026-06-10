"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin() {
    setErrorMessage("");

    const cleanLoginId = loginId.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanLoginId || !cleanPassword) {
      setErrorMessage("Please enter email or phone and password.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, password, wallet_balance")
        .or(`email.eq.${cleanLoginId},phone.eq.${cleanLoginId}`)
        .maybeSingle();

      if (error) {
        console.error(error);
        setErrorMessage(error.message);
        return;
      }

      if (!data) {
        setErrorMessage("Account not found. Please register first.");
        return;
      }

      if (String(data.password) !== cleanPassword) {
        setErrorMessage("Invalid password. Please try again.");
        return;
      }

      localStorage.setItem(
        "farmconnect_user",
        JSON.stringify({
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          wallet_balance: data.wallet_balance,
        })
      );

      router.push("/customer/dashboard");
    } catch (err) {
      console.error(err);
      setErrorMessage("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 flex items-center justify-center">
      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-[32px] shadow-xl overflow-hidden border border-green-100">
        <section className="bg-gradient-to-br from-green-800 via-green-600 to-emerald-500 text-white p-10 flex flex-col justify-between">
          <div>
            <div className="bg-white/20 w-fit px-4 py-2 rounded-full text-sm font-bold mb-6">
              🟢 Poultry Management Portal
            </div>

            <h1 className="text-4xl md:text-5xl font-black leading-tight">
              FarmConnect LIVE
            </h1>

            <p className="mt-5 text-green-50 text-lg">
              Login to monitor your flock, caretaker updates, growth progress,
              harvest earnings, and farm wallet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-10">
            <div className="bg-white/15 rounded-2xl p-4">
              <p className="text-sm text-green-50">Flock Tracking</p>
              <h2 className="text-2xl font-black">LIVE</h2>
            </div>

            <div className="bg-white/15 rounded-2xl p-4">
              <p className="text-sm text-green-50">Harvest ROI</p>
              <h2 className="text-2xl font-black">READY</h2>
            </div>
          </div>
        </section>

        <section className="p-8 md:p-10">
          <h2 className="text-3xl font-black text-gray-900 mb-2">
            Welcome Back 🐔
          </h2>

          <p className="text-gray-500 mb-8">
            Sign in to your FarmConnect subscriber account.
          </p>

          {errorMessage && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 font-semibold">
              {errorMessage}
            </div>
          )}

          <label className="block font-bold text-gray-700 mb-2">
            Email or Phone Number
          </label>
          <input
            className="w-full border border-gray-200 p-4 rounded-2xl mb-5 outline-none focus:border-green-500"
            placeholder="test@gmail.com or 09123456789"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
          />

          <label className="block font-bold text-gray-700 mb-2">
            Password
          </label>
          <input
            type="password"
            className="w-full border border-gray-200 p-4 rounded-2xl mb-6 outline-none focus:border-green-500"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white p-4 rounded-2xl font-black text-lg transition"
          >
            {loading ? "Logging In..." : "Login to Dashboard"}
          </button>

          <p className="text-center text-gray-500 mt-6">
            No account yet?{" "}
            <a href="/customer/register" className="text-green-700 font-black">
              Register here
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}