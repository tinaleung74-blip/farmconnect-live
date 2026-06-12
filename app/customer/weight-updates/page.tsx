"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function WeightUpdatesPage() {
  const [weights, setWeights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeights();
  }, []);

  async function loadWeights() {
    setLoading(true);

    const { data, error } = await supabase
      .from("animal_weights")
      .select("id, animal_id, weight_kg, note, recorded_at")
      .order("recorded_at", { ascending: false });

    if (!error && data) {
      setWeights(data);
    }

    setLoading(false);
  }

  const latest = weights[0];

  return (
    <main className="min-h-screen bg-green-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-green-900 mb-2">
          ⚖️ Weight Updates
        </h1>

        <p className="text-green-700 mb-6">
          Monitor your flock weight history uploaded by caretakers.
        </p>

        {loading ? (
          <p>Loading weight updates...</p>
        ) : weights.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow">
            No weight updates yet.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-6 shadow mb-6 border border-green-200">
              <p className="text-sm text-gray-500">Latest Weight</p>
              <h2 className="text-4xl font-bold text-green-800">
                {latest.weight_kg} kg
              </h2>
              <p className="text-gray-700 mt-2">
                {latest.note || "No caretaker note."}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Recorded:{" "}
                {latest.recorded_at
                  ? new Date(latest.recorded_at).toLocaleString()
                  : "No date"}
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
                      <h3 className="text-xl font-bold text-green-900">
                        {item.weight_kg} kg
                      </h3>

                      <p className="text-gray-700 mt-1">
                        {item.note || "No note from caretaker."}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        Animal ID: {item.animal_id || "N/A"}
                      </p>
                    </div>

                    <span className="text-sm text-gray-500">
                      {item.recorded_at
                        ? new Date(item.recorded_at).toLocaleDateString()
                        : "No date"}
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