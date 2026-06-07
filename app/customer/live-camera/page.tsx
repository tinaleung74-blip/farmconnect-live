"use client";

export default function LiveCameraPage() {
  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        🎥 Chick Live Camera
      </h1>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold mb-3">
          🐣 Chick Batch A001 Live Feed
        </h2>

        <div className="w-full h-[420px] bg-black rounded-xl flex items-center justify-center text-white text-2xl">
          LIVE CHICK CAMERA PLACEHOLDER
        </div>

        <p className="mt-4 text-gray-700">
          Camera Status: <b className="text-green-700">Online</b>
        </p>

        <p className="text-gray-700">
          Area: Brooder House / Chick Growing Pen
        </p>
      </div>
    </main>
  );
}