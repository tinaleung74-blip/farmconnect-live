"use client";

export default function NotificationsPage() {
  const notifications = [
    {
      title: "Growth Update",
      message: "Your chick gained 0.05 KG today.",
      date: "2026-06-07",
    },
    {
      title: "Feed Applied",
      message: "Starter feed completed for Chick Batch A001.",
      date: "2026-06-07",
    },
    {
      title: "Photo Uploaded",
      message: "New chick growth photo is available.",
      date: "2026-06-07",
    },
  ];

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        🔔 Notifications
      </h1>

      <div className="space-y-4">
        {notifications.map((item, index) => (
          <div key={index} className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-bold text-xl">{item.title}</h2>
            <p className="mt-2">{item.message}</p>
            <p className="text-gray-500 mt-2">{item.date}</p>
          </div>
        ))}
      </div>
    </main>
  );
}