"use client";

export default function CaretakersPage() {
  const caretakers = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `Caretaker ${i + 1}`,
    rating: (4.5 + Math.random() * 0.5).toFixed(1),
    experience: `${1 + i} Years`,
  }));

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        👨‍🌾 Choose Your Caretaker
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        {caretakers.map((caretaker) => (
          <div
            key={caretaker.id}
            className="bg-white rounded-2xl shadow p-6"
          >
            <div className="text-5xl mb-3">👨‍🌾</div>

            <h2 className="text-xl font-bold">
              {caretaker.name}
            </h2>

            <p>⭐ Rating: {caretaker.rating}</p>
            <p>📅 Experience: {caretaker.experience}</p>

            <button
              className="mt-4 w-full bg-green-600 text-white p-3 rounded-xl"
              onClick={() =>
                alert(
                  `${caretaker.name} assigned successfully!`
                )
              }
            >
              Assign Caretaker
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}