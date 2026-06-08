"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const buildings = [
  { title: "My Flock", icon: "🏡🐣", href: "/customer/chicks", pos: "md:col-start-1" },
  { title: "Marketplace", icon: "🏪🌽", href: "/customer/marketplace", pos: "md:col-start-3" },
  { title: "Inventory", icon: "🏚️📦", href: "/customer/inventory", pos: "md:col-start-2" },
  { title: "Weight Tracker", icon: "📈🐔", href: "/customer/weight-updates", pos: "md:col-start-1" },
  { title: "Photo Updates", icon: "📸🌾", href: "/customer/photo-updates", pos: "md:col-start-3" },
  { title: "Live Camera", icon: "🗼🎥", href: "/customer/live-camera", pos: "md:col-start-2" },
  { title: "Harvest", icon: "🏠🐔", href: "/customer/harvest", pos: "md:col-start-1" },
  { title: "Wallet", icon: "🏦💰", href: "/customer/wallet", pos: "md:col-start-3" },
  { title: "Notifications", icon: "🔔📢", href: "/customer/notifications", pos: "md:col-start-2" },
  { title: "Settings", icon: "⚙️🧑", href: "/customer/settings", pos: "md:col-start-1" },
  { title: "Customer Service", icon: "🎧🤝", href: "/customer/customer-service", pos: "md:col-start-3" },
];

export default function DashboardPage() {
  const [userName, setUserName] = useState("Farmer");

  useEffect(() => {
    const user = localStorage.getItem("farmconnect_user");
    if (user) {
      const parsed = JSON.parse(user);
      setUserName(parsed.full_name || "Farmer");
    }
  }, []);

  function logout() {
    localStorage.removeItem("farmconnect_user");
    window.location.href = "/customer/login";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-lime-100 to-green-300 p-4 md:p-8">
      <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-yellow-300 shadow-[0_0_100px_rgba(250,204,21,1)]" />
      <div className="absolute left-10 top-20 text-7xl">☁️</div>
      <div className="absolute right-56 top-24 text-7xl">☁️</div>
      <div className="absolute left-1/2 top-36 text-5xl">☁️</div>

      <div className="absolute bottom-0 left-[-20%] h-96 w-[140%] rounded-t-[100%] bg-green-500" />
      <div className="absolute bottom-0 left-[-10%] h-72 w-[120%] rounded-t-[100%] bg-lime-400" />
      <div className="absolute bottom-0 left-0 h-36 w-full bg-green-700/30" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="rounded-full border-4 border-white bg-yellow-200 px-5 py-3 font-black text-green-950 shadow-xl">
            🚜 FarmConnect Game Farm
          </div>

          <button
            onClick={logout}
            className="rounded-full border-4 border-white bg-red-500 px-5 py-3 font-black text-white shadow-xl hover:bg-red-600"
          >
            🚪 Logout
          </button>
        </div>

        <section className="relative mb-8 overflow-hidden rounded-[40px] border-4 border-white bg-gradient-to-br from-green-600 via-lime-500 to-yellow-300 p-7 shadow-2xl md:p-10">
          <div className="absolute bottom-3 right-10 text-8xl">🐔</div>
          <div className="absolute bottom-12 right-36 text-5xl">🐣</div>
          <div className="absolute bottom-4 left-10 text-7xl">🌾</div>
          <div className="absolute right-8 top-5 text-5xl">🚜</div>

          <div className="relative max-w-3xl">
            <p className="mb-4 w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-green-800">
              🌞 Your Digital Poultry Farm Is Active
            </p>

            <h1 className="text-4xl font-black leading-tight text-white drop-shadow md:text-6xl">
              Welcome, {userName}! 🐣
            </h1>

            <p className="mt-4 text-lg font-black text-green-950">
              Choose your farm building and manage your livestock like a real
              farming game.
            </p>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            ["🐣 Flock", "1"],
            ["📈 Growth", "22%"],
            ["📦 Supplies", "4"],
            ["💰 ROI", "₱12,500"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[28px] border-4 border-white bg-white/90 p-5 text-center shadow-xl"
            >
              <p className="font-black text-green-700">{label}</p>
              <h2 className="text-3xl font-black text-green-950">{value}</h2>
            </div>
          ))}
        </section>

        <h2 className="mb-4 text-3xl font-black text-green-950">
          🎮 Choose Your Farm Building
        </h2>

        <section className="grid gap-6 md:grid-cols-3">
          {buildings.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className={`${item.pos} group rounded-[36px] border-4 border-white bg-white/90 p-6 text-center shadow-2xl transition hover:-translate-y-3 hover:scale-105`}
            >
              <div className="mx-auto mb-4 grid h-28 w-28 place-items-center rounded-[34px] bg-gradient-to-br from-yellow-100 to-lime-300 text-5xl shadow-inner">
                {item.icon}
              </div>

              <h3 className="text-2xl font-black text-green-950">
                {item.title}
              </h3>

              <p className="mt-3 rounded-full bg-green-700 px-4 py-2 font-black text-white group-hover:bg-yellow-300 group-hover:text-green-950">
                Open Building →
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}