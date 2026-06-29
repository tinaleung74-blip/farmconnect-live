"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateText,
  isChicken,
  normalizeAnimal,
  resolveCustomerProfile,
  shellClass,
  type Animal,
  type AnimalRelation,
} from "@/lib/customer-auth";

type WeightRow = {
  id: string;
  animal_id: string | null;
  weight_kg: number | string | null;
  note: string | null;
  recorded_at: string | null;
  animals: AnimalRelation;
};

export default function WeightUpdatesPage() {
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeights();
  }, []);

  async function loadWeights() {
    setLoading(true);
    setMessage("");

    const profile = await resolveCustomerProfile();
    if (!profile) {
      setWeights([]);
      setMessage("Login required to view weight updates.");
      setLoading(false);
      return;
    }

    const animals = await loadCustomerAnimals(profile.id);
    const animalIds = animals.map((animal) => animal.id);

    if (animalIds.length === 0) {
      setWeights([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("animal_weights")
      .select("id,animal_id,weight_kg,note,recorded_at,animals(id,code,name,type,breed,health_status)")
      .in("animal_id", animalIds)
      .order("recorded_at", { ascending: false })
      .limit(120);

    if (error) setMessage(error.message);

    const chickenWeights = ((data || []) as WeightRow[]).filter((weight) =>
      isChicken(normalizeAnimal(weight.animals))
    );

    setWeights(chickenWeights);
    setLoading(false);
  }

  const summary = useMemo(() => {
    const latest = weights[0] || null;
    const average = weights.length
      ? weights.reduce((sum, row) => sum + Number(row.weight_kg || 0), 0) / weights.length
      : 0;

    return {
      latest,
      average,
      records: weights.length,
      animals: new Set(weights.map((row) => row.animal_id).filter(Boolean)).size,
    };
  }, [weights]);

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                Weight Updates
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Growth monitoring.
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-50">
                Latest caretaker/customer weight uploads linked only to your roosters.
              </p>
            </div>

            <button
              onClick={loadWeights}
              className="rounded-full bg-white px-5 py-3 font-black text-emerald-950"
            >
              Refresh
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 font-black text-emerald-800 shadow-xl">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Summary label="Records" value={summary.records.toLocaleString()} icon="🧾" />
          <Summary label="Roosters" value={summary.animals.toLocaleString()} icon="🐓" />
          <Summary label="Latest" value={summary.latest ? `${Number(summary.latest.weight_kg || 0)} kg` : "—"} icon="⚖️" />
          <Summary label="Average" value={summary.average ? `${summary.average.toFixed(2)} kg` : "—"} icon="📈" />
        </section>

        {loading ? (
          <div className="mt-6 rounded-[32px] bg-white p-8 text-center font-black text-emerald-800 shadow-2xl">
            Loading weight updates...
          </div>
        ) : weights.length === 0 ? (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-2xl">
            <div className="text-6xl">⚖️</div>
            <h2 className="mt-4 text-3xl font-black text-emerald-950">
              No weight records yet.
            </h2>
            <p className="mt-2 font-bold text-slate-500">
              Weight uploads will appear after caretaker/customer update records are added.
            </p>
            <Link
              href="/customer/chicks"
              className="mt-5 inline-block rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white"
            >
              Open My Flock
            </Link>
          </div>
        ) : (
          <section className="mt-6 space-y-4">
            {weights.map((row) => {
              const animal = normalizeAnimal(row.animals);

              return (
                <article key={row.id} className="rounded-[28px] bg-white p-6 shadow-2xl">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                        {animal?.breed || animal?.type || "Rooster"}
                      </p>
                      <h2 className="mt-1 text-2xl font-black text-emerald-950">
                        {animal?.name || animal?.code || "FarmConnect Rooster"}
                      </h2>
                      <p className="mt-1 font-bold text-slate-500">
                        {row.note || "No note"} • {dateText(row.recorded_at)}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-emerald-50 px-6 py-4 text-center">
                      <p className="text-sm font-bold text-slate-500">Weight</p>
                      <h3 className="text-3xl font-black text-emerald-800">
                        {Number(row.weight_kg || 0)} kg
                      </h3>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

async function loadCustomerAnimals(profileId: string) {
  const direct = await supabase
    .from("animals")
    .select("id,code,name,type,breed,health_status,profile_id,flock_id")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (!direct.error) return ((direct.data || []) as Animal[]).filter(isChicken);

  const flocks = await supabase.from("flocks").select("id").eq("profile_id", profileId);
  const flockIds = (flocks.data || []).map((flock) => flock.id).filter(Boolean);
  if (flockIds.length === 0) return [];

  const byFlock = await supabase
    .from("animals")
    .select("id,code,name,type,breed,health_status,profile_id,flock_id")
    .in("flock_id", flockIds)
    .order("created_at", { ascending: false });

  return ((byFlock.data || []) as Animal[]).filter(isChicken);
}

function Summary({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-500">{label}</p>
          <h2 className="mt-1 text-2xl font-black text-emerald-800">{value}</h2>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}
