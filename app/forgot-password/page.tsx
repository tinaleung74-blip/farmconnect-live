"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Enter the email used for your FarmConnect account.");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return setMessage("Enter a valid email address.");
    try {
      setSaving(true);
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      setSent(true);
      setMessage("If this email belongs to a FarmConnect account, a secure password-reset link has been sent. Check Inbox and Spam.");
    } catch {
      setSent(true);
      setMessage("If this email belongs to a FarmConnect account, a secure password-reset link will arrive shortly. Wait before trying again.");
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
        <h1 className="mt-2 text-4xl font-black text-[#063e30]">Forgot Password</h1>
        <p className="mt-3 text-sm font-bold leading-7 text-[#667267]">Use a private email address you can access. FarmConnect never asks an Admin or caretaker to know your password.</p>
        <form onSubmit={submit} className="mt-6 grid gap-3">
          <label htmlFor="recovery-email" className="text-sm font-black text-[#143f32]">Account email</label>
          <input id="recovery-email" type="email" autoComplete="email" disabled={saving || sent} value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-2xl border border-[#d8cfbd] bg-white px-4 py-4 font-bold outline-none focus:border-[#1f6b45]" placeholder="name@example.com" />
          <button type="submit" disabled={saving || sent} className="rounded-2xl bg-[#1f6b45] px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#9ca89f]">{saving ? "Sending secure link..." : sent ? "Reset Link Requested" : "Send Reset Link"}</button>
        </form>
        <p role="status" aria-live="polite" className="mt-4 rounded-2xl bg-[#f3f0e7] p-4 text-sm font-bold leading-6 text-[#516158]">{message}</p>
        <Link href="/" className="mt-5 inline-block font-black text-[#0873a3] underline">Back to Login</Link>
      </section>
    </main>
  );
}
