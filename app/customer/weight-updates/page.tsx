"use client";

export default function WeightUpdatesPage() {
  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        📈 Chick Growth Tracker
      </h1>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold">🐣 Chick Batch A001</h2>

        <p>Age: 15 Days</p>
        <p>Current Weight: 0.55 KG</p>
        <p>Target Weight: 2.50 KG</p>
        <p>Status: Growing</p>

        <p className="mt-4 font-bold">Growth Progress: 22%</p>

        <div className="w-full bg-gray-200 rounded-full h-4 mt-3">
          <div
            className="bg-green-600 h-4 rounded-full"
            style={{ width: "22%" }}
          />
        </div>
      </div>
    </main>
  );
} 