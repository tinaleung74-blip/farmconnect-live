"use client";

export default function StorePage() {
  const items = [
    { name: "Starter Feed", price: "₱250" },
    { name: "Grower Feed", price: "₱350" },
    { name: "Finisher Feed", price: "₱450" },
    { name: "Chicken Vitamins", price: "₱120" },
    { name: "Health Booster", price: "₱180" },
    { name: "Water Treatment", price: "₱90" },
  ];

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        🌾 Farm Store
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow p-6"
          >
            <h2 className="text-xl font-bold">
              {item.name}
            </h2>

            <p className="mt-2 font-bold">
              {item.price}
            </p>

            <button className="mt-4 w-full bg-green-600 text-white p-3 rounded-xl">
              Buy
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}