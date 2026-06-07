"use client";

export default function ChickMarketplacePage() {
  const chicks = [
    {
      code: "CHICK-A001",
      age: "1 Day",
      weight: "0.04 KG",
      target: "2.5 KG",
      harvest: "45 Days",
      price: "₱120",
    },
    {
      code: "CHICK-A002",
      age: "3 Days",
      weight: "0.08 KG",
      target: "2.5 KG",
      harvest: "42 Days",
      price: "₱120",
    },
    {
      code: "CHICK-A003",
      age: "7 Days",
      weight: "0.15 KG",
      target: "2.5 KG",
      harvest: "38 Days",
      price: "₱150",
    },
  ];

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        🐣 Chick Marketplace
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        {chicks.map((chick) => (
          <div key={chick.code} className="bg-white rounded-2xl shadow p-6">
            <div className="text-5xl mb-3">🐣</div>

            <h2 className="text-xl font-bold">{chick.code}</h2>

            <p>Age: {chick.age}</p>
            <p>Current Weight: {chick.weight}</p>
            <p>Target Weight: {chick.target}</p>
            <p>Harvest In: {chick.harvest}</p>

            <p className="font-bold mt-3">Price: {chick.price}</p>

            <button
              className="mt-4 w-full bg-green-600 text-white p-3 rounded-xl"
              onClick={() => alert(`${chick.code} selected successfully!`)}
            >
              Buy Chick
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}