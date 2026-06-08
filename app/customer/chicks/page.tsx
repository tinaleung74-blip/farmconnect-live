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
  caretaker_name: string | null;
};

const caretakers = [
  "Caretaker 1",
  "Caretaker 2",
  "Caretaker 3",
  "Caretaker 4",
  "Caretaker 5",
  "Caretaker 6",
  "Caretaker 7",
  "Caretaker 8",
  "Caretaker 9",
  "Caretaker 10",
];

export default function MyFlockPage() {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [selectedCaretakers, setSelectedCaretakers] = useState<Record<string, string>>({});
  const [breed, setBreed] = useState("Broiler");
  const [totalChicks, setTotalChicks] = useState(100);
  const [harvestDate, setHarvestDate] = useState("");

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
      expected_harvest_date: harvestDate,
      status: "ACTIVE",
      caretaker_name: null,
    });

    if (error) return alert(error.message);

    alert("Flock created successfully");
    setHarvestDate("");
    loadFlocks();
  }

  async function assignCaretaker(flockId: string) {
    const caretakerName = selectedCaretakers[flockId];

    if (!caretakerName) {
      alert("Please select caretaker first");
      return;
    }

    const { error } = await supabase
      .from("flocks")
      .update({ caretaker_name: caretakerName })
      .eq("id", flockId);

    if (error) {
      alert(error.message);
      return;
    }

    alert(`${caretakerName} assigned successfully!`);
    loadFlocks();
  }

  useEffect(() => {
    loadFlocks();
  }, []);

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-3xl bg-gradient-to-r from-green-700 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <h1 className="text-4xl font-black">🐣 My Flock</h1>
          <p className="mt-3 text-green-50">
            Manage poultry batches, caretaker assignment, and harvest schedule.
          </p>
        </section>

        <section className="bg-white rounded-3xl shadow border p-6 mb-8">
          <h2 className="text-2xl font-black mb-4">Create New Flock</h2>

          <div className="grid md:grid-cols-4 gap-4">
            <input className="border p-4 rounded-2xl" value={breed} onChange={(e) => setBreed(e.target.value)} />
            <input type="number" className="border p-4 rounded-2xl" value={totalChicks} onChange={(e) => setTotalChicks(Number(e.target.value))} />
            <input type="date" className="border p-4 rounded-2xl" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />

            <button onClick={createFlock} className="bg-green-600 text-white rounded-2xl font-black">
              🐣 Create Flock
            </button>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          {flocks.map((flock) => {
            const survival =
              flock.total_chicks > 0
                ? Math.round((flock.alive_count / flock.total_chicks) * 100)
                : 0;

            return (
              <div key={flock.id} className="bg-white rounded-3xl shadow border p-7">
                <div className="flex justify-between mb-5">
                  <div>
                    <h2 className="text-3xl font-black">🐥 {flock.batch_no}</h2>
                    <p className="text-gray-500">{flock.breed}</p>
                  </div>

                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold h-fit">
                    {flock.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-green-50 rounded-2xl p-4">
                    <p>Total Chicks</p>
                    <h3 className="text-2xl font-black">{flock.total_chicks}</h3>
                  </div>

                  <div className="bg-green-50 rounded-2xl p-4">
                    <p>Alive</p>
                    <h3 className="text-2xl font-black">{flock.alive_count}</h3>
                  </div>

                  <div className="bg-yellow-50 rounded-2xl p-4">
                    <p>Survival Rate</p>
                    <h3 className="text-2xl font-black">{survival}%</h3>
                  </div>

                  <div className="bg-blue-50 rounded-2xl p-4">
                    <p>Harvest Date</p>
                    <h3 className="text-lg font-black">
                      {flock.expected_harvest_date || "Not set"}
                    </h3>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-5">
                  <p className="font-bold">Assigned Caretaker</p>
                  <p className="text-green-700 font-black text-xl mt-1">
                    👨‍🌾 {flock.caretaker_name || "No caretaker assigned yet"}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <select
                    className="border p-4 rounded-2xl font-bold"
                    value={selectedCaretakers[flock.id] || ""}
                    onChange={(e) =>
                      setSelectedCaretakers({
                        ...selectedCaretakers,
                        [flock.id]: e.target.value,
                      })
                    }
                  >
                    <option value="">Choose Caretaker</option>
                    {caretakers.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => assignCaretaker(flock.id)}
                    className="bg-green-600 text-white p-4 rounded-2xl font-black"
                  >
                    Assign
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}