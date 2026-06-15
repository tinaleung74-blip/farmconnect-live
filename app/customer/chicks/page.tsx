"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Flock = any;
type UsageLog = any;
type Hire = any;
type RiskAlert = any;

export default function CustomerChicksPage() {
  const [profileId, setProfileId] = useState("");
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [paidHires, setPaidHires] = useState<Hire[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [selectedFlock, setSelectedFlock] = useState<Flock | null>(null);
  const [selectedCaretakerId, setSelectedCaretakerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setProfileId(user.id);

    const { data: flockData } = await supabase
      .from("flocks")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });

    const { data: usageData } = await supabase
      .from("inventory_usage_logs")
      .select("*")
      .eq("profile_id", user.id)
      .order("used_at", { ascending: false });

    const { data: hireData } = await supabase
      .from("customer_caretaker_hires")
      .select("*")
      .eq("profile_id", user.id)
      .eq("status", "ACTIVE")
      .eq("payment_status", "PAID")
      .order("created_at", { ascending: false });

    const { data: riskData } = await supabase
      .from("risk_alerts")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });

    setFlocks(flockData || []);
    setUsageLogs(usageData || []);
    setPaidHires(hireData || []);
    setRiskAlerts(riskData || []);
    setLoading(false);
  }

  const selectedUsageLogs = useMemo(() => {
    if (!selectedFlock) return [];
    return usageLogs.filter((log) => log.flock_id === selectedFlock.id);
  }, [usageLogs, selectedFlock]);

  const selectedRiskAlerts = useMemo(() => {
    if (!selectedFlock) return [];
    return riskAlerts.filter((risk) => risk.flock_id === selectedFlock.id);
  }, [riskAlerts, selectedFlock]);

  const availablePaidHires = useMemo(() => {
    if (!selectedFlock) return paidHires;
    return paidHires.filter(
      (hire) => !hire.flock_id || hire.flock_id === selectedFlock.id
    );
  }, [paidHires, selectedFlock]);

  function money(value: any) {
    const num = Number(value || 0);
    return `₱${num.toLocaleString("en-PH")}`;
  }

  function formatDate(value: any) {
    if (!value) return "No date";
    return new Date(value).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getChicksAlive(flock: Flock) {
    const total = Number(flock.total_chicks || flock.chicks_count || flock.quantity || 0);
    const mortality = Number(flock.mortality_count || flock.dead_count || 0);
    return Math.max(total - mortality, 0);
  }

  function getCurrentStage(flock: Flock) {
    const created = flock.created_at ? new Date(flock.created_at) : new Date();
    const days = Math.floor(
      (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days <= 14) return "Brooding Stage";
    if (days <= 30) return "Growing Stage";
    if (days <= 45) return "Finishing Stage";
    return "Prime / Harvest Ready";
  }

  function getGrowthStatus(flock: Flock) {
    const alive = getChicksAlive(flock);
    const total = Number(flock.total_chicks || flock.chicks_count || flock.quantity || 0);
    const survival = total > 0 ? (alive / total) * 100 : 0;

    if (survival >= 95) return "Excellent";
    if (survival >= 85) return "Healthy";
    if (survival >= 70) return "Needs Monitoring";
    return "High Risk";
  }

  async function assignCaretaker() {
    if (!selectedFlock || !selectedCaretakerId) {
      alert("Please select an ACTIVE + PAID caretaker.");
      return;
    }

    setAssigning(true);

    const hire = paidHires.find((h) => String(h.caretaker_id) === selectedCaretakerId);

    if (!hire) {
      alert("Caretaker hire record not found.");
      setAssigning(false);
      return;
    }

    const caretakerName = hire.caretaker_name || "Assigned Caretaker";

    const { error: flockError } = await supabase
      .from("flocks")
      .update({
        caretaker_name: caretakerName,
      })
      .eq("id", selectedFlock.id)
      .eq("profile_id", profileId);

    if (flockError) {
      alert(flockError.message);
      setAssigning(false);
      return;
    }

    await supabase
      .from("caretakers")
      .update({
        assigned_flock_id: selectedFlock.id,
        assignment_start: new Date().toISOString(),
        status: "ASSIGNED",
      })
      .eq("id", selectedCaretakerId);

    await supabase
      .from("customer_caretaker_hires")
      .update({
        flock_id: selectedFlock.id,
      })
      .eq("id", hire.id)
      .eq("profile_id", profileId);

    alert("Caretaker assigned successfully.");
    setAssigning(false);
    setSelectedCaretakerId("");
    setSelectedFlock(null);
    loadData();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p>Loading My Flock...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm text-emerald-300">FarmConnect Customer</p>
          <h1 className="text-3xl font-bold">My Flock Command Center</h1>
          <p className="mt-2 text-slate-400">
            Monitor poultry growth, caretaker assignment, expenses, usage history, and risk status.
          </p>
        </div>

        {flocks.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <h2 className="text-xl font-semibold">No flock found</h2>
            <p className="mt-2 text-slate-400">
              Your poultry batches will appear here after purchase or creation.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {flocks.map((flock) => {
              const alive = getChicksAlive(flock);
              const total = Number(flock.total_chicks || flock.chicks_count || flock.quantity || 0);
              const startingValue = Number(flock.starting_value || total * 1000);
              const currentValue = Number(flock.current_value || alive * 1200);
              const primeValue = Number(flock.projected_prime_value || alive * 1500);

              return (
                <div
                  key={flock.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Batch</p>
                      <h2 className="text-xl font-bold">
                        {flock.batch_name || flock.batch_number || "Poultry Batch"}
                      </h2>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {getGrowthStatus(flock)}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-slate-500">Current Stage</p>
                      <p className="font-semibold">{getCurrentStage(flock)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-slate-500">Chicks Alive</p>
                      <p className="font-semibold">
                        {alive} / {total}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-slate-500">Current Value</p>
                      <p className="font-semibold">{money(currentValue)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-slate-500">Prime Value</p>
                      <p className="font-semibold">{money(primeValue)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-950 p-3 text-sm">
                    <p className="text-slate-500">Assigned Caretaker</p>
                    <p className="font-semibold">
                      {flock.caretaker_name || "No caretaker assigned yet"}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedFlock(flock)}
                    className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    Open Command Center
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedFlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-emerald-300">Flock Command Center</p>
                <h2 className="text-2xl font-bold">
                  {selectedFlock.batch_name ||
                    selectedFlock.batch_number ||
                    "Poultry Batch"}
                </h2>
                <p className="text-sm text-slate-400">
                  Created: {formatDate(selectedFlock.created_at)}
                </p>
              </div>

              <button
                onClick={() => setSelectedFlock(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard title="Growth Status" value={getGrowthStatus(selectedFlock)} />
              <InfoCard title="Current Stage" value={getCurrentStage(selectedFlock)} />
              <InfoCard title="Chicks Alive" value={String(getChicksAlive(selectedFlock))} />
              <InfoCard
                title="Starting Value"
                value={money(
                  selectedFlock.starting_value ||
                    Number(
                      selectedFlock.total_chicks ||
                        selectedFlock.chicks_count ||
                        selectedFlock.quantity ||
                        0
                    ) * 1000
                )}
              />
              <InfoCard
                title="Current Value"
                value={money(
                  selectedFlock.current_value || getChicksAlive(selectedFlock) * 1200
                )}
              />
              <InfoCard
                title="Projected Prime Value"
                value={money(
                  selectedFlock.projected_prime_value ||
                    getChicksAlive(selectedFlock) * 1500
                )}
              />
            </div>

            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-lg font-bold">Assigned Caretaker</h3>
              <p className="mt-1 text-sm text-slate-400">
                Only ACTIVE + PAID caretaker hires can be assigned.
              </p>

              <div className="mt-4 rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-500">Current Assignment</p>
                <p className="font-semibold">
                  {selectedFlock.caretaker_name || "No caretaker assigned yet"}
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <select
                  value={selectedCaretakerId}
                  onChange={(e) => setSelectedCaretakerId(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                >
                  <option value="">Select ACTIVE + PAID caretaker</option>
                  {availablePaidHires.map((hire) => (
                    <option key={hire.id} value={hire.caretaker_id}>
                      {hire.caretaker_name} — PAID
                    </option>
                  ))}
                </select>

                <button
                  onClick={assignCaretaker}
                  disabled={assigning}
                  className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Assign Caretaker"}
                </button>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-lg font-bold">Flock Expense & Usage History</h3>
              <p className="mt-1 text-sm text-slate-400">
                History of feeds, vaccines, vitamins, medicines, caretaker fees, utilities, and farm expenses used for this flock.
              </p>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
                {selectedUsageLogs.length === 0 ? (
                  <div className="bg-slate-950 p-5 text-sm text-slate-400">
                    No usage or expense history yet.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Item / Expense</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3">Unit</th>
                        <th className="p-3">Used By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUsageLogs.map((log) => (
                        <tr key={log.id} className="border-t border-slate-800">
                          <td className="p-3 text-slate-300">{formatDate(log.used_at)}</td>
                          <td className="p-3 font-semibold">
                            {log.item_name || log.expense_name || "Farm Expense"}
                          </td>
                          <td className="p-3 text-slate-300">
                            {log.qty_used || log.amount || "-"}
                          </td>
                          <td className="p-3 text-slate-300">{log.unit || "-"}</td>
                          <td className="p-3 text-slate-300">
                            {log.used_by || "Farm Operations"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-lg font-bold">Risk Management</h3>
              <p className="mt-1 text-sm text-slate-400">
                Operational alerts connected to this flock.
              </p>

              <div className="mt-4 space-y-3">
                {selectedRiskAlerts.length === 0 ? (
                  <div className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                    No active risk alerts for this flock.
                  </div>
                ) : (
                  selectedRiskAlerts.map((risk) => (
                    <div
                      key={risk.id}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-amber-300">
                            {risk.title || risk.risk_type || "Risk Alert"}
                          </p>
                          <p className="mt-1 text-sm text-slate-300">
                            {risk.description || risk.message || "Needs monitoring."}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
                          {risk.status || "OPEN"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}