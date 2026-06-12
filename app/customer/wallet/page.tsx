"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function WalletPage() {
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const transactions = [
    { title: "Chick Batch A001 Purchase", amount: "-₱120", date: "2026-06-07" },
    { title: "Caretaker Service Fee", amount: "-₱100", date: "2026-06-07" },
    { title: "Estimated Harvest Profit", amount: "+₱330", date: "Pending" },
  ];

  useEffect(() => {
    loadWallet();
  }, []);

  function formatPeso(amount: number) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  }

  async function loadWallet() {
    setLoading(true);

    const savedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("farmconnect_user")
        : null;

    if (!savedUser) {
      setWalletBalance(0);
      setLoading(false);
      return;
    }

    const user = JSON.parse(savedUser);

    const { data, error } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("email", user.email)
      .single();

    if (error) {
      console.error("Wallet load error:", error);
      setWalletBalance(0);
    } else {
      setWalletBalance(Number(data?.wallet_balance || 0));
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="bg-green-100 text-green-700 w-fit px-4 py-2 rounded-full text-sm font-black mb-3">
              💰 Farm Payment Center
            </p>

            <h1 className="text-4xl font-black text-gray-900">Farm Wallet</h1>

            <p className="text-gray-500 mt-2">
              Track earnings, marketplace expenses, and future GCash/Maya cash-in.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="bg-white border border-green-100 px-5 py-3 rounded-2xl font-black text-green-700 shadow"
          >
            ← Dashboard
          </Link>
        </div>

        <section className="grid md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Available Balance</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {loading ? "Loading..." : formatPeso(walletBalance)}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">GCash</p>
            <h2 className="text-xl font-black text-orange-500 mt-2">
              Pending Approval
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Maya</p>
            <h2 className="text-xl font-black text-orange-500 mt-2">
              Pending Approval
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Harvest Earnings</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">₱0.00</h2>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              Payment Channels
            </h2>

            <div className="grid gap-4">
              <div className="border border-green-100 rounded-2xl p-5">
                <h3 className="text-xl font-black text-gray-900">GCash</h3>
                <p className="text-gray-500 mt-1">
                  Real GCash cash-in will be enabled after merchant approval.
                </p>
              </div>

              <div className="border border-green-100 rounded-2xl p-5">
                <h3 className="text-xl font-black text-gray-900">Maya</h3>
                <p className="text-gray-500 mt-1">
                  Real Maya cash-in will be enabled after merchant approval.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              Transaction History
            </h2>

            <div className="space-y-3">
              {transactions.map((tx, index) => (
                <div
                  key={index}
                  className="border border-green-100 rounded-2xl p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-black text-gray-900">{tx.title}</p>
                      <p className="text-sm text-gray-500">{tx.date}</p>
                    </div>

                    <p
                      className={`font-black ${
                        tx.amount.startsWith("+")
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {tx.amount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}