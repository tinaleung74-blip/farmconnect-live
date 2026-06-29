"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Caretaker = { id: string; caretaker_profile_id: string | null; email: string | null; full_name: string | null };
type Concern = { id: string; category: string | null; message: string | null; status: string | null; created_at: string | null };

const navLinks = [
  { href: "/caretaker/dashboard", label: "Dashboard" },
  { href: "/caretaker/tasks", label: "Tasks" },
  { href: "/caretaker/feeding", label: "Feeding" },
  { href: "/caretaker/photos", label: "Photos" },
  { href: "/caretaker/weight", label: "Weight" },
  { href: "/caretaker/mortality", label: "Mortality" },
];

export default function NotesPage() {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [history, setHistory] = useState<Concern[]>([]);
  const [category, setCategory] = useState("");
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setNotice("");
    const resolved = await resolveCaretaker();
    setCaretaker(resolved);
    if (!resolved) {
      setHistory([]);
      setNotice("Please login as caretaker.");
      setLoading(false);
      return;
    }
    await loadHistory(resolved.id);
    setLoading(false);
  }

  async function loadHistory(caretakerId: string) {
    const { data, error } = await supabase
      .from("caretaker_concern_reports")
      .select("id, category, message, status, created_at")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setHistory([]);
      setNotice(`Concern history load error: ${error.message}`);
      return;
    }
    setHistory((data || []) as Concern[]);
  }

  async function submitUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice("");

    if (!caretaker) {
      setNotice("Caretaker session not found. Please login again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("caretaker_concern_reports").insert({
      caretaker_id: caretaker.id,
      category,
      message: messageText.trim(),
      status: "OPEN",
      created_at: new Date().toISOString(),
    });

    if (error) {
      setNotice(`Concern save error: ${error.message}`);
      setSaving(false);
      return;
    }

    setCategory("");
    setMessageText("");
    setNotice("✅ Note sent to Admin and synced.");
    await loadHistory(caretaker.id);
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,199,0,0.38),transparent_34%),linear-gradient(180deg,#ffffff,#fff6c7)] px-4 py-5 text-slate-950 md:px-8">
      <nav className="mx-auto mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link href="/caretaker/dashboard" className="rounded-full border border-yellow-200 bg-white px-4 py-3 font-black text-slate-950 shadow-sm">← Dashboard</Link>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {navLinks.map((item) => <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full border border-yellow-200 bg-white px-4 py-3 text-sm font-black text-slate-700">{item.label}</Link>)}
        </div>
      </nav>

      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <aside className="rounded-[34px] bg-yellow-400 p-7 shadow-2xl shadow-yellow-200">
          <p className="text-xs font-black uppercase tracking-[0.2em]">Admin concern desk</p>
          <h1 className="mt-4 text-5xl font-black leading-none">📝 Notes / Concern</h1>
          <p className="mt-4 font-semibold leading-7 text-slate-800">Send issues to Admin only. No customer direct chat. All concerns are saved in Supabase for review.</p>
          <button onClick={loadData} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white">Refresh</button>
        </aside>

        <section className="rounded-[34px] border border-yellow-200 bg-white p-6 shadow-2xl">
          <h2 className="text-3xl font-black">Send a note</h2>
          <p className="mt-2 font-semibold text-slate-500">Farm issue, supply needs, or chicken health concern.</p>
          {notice && <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-center font-bold text-yellow-700">{notice}</div>}

          <form onSubmit={submitUpdate} className="mt-5 grid gap-4">
            <label className="grid gap-2 font-black">Concern Type
              <select value={category} onChange={(e) => setCategory(e.target.value)} required className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
                <option value="">Select concern</option>
                <option value="Feed Supply">Feed Supply</option>
                <option value="Medicine / Vitamins">Medicine / Vitamins</option>
                <option value="Chicken Health">Chicken Health</option>
                <option value="Farm Issue">Farm Issue</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className="grid gap-2 font-black">Message
              <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} required placeholder="Type your concern here" className="min-h-36 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
            </label>

            <button disabled={saving || loading} className="rounded-2xl bg-yellow-400 px-5 py-4 text-lg font-black text-slate-950 shadow-xl shadow-yellow-100 hover:bg-yellow-300 disabled:opacity-70">{saving ? "Sending..." : "Send to Admin"}</button>
          </form>
        </section>
      </div>

      <section className="mx-auto mt-5 max-w-5xl rounded-[34px] border border-yellow-200 bg-white p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Latest Notes</h2>
          <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-black text-yellow-700">{history.length} records</span>
        </div>
        {loading ? <p className="mt-4 font-semibold text-slate-500">Loading notes...</p> : history.length === 0 ? <p className="mt-4 font-semibold text-slate-500">No notes yet.</p> : (
          <div className="mt-5 grid gap-3">
            {history.map((item) => <article key={item.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-wrap justify-between gap-2"><h3 className="font-black">{item.category || "Concern"}</h3><span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-700">{item.status || "OPEN"}</span></div>
              <p className="mt-2 font-semibold text-slate-600">{item.message}</p>
              <p className="mt-3 text-sm font-bold text-slate-400">{formatDate(item.created_at)}</p>
            </article>)}
          </div>
        )}
      </section>
    </main>
  );
}

async function resolveCaretaker(): Promise<Caretaker | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return null;
  const email = user.email || "";
  const { data, error } = await supabase
    .from("caretakers")
    .select("id, caretaker_profile_id, email, full_name")
    .or(`caretaker_profile_id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();
  if (error || !data) return null;
  return data as Caretaker;
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}
