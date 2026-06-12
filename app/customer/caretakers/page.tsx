"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  full_name: string;
  phone: string | null;
  status: string | null;
};

type Hire = {
  id: string;
  caretaker_id: string;
  caretaker_name: string;
  duration_days: number;
  rate_per_chick: number;
  total_chicks: number;
  total_fee: number;
  status: string;
  payment_status: string;
  start_date: string | null;
  end_date: string | null;
};

const RATE_PER_CHICK = 50;
const DEFAULT_DURATION = 45;

function money(n: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysLeft(date?: string | null) {
  if (!date) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
}

export default function CaretakersPage() {
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Caretaker | null>(null);
  const [totalChicks, setTotalChicks] = useState(100);
  const [durationDays, setDurationDays] = useState(DEFAULT_DURATION);
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState(false);

  const totalFee = useMemo(
    () => Number(totalChicks || 0) * RATE_PER_CHICK,
    [totalChicks]
  );

  function getProfile() {
    const user = localStorage.getItem("farmconnect_user");
    return user ? JSON.parse(user) : null;
  }

  async function loadCaretakers() {
    const { data, error } = await supabase
      .from("caretakers")
      .select("id,full_name,phone,status")
      .eq("status", "HIRED")
      .order("full_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setCaretakers(data || []);
  }

  async function loadMyHires() {
    const profile = getProfile();
    if (!profile) return;

    const { data, error } = await supabase
      .from("customer_caretaker_hires")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (!error) setHires(data || []);
  }

  async function refreshData() {
    setLoading(true);
    await loadCaretakers();
    await loadMyHires();
    setLoading(false);
  }

  async function hireCaretaker() {
    const profile = getProfile();
    if (!profile) return alert("Please login first.");
    if (!selectedCaretaker) return alert("Choose caretaker first.");
    if (totalChicks <= 0) return alert("Total chicks must be greater than 0.");

    setHiring(true);

    const { error } = await supabase.from("customer_caretaker_hires").insert({
      profile_id: profile.id,
      caretaker_id: selectedCaretaker.id,
      caretaker_name: selectedCaretaker.full_name,
      duration_days: durationDays,
      rate_per_chick: RATE_PER_CHICK,
      total_chicks: totalChicks,
      total_fee: totalFee,
      status: "ACTIVE",
      payment_status: "PENDING",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: addDays(durationDays),
    });

    setHiring(false);

    if (error) return alert(error.message);

    alert(`${selectedCaretaker.full_name} hired. Fee: ${money(totalFee)}`);

    setSelectedCaretaker(null);
    setTotalChicks(100);
    setDurationDays(DEFAULT_DURATION);
    await refreshData();
  }

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-3xl bg-gradient-to-r from-green-700 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <p className="font-bold opacity-90">FarmConnect Professional Care</p>
          <h1 className="text-4xl font-black mt-1">👨‍🌾 Hire Caretaker</h1>
          <p className="mt-3 text-green-50">
            Hire a caretaker first. After hiring, they will appear in My Flock Assign Caretaker.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-gray-500 font-bold">Available Caretakers</p>
            <h2 className="text-3xl font-black text-green-700">{caretakers.length}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-gray-500 font-bold">My Hired Caretakers</p>
            <h2 className="text-3xl font-black text-blue-700">{hires.length}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-gray-500 font-bold">Rate Per Chick</p>
            <h2 className="text-3xl font-black text-orange-600">
              {money(RATE_PER_CHICK)}
            </h2>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow border p-6 mb-8">
          <h2 className="text-2xl font-black mb-4">Hire Package</h2>

          <div className="grid md:grid-cols-4 gap-4">
            <select
              className="border p-4 rounded-2xl font-bold"
              value={selectedCaretaker?.id || ""}
              onChange={(e) => {
                const found = caretakers.find((c) => c.id === e.target.value) || null;
                setSelectedCaretaker(found);
              }}
            >
              <option value="">Choose Caretaker</option>
              {caretakers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>

            <input
              type="number"
              className="border p-4 rounded-2xl"
              value={totalChicks}
              onChange={(e) => setTotalChicks(Number(e.target.value))}
              placeholder="Total Chicks"
            />

            <input
              type="number"
              className="border p-4 rounded-2xl"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              placeholder="Duration Days"
            />

            <button
              onClick={hireCaretaker}
              disabled={hiring}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-2xl font-black"
            >
              {hiring ? "Hiring..." : "Hire Caretaker"}
            </button>
          </div>

          <div className="mt-5 bg-green-50 border border-green-100 rounded-2xl p-5">
            <p className="text-gray-600 font-bold">Estimated Caretaker Fee</p>
            <h3 className="text-3xl font-black text-green-700">{money(totalFee)}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {totalChicks} chicks × {money(RATE_PER_CHICK)} per chick • {durationDays} days
            </p>
          </div>
        </section>

        {loading ? (
          <div className="bg-white rounded-3xl p-8 shadow border">Loading caretakers...</div>
        ) : (
          <section className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl shadow border p-6">
              <h2 className="text-2xl font-black mb-4">Available Caretakers</h2>

              <div className="space-y-3">
                {caretakers.length === 0 ? (
                  <p className="text-gray-500">No hired caretakers available yet.</p>
                ) : (
                  caretakers.map((c) => (
                    <div key={c.id} className="border rounded-2xl p-4 bg-green-50">
                      <h3 className="text-xl font-black">👨‍🌾 {c.full_name}</h3>
                      <p className="text-sm text-gray-600">Phone: {c.phone || "No phone"}</p>
                      <p className="text-sm font-bold text-green-700">Status: {c.status}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow border p-6">
              <h2 className="text-2xl font-black mb-4">My Hired Caretakers</h2>

              <div className="space-y-3">
                {hires.length === 0 ? (
                  <p className="text-gray-500">
                    No caretaker hired yet. Hire one first before assigning in My Flock.
                  </p>
                ) : (
                  hires.map((h) => (
                    <div key={h.id} className="border rounded-2xl p-4 bg-blue-50">
                      <h3 className="text-xl font-black">👨‍🌾 {h.caretaker_name}</h3>
                      <p className="text-sm text-gray-600">
                        Duration: {h.duration_days} days
                      </p>
                      <p className="text-sm text-gray-600">
                        Days Remaining: {daysLeft(h.end_date)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Fee: <b>{money(Number(h.total_fee || 0))}</b>
                      </p>
                      <p className="text-sm text-gray-600">
                        Payment: <b>{h.payment_status}</b>
                      </p>
                      <p className="text-sm font-bold text-green-700">
                        Status: {h.status}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}