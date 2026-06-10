"use client";

import Link from "next/link";

export default function CustomerPortalPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-100 to-white p-8">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-5xl font-bold text-green-700 mb-4">
          Customer Portal
        </h1>

        <p className="text-gray-600 mb-8">
          Manage investments, flock monitoring,
          harvest tracking and wallet activities.
        </p>

        <Link
          href="/customer/login"
          className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl mb-8"
        >
          Customer Login
        </Link>

        <div className="grid md:grid-cols-3 gap-6">

          <Link href="/customer/dashboard" className="bg-white p-6 rounded-2xl shadow">
            🏠 Dashboard
          </Link>

          <Link href="/customer/chicks" className="bg-white p-6 rounded-2xl shadow">
            🐣 My Flock
          </Link>

          <Link href="/customer/marketplace" className="bg-white p-6 rounded-2xl shadow">
            🛒 Marketplace
          </Link>

          <Link href="/customer/inventory" className="bg-white p-6 rounded-2xl shadow">
            📦 Inventory
          </Link>

          <Link href="/customer/wallet" className="bg-white p-6 rounded-2xl shadow">
            💰 Wallet
          </Link>

          <Link href="/customer/harvest" className="bg-white p-6 rounded-2xl shadow">
            🌾 Harvest
          </Link>

          <Link href="/customer/weight-updates" className="bg-white p-6 rounded-2xl shadow">
            📈 Weight Updates
          </Link>

          <Link href="/customer/photo-updates" className="bg-white p-6 rounded-2xl shadow">
            📸 Photo Updates
          </Link>

          <Link href="/customer/notifications" className="bg-white p-6 rounded-2xl shadow">
            🔔 Notifications
          </Link>

        </div>
      </div>
    </main>
  );
}