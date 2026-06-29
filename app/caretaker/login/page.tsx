"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CaretakerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData.user) {
      setMessage(authError?.message || "Login failed. Please check your email and password.");
      setLoading(false);
      return;
    }

    const { data: caretaker, error: caretakerError } = await supabase
      .from("caretakers")
      .select("id, caretaker_profile_id, email, full_name, status")
      .or(`caretaker_profile_id.eq.${authData.user.id},email.eq.${cleanEmail}`)
      .maybeSingle();

    if (caretakerError || !caretaker) {
      await supabase.auth.signOut();
      setMessage("No caretaker profile found for this login. Please ask Admin to link this email.");
      setLoading(false);
      return;
    }

    const status = String(caretaker.status || "ACTIVE").toUpperCase();
    if (!["ACTIVE", "APPROVED", "VERIFIED"].includes(status)) {
      await supabase.auth.signOut();
      setMessage("Caretaker account is not active yet. Please wait for Admin approval.");
      setLoading(false);
      return;
    }

    router.replace("/caretaker/dashboard");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fff8dc] text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,199,0,0.45),transparent_34%),linear-gradient(180deg,#ffffff_0%,#fff7cf_55%,#ffe68a_100%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-52 bg-[linear-gradient(135deg,rgba(255,199,0,0.22),rgba(255,255,255,0.2))]" />

      <section className="relative z-10 mx-auto grid min-h-screen max-w-6xl place-items-center px-5 py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
          <aside className="hidden rounded-[40px] border border-yellow-200 bg-white/75 p-9 shadow-2xl backdrop-blur-xl lg:block">
            <p className="w-fit rounded-full bg-yellow-400 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950">
              Shopify + GCash Vibe
            </p>
            <h1 className="mt-6 text-6xl font-black leading-none">
              FarmConnect<br /><span className="text-yellow-500">Caretaker</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg font-semibold leading-8 text-slate-600">
              Clean mobile-first portal for poultry jobs, field updates, reports, and Admin sync.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Secure", "Synced", "Simple"].map((item) => (
                <div key={item} className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 text-center font-black shadow-sm">
                  ✨<br />{item}
                </div>
              ))}
            </div>
          </aside>

          <section className="mx-auto w-full max-w-md rounded-[36px] border border-yellow-200 bg-white p-7 shadow-2xl sm:p-9">
            <div className="text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-yellow-400 text-5xl shadow-xl">
                🐔
              </div>
              <h2 className="mt-5 text-4xl font-black">Caretaker Login</h2>
              <p className="mt-2 font-semibold text-slate-500">Care today. Thrive tomorrow.</p>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-7 grid gap-4">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="caretaker@email.com"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-100"
                />
              </label>

              <button
                disabled={loading}
                className="mt-2 rounded-2xl bg-yellow-400 px-5 py-4 text-lg font-black text-slate-950 shadow-xl shadow-yellow-200 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Checking..." : "Login"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm font-semibold text-slate-500">
              No account yet? <Link href="/" className="font-black text-yellow-600">Contact Admin</Link>
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
