"use client";

export default function WeightUpdatesPage() {
  const currentWeight = 0.55;
  const targetWeight = 2.5;

  const progress = Math.round(
    (currentWeight / targetWeight) * 100
  );

  const logs = [
    { day: 1, weight: 0.04 },
    { day: 7, weight: 0.18 },
    { day: 14, weight: 0.42 },
    { day: 15, weight: 0.55 },
  ];

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="bg-green-100 text-green-700 w-fit px-4 py-2 rounded-full text-sm font-black mb-3">
            📈 Poultry Analytics
          </p>

          <h1 className="text-4xl font-black text-gray-900">
            Chick Growth Tracker
          </h1>

          <p className="text-gray-500 mt-2">
            Monitor weight progression, growth performance,
            and harvest readiness.
          </p>
        </div>

        <section className="grid md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">🐣 Active Batch</p>
            <h2 className="text-3xl font-black text-green-700 mt-2">
              A001
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">📈 Current Weight</p>
            <h2 className="text-3xl font-black text-green-700 mt-2">
              {currentWeight} KG
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">🎯 Target Weight</p>
            <h2 className="text-3xl font-black text-green-700 mt-2">
              {targetWeight} KG
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">📅 Age</p>
            <h2 className="text-3xl font-black text-green-700 mt-2">
              15 Days
            </h2>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-6 shadow border border-green-100 mb-8">
          <div className="flex justify-between mb-3">
            <h2 className="text-2xl font-black text-gray-900">
              Growth Progress
            </h2>

            <span className="font-black text-green-700">
              {progress}%
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-5">
            <div
              className="bg-green-600 h-5 rounded-full"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <p className="mt-4 text-green-700 font-black">
            ✅ Growth Status: On Track
          </p>
        </section>

        <section className="bg-white rounded-3xl p-6 shadow border border-green-100">
          <h2 className="text-2xl font-black text-gray-900 mb-5">
            Weight History
          </h2>

          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.day}
                className="flex items-center justify-between border-b pb-3"
              >
                <span className="font-bold">
                  Day {log.day}
                </span>

                <span className="text-green-700 font-black">
                  {log.weight} KG
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-5 mt-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h3 className="text-xl font-black mb-3">
              🐔 Harvest Projection
            </h3>

            <p>Projected Harvest Date</p>
            <p className="font-black text-green-700">
              July 25, 2026
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h3 className="text-xl font-black mb-3">
              💰 Estimated Revenue
            </h3>

            <p className="text-3xl font-black text-green-700">
              ₱12,500
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}