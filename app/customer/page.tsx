// app/customer/dashboard/page.tsx
"use client";

import Link from "next/link";

const actions = [
  { icon: "🐓", title: "My Flock", href: "/customer/chicks", desc: "View rooster growth, health, harvest status, and caretaker updates." },
  { icon: "📦", title: "Inventory", href: "/customer/inventory", desc: "Track feeds, vitamins, medicine, supplies, and usage logs." },
  { icon: "🛒", title: "Marketplace", href: "/customer/marketplace", desc: "Buy feeds, vaccines, supplies, equipment, and poultry items." },
  { icon: "💳", title: "Wallet", href: "/customer/wallet", desc: "Cash-in, cash-out, request history, and wallet records." },
  { icon: "🏷️", title: "Sell Chicken", href: "/customer/sell-chicken", desc: "Sell one rooster at a time with latest photo and weight evidence." },
  { icon: "📷", title: "Live Camera", href: "/customer/live-camera", desc: "View latest farm photo feed and rooster monitoring updates." },
  { icon: "⚖️", title: "Weight Updates", href: "/customer/weight-updates", desc: "Monitor latest weight logs from caretaker/customer updates." },
  { icon: "🎧", title: "Support", href: "/customer/customer-service", desc: "Prepare support request and check customer service flow." },
];

const stats = [
  { icon: "🐔", label: "Flock", value: "Live", note: "Growth monitoring" },
  { icon: "📦", label: "Inventory", value: "Tracked", note: "Supplies synced" },
  { icon: "💳", label: "Wallet", value: "Ready", note: "Cash movement" },
  { icon: "🛒", label: "Market", value: "Open", note: "Buy supplies" },
];

export default function CustomerDashboardPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03140b] text-white">
      {/* CTRL+F: FARMCONNECT_DASHBOARD_BACKGROUND */}
      <div className="fixed inset-0">
        <img
          src="/farmconnect-hero-wallpaper.jpg"
          alt="FarmConnect background"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="fixed inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/25" />
      <div className="fixed inset-0 bg-gradient-to-t from-[#03140b] via-[#03140b]/65 to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.28),transparent_35%)]" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-6 pb-28 md:px-8">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[46px] border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur-2xl md:p-10">
            <p className="w-fit rounded-full border border-amber-300/40 bg-amber-300/15 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-amber-100">
              Live Customer Command Center
            </p>

            <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[0.92] tracking-tight md:text-7xl">
              Welcome back to your farm.
            </h1>

            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/80 md:text-lg">
              Monitor flock growth, marketplace purchases, wallet movement, inventory,
              caretaker updates, photo evidence, and rooster selling in one premium customer app.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/customer/chicks" className="rounded-2xl bg-emerald-500 px-7 py-4 text-sm font-black shadow-xl transition hover:-translate-y-1 hover:bg-emerald-400">
                View My Flock
              </Link>
              <Link href="/customer/inventory" className="rounded-2xl bg-amber-300 px-7 py-4 text-sm font-black text-emerald-950 shadow-xl transition hover:-translate-y-1 hover:bg-amber-200">
                Open Inventory
              </Link>
              <Link href="/customer/marketplace" className="rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-sm font-black backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/20">
                Marketplace
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-[36px] border border-white/10 bg-black/35 p-6 shadow-2xl backdrop-blur-2xl transition hover:-translate-y-1 hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                      {item.label}
                    </p>
                    <h2 className="mt-2 text-4xl font-black">{item.value}</h2>
                    <p className="mt-2 text-sm font-semibold text-white/60">{item.note}</p>
                  </div>
                  <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-4xl">
                    {item.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[42px] border border-white/10 bg-black/35 p-5 shadow-2xl backdrop-blur-2xl md:p-7">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">
                Quick Actions
              </p>
              <h2 className="mt-2 text-3xl font-black">Your farm tools</h2>
            </div>
            <p className="text-sm font-bold text-white/55">
              All buttons route to live customer modules.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[30px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-amber-300/40 hover:bg-white/15"
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-black/30 text-3xl shadow-inner">
                  {item.icon}
                </div>

                <h3 className="mt-5 text-xl font-black">{item.title}</h3>

                <p className="mt-2 min-h-[72px] text-sm font-semibold leading-6 text-white/65">
                  {item.desc}
                </p>

                <p className="mt-4 text-sm font-black text-amber-200">
                  Open module →
                </p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}