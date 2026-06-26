"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type Flock = {
  id: string;
  batch_no: string;
  breed: string;
  alive_count: number;
  created_at: string;
  status: string;
};

type PriceSetting = {
  id: string;
  price_per_chicken: number;
  technical_fee_rate: number;
  status: string;
  updated_at: string;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [priceSetting, setPriceSetting] = useState<PriceSetting | null>(null);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const selectedFlock = useMemo(
    () => flocks.find((f) => f.id === selectedFlockId),
    [flocks, selectedFlockId]
  );

  const age = selectedFlock ? daysOld(selectedFlock.created_at) : 0;
  const stage = chickenStage(age);

  const pricePerChicken = Number(priceSetting?.price_per_chicken || 0);
  const technicalFeeRate = Number(priceSetting?.technical_fee_rate || 0.02);

  const totalAmount = quantity * pricePerChicken;
  const farmConnectFee = totalAmount * technicalFeeRate;
  const customerNetAmount = totalAmount - farmConnectFee;

  const canSell =
    !!profile &&
    !!priceSetting &&
    pricePerChicken > 0 &&
    !!selectedFlock &&
    age >= 30 &&
    quantity >= 1 &&
    quantity <= Number(selectedFlock.alive_count || 0);

  useEffect(() => {
    loadData();
  }, []);

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Login required.");
      return null;
    }

    const authUser = authData.user;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileById) return profileById as Profile;

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("email", authUser.email)
      .maybeSingle();

    if (profileByEmail) return profileByEmail as Profile;

    setMessage("Login required. Customer profile not found.");
    return null;
  }

  async function loadActivePriceSetting() {
    const { data, error } = await supabase
      .from("sell_chicken_price_settings")
      .select("id,price_per_chicken,technical_fee_rate,status,updated_at")
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setPriceSetting(null);
      setMessage(`Sell price load error: ${error.message}`);
      return null;
    }

    if (!data) {
      setPriceSetting(null);
      setMessage("No active sell chicken price set by admin.");
      return null;
    }

    setPriceSetting(data as PriceSetting);
    return data as PriceSetting;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const [resolvedProfile] = await Promise.all([
      resolveProfile(),
      loadActivePriceSetting(),
    ]);

    setProfile(resolvedProfile);

    if (!resolvedProfile?.id) {
      setFlocks([]);
      setRequests([]);
      setLoading(false);
      return;
    }

    const { data: flockData, error: flockError } = await supabase
      .from("flocks")
      .select("id,batch_no,breed,alive_count,created_at,status")
      .eq("profile_id", resolvedProfile.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    const { data: requestData, error: requestError } = await supabase
      .from("sell_chicken_requests")
      .select("*")
      .eq("profile_id", resolvedProfile.id)
      .order("created_at", { ascending: false });

    if (flockError) {
      setMessage(`Flock load error: ${flockError.message}`);
      setFlocks([]);
    } else {
      setFlocks((flockData || []) as Flock[]);
    }

    if (requestError) {
      setMessage(`Sell history load error: ${requestError.message}`);
      setRequests([]);
    } else {
      setRequests((requestData || []) as SellRequest[]);
    }

    if (flockData && flockData.length > 0 && !selectedFlockId) {
      setSelectedFlockId(flockData[0].id);
    }

    setLoading(false);
  }

  async function submitSellRequest() {
    if (!profile?.id) {
      alert("Login required.");
      return;
    }

    if (!priceSetting) {
      alert("No active sell chicken price set by admin.");
      return;
    }

    if (!selectedFlock) {
      alert("Please select a flock.");
      return;
    }

    if (!canSell) {
      alert("Chicken is not ready or quantity is invalid.");
      return;
    }

    const confirmSubmit = confirm(
      `Submit sell request for ${quantity} chicken(s) at ₱${pricePerChicken.toLocaleString()} each? Chicken count will be reserved immediately while waiting for admin approval.`
    );

    if (!confirmSubmit) return;

    setSubmitting(true);

    const currentAlive = Number(selectedFlock.alive_count || 0);
    const newAliveCount = currentAlive - Number(quantity || 0);

    const { error: reserveError } = await supabase
      .from("flocks")
      .update({
        alive_count: newAliveCount,
        status: newAliveCount <= 0 ? "RESERVED_FOR_SALE" : "ACTIVE",
      })
      .eq("id", selectedFlock.id);

    if (reserveError) {
      alert(reserveError.message);
      setSubmitting(false);
      return;
    }

    const insertPayload: Record<string, any> = {
      profile_id: profile.id,
      flock_id: selectedFlock.id,
      batch_no: selectedFlock.batch_no,
      breed: selectedFlock.breed,
      chicken_stage: stage,
      quantity,
      price_per_chicken: pricePerChicken,
      total_amount: totalAmount,
      status: "PENDING_ADMIN_APPROVAL",
      admin_notes:
        "Chicken count reserved immediately. Waiting for admin approval.",
    };

    const { error: insertError } = await supabase
      .from("sell_chicken_requests")
      .insert(insertPayload);

    if (insertError) {
      await supabase
        .from("flocks")
        .update({
          alive_count: currentAlive,
          status: "ACTIVE",
        })
        .eq("id", selectedFlock.id);

      alert(`${insertError.message}. Reserved chickens were returned.`);
      setSubmitting(false);
      return;
    }

    alert("Sell request submitted. Chickens reserved while waiting for admin approval.");
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
              Submit sell requests. Chicken count is reserved immediately.
            </p>
            {profile && (
              <p className="mt-1 text-sm font-bold text-green-700">
                Customer: {profile.full_name || profile.email || "Profile"}
              </p>
            )}
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-full bg-green-700 px-5 py-3 font-black text-white"
          >
            Back
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-3xl bg-white p-5 font-black text-orange-700 shadow">
            {message}
          </div>
        )}

        {priceSetting && (
          <div className="mb-6 rounded-3xl bg-white p-5 shadow">
            <p className="font-bold text-gray-500">Current Admin Sell Price</p>
            <h2 className="text-3xl font-black text-green-800">
              ₱{pricePerChicken.toLocaleString()} per chicken
            </h2>
            <p className="mt-1 font-bold text-orange-700">
              Technical Fee: {(technicalFeeRate * 100).toLocaleString()}%
            </p>
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center font-black shadow">
            Loading sell data...
          </div>
        ) : !profile ? (
          <div className="rounded-3xl bg-white p-8 text-center font-black text-red-700 shadow">
            Login required.
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
                      Live Price per chicken
                    </p>
                    <h3 className="text-2xl font-black text-green-800">
                      ₱{pricePerChicken.toLocaleString()}
                    </h3>
                  </div>

                  <div className="mt-4 rounded-2xl bg-green-50 p-4">
                    <p className="font-bold text-gray-500">Gross Sale</p>
                    <h3 className="text-3xl font-black text-green-800">
                      ₱{totalAmount.toLocaleString()}
                    </h3>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl bg-orange-50 p-4">
                      <p className="font-bold text-gray-500">
                        FarmConnect Fee
                      </p>
                      <h3 className="text-xl font-black text-orange-700">
                        ₱{farmConnectFee.toLocaleString()}
                      </h3>
                    </div>

                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="font-bold text-gray-500">
                        Net To Wallet After Approval
                      </p>
                      <h3 className="text-xl font-black text-emerald-700">
                        ₱{customerNetAmount.toLocaleString()}
                      </h3>
                    </div>
                  </div>

                  {!canSell && (
                    <div className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700">
                      Login, active admin price, valid quantity, and Young
                      Tandang or Mature Tandang stage are required.
                    </div>
                  )}

                  <button
                    onClick={submitSellRequest}
                    disabled={!canSell || submitting}
                    className="mt-5 w-full rounded-2xl bg-green-700 p-4 font-black text-white disabled:bg-gray-400"
                  >
                    {submitting ? "Submitting..." : "Submit & Reserve Chicken"}
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
                        <th className="p-3 text-left">Price</th>
                        <th className="p-3 text-left">Gross</th>
                        <th className="p-3 text-left">Net</th>
                        <th className="p-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => {
                        const gross = Number(r.total_amount || 0);
                        const net = gross - gross * technicalFeeRate;

                        return (
                          <tr key={r.id} className="border-t">
                            <td className="p-3 font-bold">
                              {new Date(r.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3">{r.batch_no}</td>
                            <td className="p-3">{r.chicken_stage}</td>
                            <td className="p-3">{r.quantity}</td>
                            <td className="p-3">
                              ₱{Number(r.price_per_chicken || 0).toLocaleString()}
                            </td>
                            <td className="p-3">
                              ₱{gross.toLocaleString()}
                            </td>
                            <td className="p-3 font-black text-green-700">
                              ₱{net.toLocaleString()}
                            </td>
                            <td className="p-3 font-black text-orange-600">
                              {r.status}
                            </td>
                          </tr>
                        );
                      })}
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