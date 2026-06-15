"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Flock = {
  id: string;
  profile_id?: string;
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

type UsageLog = {
  id: string;
  profile_id?: string | null;
  flock_id?: string | null;
  inventory_id?: string | null;
  item_name?: string | null;
  qty_used?: number | null;
  unit?: string | null;
  used_by?: string | null;
  purpose?: string | null;
  amount?: number | null;
  cost?: number | null;
  total_cost?: number | null;
  expense_amount?: number | null;
  created_at?: string | null;
  used_at?: string | null;
};

type WeightLog = {
  id: string;
  profile_id?: string | null;
  flock_id?: string | null;
  weight?: number | null;
  weight_kg?: number | null;
  average_weight?: number | null;
  notes?: string | null;
  note?: string | null;
  submitted_by?: string | null;
  caretaker_name?: string | null;
  created_at?: string | null;
  recorded_at?: string | null;
};

type PhotoLog = {
  id: string;
  profile_id?: string | null;
  flock_id?: string | null;
  photo_url?: string | null;
  image_url?: string | null;
  url?: string | null;
  caption?: string | null;
  uploaded_by?: string | null;
  caretaker_name?: string | null;
  created_at?: string | null;
  uploaded_at?: string | null;
};

type CaretakerHire = {
  id: string;
  profile_id: string;
  caretaker_id: string | null;
  caretaker_name: string;
  flock_id: string | null;
  status: string | null;
  payment_status: string | null;
};

type CaretakerOption = {
  id: string;
  full_name: string;
  hire_id: string;
};

const CHICK_PRICE = 1000;
const CYCLE_DAYS = 45;

function money(n: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

function safeDate(date?: string | null) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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

function sameFlock(rowFlockId: string | null | undefined, flockId: string) {
  return String(rowFlockId || "") === String(flockId);
}

function getGrowthStage(day: number) {
  if (day <= 7) {
    return {
      icon: "🐣",
      name: "Starter Phase",
      multiplier: 1,
      label: "Premium chick starting stage",
    };
  }

  if (day <= 15) {
    return {
      icon: "🐥",
      name: "Early Growth",
      multiplier: 1.15,
      label: "Feed conversion and early care stage",
    };
  }

  if (day <= 25) {
    return {
      icon: "🐤",
      name: "Growing Phase",
      multiplier: 1.35,
      label: "Active flock development stage",
    };
  }

  if (day <= 35) {
    return {
      icon: "🐔",
      name: "Finishing Phase",
      multiplier: 1.65,
      label: "Near harvest preparation stage",
    };
  }

  return {
    icon: "🏆",
    name: "Harvest Ready",
    multiplier: 2,
    label: "Projected prime harvest value stage",
  };
}

function expenseValue(log: UsageLog) {
  return Number(
    log.total_cost ||
      log.expense_amount ||
      log.amount ||
      log.cost ||
      0
  );
}

function getWeightValue(log: WeightLog) {
  return Number(log.weight_kg || log.average_weight || log.weight || 0);
}

function getPhotoUrl(log: PhotoLog) {
  return log.photo_url || log.image_url || log.url || "";
}

export default function MyFlockPage() {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [photoLogs, setPhotoLogs] = useState<PhotoLog[]>([]);
  const [caretakers, setCaretakers] = useState<CaretakerOption[]>([]);
  const [caretakerHires, setCaretakerHires] = useState<CaretakerHire[]>([]);

  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [breed, setBreed] = useState("Premium Broiler");
  const [totalChicks, setTotalChicks] = useState(100);
  const [harvestDate, setHarvestDate] = useState("");
  const [selectedFlock, setSelectedFlock] = useState<Flock | null>(null);
  const [loading, setLoading] = useState(true);

  function getProfile() {
    const user = localStorage.getItem("farmconnect_user");
    if (!user) return null;
    return JSON.parse(user);
  }

  async function loadFlocks() {
    const profile = getProfile();
    if (!profile) return;

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

  async function loadUsageLogs() {
    const profile = getProfile();
    if (!profile) return;

    const { data } = await supabase
      .from("inventory_usage_logs")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    setUsageLogs(data || []);
  }

  async function loadWeightLogs() {
    const profile = getProfile();
    if (!profile) return;

    const { data } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    setWeightLogs(data || []);
  }

  async function loadPhotoLogs() {
    const profile = getProfile();
    if (!profile) return;

    const { data } = await supabase
      .from("photo_logs")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    setPhotoLogs(data || []);
  }

  async function loadCaretakers() {
    const profile = getProfile();
    if (!profile) return;

    const { data, error } = await supabase
      .from("customer_caretaker_hires")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("status", "ACTIVE")
      .eq("payment_status", "PAID")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error.message);
      setCaretakers([]);
      setCaretakerHires([]);
      return;
    }

    const hires = data || [];
    setCaretakerHires(hires);

    setCaretakers(
      hires.map((hire: CaretakerHire) => ({
        id: hire.caretaker_id || hire.id,
        full_name: hire.caretaker_name,
        hire_id: hire.id,
      }))
    );
  }

  async function refreshPageData() {
    setLoading(true);
    await loadFlocks();
    await loadUsageLogs();
    await loadWeightLogs();
    await loadPhotoLogs();
    await loadCaretakers();
    setLoading(false);
  }

  async function createFlock() {
    const profile = getProfile();
    if (!profile) return alert("Please login first");

    const batchNo = "FC-" + Math.floor(100000 + Math.random() * 900000);

    const defaultHarvest = new Date();
    defaultHarvest.setDate(defaultHarvest.getDate() + CYCLE_DAYS);

    const { error } = await supabase.from("flocks").insert({
      profile_id: profile.id,
      batch_no: batchNo,
      breed,
      total_chicks: totalChicks,
      alive_count: totalChicks,
      mortality_count: 0,
      expected_harvest_date:
        harvestDate || defaultHarvest.toISOString().slice(0, 10),
      status: "ACTIVE",
      caretaker_name: null,
    });

    if (error) return alert(error.message);

    alert("Premium chick batch created successfully");
    setHarvestDate("");
    await refreshPageData();
  }

  async function assignCaretaker(flockId: string) {
    const caretaker = selectedCaretaker[flockId];

    if (!caretaker) return alert("Please select ACTIVE + PAID caretaker first.");

    const hire = caretakerHires.find((h) => h.caretaker_name === caretaker);

    const { error } = await supabase
      .from("flocks")
      .update({ caretaker_name: caretaker })
      .eq("id", flockId);

    if (error) return alert(error.message);

    if (hire?.caretaker_id) {
      await supabase
        .from("caretakers")
        .update({
          assigned_flock_id: flockId,
          assignment_start: new Date().toISOString(),
          status: "ASSIGNED",
        })
        .eq("id", hire.caretaker_id);
    }

    if (hire?.id) {
      await supabase
        .from("customer_caretaker_hires")
        .update({ flock_id: flockId })
        .eq("id", hire.id);
    }

    alert(`${caretaker} assigned successfully!`);
    await refreshPageData();
  }

  useEffect(() => {
    refreshPageData();
  }, []);

  const summary = useMemo(() => {
    const alive = flocks.reduce((sum, f) => sum + Number(f.alive_count || 0), 0);
    const noCaretaker = flocks.filter((f) => !f.caretaker_name).length;

    const nearHarvest = flocks.filter((f) => {
      const left = daysUntil(f.expected_harvest_date);
      return left !== null && left <= 7;
    }).length;

    const usageToday = usageLogs.filter((log) => {
      const d = log.used_at || log.created_at;
      if (!d) return false;
      return new Date(d).toDateString() === new Date().toDateString();
    }).length;

    return { alive, noCaretaker, nearHarvest, usageToday };
  }, [flocks, usageLogs]);

  const selectedUsageLogs = selectedFlock
    ? usageLogs.filter((log) => sameFlock(log.flock_id, selectedFlock.id))
    : [];

  const selectedWeightLogs = selectedFlock
    ? weightLogs.filter((log) => sameFlock(log.flock_id, selectedFlock.id))
    : [];

  const selectedPhotoLogs = selectedFlock
    ? photoLogs.filter((log) => sameFlock(log.flock_id, selectedFlock.id))
    : [];

  const selectedDay = selectedFlock ? daysBetween(selectedFlock.created_at) : 0;
  const selectedStage = getGrowthStage(selectedDay);
  const selectedCurrentValue = selectedFlock
    ? Number(selectedFlock.alive_count || 0) * CHICK_PRICE * selectedStage.multiplier
    : 0;

  const selectedProjectedValue = selectedFlock
    ? Number(selectedFlock.alive_count || 0) * CHICK_PRICE * 2
    : 0;

  const selectedTotalExpenses = selectedUsageLogs.reduce(
    (sum, log) => sum + expenseValue(log),
    0
  );

  const selectedProjectedProfit = selectedCurrentValue - selectedTotalExpenses;

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-green-900">🐣 My Flock</h1>
          <p className="text-green-700 mt-2">
            Monitor your real poultry batches, caretaker assignment, farm usage,
            weight updates, photos, and harvest value.
          </p>
        </div>

        <section className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-sm font-bold text-gray-500">Active Chicks</p>
            <h2 className="text-3xl font-black text-green-800">{summary.alive}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-sm font-bold text-gray-500">Need Caretaker</p>
            <h2 className="text-3xl font-black text-orange-600">
              {summary.noCaretaker}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-sm font-bold text-gray-500">Near Harvest</p>
            <h2 className="text-3xl font-black text-blue-700">
              {summary.nearHarvest}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-sm font-bold text-gray-500">Usage Today</p>
            <h2 className="text-3xl font-black text-purple-700">
              {summary.usageToday}
            </h2>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-6 shadow border mb-8">
          <h2 className="text-2xl font-black text-green-900 mb-4">
            Create Chick Batch
          </h2>

          <div className="grid md:grid-cols-4 gap-3">
            <input
              className="border p-4 rounded-2xl font-bold"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Breed"
            />

            <input
              className="border p-4 rounded-2xl font-bold"
              type="number"
              value={totalChicks}
              onChange={(e) => setTotalChicks(Number(e.target.value))}
              placeholder="Total chicks"
            />

            <input
              className="border p-4 rounded-2xl font-bold"
              type="date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
            />

            <button
              onClick={createFlock}
              className="bg-green-700 hover:bg-green-800 text-white rounded-2xl font-black p-4"
            >
              Create Batch
            </button>
          </div>
        </section>

        {loading ? (
          <div className="bg-white rounded-3xl p-8 shadow text-center font-bold">
            Loading flock data...
          </div>
        ) : flocks.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 shadow text-center">
            <h2 className="text-2xl font-black text-gray-800">
              No chick batches yet.
            </h2>
            <p className="text-gray-500 mt-2">
              Create your first premium poultry batch to start monitoring.
            </p>
          </div>
        ) : (
          <section className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
            {flocks.map((flock) => {
              const day = daysBetween(flock.created_at);
              const stage = getGrowthStage(day);
              const progress = Math.min(100, Math.round((day / CYCLE_DAYS) * 100));
              const survival =
                Number(flock.total_chicks || 0) > 0
                  ? Math.round(
                      (Number(flock.alive_count || 0) /
                        Number(flock.total_chicks || 0)) *
                        100
                    )
                  : 0;

              const currentValue =
                Number(flock.alive_count || 0) * CHICK_PRICE * stage.multiplier;

              const projectedValue =
                Number(flock.alive_count || 0) * CHICK_PRICE * 2;

              const flockUsageLogs = usageLogs.filter((log) =>
                sameFlock(log.flock_id, flock.id)
              );

              const flockWeightLogs = weightLogs.filter((log) =>
                sameFlock(log.flock_id, flock.id)
              );

              const flockPhotoLogs = photoLogs.filter((log) =>
                sameFlock(log.flock_id, flock.id)
              );

              const riskCount =
                (survival < 95 ? 1 : 0) +
                (!flock.caretaker_name ? 1 : 0) +
                (flockWeightLogs.length === 0 ? 1 : 0);

              return (
                <div
                  key={flock.id}
                  className="bg-white rounded-3xl p-6 shadow border border-green-100 hover:shadow-xl transition"
                >
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div>
                      <h2 className="text-2xl font-black text-green-900">
                        {stage.icon} {flock.batch_no}
                      </h2>
                      <p className="text-sm text-gray-500">{flock.breed}</p>
                    </div>

                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-black">
                      {flock.status || "ACTIVE"}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-bold text-gray-500">
                      Current Poultry Stage
                    </p>
                    <h3 className="text-xl font-black text-gray-900">
                      {stage.name}
                    </h3>
                    <p className="text-xs text-gray-500">{stage.label}</p>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                    <div
                      className="bg-green-600 h-3 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="text-xs text-gray-500 mb-5">
                    Day {day} of {CYCLE_DAYS} grow cycle
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-yellow-50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-500">
                        Chicks Alive
                      </p>
                      <h3 className="text-xl font-black">
                        {flock.alive_count}/{flock.total_chicks}
                      </h3>
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-500">
                        Survival Rate
                      </p>
                      <h3 className="text-xl font-black">{survival}%</h3>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-500">
                        Current Value
                      </p>
                      <h3 className="text-xl font-black text-green-700">
                        {money(currentValue)}
                      </h3>
                    </div>

                    <div className="bg-purple-50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-500">
                        Harvest Countdown
                      </p>
                      <h3 className="text-xl font-black">
                        {daysUntil(flock.expected_harvest_date) === null
                          ? "Not set"
                          : `${daysUntil(flock.expected_harvest_date)}d`}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-5">
                    <p className="font-bold text-gray-700">Assigned Caretaker</p>
                    <p className="text-green-700 font-black text-xl mt-1">
                      👨‍🌾 {flock.caretaker_name || "No caretaker assigned yet"}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Only ACTIVE + PAID caretakers can be assigned.
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
                      <option value="">Choose ACTIVE + PAID Caretaker</option>
                      {caretakers.map((c) => (
                        <option key={c.hire_id} value={c.full_name}>
                          {c.full_name}
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
                    <div className="bg-red-50 rounded-2xl p-4">
                      <p className="text-sm font-bold text-red-700">Risk</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {riskCount > 0 ? `${riskCount} alert(s)` : "Low risk"}
                      </p>
                    </div>

                    <div className="bg-purple-50 rounded-2xl p-4">
                      <p className="text-sm font-bold text-purple-700">
                        Usage History
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {flockUsageLogs.length} record(s)
                      </p>
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-4">
                      <p className="text-sm font-bold text-blue-700">
                        Farm Updates
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {flockWeightLogs.length} weight / {flockPhotoLogs.length} photo
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 mb-5">
                    <p className="text-sm text-gray-500 font-bold">
                      Projected Prime Value
                    </p>
                    <h3 className="text-2xl font-black text-green-700">
                      {money(projectedValue)}
                    </h3>
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
        )}

        {selectedFlock && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] overflow-y-auto p-7 shadow-2xl">
              <div className="flex justify-between gap-4 mb-6 sticky top-0 bg-white pb-4 z-10">
                <div>
                  <h2 className="text-3xl font-black text-green-900">
                    🐔 {selectedFlock.batch_no}
                  </h2>
                  <p className="text-gray-500">
                    Flock Command Center — read-only operational monitoring
                  </p>
                </div>

                <button
                  onClick={() => setSelectedFlock(null)}
                  className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl font-black"
                >
                  Close
                </button>
              </div>

              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Growth Status</p>
                  <h3 className="text-2xl font-black">
                    Day {selectedDay} / {CYCLE_DAYS}
                  </h3>
                </div>

                <div className="bg-blue-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Current Stage</p>
                  <h3 className="text-2xl font-black">
                    {selectedStage.icon} {selectedStage.name}
                  </h3>
                </div>

                <div className="bg-yellow-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Chicks Alive</p>
                  <h3 className="text-2xl font-black">
                    {selectedFlock.alive_count} / {selectedFlock.total_chicks}
                  </h3>
                </div>

                <div className="bg-purple-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Harvest Countdown</p>
                  <h3 className="text-2xl font-black">
                    {daysUntil(selectedFlock.expected_harvest_date) === null
                      ? "Not set"
                      : `${daysUntil(selectedFlock.expected_harvest_date)} days left`}
                  </h3>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Starting Value</p>
                  <h3 className="text-2xl font-black">
                    {money(Number(selectedFlock.total_chicks || 0) * CHICK_PRICE)}
                  </h3>
                </div>

                <div className="bg-emerald-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Current Value</p>
                  <h3 className="text-2xl font-black text-green-700">
                    {money(selectedCurrentValue)}
                  </h3>
                </div>

                <div className="bg-lime-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Projected Prime Value</p>
                  <h3 className="text-2xl font-black text-green-700">
                    {money(selectedProjectedValue)}
                  </h3>
                </div>

                <div className="bg-cyan-50 rounded-2xl p-5">
                  <p className="font-bold text-gray-500">Assigned Caretaker</p>
                  <h3 className="text-xl font-black">
                    {selectedFlock.caretaker_name || "Not assigned"}
                  </h3>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-6">
                <h3 className="text-2xl font-black text-amber-800">
                  💰 Flock Expense & Usage History
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Source: inventory_usage_logs. History only. No inventory controls.
                </p>

                <div className="mt-5 overflow-x-auto">
                  {selectedUsageLogs.length === 0 ? (
                    <div className="bg-white rounded-2xl p-5 text-gray-500 font-bold">
                      No usage history yet.
                    </div>
                  ) : (
                    <table className="w-full text-sm bg-white rounded-2xl overflow-hidden">
                      <thead className="bg-amber-100 text-amber-900">
                        <tr>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Item Used</th>
                          <th className="text-left p-3">Quantity</th>
                          <th className="text-left p-3">Used By</th>
                          <th className="text-left p-3">Purpose</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUsageLogs.map((log) => (
                          <tr key={log.id} className="border-t">
                            <td className="p-3 font-bold">
                              {safeDate(log.used_at || log.created_at)}
                            </td>
                            <td className="p-3">{log.item_name || "Farm supply"}</td>
                            <td className="p-3">
                              {Number(log.qty_used || 0)} {log.unit || ""}
                            </td>
                            <td className="p-3">
                              {log.used_by || selectedFlock.caretaker_name || "Caretaker"}
                            </td>
                            <td className="p-3">{log.purpose || "Farm operation"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6">
                  <h3 className="text-2xl font-black text-blue-800">
                    ⚖️ Weight Monitoring
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Source: weight_logs. Read only caretaker submissions.
                  </p>

                  <div className="mt-5 space-y-3">
                    {selectedWeightLogs.length === 0 ? (
                      <div className="bg-white rounded-2xl p-5 text-gray-500 font-bold">
                        No caretaker weight logs yet.
                      </div>
                    ) : (
                      selectedWeightLogs.slice(0, 8).map((log) => (
                        <div key={log.id} className="bg-white rounded-2xl p-4 border">
                          <div className="flex justify-between gap-3">
                            <div>
                              <p className="font-black text-blue-900">
                                {getWeightValue(log)} kg
                              </p>
                              <p className="text-sm text-gray-600">
                                {log.notes || log.note || "No notes"}
                              </p>
                            </div>
                            <p className="text-xs font-bold text-gray-500">
                              {safeDate(log.recorded_at || log.created_at)}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Submitted by:{" "}
                            {log.submitted_by ||
                              log.caretaker_name ||
                              selectedFlock.caretaker_name ||
                              "Caretaker"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-pink-50 border border-pink-100 rounded-3xl p-6">
                  <h3 className="text-2xl font-black text-pink-800">
                    📸 Flock Photo Updates
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Source: photo_logs. Read only farm photo timeline.
                  </p>

                  <div className="mt-5 grid md:grid-cols-2 gap-4">
                    {selectedPhotoLogs.length === 0 ? (
                      <div className="bg-white rounded-2xl p-5 text-gray-500 font-bold md:col-span-2">
                        No caretaker photo logs yet.
                      </div>
                    ) : (
                      selectedPhotoLogs.slice(0, 6).map((log) => {
                        const photo = getPhotoUrl(log);

                        return (
                          <div key={log.id} className="bg-white rounded-2xl p-3 border">
                            {photo ? (
                              <img
                                src={photo}
                                alt={log.caption || "Flock photo update"}
                                className="w-full h-36 object-cover rounded-xl mb-3"
                              />
                            ) : (
                              <div className="w-full h-36 bg-gray-100 rounded-xl mb-3 flex items-center justify-center text-gray-400 font-bold">
                                No photo URL
                              </div>
                            )}

                            <p className="font-black text-gray-800">
                              {log.caption || "Farm photo update"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {safeDate(log.uploaded_at || log.created_at)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Uploaded by:{" "}
                              {log.uploaded_by ||
                                log.caretaker_name ||
                                selectedFlock.caretaker_name ||
                                "Caretaker"}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-3xl p-6 mb-6">
                <h3 className="text-2xl font-black text-green-800">
                  💰 Harvest ROI
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Current Value - Total Expenses = Projected Profit
                </p>

                <div className="grid md:grid-cols-3 gap-4 mt-5">
                  <div className="bg-white rounded-2xl p-5">
                    <p className="font-bold text-gray-500">Current Value</p>
                    <h3 className="text-3xl font-black text-green-700">
                      {money(selectedCurrentValue)}
                    </h3>
                  </div>

                  <div className="bg-white rounded-2xl p-5">
                    <p className="font-bold text-gray-500">Total Expenses</p>
                    <h3 className="text-3xl font-black text-red-600">
                      {money(selectedTotalExpenses)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      From inventory_usage_logs
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-5">
                    <p className="font-bold text-gray-500">Projected Profit</p>
                    <h3 className="text-3xl font-black text-green-800">
                      {money(selectedProjectedProfit)}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-3xl p-6">
                <h3 className="text-2xl font-black text-red-700">
                  🛡️ Risk Management
                </h3>
                <div className="grid md:grid-cols-3 gap-4 mt-5">
                  <div className="bg-white rounded-2xl p-4">
                    <p className="font-black">Caretaker Assignment</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedFlock.caretaker_name
                        ? "Caretaker assigned."
                        : "No caretaker assigned yet."}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4">
                    <p className="font-black">Weight Monitoring</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedWeightLogs.length > 0
                        ? `${selectedWeightLogs.length} weight record(s).`
                        : "No weight record yet."}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4">
                    <p className="font-black">Farm Photo Updates</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedPhotoLogs.length > 0
                        ? `${selectedPhotoLogs.length} photo update(s).`
                        : "No photo update yet."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}