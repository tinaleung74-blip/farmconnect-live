"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  resolveCustomerProfile,
  shellClass,
  statusPill,
  type CustomerProfile,
} from "@/lib/customer-auth";

const preferenceRows = [
  {
    key: "notifications",
    label: "App Notifications",
    description: "Wallet, marketplace, caretaker, and sell chicken updates.",
  },
  {
    key: "farmAlerts",
    label: "Farm Update Alerts",
    description: "Photo, weight, mortality, and inventory usage updates.",
  },
  {
    key: "sellAlerts",
    label: "Sell Chicken Alerts",
    description: "Pending, approved, rejected, and cancelled sell requests.",
  },
] as const;

type PreferenceKey = (typeof preferenceRows)[number]["key"];

type PreferenceState = Record<PreferenceKey, boolean>;

export default function SettingsPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [preferences, setPreferences] = useState<PreferenceState>({
    notifications: true,
    farmAlerts: true,
    sellAlerts: true,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const resolvedProfile = await resolveCustomerProfile();
    setProfile(resolvedProfile);
    setLoading(false);
  }

  function togglePreference(key: PreferenceKey) {
    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
    setMessage("Preferences saved for this device. Database-backed settings can be added in the next settings phase.");
  }

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                Customer Settings
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Account and app preferences.
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-50">
                Identity is loaded from Supabase Auth only.
              </p>
            </div>

            <Link
              href="/customer/dashboard"
              className="rounded-full bg-white px-5 py-3 text-center font-black text-emerald-950"
            >
              Dashboard
            </Link>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 font-black text-emerald-800 shadow-xl">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_.85fr]">
          <article className="rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                  Account
                </p>
                <h2 className="mt-1 text-3xl font-black text-emerald-950">
                  {loading ? "Loading customer..." : profile?.full_name || "FarmConnect Customer"}
                </h2>
              </div>
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-4xl">
                👤
              </div>
            </div>

            {!profile && !loading ? (
              <div className="mt-6 rounded-3xl bg-red-50 p-5 font-black text-red-700">
                Login required to view account settings.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Info label="Full Name" value={profile?.full_name || "—"} />
                <Info label="Email" value={profile?.email || "—"} />
                <Info label="Phone" value={profile?.phone || "—"} />
                <Info label="Wallet" value={String(profile?.wallet_balance ?? "—")} />
                <StatusInfo label="Membership" status={profile?.membership_status} />
                <StatusInfo label="KYC" status={profile?.verification_status} />
                <StatusInfo label="Account" status={profile?.account_status} />
                <Info label="Membership Expiry" value={profile?.membership_expiry || "—"} />
              </div>
            )}
          </article>

          <article className="rounded-[32px] bg-white p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Preferences
            </p>
            <h2 className="mt-1 text-3xl font-black text-emerald-950">
              App controls
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              These toggles are safe UI preferences only. Production identity remains Supabase Auth.
            </p>

            <div className="mt-5 space-y-3">
              {preferenceRows.map((row) => (
                <div key={row.key} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-black text-slate-900">{row.label}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {row.description}
                      </p>
                    </div>
                    <button
                      onClick={() => togglePreference(row.key)}
                      className={`rounded-full px-5 py-2 font-black text-white ${
                        preferences[row.key] ? "bg-emerald-700" : "bg-slate-400"
                      }`}
                    >
                      {preferences[row.key] ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-emerald-50 p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <h3 className="mt-1 break-words text-xl font-black text-emerald-950">
        {value}
      </h3>
    </div>
  );
}

function StatusInfo({ label, status }: { label: string; status?: string | null }) {
  return (
    <div className="rounded-3xl bg-emerald-50 p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(status)}`}>
        {status || "PENDING"}
      </span>
    </div>
  );
}
