"use client";

import { useEffect, useState } from "react";

export default function MyFlockPage() {
  const [caretaker, setCaretaker] = useState("No caretaker assigned yet");

  useEffect(() => {
    const savedCaretaker = localStorage.getItem("assigned_caretaker");
    if (savedCaretaker) {
      setCaretaker(savedCaretaker);
    }
  }, []);

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-4xl font-bold text-green-700 mb-8">
        🐣 My Flock
      </h1>

      <div className="bg-white rounded-2xl shadow p-8">
        <h2 className="text-3xl font-bold mb-4">
          🐣 Chick Batch A001
        </h2>

        <p>Age: <b>15 Days</b></p>
        <p>Status: <b className="text-green-700">Growing</b></p>
        <p>Current Weight: <b>0.55 KG</b></p>
        <p>Target Weight: <b>2.50 KG</b></p>

        <div className="mt-5 bg-green-50 p-4 rounded-xl">
          <p className="font-bold">Assigned Caretaker:</p>
          <p className="text-green-700 font-bold text-xl">
            👨‍🌾 {caretaker}
          </p>
        </div>

        <div className="mt-6">
          <a
            href="/customer/caretakers"
            className="bg-green-600 text-white p-4 rounded-xl text-center font-bold block"
          >
            👨‍🌾 Assign Caretaker
          </a>
        </div>
      </div>
    </main>
  );
}