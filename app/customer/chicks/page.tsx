"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Flock = {
  id: string;
  batch_no: string;
  breed: string;
  total_chicks: number;
  alive_count: number;
  expected_harvest_date: string;
  status: string;
};

export default function MyFlockPage() {
  const [caretaker, setCaretaker] = useState(
    "No caretaker assigned yet"
  );

  const [flocks, setFlocks] = useState<Flock[]>([]);

  const [breed, setBreed] = useState("Broiler");
  const [totalChicks, setTotalChicks] = useState(100);
  const [harvestDate, setHarvestDate] = useState("");

  async function loadFlocks() {
    const user = localStorage.getItem("farmconnect_user");

    if (!user) return;

    const profile = JSON.parse(user);

    const { data } = await supabase
      .from("flocks")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    setFlocks(data || []);
  }

  async function createFlock() {
    const user = localStorage.getItem("farmconnect_user");

    if (!user) {
      alert("Please login first");
      return;
    }

    const profile = JSON.parse(user);

    const batchNo =
      "FC-" +
      Math.floor(100000 + Math.random() * 900000);

    const { error } = await supabase.from("flocks").insert({
      profile_id: profile.id,
      batch_no: batchNo,
      breed,
      total_chicks: totalChicks,
      alive_count: totalChicks,
      mortality_count: 0,
      expected_harvest_date: harvestDate,
      status: "ACTIVE",
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Flock created successfully");

    loadFlocks();
  }

  useEffect(() => {
    const savedCaretaker =
      localStorage.getItem("assigned_caretaker");

    if (savedCaretaker) {
      setCaretaker(savedCaretaker);
    }

    loadFlocks();
  }, []);

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-4xl font-bold text-green-700 mb-8">
        🐣 My Flock
      </h1>

      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">
          Create New Flock
        </h2>

        <input
          className="w-full border p-3 rounded mb-3"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          placeholder="Breed"
        />

        <input
          type="number"
          className="w-full border p-3 rounded mb-3"
          value={totalChicks}
          onChange={(e) =>
            setTotalChicks(Number(e.target.value))
          }
        />

        <input
          type="date"
          className="w-full border p-3 rounded mb-4"
          value={harvestDate}
          onChange={(e) => setHarvestDate(e.target.value)}
        />

        <button
          onClick={createFlock}
          className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold"
        >
          🐣 Create Flock
        </button>
      </div>

      <div className="grid gap-6">
        {flocks.map((flock) => (
          <div
            key={flock.id}
            className="bg-white rounded-2xl shadow p-8"
          >
            <h2 className="text-3xl font-bold mb-4">
              🐣 {flock.batch_no}
            </h2>

            <p>
              Breed: <b>{flock.breed}</b>
            </p>

            <p>
              Total Chicks:{" "}
              <b>{flock.total_chicks}</b>
            </p>

            <p>
              Alive Count:{" "}
              <b>{flock.alive_count}</b>
            </p>

            <p>
              Harvest Date:{" "}
              <b>{flock.expected_harvest_date}</b>
            </p>

            <p>
              Status:{" "}
              <span className="text-green-700 font-bold">
                {flock.status}
              </span>
            </p>

            <div className="mt-5 bg-green-50 p-4 rounded-xl">
              <p className="font-bold">
                Assigned Caretaker:
              </p>

              <p className="text-green-700 font-bold text-xl">
                👨‍🌾 {caretaker}
              </p>
            </div>

            <div className="mt-6">
              <a
                href="/customer/caretakers"
                className="bg-green-600 text-white p-4 rounded-xl text-center font-bold block"
              >
                👨‍🌾 Assign Caretaker
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}