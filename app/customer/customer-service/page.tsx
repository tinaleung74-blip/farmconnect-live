"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { shellClass } from "@/lib/customer-auth";

type SupportCategory = "Wallet" | "Marketplace" | "Flock" | "Sell Chicken" | "Membership" | "Other";

const categories: SupportCategory[] = ["Wallet", "Marketplace", "Flock", "Sell Chicken", "Membership", "Other"];

export default function CustomerServicePage() {
  const [category, setCategory] = useState<SupportCategory>("Wallet");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const supportSummary = useMemo(() => {
    return [
      `Category: ${category}`,
      `Subject: ${subject || "Not provided"}`,
      `Message: ${message || "Not provided"}`,
    ].join("\n");
  }, [category, subject, message]);

  async function copySupportSummary() {
    if (!subject.trim() || !message.trim()) {
      setStatus("Please enter a subject and message before preparing the support note.");
      return;
    }

    try {
      await navigator.clipboard.writeText(supportSummary);
      setStatus("Support note copied. Real admin ticket chat will be connected in the support backend phase.");
    } catch {
      setStatus("Support note prepared. Copy is not available in this browser.");
    }
  }

  function clearForm() {
    setSubject("");
    setMessage("");
    setStatus("Support form cleared.");
  }

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[40px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl">
          <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
            Customer Support
          </p>
          <h1 className="mt-4 text-5xl font-black leading-tight md:text-6xl">
            Prepare a support request.
          </h1>
          <p className="mt-3 max-w-3xl font-semibold text-emerald-50">
            This page does not pretend to be live admin chat yet. The real ticket tables and admin reply flow are scheduled for the support backend phase.
          </p>
        </section>

        {status && (
          <div className="mt-5 rounded-2xl bg-white p-4 font-black text-emerald-800 shadow-xl">
            {status}
          </div>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[36px] bg-white p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Request Details
            </p>
            <h2 className="mt-1 text-3xl font-black text-emerald-950">Tell FarmConnect what happened</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`rounded-2xl border px-4 py-3 text-left font-black ${
                    category === item
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-emerald-100 bg-emerald-50 text-emerald-950"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="mt-6 block text-sm font-black text-slate-600">Subject</label>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Enter support subject"
              className="mt-2 w-full rounded-2xl border border-emerald-100 p-4 font-bold outline-none focus:border-emerald-600"
            />

            <label className="mt-5 block text-sm font-black text-slate-600">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write the details, amount, reference number, rooster code, or marketplace item if relevant."
              className="mt-2 min-h-48 w-full rounded-2xl border border-emerald-100 p-4 font-bold outline-none focus:border-emerald-600"
            />

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <button
                onClick={copySupportSummary}
                className="rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white"
              >
                Prepare Support Note
              </button>
              <button
                onClick={clearForm}
                className="rounded-2xl bg-slate-100 px-6 py-4 font-black text-slate-700"
              >
                Clear
              </button>
              <Link
                href="/customer/notifications"
                className="rounded-2xl bg-amber-300 px-6 py-4 text-center font-black text-emerald-950"
              >
                Check Notifications
              </Link>
            </div>
          </div>

          <aside className="rounded-[36px] bg-[#0c2318] p-6 text-white shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-200">
              Next Support Phase
            </p>
            <h2 className="mt-2 text-3xl font-black">Real ticket chat</h2>
            <p className="mt-3 text-sm font-semibold text-emerald-50">
              When support tables are added, this page should be upgraded into real customer-admin ticket chat.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                "Customer creates ticket",
                "Admin receives ticket",
                "Customer sends messages",
                "Admin replies",
                "Ticket can be closed",
              ].map((step) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/10 p-4 font-black">
                  ✓ {step}
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
