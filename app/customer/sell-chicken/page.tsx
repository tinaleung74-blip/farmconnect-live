"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Flock = {
  id: string;
  batch_no: string;
  breed: string;
  alive_count: number;
  created_at: string;
  status: string;
};

type SellRequest = {
  id: string;
  flock_id: string;
  batch_no: string;
  breed: string;
  chicken_stage: string;
  quantity: number;
  price_per_chicken: number;
  total_amount: number;
  status: string;
  created_at: string;
};

const PRICE_PER_CHICKEN = 350;

function daysOld(date: string) {
  return Math.max(
    0,
    Math.floor(
      (new Date().getTime() - new Date(date).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
}

function chickenStage(days: number) {
  if (days < 15) return "🐣 Chick";
  if (days < 30) return "🐔 Growing Chicken";
  if (days < 45) return "🐓 Young Tandang";
  return "🐓 Mature Tandang";
}

export default function SellChickenPage() {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  function getProfile() {
    const user = localStorage.getItem("farmconnect_user");
    if (!user) return null;
    return JSON.parse(user);
  }

  const selectedFlock = useMemo(
    () => flocks.find((f) => f.id === selectedFlockId),
    [flocks, selectedFlockId]
  );

  const age = selectedFlock ? daysOld(selectedFlock.created_at) : 0;
  const stage = chickenStage(age);
  const totalAmount = quantity * PRICE_PER_CHICKEN;
  const canSell =
    !!selectedFlock &&
    age >= 30 &&
    quantity >= 1 &&
    quantity <= Number(selectedFlock.alive_count || 0);

  async function loadData() {
    const profile = getProfile();
    if (!profile) return;

    setLoading(true);

    const { data: flockData } = await supabase
      .from("flocks")
      .select("id,batch_no,breed,alive_count,created_at,status")
      .eq("profile_id", profile.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    const { data: requestData } = await supabase
      .from("sell_chicken_requests")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    setFlocks(flockData || []);
    setRequests(requestData || []);

    if (flockData && flockData.length > 0 && !selectedFlockId) {
      setSelectedFlockId(flockData[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitSellRequest() {
    const profile = getProfile();

    if (!profile || !selectedFlock) {
      alert("Please select a flock.");
      return;
    }

    if (!canSell) {
      alert("Chicken is not ready or quantity is invalid.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("sell_chicken_requests").insert({
      profile_id: profile.id,
      flock_id: selectedFlock.id,
      batch_no: selectedFlock.batch_no,
      breed: selectedFlock.breed,
      chicken_stage: stage,
      quantity,
      price_per_chicken: PRICE_PER_CHICKEN,
      total_amount: totalAmount,
      status: "PENDING_ADMIN_APPROVAL",
    });

    if (error) {
      alert(error.message);
      setSubmitting(false);
      return;
    }

    alert("Sell request submitted. Waiting for admin approval.");
    setQuantity(1);
    await loadData();
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-black text-green-900">
              🐓 Sell Chicken
            </h1>
            <p className="font-semibold text-green-700">
              Submit sell requests per chicken. Admin approval required.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-full bg-green-700 px-5 py-3 font-black text-white"
          >
            Back
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center font-black shadow">
            Loading sell data...
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="grid gap-5 md:grid-cols-2">
              {flocks.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 shadow md:col-span-2">
                  <h2 className="text-2xl font-black">No active flock.</h2>
                  <p className="mt-2 text-gray-500">
                    Buy chicks first from Marketplace.
                  </p>
                </div>
              ) : (
                flocks.map((flock) => {
                  const d = daysOld(flock.created_at);
                  const s = chickenStage(d);

                  return (
                    <button
                      key={flock.id}
                      onClick={() => setSelectedFlockId(flock.id)}
                      className={`rounded-3xl border-4 p-6 text-left shadow-xl ${
                        selectedFlockId === flock.id
                          ? "border-green-700 bg-green-50"
                          : "border-white bg-white"
                      }`}
                    >
                      <h2 className="text-2xl font-black text-green-900">
                        {s}
                      </h2>
                      <p className="mt-1 font-bold text-gray-600">
                        {flock.batch_no} - {flock.breed}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-sm font-bold text-gray-500">Age</p>
                          <h3 className="text-xl font-black">{d} days</h3>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-sm font-bold text-gray-500">
                            Available
                          </p>
                          <h3 className="text-xl font-black">
                            {flock.alive_count}
                          </h3>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <aside className="rounded-3xl border bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-2xl font-black text-green-900">
                Sell Request
              </h2>

              {selectedFlock ? (
                <>
                  <div className="mb-4 rounded-2xl bg-green-50 p-4">
                    <p className="font-black text-green-800">
                      {selectedFlock.batch_no}
                    </p>
                    <p className="font-bold text-gray-700">{stage}</p>
                    <p className="text-sm text-gray-500">
                      Available chickens: {selectedFlock.alive_count}
                    </p>
                  </div>

                  <label className="font-black">Quantity to sell</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedFlock.alive_count}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="mt-2 w-full rounded-2xl border p-4 text-center text-2xl font-black"
                  />

                  <div className="mt-4 rounded-2xl bg-yellow-50 p-4">
                    <p className="font-bold text-gray-500">
                      Price per chicken
                    </p>
                    <h3 className="text-2xl font-black text-green-800">
                      ₱{PRICE_PER_CHICKEN.toLocaleString()}
                    </h3>
                  </div>

                  <div className="mt-4 rounded-2xl bg-green-50 p-4">
                    <p className="font-bold text-gray-500">Projected Sale</p>
                    <h3 className="text-3xl font-black text-green-800">
                      ₱{totalAmount.toLocaleString()}
                    </h3>
                  </div>

                  {!canSell && (
                    <div className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700">
                      Chicken must reach Young Tandang or Mature Tandang stage.
                    </div>
                  )}

                  <button
                    onClick={submitSellRequest}
                    disabled={!canSell || submitting}
                    className="mt-5 w-full rounded-2xl bg-green-700 p-4 font-black text-white disabled:bg-gray-400"
                  >
                    {submitting ? "Submitting..." : "Submit Sell Request"}
                  </button>
                </>
              ) : (
                <p className="text-gray-500">No flock selected.</p>
              )}
            </aside>

            <div className="rounded-3xl border bg-white p-6 shadow-xl lg:col-span-2">
              <h2 className="mb-4 text-2xl font-black text-green-900">
                📋 Sell Request History
              </h2>

              {requests.length === 0 ? (
                <p className="text-gray-500">No sell requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-green-50 text-green-900">
                      <tr>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Batch</th>
                        <th className="p-3 text-left">Stage</th>
                        <th className="p-3 text-left">Qty</th>
                        <th className="p-3 text-left">Amount</th>
                        <th className="p-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-3 font-bold">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">{r.batch_no}</td>
                          <td className="p-3">{r.chicken_stage}</td>
                          <td className="p-3">{r.quantity}</td>
                          <td className="p-3">
                            ₱{Number(r.total_amount || 0).toLocaleString()}
                          </td>
                          <td className="p-3 font-black text-orange-600">
                            {r.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}