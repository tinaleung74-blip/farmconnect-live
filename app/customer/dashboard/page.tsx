"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  money,
  resolveCustomerProfile,
  type CustomerProfile,
} from "@/lib/customer-auth";

type Weather = {
  temp: number | null;
  feelsLike: number | null;
  humidity: number | null;
  wind: number | null;
  label: string;
};

type DashboardStats = {
  totalRoosters: number;
  aliveRoosters: number;
  avgWeight: number;
  inventoryItems: number;
  walletBalance: number;
  pendingSell: number;
  latestPhotoCount: number;
  latestWeightCount: number;
};

const quickActions = [
  { title: "My Flock", icon: "🐓", href: "/customer/chicks" },
  { title: "Inventory", icon: "📦", href: "/customer/inventory" },
  { title: "Marketplace", icon: "🛒", href: "/customer/marketplace" },
  { title: "Wallet", icon: "💳", href: "/customer/wallet" },
  { title: "Sell Chicken", icon: "🏷️", href: "/customer/sell-chicken" },
  { title: "Live Camera", icon: "📷", href: "/customer/live-camera" },
];

export default function CustomerDashboardPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [locationLabel, setLocationLabel] = useState("Your farm area");
  const [stats, setStats] = useState<DashboardStats>({
    totalRoosters: 0,
    aliveRoosters: 0,
    avgWeight: 0,
    inventoryItems: 0,
    walletBalance: 0,
    pendingSell: 0,
    latestPhotoCount: 0,
    latestWeightCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDashboard();
    loadWeather();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveCustomerProfile();
    setProfile(currentProfile);

    if (!currentProfile) {
      setMessage("Login required.");
      setLoading(false);
      return;
    }

    const [
      profileRes,
      flockRes,
      inventoryRes,
      sellRes,
      animalsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", currentProfile.id).maybeSingle(),
      supabase
        .from("flocks")
        .select("id,total_chicks,alive_count,status")
        .eq("profile_id", currentProfile.id),
      supabase
        .from("flock_inventory")
        .select("id")
        .eq("profile_id", currentProfile.id),
      supabase
        .from("sell_chicken_requests")
        .select("id,status")
        .eq("profile_id", currentProfile.id),
      supabase
        .from("animals")
        .select("id,current_weight,profile_id")
        .eq("profile_id", currentProfile.id),
    ]);

    if (profileRes.error) setMessage(profileRes.error.message);

    const profileRow = (profileRes.data || currentProfile) as CustomerProfile;
    const flocks = flockRes.data || [];
    const inventory = inventoryRes.data || [];
    const sells = sellRes.data || [];
    const animals = animalsRes.data || [];

    const animalIds = animals.map((animal) => animal.id);

    let latestPhotoCount = 0;
    let latestWeightCount = 0;

    if (animalIds.length > 0) {
      const [photoRes, weightRes] = await Promise.all([
        supabase.from("animal_photos").select("id").in("animal_id", animalIds).limit(50),
        supabase.from("animal_weights").select("id").in("animal_id", animalIds).limit(50),
      ]);

      latestPhotoCount = photoRes.data?.length || 0;
      latestWeightCount = weightRes.data?.length || 0;
    }

    const totalRoosters = flocks.reduce((sum, row) => sum + Number(row.total_chicks || 0), 0);
    const aliveRoosters = flocks.reduce((sum, row) => sum + Number(row.alive_count || 0), 0);

    const weights = animals
      .map((animal) => Number(animal.current_weight || 0))
      .filter((value) => value > 0);

    const avgWeight =
      weights.length > 0
        ? weights.reduce((sum, value) => sum + value, 0) / weights.length
        : 0;

    setProfile(profileRow);
    setStats({
      totalRoosters,
      aliveRoosters,
      avgWeight,
      inventoryItems: inventory.length,
      walletBalance: Number(profileRow.wallet_balance || 0),
      pendingSell: sells.filter((row) =>
        String(row.status || "").toUpperCase().includes("PENDING")
      ).length,
      latestPhotoCount,
      latestWeightCount,
    });

    setLoading(false);
  }

  async function loadWeather() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLocationLabel("Live location");

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code`
        );

        const data = await res.json();
        const current = data.current;

        setWeather({
          temp: current?.temperature_2m ?? null,
          feelsLike: current?.apparent_temperature ?? null,
          humidity: current?.relative_humidity_2m ?? null,
          wind: current?.wind_speed_10m ?? null,
          label: weatherCodeText(current?.weather_code),
        });
      },
      () => {
        setLocationLabel("Location permission needed");
      }
    );
  }

  const survivalRate = useMemo(() => {
    if (stats.totalRoosters <= 0) return 0;
    return Math.round((stats.aliveRoosters / stats.totalRoosters) * 100);
  }, [stats]);

  return (
    <main
      className="relative min-h-screen bg-cover bg-center bg-fixed p-4 pb-28 text-[#123425] md:p-8"
      style={{
        backgroundImage:
          "linear-gradient(rgba(8,18,10,.35), rgba(8,18,10,.35)), url('/farmconnect-bg.png')",
      }}
    >
      <div className="relative z-10 mx-auto max-w-7xl">
        <section className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#6a7d68]">Good day,</p>
            <h1 className="text-3xl font-black md:text-5xl">
              {profile?.full_name || "FarmConnect Customer"} 👋
            </h1>
            <p className="mt-1 font-semibold text-[#6a7d68]">
              Your live farm command center.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/customer/notifications" className="grid h-14 w-14 place-items-center rounded-full bg-white text-2xl shadow-lg">
              🔔
            </Link>
            <Link href="/customer/customer-service" className="grid h-14 w-14 place-items-center rounded-full bg-white text-2xl shadow-lg">
              💬
            </Link>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-3xl bg-white p-4 font-black text-emerald-800 shadow">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-[38px] bg-white shadow-xl">
            <div className="relative min-h-[300px] bg-[linear-gradient(120deg,#eff8e8,#fff7df)] p-7">
              <p className="text-xl font-black">Farm Weather</p>
              <p className="mt-2 font-bold text-[#6a7d68]">📍 {locationLabel}</p>

              <div className="mt-8 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-7xl font-black text-[#123425]">
                    {weather?.temp !== null && weather ? Math.round(weather.temp) : "—"}°
                  </h2>
                  <p className="mt-2 text-xl font-black">
                    {weather?.label || "Loading live weather"}
                  </p>
                </div>
                <div className="text-8xl">🌤️</div>
              </div>
            </div>
          </div>

          <div className="rounded-[38px] bg-white p-6 shadow-xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
              Live Conditions
            </p>

            <div className="mt-5 space-y-4">
              <WeatherRow icon="💧" label="Humidity" value={weather?.humidity !== null && weather ? `${weather.humidity}%` : "—"} />
              <WeatherRow icon="💨" label="Wind" value={weather?.wind !== null && weather ? `${weather.wind} km/h` : "—"} />
              <WeatherRow icon="🌡️" label="Feels Like" value={weather?.feelsLike !== null && weather ? `${Math.round(weather.feelsLike)}°C` : "—"} />
            </div>

            <button
              onClick={loadWeather}
              className="mt-6 w-full rounded-2xl bg-[#1f7a3f] px-5 py-4 font-black text-white shadow-lg"
            >
              Refresh Weather
            </button>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black">Farm Overview</h2>
            <button onClick={loadDashboard} className="rounded-full bg-white px-5 py-3 font-black text-emerald-800 shadow">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon="🐓" label="Total Roosters" value={stats.totalRoosters} note={`${stats.aliveRoosters} alive`} />
            <StatCard icon="💚" label="Survival Rate" value={`${survivalRate}%`} note="Based on flock records" />
            <StatCard icon="⚖️" label="Avg. Weight" value={stats.avgWeight ? `${stats.avgWeight.toFixed(2)}kg` : "—"} note="Animal weight records" />
            <StatCard icon="📦" label="Inventory" value={stats.inventoryItems} note="Active stock items" />
          </div>
        </section>

        <section className="mt-7 rounded-[34px] bg-white p-5 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black">Quick Actions</h2>
            <Link href="/customer/chicks" className="font-black text-emerald-700">
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[28px] border border-[#eef1e7] bg-[#fbfaf5] p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e9f3e2] text-3xl">
                  {item.icon}
                </div>
                <p className="mt-3 font-black">{item.title}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[34px] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">Recent Activity</h2>
              <Link href="/customer/notifications" className="font-black text-emerald-700">
                See All
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              <Activity icon="📸" title="Photo updates" value={`${stats.latestPhotoCount} record(s)`} href="/customer/photo-updates" />
              <Activity icon="⚖️" title="Weight updates" value={`${stats.latestWeightCount} record(s)`} href="/customer/weight-updates" />
              <Activity icon="🏷️" title="Pending sell requests" value={`${stats.pendingSell} pending`} href="/customer/sell-chicken" />
            </div>
          </div>

          <div className="rounded-[34px] bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black">Farm Health</h2>

            <div className="mt-6 flex items-center gap-5">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-[#e9f3e2] text-6xl">
                🛡️
              </div>
              <div>
                <h3 className="text-3xl font-black text-emerald-700">
                  {survivalRate >= 90 ? "All Good!" : "Needs Review"}
                </h3>
                <p className="mt-2 font-semibold text-[#6a7d68]">
                  Based on current flock survival data.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Health label="Flock" value={survivalRate >= 90 ? "Good" : "Review"} />
              <Health label="Wallet" value={money(stats.walletBalance)} />
              <Health label="Stock" value={`${stats.inventoryItems}`} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function WeatherRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-3xl bg-[#f6f4ed] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e9f3e2] text-xl">{icon}</span>
        <span className="font-bold text-[#6a7d68]">{label}</span>
      </div>
      <b>{value}</b>
    </div>
  );
}

function StatCard({ icon, label, value, note }: { icon: string; label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-[34px] bg-white p-6 shadow-xl">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e9f3e2] text-3xl">
        {icon}
      </div>
      <p className="mt-5 font-bold text-[#6a7d68]">{label}</p>
      <h3 className="mt-1 text-4xl font-black text-[#123425]">{value}</h3>
      <p className="mt-2 font-semibold text-emerald-700">{note}</p>
    </div>
  );
}

function Activity({ icon, title, value, href }: { icon: string; title: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-3xl bg-[#fbfaf5] p-4 hover:bg-[#f3f0e8]">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e9f3e2] text-2xl">{icon}</span>
        <div>
          <p className="font-black">{title}</p>
          <p className="font-semibold text-[#6a7d68]">{value}</p>
        </div>
      </div>
      <span className="font-black text-emerald-700">→</span>
    </Link>
  );
}

function Health({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f6f4ed] p-4 text-center">
      <p className="text-xs font-bold text-[#6a7d68]">{label}</p>
      <p className="mt-1 font-black text-emerald-700">{value}</p>
    </div>
  );
}

function weatherCodeText(code?: number) {
  if (code === 0) return "Clear Sky";
  if ([1, 2, 3].includes(Number(code))) return "Partly Cloudy";
  if ([45, 48].includes(Number(code))) return "Foggy";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(Number(code))) return "Rainy";
  if ([95, 96, 99].includes(Number(code))) return "Thunderstorm";
  return "Live Weather";
}