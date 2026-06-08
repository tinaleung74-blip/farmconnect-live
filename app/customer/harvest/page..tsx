"use client";

export default function HarvestPage() {
  function sellChicken() {
    alert("Harvest completed! Estimated profit credited to Farm Wallet.");
    window.location.href = "/customer/wallet";
  }

  return (
    <main className="min-h-screen bg-green-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        🐔 Harvest & Earnings
      </h1>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Chick Batch A001</h2>

        <p>Age: 45 Days</p>
        <p>Final Weight: 2.50 KG</p>
        <p>Status: Ready for Harvest</p>

        <hr className="my-4" />

        <p>Chick Cost: ₱120</p>
        <p>Caretaker Fee: ₱100</p>
        <p>Farm Service Cost: ₱80</p>

        <hr className="my-4" />

        <p><b>Total Cost:</b> ₱300</p>
        <p><b>Market Value:</b> ₱850</p>

        <p className="text-green-700 font-bold mt-3">
          Estimated Profit: ₱550
        </p>

        <p><b>ROI:</b> 183%</p>

        <button
          onClick={sellChicken}
          className="mt-6 w-full bg-green-600 text-white p-3 rounded-xl"
        >
          Harvest / Sell Chicken
        </button>
      </div>
    </main>
  );
}