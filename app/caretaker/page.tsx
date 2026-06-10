"use client";

import Link from "next/link";

export default function CaretakerPortalPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-100 to-white p-8">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-5xl font-bold text-yellow-700 mb-4">
          Caretaker Portal
        </h1>

        <p className="text-gray-600 mb-8">
          Farm operations, feeding schedules,
          mortality monitoring and reporting.
        </p>

        <Link
          href="/caretaker/login"
          className="inline-block bg-yellow-600 text-white px-6 py-3 rounded-xl mb-8"
        >
          Caretaker Login
        </Link>

        <div className="grid md:grid-cols-3 gap-6">

          <Link href="/caretaker/dashboard" className="bg-white p-6 rounded-2xl shadow">
            🏠 Dashboard
          </Link>

          <Link href="/caretaker/feeding" className="bg-white p-6 rounded-2xl shadow">
            🌽 Feeding Logs
          </Link>

          <Link href="/caretaker/mortality" className="bg-white p-6 rounded-2xl shadow">
            ☠️ Mortality Logs
          </Link>

          <Link href="/caretaker/weight" className="bg-white p-6 rounded-2xl shadow">
            ⚖️ Weight Logs
          </Link>

          <Link href="/caretaker/photos" className="bg-white p-6 rounded-2xl shadow">
            📸 Photo Logs
          </Link>

          <Link href="/caretaker/notes" className="bg-white p-6 rounded-2xl shadow">
            📝 Notes
          </Link>

        </div>
      </div>
    </main>
  );
}