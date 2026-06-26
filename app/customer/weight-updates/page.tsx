"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
};

type AnimalRelation = Animal | Animal[] | null;

type AnimalWeight = {
  id: string;
  animal_id: string;
  weight_kg: number | null;
  note: string | null;
  recorded_at: string | null;
  animals: AnimalRelation;
};

export default function WeightUpdatesPage() {
  const [weights, setWeights] = useState<AnimalWeight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeights();
  }, []);

  async function loadWeights() {
    setLoading(true);

    const { data, error } = await supabase
      .from("animal_weights")
      .select(`
        id,
        animal_id,
        weight_kg,
        note,
        recorded_at,
        animals (
          id,
          code,
          name,
          type
        )
      `)
      .order("recorded_at", { ascending: false });

    if (error) {
      alert(`Weight load error: ${error.message}`);
      setWeights([]);
      setLoading(false);
      return;
    }

    const chickenOnly = (data || []).filter((item: any) => {
      const animal = normalizeAnimal(item.animals);
      return String(animal?.type || "").toLowerCase().includes("chicken");
    });

    setWeights(chickenOnly as AnimalWeight[]);
    setLoading(false);
  }

  const latest = weights[0];

  return (
    <main className="min-h-screen bg-green-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-green-900 mb-2">
          Weight Updates
        </h1>

        <p className="text-green-700 mb-6">
          View-only chicken weight history uploaded by caretakers.
        </p>

        {loading ? (
          <p>Loading weight updates...</p>
        ) : weights.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow">
            No chicken weight updates yet.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-6 shadow mb-6 border border-green-200">
              <p className="text-sm text-gray-500">Latest Weight</p>

              <h2 className="text-4xl font-bold text-green-800">
                {latest.weight_kg ?? "—"} kg
              </h2>

              <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
                <Info label="Animal Name" value={normalizeAnimal(latest.animals)?.name || "Unnamed Chicken"} />
                <Info label="Animal Code" value={normalizeAnimal(latest.animals)?.code || "No code"} />
                <Info label="Chicken Type" value={normalizeAnimal(latest.animals)?.type || "Chicken"} />
              </div>

              <p className="text-gray-700 mt-4">
                {latest.note || "No caretaker note."}
              </p>

              <p className="text-sm text-gray-500 mt-2">
                Recorded: {formatDate(latest.recorded_at)}
              </p>
            </div>

            <div className="grid gap-4">
              {weights.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-5 shadow border border-green-100"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">
                        {normalizeAnimal(item.animals)?.type || "Chicken"}
                      </p>

                      <h3 className="text-xl font-bold text-green-900 mt-1">
                        {normalizeAnimal(item.animals)?.name || "Unnamed Chicken"}
                      </h3>

                      <p className="text-sm text-gray-500">
                        Code: {normalizeAnimal(item.animals)?.code || "No code"}
                      </p>

                      <p className="text-2xl font-bold text-green-800 mt-3">
                        {item.weight_kg ?? "—"} kg
                      </p>

                      <p className="text-gray-700 mt-1">
                        {item.note || "No note from caretaker."}
                      </p>
                    </div>

                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(item.recorded_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-green-50 border border-green-100 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-green-900">{value}</p>
    </div>
  );
}

function normalizeAnimal(value: AnimalRelation): Animal | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
}