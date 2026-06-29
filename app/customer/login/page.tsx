"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login() {
    setMessage("");
    if (!email.trim() || !password.trim()) return setMessage("Please enter email and password.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) return setMessage(error.message);
    router.replace("/customer/dashboard");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#315b36_0,#10251b_36%,#07150f_100%)] p-6 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <p className="mb-4 w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">FarmConnect Live V28</p>
          <h1 className="text-5xl font-black leading-tight md:text-6xl">Manage your poultry investment like a real app.</h1>
          <p className="mt-5 max-w-xl text-lg text-emerald-50">Track flocks, rooster photos, caretaker updates, marketplace purchases, wallet, and harvest flow.</p>
        </section>
        <section className="rounded-[36px] bg-white p-8 text-slate-950 shadow-2xl">
          <h2 className="text-3xl font-black">Welcome back 🐔</h2>
          <p className="mt-2 text-slate-500">Login with your FarmConnect customer account.</p>
          {message && <div className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{message}</div>}
          <label className="mt-6 block text-sm font-black text-slate-600">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-2xl border p-4 font-bold outline-none focus:border-emerald-500" />
          <label className="mt-4 block text-sm font-black text-slate-600">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} className="mt-2 w-full rounded-2xl border p-4 font-bold outline-none focus:border-emerald-500" />
          <button onClick={login} disabled={loading} className="mt-6 w-full rounded-2xl bg-emerald-700 p-4 font-black text-white hover:bg-emerald-800 disabled:bg-slate-400">
            {loading ? "Logging in..." : "Login to Dashboard"}
          </button>
          <p className="mt-6 text-center text-slate-500">No account yet? <Link href="/customer/register" className="font-black text-emerald-700">Register</Link></p>
        </section>
      </div>
    </main>
  );
}
