"use client";

export default function PhotoUpdatesPage() {
  const photos = [
    {
      date: "Day 1",
      chick: "Chick Batch A001",
      image: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7",
    },
    {
      date: "Day 15",
      chick: "Chick Batch A001",
      image: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7",
    },
    {
      date: "Day 45",
      chick: "Mature Chicken A001",
      image: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7",
    },
  ];

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        📸 Chick Growth Photos
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        {photos.map((photo, index) => (
          <div key={index} className="bg-white rounded-2xl shadow overflow-hidden">
            <img src={photo.image} alt={photo.chick} className="w-full h-64 object-cover" />
            <div className="p-4">
              <h2 className="font-bold text-xl">🐣 {photo.chick}</h2>
              <p>Update: {photo.date}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}