"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MyFlockPage() {
  const [animals, setAnimals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnimals();
  }, []);

  async function loadAnimals() {
    setLoading(true);

    const { data, error } = await supabase
      .from("animals")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setAnimals(data);

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-yellow-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-900 mb-2">
          🐣 My Flock
        </h1>

        <p className="text-yellow-700 mb-6">
          View your assigned animals and flock status.
        </p>

        {loading ? (
          <p>Loading flock...</p>
        ) : animals.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow">
            No animals found yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {animals.map((animal) => (
              <div
                key={animal.id}
                className="bg-white rounded-2xl p-5 shadow border border-yellow-200"
              >
                <h2 className="text-xl font-bold text-yellow-900">
                  🐔 {animal.name || animal.animal_name || "Unnamed Animal"}
                </h2>

                <p className="text-sm text-gray-600 mt-2">
                  Animal ID: {animal.id}
                </p>

                <p className="mt-3">
                  <span className="font-semibold">Type:</span>{" "}
                  {animal.type || animal.animal_type || "Chicken"}
                </p>

                <p>
                  <span className="font-semibold">Status:</span>{" "}
                  {animal.status || "Active"}
                </p>

                <p>
                  <span className="font-semibold">Breed:</span>{" "}
                  {animal.breed || "N/A"}
                </p>

                <p>
                  <span className="font-semibold">Age:</span>{" "}
                  {animal.age || animal.age_days || "N/A"}
                </p>

                <p className="text-xs text-gray-500 mt-3">
                  Added:{" "}
                  {animal.created_at
                    ? new Date(animal.created_at).toLocaleDateString()
                    : "No date"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}