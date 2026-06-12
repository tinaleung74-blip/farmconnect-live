"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Flock = {
  id: string;
  batch_no: string;
  breed: string;
  total_chicks: number;
  alive_count: number;
  mortality_count?: number;
  expected_harvest_date: string | null;
  status: string;
  caretaker_name: string | null;
  created_at?: string;
};

const CARETAKERS = [
  "Caretaker 1",
  "Caretaker 2",
  "Caretaker 3",
  "Caretaker 4",
  "Caretaker 5",
];

function daysBetween(start?: string | null) {
  if (!start) return 0;
  const a = new Date(start).getTime();
  const b = new Date().getTime();
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
}

function daysUntil(date?: string | null) {
  if (!date) return null;
  const a = new Date(date).getTime();
  const b = new Date().getTime();
  return Math.ceil((a - b) / (1000 * 60 * 60 * 24));
}

export default function MyFlockPage() {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [breed, setBreed] = useState("Broiler");
  const [totalChicks, setTotalChicks] = useState(100);
  const [harvestDate, setHarvestDate] = useState("");
  const [selectedFlock, setSelectedFlock] = useState<Flock | null>(null);

  async function loadFlocks() {
    const user = localStorage.getItem("farmconnect_user");
    if (!user) return;

    const profile = JSON.parse(user);

    const { data, error } = await supabase
      .from("flocks")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setFlocks(data || []);
  }

  async function createFlock() {
    const user = localStorage.getItem("farmconnect_user");
    if (!user) return alert("Please login first");

    const profile = JSON.parse(user);
    const batchNo = "FC-" + Math.floor(100000 + Math.random() * 900000);

    const { error } = await supabase.from("flocks").insert({
      profile_id: profile.id,
      batch_no: batchNo,
      breed,
      total_chicks: totalChicks,
      alive_count: totalChicks,
      mortality_count: 0,
      expected_harvest_date: harvestDate || null,
      status: "ACTIVE",
      caretaker_name: null,
    });

    if (error) return alert(error.message);

    alert("Flock created successfully");
    setHarvestDate("");
    loadFlocks();
  }

  async function assignCaretaker(flockId: string) {
    const caretaker = selectedCaretaker[flockId];

    if (!caretaker) return alert("Please select caretaker first.");

    const { error } = await supabase
      .from("flocks")
      .update({ caretaker_name: caretaker })
      .eq("id", flockId);

    if (error) return alert(error.message);

    alert(`${caretaker} assigned successfully!`);
    await loadFlocks();
  }

  useEffect(() => {
    loadFlocks();
  }, []);

  const summary = useMemo(() => {
    const total = flocks.reduce((sum, f) => sum + Number(f.total_chicks || 0), 0);
    const alive = flocks.reduce((sum, f) => sum + Number(f.alive_count || 0), 0);
    const noCaretaker = flocks.filter((f) => !f.caretaker_name).length;
    const nearHarvest = flocks.filter((f) => {
      const left = daysUntil(f.expected_harvest_date);
      return left !== null && left <= 7;
    }).length;

    return { total, alive, noCaretaker, nearHarvest };
  }, [flocks]);

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-3xl bg-gradient-to-r from-green-700 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <p className="font-bold opacity-90">FarmConnect Poultry Ownership</p>
          <h1 className="text-4xl font-black mt-1">🐣 My Flock Command Center</h1>
          <p className="mt-3 text-green-50">
            Own real chicks, monitor real farm activity, and track harvest readiness.
          </p>
        </section>

        <section className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-gray-500 font-bold">Active Chicks</p>
            <h2 className="text-3xl font-black text-green-700">{summary.alive}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-gray-500 font-bold">Total Flocks</p>
            <h2 className="text-3xl font-black text-green-700">{flocks.length}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border relative">
            {summary.noCaretaker > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full">
                {summary.noCaretaker}
              </span>
            )}
            <p className="text-gray-500 font-bold">Caretaker Alerts</p>
            <h2 className="text-3xl font-black text-orange-600">{summary.noCaretaker}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border relative">
            {summary.nearHarvest > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-black px-3 py-1 rounded-full">
                {summary.nearHarvest}
              </span>
            )}
            <p className="text-gray-500 font-bold">Near Harvest</p>
            <h2 className="text-3xl font-black text-yellow-600">{summary.nearHarvest}</h2>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow border p-6 mb-8">
          <h2 className="text-2xl font-black mb-4">Create New Chick Batch</h2>

          <div className="grid md:grid-cols-4 gap-4">
            <input
              className="border p-4 rounded-2xl"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Breed"
            />

            <input
              type="number"
              className="border p-4 rounded-2xl"
              value={totalChicks}
              onChange={(e) => setTotalChicks(Number(e.target.value))}
              placeholder="Total Chicks"
            />

            <input
              type="date"
              className="border p-4 rounded-2xl"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
            />

            <button
              onClick={createFlock}
              className="bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black"
            >
              🐣 Create Batch
            </button>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          {flocks.map((flock) => {
            const survival =
              flock.total_chicks > 0
                ? Math.round((flock.alive_count / flock.total_chicks) * 100)
                : 0;

            const dayAge = daysBetween(flock.created_at);
            const growthProgress = Math.min(100, Math.round((dayAge / 35) * 100));
            const harvestLeft = daysUntil(flock.expected_harvest_date);

            const riskCount =
              (survival < 95 ? 1 : 0) +
              (!flock.caretaker_name ? 1 : 0) +
              (harvestLeft !== null && harvestLeft <= 7 ? 1 : 0);

            return (
              <div key={flock.id} className="bg-white rounded-3xl shadow border p-7 relative">
                {riskCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full">
                    {riskCount}
                  </span>
                )}

                <div className="flex justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-3xl font-black">🐣 {flock.batch_no}</h2>
                    <p className="text-gray-500">{flock.breed} Chick Batch</p>
                  </div>

                  <span className="h-fit bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold">
                    {flock.status}
                  </span>
                </div>

                <div className="mb-5">
                  <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
                    <span>Day {dayAge} / 35 Grow Cycle</span>
                    <span>{growthProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className="bg-green-600 h-4 rounded-full"
                      style={{ width: `${growthProgress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-green-50 rounded-2xl p-4">
                    <p className="text-gray-500">Total Chicks</p>
                    <h3 className="text-2xl font-black">{flock.total_chicks}</h3>
                  </div>

                  <div className="bg-green-50 rounded-2xl p-4">
                    <p className="text-gray-500">Alive Chicks</p>
                    <h3 className="text-2xl font-black">{flock.alive_count}</h3>
                  </div>

                  <div className="bg-yellow-50 rounded-2xl p-4">
                    <p className="text-gray-500">Survival Rate</p>
                    <h3 className="text-2xl font-black">{survival}%</h3>
                  </div>

                  <div className="bg-blue-50 rounded-2xl p-4">
                    <p className="text-gray-500">Harvest Countdown</p>
                    <h3 className="text-lg font-black">
                      {harvestLeft === null
                        ? "Not set"
                        : harvestLeft <= 0
                        ? "Ready"
                        : `${harvestLeft} days left`}
                    </h3>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-5">
                  <p className="font-bold text-gray-700">Assigned Caretaker</p>
                  <p className="text-green-700 font-black text-xl mt-1">
                    👨‍🌾 {flock.caretaker_name || "No caretaker assigned yet"}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-5">
                  <select
                    className="border p-4 rounded-2xl font-bold"
                    value={selectedCaretaker[flock.id] || ""}
                    onChange={(e) =>
                      setSelectedCaretaker({
                        ...selectedCaretaker,
                        [flock.id]: e.target.value,
                      })
                    }
                  >
                    <option value="">Choose Caretaker</option>
                    {CARETAKERS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => assignCaretaker(flock.id)}
                    className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-2xl font-black"
                  >
                    Assign Caretaker
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-3 mb-5">
                  <div className="bg-orange-50 rounded-2xl p-4">
                    <p className="text-sm font-bold text-orange-700">Inventory</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Feed usage monitoring next.
                    </p>
                  </div>

                  <div className="bg-red-50 rounded-2xl p-4">
                    <p className="text-sm font-bold text-red-700">Risk</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {riskCount > 0 ? `${riskCount} alert(s)` : "Low risk"}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-2xl p-4">
                    <p className="text-sm font-bold text-purple-700">Reports</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Caretaker updates required.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedFlock(flock)}
                  className="w-full bg-gray-900 hover:bg-black text-white p-4 rounded-2xl font-black"
                >
                  Open Flock Command Center
                </button>
              </div>
            );
          })}
        </section>

        {selectedFlock && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-7 shadow-2xl">
              <div className="flex justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-3xl font-black">🐔 {selectedFlock.batch_no}</h2>
                  <p className="text-gray-500">Flock Command Center</p>
                </div>

                <button
                  onClick={() => setSelectedFlock(null)}
                  className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl font-black"
                >
                  Close
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Growth Status</p>
                  <h3 className="text-2xl font-black">
                    Day {daysBetween(selectedFlock.created_at)} / 35
                  </h3>
                </div>

                <div className="bg-blue-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Harvest</p>
                  <h3 className="text-2xl font-black">
                    {daysUntil(selectedFlock.expected_harvest_date) === null
                      ? "Not set"
                      : `${daysUntil(selectedFlock.expected_harvest_date)} days left`}
                  </h3>
                </div>

                <div className="bg-yellow-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Chicks Alive</p>
                  <h3 className="text-2xl font-black">
                    {selectedFlock.alive_count} / {selectedFlock.total_chicks}
                  </h3>
                </div>

                <div className="bg-emerald-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Caretaker</p>
                  <h3 className="text-2xl font-black">
                    {selectedFlock.caretaker_name || "Not assigned"}
                  </h3>
                </div>
              </div>

              <div className="mt-5 bg-red-50 border border-red-100 rounded-2xl p-5">
                <h3 className="font-black text-red-700">Risk Management</h3>
                <p className="text-sm text-gray-700 mt-2">
                  Next connection: inventory usage, missed caretaker reports,
                  low feed alerts, weight delay alerts, and harvest readiness.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}