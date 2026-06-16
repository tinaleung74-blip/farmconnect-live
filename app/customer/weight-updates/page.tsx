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
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Weight load error: ${error.message}`);
      setWeights([]);
    } else {
      setWeights(data || []);
    }

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
          Monitor flock weight history uploaded by caretakers.
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
                {latest.weight_kg || latest.weight || "—"} kg
              </h2>
              <p className="text-gray-700 mt-2">
                {latest.note || latest.remarks || "No caretaker note."}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Recorded: {formatDate(latest.created_at || latest.recorded_at)}
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
                        {item.weight_kg || item.weight || "—"} kg
                      </h3>

                      <p className="text-gray-700 mt-1">
                        {item.note || item.remarks || "No note from caretaker."}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        Flock ID: {item.flock_id || item.animal_id || "N/A"}
                      </p>
                    </div>

                    <span className="text-sm text-gray-500">
                      {formatDate(item.created_at || item.recorded_at)}
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

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
}