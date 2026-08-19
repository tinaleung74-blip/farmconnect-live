"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("Verifying your secure recovery link...");

  useEffect(() => {
    let active = true;
    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || session)) {
        setReady(true);
        setMessage("Secure link verified. Create a new password for this account.");
      }
    }).data.subscription;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setReady(true);
        setMessage("Secure link verified. Create a new password for this account.");
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (!error) {
          setReady(true);
          setMessage("Secure link verified. Create a new password for this account.");
          return;
        }
      }
      setMessage("This recovery link is invalid or expired. Request a new link from Forgot Password.");
    })();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setMessage("Use at least 8 characters for the new password.");
    if (password !== confirmPassword) return setMessage("The two passwords do not match.");
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setPassword("");
      setConfirmPassword("");
      setComplete(true);
      setReady(false);
      setMessage("Password changed successfully. Sign in again using the new password.");
    } catch (error) {
      setMessage(`Password could not be changed: ${error instanceof Error ? error.message : "Request a new recovery link and try again."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#075f48] px-4 py-8 text-[#14251f]">
      <div className="fixed inset-0 bg-[url('/farmconnect-hero-wallpaper.jpg')] bg-cover bg-center" />
      <div className="fixed inset-0 bg-[linear-gradient(135deg,rgba(2,45,34,.72),rgba(3,52,40,.76))]" />
      <section className="relative z-10 w-full max-w-xl rounded-[32px] border border-white/35 bg-white/96 p-8 shadow-[0_28px_80px_rgba(5,48,36,.24)]">
        <img src="/farmconnect/home/farmconnect-brand-mark.png" alt="" className="h-16 w-16 rounded-2xl object-cover shadow-sm" />
        <p className="mt-6 text-xs font-black uppercase tracking-[.14em] text-[#075f48]">FarmConnect Security</p>
        <h1 className="mt-2 text-4xl font-black text-[#063e30]">Create New Password</h1>
        {ready && !complete && <form onSubmit={submit} className="mt-6 grid gap-3">
          <label htmlFor="new-password" className="text-sm font-black text-[#143f32]">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-2xl border border-[#d8cfbd] bg-white px-4 py-4 font-bold outline-none focus:border-[#1f6b45]" />
          <label htmlFor="confirm-password" className="text-sm font-black text-[#143f32]">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded-2xl border border-[#d8cfbd] bg-white px-4 py-4 font-bold outline-none focus:border-[#1f6b45]" />
          <button type="submit" disabled={saving || password.length < 8 || password !== confirmPassword} className="rounded-2xl bg-[#1f6b45] px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#9ca89f]">{saving ? "Updating password..." : "Save New Password"}</button>
        </form>}
        <p role="status" aria-live="polite" className="mt-4 rounded-2xl bg-[#f3f0e7] p-4 text-sm font-bold leading-6 text-[#516158]">{message}</p>
        <Link href={complete ? "/" : "/forgot-password"} className="mt-5 inline-block font-black text-[#0873a3] underline">{complete ? "Go to Login" : "Request a New Link"}</Link>
      </section>
    </main>
  );
}
