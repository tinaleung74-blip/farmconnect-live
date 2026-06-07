"use client";

export default function WalletPage() {
  const transactions = [
    { title: "Wallet Top-up", amount: "₱5,000", date: "2026-06-07" },
    { title: "Chick Batch A001 Purchase", amount: "-₱120", date: "2026-06-07" },
    { title: "Caretaker Service Fee", amount: "-₱100", date: "2026-06-07" },
    { title: "Estimated Harvest Profit", amount: "+₱330", date: "Pending" },
  ];

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        💰 Farm Wallet
      </h1>

      <div className="bg-white p-6 rounded-2xl shadow mb-6">
        <p className="text-gray-600">Available Balance</p>
        <h2 className="text-4xl font-bold text-green-700">₱5,000.00</h2>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow">
        <h2 className="text-xl font-bold mb-4">
          Transaction History
        </h2>

        {transactions.map((tx, index) => (
          <div key={index} className="border-b py-3">
            <p className="font-bold">{tx.title}</p>
            <p>{tx.amount}</p>
            <p className="text-gray-500">{tx.date}</p>
          </div>
        ))}
      </div>
    </main>
  );
}