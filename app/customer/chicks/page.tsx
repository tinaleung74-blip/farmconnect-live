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

type InventoryItem = {
  id: string;
  profile_id: string | null;
  flock_id: string | null;
  item_name: string;
  category: string | null;
  unit: string | null;
  starting_qty: number;
  remaining_qty: number;
  low_stock_level: number;
  status: string | null;
  created_at?: string;
};

type UsageLog = {
  id: string;
  profile_id: string | null;
  flock_id: string | null;
  inventory_id: string | null;
  item_name: string | null;
  qty_used: number;
  unit: string | null;
  used_by: string | null;
  purpose: string | null;
  created_at?: string;
};

type HiredCaretaker = {
  id: string;
  profile_id: string | null;
  caretaker_id: string;
  caretaker_name: string;
  flock_id: string | null;
  duration_days: number | null;
  rate_per_chick: number | null;
  total_chicks: number | null;
  total_fee: number | null;
  status: string | null;
  payment_status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
};

const CHICK_PRICE = 1000;
const CYCLE_DAYS = 45;

function money(n: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
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

function inventoryForFlock(inventory: InventoryItem[], flockId: string) {
  return inventory.filter((item) => item.flock_id === flockId);
}

function lowStockItems(items: InventoryItem[]) {
  return items.filter(
    (item) => Number(item.remaining_qty || 0) <= Number(item.low_stock_level || 0)
  );
}

function getGrowthStage(day: number) {
  if (day <= 7) {
    return {
      icon: "🐣",
      name: "Hatchling",
      multiplier: 1,
      label: "Premium chick starting stage",
    };
  }

  if (day <= 15) {
    return {
      icon: "🐥",
      name: "Starter",
      multiplier: 1.15,
      label: "Early growth stage",
    };
  }

  if (day <= 25) {
    return {
      icon: "🐤",
      name: "Juvenile",
      multiplier: 1.35,
      label: "Growing value stage",
    };
  }

  if (day <= 35) {
    return {
      icon: "🐔",
      name: "Adolescent",
      multiplier: 1.65,
      label: "Premium development stage",
    };
  }

  return {
    icon: "🏆",
    name: "Prime",
    multiplier: 2,
    label: "Projected harvest value stage",
  };
}

function getCurrentProfileId() {
  const rawProfileId =
    localStorage.getItem("farmconnect_profile_id") ||
    localStorage.getItem("profile_id") ||
    localStorage.getItem("customer_id");

  if (rawProfileId) return rawProfileId;

  const rawUser = localStorage.getItem("farmconnect_user");
  if (!rawUser) return null;

  try {
    const profile = JSON.parse(rawUser);
    return profile?.id || profile?.profile_id || profile?.customer_id || null;
  } catch {
    return null;
  }
}

export default function MyFlockPage() {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [caretakers, setCaretakers] = useState<HiredCaretaker[]>([]);

  const [selectedCaretaker, setSelectedCaretaker] = useState<Record<string, string>>({});
  const [breed, setBreed] = useState("Premium Broiler");
  const [totalChicks, setTotalChicks] = useState(100);
  const [harvestDate, setHarvestDate] = useState("");
  const [selectedFlock, setSelectedFlock] = useState<Flock | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeInventory, setActiveInventory] = useState<InventoryItem | null>(null);
  const [qtyUsed, setQtyUsed] = useState(1);
  const [usedBy, setUsedBy] = useState("");
  const [purpose, setPurpose] = useState("Morning feeding");
  const [deducting, setDeducting] = useState(false);

  async function loadFlocks() {
    const profileId = getCurrentProfileId();

    if (!profileId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("flocks")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setFlocks(data || []);
  }

  async function loadInventory() {
    const profileId = getCurrentProfileId();
    if (!profileId) return;

    const { data } = await supabase
      .from("flock_inventory")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    setInventory(data || []);
  }

  async function loadUsageLogs() {
    const profileId = getCurrentProfileId();
    if (!profileId) return;

    const { data } = await supabase
      .from("inventory_usage_logs")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    setUsageLogs(data || []);
  }

  async function loadCaretakers() {
    const profileId = getCurrentProfileId();

    if (!profileId) {
      setCaretakers([]);
      return;
    }

    const { data, error } = await supabase
      .from("customer_caretaker_hires")
      .select(
        "id,profile_id,caretaker_id,caretaker_name,flock_id,duration_days,rate_per_chick,total_chicks,total_fee,status,payment_status,start_date,end_date,created_at"
      )
      .eq("profile_id", profileId)
      .eq("status", "ACTIVE")
      .eq("payment_status", "PAID")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error.message);
      setCaretakers([]);
      return;
    }

    setCaretakers(data || []);
  }

  async function refreshPageData() {
    setLoading(true);
    await loadFlocks();
    await loadInventory();
    await loadUsageLogs();
    await loadCaretakers();
    setLoading(false);
  }

  async function createFlock() {
    const profileId = getCurrentProfileId();
    if (!profileId) return alert("Please login first");

    const batchNo = "FC-" + Math.floor(100000 + Math.random() * 900000);

    const defaultHarvest = new Date();
    defaultHarvest.setDate(defaultHarvest.getDate() + CYCLE_DAYS);

    const { data, error } = await supabase
      .from("flocks")
      .insert({
        profile_id: profileId,
        batch_no: batchNo,
        breed,
        total_chicks: totalChicks,
        alive_count: totalChicks,
        mortality_count: 0,
        expected_harvest_date: harvestDate || defaultHarvest.toISOString().slice(0, 10),
        status: "ACTIVE",
        caretaker_name: null,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    if (data?.id) {
      await supabase.from("flock_inventory").insert({
        profile_id: profileId,
        flock_id: data.id,
        item_name: "Starter Feed",
        category: "FEED",
        unit: "sack",
        starting_qty: 20,
        remaining_qty: 20,
        low_stock_level: 5,
        status: "ACTIVE",
      });
    }

    alert("Premium chick batch created successfully");
    setHarvestDate("");
    await refreshPageData();
  }

  async function assignCaretaker(flockId: string) {
    const hireId = selectedCaretaker[flockId];

    if (!hireId) return alert("Please select ACTIVE + PAID caretaker first.");

    const hire = caretakers.find((item) => item.id === hireId);

    if (!hire) return alert("Caretaker hire record not found.");
    if (hire.status !== "ACTIVE" || hire.payment_status !== "PAID") {
      return alert("Only ACTIVE + PAID caretakers can be assigned.");
    }

    const { error: flockError } = await supabase
      .from("flocks")
      .update({
        caretaker_name: hire.caretaker_name,
      })
      .eq("id", flockId);

    if (flockError) return alert(flockError.message);

    const { error: caretakerError } = await supabase
      .from("caretakers")
      .update({
        assigned_flock_id: flockId,
        assignment_start: new Date().toISOString().slice(0, 10),
        status: "ASSIGNED",
      })
      .eq("id", hire.caretaker_id);

    if (caretakerError) return alert(caretakerError.message);

    const { error: hireError } = await supabase
      .from("customer_caretaker_hires")
      .update({
        flock_id: flockId,
      })
      .eq("id", hire.id);

    if (hireError) return alert(hireError.message);

    alert(`${hire.caretaker_name} assigned successfully!`);
    await refreshPageData();
  }

  async function submitInventoryUsage() {
    if (!activeInventory) return alert("Please choose an inventory item card.");
    if (!qtyUsed || qtyUsed <= 0) return alert("Quantity used must be greater than zero.");

    setDeducting(true);

    const { data, error } = await supabase.rpc("use_flock_inventory", {
      p_inventory_id: activeInventory.id,
      p_qty_used: qtyUsed,
      p_used_by: usedBy || selectedFlock?.caretaker_name || "Caretaker",
      p_purpose: purpose || "Farm operation",
    });

    setDeducting(false);

    if (error) return alert(error.message);
    if (!data?.ok) return alert(data?.message || "Failed to deduct inventory.");

    alert(`${data.item_name} deducted successfully. Remaining: ${data.remaining_qty}`);

    setActiveInventory(null);
    setQtyUsed(1);
    setUsedBy("");
    setPurpose("Morning feeding");

    await refreshPageData();
  }

  useEffect(() => {
    refreshPageData();
  }, []);

  useEffect(() => {
    if (selectedFlock?.caretaker_name) setUsedBy(selectedFlock.caretaker_name);
  }, [selectedFlock]);

  const availableCaretakers = useMemo(() => {
    return caretakers.filter((item) => !item.flock_id);
  }, [caretakers]);

  const summary = useMemo(() => {
    const alive = flocks.reduce((sum, f) => sum + Number(f.alive_count || 0), 0);
    const noCaretaker = flocks.filter((f) => !f.caretaker_name).length;

    const nearHarvest = flocks.filter((f) => {
      const left = daysUntil(f.expected_harvest_date);
      return left !== null && left <= 7;
    }).length;

    const inventoryAlerts = inventory.filter(
      (item) => Number(item.remaining_qty || 0) <= Number(item.low_stock_level || 0)
    ).length;

    const usageToday = usageLogs.filter((log) => {
      if (!log.created_at) return false;
      return new Date(log.created_at).toDateString() === new Date().toDateString();
    }).length;

    return { alive, noCaretaker, nearHarvest, inventoryAlerts, usageToday };
  }, [flocks, inventory, usageLogs]);

  const selectedInventory = selectedFlock ? inventoryForFlock(inventory, selectedFlock.id) : [];
  const selectedLowStock = lowStockItems(selectedInventory);
  const selectedUsageLogs = selectedFlock
    ? usageLogs.filter((log) => log.flock_id === selectedFlock.id)
    : [];

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-3xl bg-gradient-to-r from-green-700 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <p className="font-bold opacity-90">FarmConnect Premium Poultry Ownership</p>
          <h1 className="text-4xl font-black mt-1">🐣 My Flock Command Center</h1>
          <p className="mt-3 text-green-50">
            Own premium chicks, monitor real farm activity, track growth value, and protect harvest returns.
          </p>
        </section>

        <section className="grid md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-gray-500 font-bold">Active Chicks</p>
            <h2 className="text-3xl font-black text-green-700">{summary.alive}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border relative">
            {summary.inventoryAlerts > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full">
                {summary.inventoryAlerts}
              </span>
            )}
            <p className="text-gray-500 font-bold">Supply Alerts</p>
            <h2 className="text-3xl font-black text-orange-600">{summary.inventoryAlerts}</h2>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow border">
            <p className="text-gray-500 font-bold">Usage Today</p>
            <h2 className="text-3xl font-black text-blue-600">{summary.usageToday}</h2>
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
          <h2 className="text-2xl font-black mb-4">Create New Premium Chick Batch</h2>

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

          <p className="text-sm text-gray-500 mt-3">
            Premium value: {money(CHICK_PRICE)} per chick • Default cycle: {CYCLE_DAYS} days
          </p>
        </section>

        {loading ? (
          <div className="bg-white rounded-3xl p-8 shadow border">
            Loading flock command center...
          </div>
        ) : flocks.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 shadow border">
            No chick batches yet. Create your first batch above.
          </div>
        ) : (
          <section className="grid lg:grid-cols-2 gap-6">
            {flocks.map((flock) => {
              const survival =
                flock.total_chicks > 0
                  ? Math.round((flock.alive_count / flock.total_chicks) * 100)
                  : 0;

              const dayAge = daysBetween(flock.created_at);
              const growthProgress = Math.min(100, Math.round((dayAge / CYCLE_DAYS) * 100));
              const harvestLeft = daysUntil(flock.expected_harvest_date);
              const stage = getGrowthStage(dayAge);

              const startingValue = Number(flock.total_chicks || 0) * CHICK_PRICE;
              const currentValue = Math.round(startingValue * stage.multiplier);
              const projectedValue = Math.round(startingValue * 2);

              const flockInventory = inventoryForFlock(inventory, flock.id);
              const flockLowStock = lowStockItems(flockInventory);
              const flockUsageLogs = usageLogs.filter((log) => log.flock_id === flock.id);

              const riskCount =
                (survival < 95 ? 1 : 0) +
                (!flock.caretaker_name ? 1 : 0) +
                (harvestLeft !== null && harvestLeft <= 7 ? 1 : 0) +
                flockLowStock.length;

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
                      <span>
                        Day {dayAge} / {CYCLE_DAYS} Grow Cycle
                      </span>
                      <span>{growthProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div
                        className="bg-green-600 h-4 rounded-full"
                        style={{ width: `${growthProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-5">
                    <p className="font-bold text-gray-700">Current Premium Stage</p>
                    <h3 className="text-2xl font-black text-green-700 mt-1">
                      {stage.icon} {stage.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{stage.label}</p>
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

                    <div className="bg-purple-50 rounded-2xl p-4">
                      <p className="text-gray-500">Starting Value</p>
                      <h3 className="text-xl font-black">{money(startingValue)}</h3>
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-4">
                      <p className="text-gray-500">Current Value</p>
                      <h3 className="text-xl font-black">{money(currentValue)}</h3>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-5">
                    <p className="font-bold text-gray-700">Assigned Caretaker</p>
                    <p className="text-green-700 font-black text-xl mt-1">
                      👨‍🌾 {flock.caretaker_name || "No caretaker assigned yet"}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Only ACTIVE + PAID caretaker hires can be assigned.
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

                      {availableCaretakers.length === 0 ? (
                        <option value="" disabled>
                          No ACTIVE + PAID caretaker available
                        </option>
                      ) : (
                        availableCaretakers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.caretaker_name}
                          </option>
                        ))
                      )}
                    </select>

                    <button
                      onClick={() => assignCaretaker(flock.id)}
                      className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-2xl font-black"
                    >
                      Assign Caretaker
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 mb-5">
                    <div className="bg-red-50 rounded-2xl p-4">
                      <p className="text-sm font-bold text-red-700">Risk</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {riskCount > 0 ? `${riskCount} alert(s)` : "Low risk"}
                      </p>
                    </div>

                    <div className="bg-purple-50 rounded-2xl p-4">
                      <p className="text-sm font-bold text-purple-700">Usage Logs</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {flockUsageLogs.length} record(s)
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 mb-5">
                    <p className="text-sm text-gray-500 font-bold">Projected Prime Value</p>
                    <h3 className="text-2xl font-black text-green-700">{money(projectedValue)}</h3>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedFlock(flock);
                      setActiveInventory(null);
                      setQtyUsed(1);
                      setUsedBy(flock.caretaker_name || "");
                      setPurpose("Morning feeding");
                    }}
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-5xl w-full p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
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

              {(() => {
                const dayAge = daysBetween(selectedFlock.created_at);
                const stage = getGrowthStage(dayAge);
                const startingValue = Number(selectedFlock.total_chicks || 0) * CHICK_PRICE;
                const currentValue = Math.round(startingValue * stage.multiplier);
                const projectedValue = Math.round(startingValue * 2);

                return (
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-2xl p-5">
                      <p className="font-bold text-gray-500">Growth Status</p>
                      <h3 className="text-2xl font-black">
                        Day {dayAge} / {CYCLE_DAYS}
                      </h3>
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-5">
                      <p className="font-bold text-gray-500">Current Stage</p>
                      <h3 className="text-2xl font-black">
                        {stage.icon} {stage.name}
                      </h3>
                    </div>

                    <div className="bg-yellow-50 rounded-2xl p-5">
                      <p className="font-bold text-gray-500">Chicks Alive</p>
                      <h3 className="text-2xl font-black">
                        {selectedFlock.alive_count} / {selectedFlock.total_chicks}
                      </h3>
                    </div>

                    <div className="bg-purple-50 rounded-2xl p-5">
                      <p className="font-bold text-gray-500">Starting Value</p>
                      <h3 className="text-2xl font-black">{money(startingValue)}</h3>
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-5">
                      <p className="font-bold text-gray-500">Current Value</p>
                      <h3 className="text-2xl font-black">{money(currentValue)}</h3>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-5">
                      <p className="font-bold text-gray-500">Projected Prime Value</p>
                      <h3 className="text-2xl font-black">{money(projectedValue)}</h3>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-5 bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                <p className="font-bold text-gray-500">Assigned Caretaker</p>
                <h3 className="text-2xl font-black text-green-700">
                  👨‍🌾 {selectedFlock.caretaker_name || "Not assigned"}
                </h3>
              </div>

              <div className="mt-5 bg-orange-50 border border-orange-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-orange-700">🌾 Inventory Panel</h3>
                  {selectedLowStock.length > 0 && (
                    <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full">
                      {selectedLowStock.length} low stock
                    </span>
                  )}
                </div>

                {selectedInventory.length === 0 ? (
                  <p className="text-sm text-gray-600">No supplies assigned to this flock yet.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {selectedInventory.map((item) => {
                      const isLow =
                        Number(item.remaining_qty || 0) <= Number(item.low_stock_level || 0);

                      const percent = Math.min(
                        100,
                        Math.round(
                          (Number(item.remaining_qty || 0) /
                            Math.max(Number(item.starting_qty || 1), 1)) *
                            100
                        )
                      );

                      return (
                        <div key={item.id} className="bg-white rounded-2xl p-4 border">
                          <div className="flex justify-between gap-3">
                            <div>
                              <p className="font-black">🌾 {item.item_name}</p>
                              <p className="text-sm text-gray-600 mt-1">
                                {item.remaining_qty} {item.unit || ""} remaining
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Low level: {item.low_stock_level} {item.unit || ""}
                              </p>
                            </div>

                            {isLow && (
                              <span className="h-fit bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full">
                                LOW
                              </span>
                            )}
                          </div>

                          <div className="mt-3 w-full bg-gray-100 rounded-full h-3">
                            <div
                              className={
                                isLow
                                  ? "bg-red-500 h-3 rounded-full"
                                  : "bg-green-600 h-3 rounded-full"
                              }
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <button
                            onClick={() => {
                              setActiveInventory(item);
                              setQtyUsed(1);
                              setUsedBy(selectedFlock.caretaker_name || "");
                              setPurpose("Morning feeding");
                            }}
                            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-black"
                          >
                            Record Usage
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {activeInventory && (
                <div className="mt-5 bg-green-50 border border-green-100 rounded-2xl p-5">
                  <div className="flex justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-black text-green-700">
                        🌾 Record Usage: {activeInventory.item_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Remaining: {activeInventory.remaining_qty} {activeInventory.unit}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveInventory(null)}
                      className="bg-white border px-3 py-2 rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    <input
                      type="number"
                      className="border p-3 rounded-xl"
                      value={qtyUsed}
                      onChange={(e) => setQtyUsed(Number(e.target.value))}
                      placeholder="Qty Used"
                    />

                    <input
                      className="border p-3 rounded-xl"
                      value={usedBy}
                      onChange={(e) => setUsedBy(e.target.value)}
                      placeholder="Used By"
                    />

                    <input
                      className="border p-3 rounded-xl"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="Purpose"
                    />
                  </div>

                  <button
                    onClick={submitInventoryUsage}
                    disabled={deducting}
                    className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-5 py-3 rounded-xl font-black"
                  >
                    {deducting ? "Saving..." : "Save Usage"}
                  </button>
                </div>
              )}

              <div className="mt-5 bg-red-50 border border-red-100 rounded-2xl p-5">
                <h3 className="font-black text-red-700">⚠️ Risk Management</h3>

                <div className="mt-3 space-y-2 text-sm">
                  {!selectedFlock.caretaker_name && (
                    <p className="text-red-700 font-bold">• No caretaker assigned yet.</p>
                  )}

                  {selectedLowStock.length > 0 && (
                    <p className="text-red-700 font-bold">
                      • {selectedLowStock.length} supply item(s) need reorder.
                    </p>
                  )}

                  {daysUntil(selectedFlock.expected_harvest_date) !== null &&
                    daysUntil(selectedFlock.expected_harvest_date)! <= 7 && (
                      <p className="text-yellow-700 font-bold">
                        • Harvest is near. Prepare operations and buyer coordination.
                      </p>
                    )}

                  {selectedFlock.caretaker_name &&
                    selectedLowStock.length === 0 &&
                    !(
                      daysUntil(selectedFlock.expected_harvest_date) !== null &&
                      daysUntil(selectedFlock.expected_harvest_date)! <= 7
                    ) && <p className="text-green-700 font-bold">• Current risk level is low.</p>}
                </div>
              </div>

              <div className="mt-5 bg-purple-50 border border-purple-100 rounded-2xl p-5">
                <h3 className="font-black text-purple-700 mb-4">📋 Usage Logs</h3>

                {selectedUsageLogs.length === 0 ? (
                  <p className="text-sm text-gray-700">No usage records yet for this flock.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedUsageLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className="bg-white rounded-xl p-4 border">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-black">{log.item_name}</p>
                            <p className="text-sm text-gray-600">
                              Used: {log.qty_used} {log.unit}
                            </p>
                            <p className="text-sm text-gray-600">
                              By: {log.used_by || "Caretaker"}
                            </p>
                            <p className="text-sm text-gray-600">
                              Purpose: {log.purpose || "Farm operation"}
                            </p>
                          </div>

                          <p className="text-xs text-gray-500">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : "No date"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}