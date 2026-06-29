"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  email?: string | null;
  role?: string | null;
};

async function isAdminAllowed(userId: string, email: string) {
  const cleanEmail = email.trim().toLowerCase();

  const { data: profileById } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  const { data: profileByEmail } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("email", cleanEmail)
    .maybeSingle<ProfileRow>();

  const profile = profileById || profileByEmail;
  const profileId = profile?.id || userId;

  const byAdminProfileId = await supabase
    .from("admins")
    .select("*")
    .eq("admin_profile_id", profileId)
    .maybeSingle();

  if (byAdminProfileId.data) return true;

  const byProfileId = await supabase
    .from("admins")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (byProfileId.data) return true;

  const byEmail = await supabase
    .from("admins")
    .select("*")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (byEmail.data) return true;

  return profile?.role?.toUpperCase() === "ADMIN";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login() {
    setMessage("");
    if (!email.trim() || !password.trim()) return setMessage("Please enter email and password.");

    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      return setMessage(error?.message || "Unable to login admin account.");
    }

    const allowed = await isAdminAllowed(data.user.id, cleanEmail);

    setLoading(false);

    if (!allowed) {
      await supabase.auth.signOut();
      return setMessage("This account is not registered as an admin.");
    }

    router.replace("/admin/dashboard");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1d4ed8_0,#10251b_36%,#07150f_100%)] p-6 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-[36px] border border-blue-300/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <p className="mb-4 w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">FarmConnect Live V28</p>
          <h1 className="text-5xl font-black leading-tight md:text-6xl">Admin command center for FarmConnect operations.</h1>
          <p className="mt-5 max-w-xl text-lg text-emerald-50">Manage customers, caretakers, treasury, approvals, reports, and poultry operations.</p>
        </section>
        <section className="rounded-[36px] bg-white p-8 text-slate-950 shadow-2xl">
          <h2 className="text-3xl font-black">Admin Login 🏢</h2>
          <p className="mt-2 text-slate-500">Login with your FarmConnect admin account.</p>
          {message && <div className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{message}</div>}
          <label className="mt-6 block text-sm font-black text-slate-600">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-2xl border p-4 font-bold outline-none focus:border-blue-500" />
          <label className="mt-4 block text-sm font-black text-slate-600">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} className="mt-2 w-full rounded-2xl border p-4 font-bold outline-none focus:border-blue-500" />
          <button onClick={login} disabled={loading} className="mt-6 w-full rounded-2xl bg-blue-700 p-4 font-black text-white hover:bg-blue-800 disabled:bg-slate-400">
            {loading ? "Logging in..." : "Login to Admin Dashboard"}
          </button>
          <p className="mt-6 text-center text-slate-500"><Link href="/" className="font-black text-blue-700">Back to portals</Link></p>
        </section>
      </div>
    </main>
  );
}
