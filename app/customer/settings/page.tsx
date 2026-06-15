"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState(true);
  const [farmAlerts, setFarmAlerts] = useState(true);
  const [sellAlerts, setSellAlerts] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem("farmconnect_user");
    if (user) setProfile(JSON.parse(user));
  }, []);

  function saveSettings() {
    alert("Settings saved.");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-lime-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-green-900">
              ⚙️ Customer Settings
            </h1>
            <p className="font-semibold text-green-700">
              Manage your FarmConnect profile and preferences.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-full bg-green-700 px-5 py-3 font-black text-white"
          >
            Back
          </Link>
        </div>

        <section className="grid gap-5">
          <div className="rounded-3xl border bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-black text-green-900">
              👤 Profile
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm font-bold text-gray-500">Full Name</p>
                <h3 className="text-xl font-black">
                  {profile?.full_name || "Customer"}
                </h3>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm font-bold text-gray-500">Email</p>
                <h3 className="text-xl font-black">
                  {profile?.email || "No email"}
                </h3>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm font-bold text-gray-500">Account Type</p>
                <h3 className="text-xl font-black">Poultry Owner</h3>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm font-bold text-gray-500">Platform</p>
                <h3 className="text-xl font-black">FarmConnect Live</h3>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-black text-green-900">
              🔔 Notification Preferences
            </h2>

            {[
              ["App Notifications", notifications, setNotifications],
              ["Farm Risk Alerts", farmAlerts, setFarmAlerts],
              ["Sell Chicken Alerts", sellAlerts, setSellAlerts],
            ].map(([label, value, setter]: any) => (
              <div
                key={label}
                className="mb-3 flex items-center justify-between rounded-2xl bg-gray-50 p-4"
              >
                <p className="font-black text-gray-800">{label}</p>
                <button
                  onClick={() => setter(!value)}
                  className={`rounded-full px-5 py-2 font-black text-white ${
                    value ? "bg-green-700" : "bg-gray-400"
                  }`}
                >
                  {value ? "ON" : "OFF"}
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-black text-green-900">
              🐓 Poultry Preferences
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-green-50 p-4">
                <p className="text-sm font-bold text-gray-500">Default View</p>
                <h3 className="text-xl font-black text-green-900">My Flock</h3>
              </div>

              <div className="rounded-2xl bg-yellow-50 p-4">
                <p className="text-sm font-bold text-gray-500">Selling Mode</p>
                <h3 className="text-xl font-black text-green-900">
                  Per Chicken
                </h3>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-bold text-gray-500">Growth Label</p>
                <h3 className="text-xl font-black text-green-900">
                  Chick to Tandang
                </h3>
              </div>

              <div className="rounded-2xl bg-purple-50 p-4">
                <p className="text-sm font-bold text-gray-500">Support Mode</p>
                <h3 className="text-xl font-black text-green-900">
                  AI + Admin
                </h3>
              </div>
            </div>
          </div>

          <button
            onClick={saveSettings}
            className="rounded-2xl bg-green-700 p-4 font-black text-white shadow-xl"
          >
            Save Settings
          </button>
        </section>
      </div>
    </main>
  );
}