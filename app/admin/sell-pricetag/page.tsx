"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PriceSetting = {
  id: string;
  price_per_chicken: number;
  technical_fee_rate: number;
  status: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminSellPricePage() {
  const [setting, setSetting] = useState<PriceSetting | null>(null);
  const [price, setPrice] = useState("");
  const [feeRate, setFeeRate] = useState("2");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSetting();
  }, []);

  async function loadSetting() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("sell_chicken_price_settings")
      .select("*")
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(`Price setting load error: ${error.message}`);
      setSetting(null);
      setLoading(false);
      return;
    }

    if (data) {
      setSetting(data as PriceSetting);
      setPrice(String(data.price_per_chicken || ""));
      setFeeRate(String(Number(data.technical_fee_rate || 0.02) * 100));
    }

    setLoading(false);
  }

  async function saveSetting(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedPrice = Number(price);
    const parsedFeePercent = Number(feeRate);
    const technicalFeeRate = parsedFeePercent / 100;

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setMessage("Enter a valid sell price.");
      setSaving(false);
      return;
    }

    if (
      !Number.isFinite(parsedFeePercent) ||
      parsedFeePercent < 0 ||
      parsedFeePercent > 100
    ) {
      setMessage("Enter a valid technical fee percent.");
      setSaving(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const adminUserId = authData.user?.id || null;

    const { error: deactivateError } = await supabase
      .from("sell_chicken_price_settings")
      .update({
        status: "INACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "ACTIVE");

    if (deactivateError) {
      setMessage(`Deactivate old price error: ${deactivateError.message}`);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("sell_chicken_price_settings")
      .insert({
        price_per_chicken: parsedPrice,
        technical_fee_rate: technicalFeeRate,
        status: "ACTIVE",
        updated_by: adminUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      setMessage(`Save price error: ${insertError.message}`);
      setSaving(false);
      return;
    }

    setMessage("✅ Sell chicken price updated.");
    await loadSetting();
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-black text-green-900">
              🐓 Sell Chicken Price
            </h1>
            <p className="font-semibold text-green-700">
              Admin-controlled live sell price used by customer sell requests.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-full bg-green-700 px-5 py-3 font-black text-white"
          >
            Back Admin
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-3xl bg-white p-5 font-black text-green-700 shadow">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center font-black shadow">
            Loading price setting...
          </div>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <form
              onSubmit={saveSetting}
              className="rounded-3xl bg-white p-6 shadow-xl"
            >
              <h2 className="mb-5 text-2xl font-black text-green-900">
                Update Live Sell Price
              </h2>

              <label className="font-black">Price Per Chicken</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-2 w-full rounded-2xl border p-4 text-2xl font-black"
                placeholder="Example: 350"
                required
              />

              <label className="mt-5 block font-black">
                Technical Fee Percent
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={feeRate}
                onChange={(e) => setFeeRate(e.target.value)}
                className="mt-2 w-full rounded-2xl border p-4 text-2xl font-black"
                placeholder="Example: 2"
                required
              />

              <button
                disabled={saving}
                className="mt-6 w-full rounded-2xl bg-green-700 p-4 font-black text-white disabled:bg-gray-400"
              >
                {saving ? "Saving..." : "Save Live Price"}
              </button>
            </form>

            <aside className="rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-2xl font-black text-green-900">
                Active Price
              </h2>

              {setting ? (
                <>
                  <div className="mt-5 rounded-2xl bg-green-50 p-5">
                    <p className="font-bold text-gray-500">
                      Price Per Chicken
                    </p>
                    <h3 className="text-4xl font-black text-green-800">
                      ₱
                      {Number(setting.price_per_chicken || 0).toLocaleString()}
                    </h3>
                  </div>

                  <div className="mt-4 rounded-2xl bg-orange-50 p-5">
                    <p className="font-bold text-gray-500">Technical Fee</p>
                    <h3 className="text-3xl font-black text-orange-700">
                      {Number(setting.technical_fee_rate * 100).toLocaleString()}%
                    </h3>
                  </div>

                  <p className="mt-4 text-sm font-bold text-gray-500">
                    Last Updated: {formatDate(setting.updated_at)}
                  </p>
                </>
              ) : (
                <p className="mt-4 font-bold text-gray-500">
                  No active price setting found.
                </p>
              )}
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}