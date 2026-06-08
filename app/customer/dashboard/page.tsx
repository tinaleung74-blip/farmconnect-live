"use client";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-green-50 p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-green-700">
          🚜 FarmConnect Dashboard
        </h1>

        <p className="mt-4 text-lg">Welcome to FarmConnect Live</p>

        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <a href="/customer/chicks" className="bg-white p-6 rounded-xl shadow block">
            🐣 My Flock
          </a>

          <a href="/customer/marketplace" className="bg-white p-6 rounded-xl shadow block">
            🐣 Chick Marketplace
          </a>

          <a href="/customer/store" className="bg-white p-6 rounded-xl shadow block">
            🌾 Feed & Vitamins Store
          </a>

          <a href="/customer/weight-updates" className="bg-white p-6 rounded-xl shadow block">
            📈 Chick Growth Tracker
          </a>

          <a href="/customer/photo-updates" className="bg-white p-6 rounded-xl shadow block">
            📸 Chick Growth Photos
          </a>

          <a href="/customer/live-camera" className="bg-white p-6 rounded-xl shadow block">
            📹 Chick House Live
          </a>

          <a href="/customer/wallet" className="bg-white p-6 rounded-xl shadow block">
            💰 Farm Wallet
          </a>

          <a href="/customer/harvest" className="bg-white p-6 rounded-xl shadow block">
            🐔 Harvest / Earnings
          </a>

          <a href="/customer/notifications" className="bg-white p-6 rounded-xl shadow block">
            🔔 Farm Alerts
          </a>
        </div>
      </div>
    </main>
  );
}