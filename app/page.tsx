export default function Home() {
  return (
    <main className="min-h-screen bg-green-50 p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-green-700">
          🚜 FarmConnect Live
        </h1>

        <p className="mt-4 text-xl text-gray-700">
          Raise real chicks online. Watch them grow into harvest-ready chickens.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-10">
          <div className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-2xl font-bold">🐣 Buy Chicks</h2>
            <p>Choose chick batches and start your online farm journey.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-2xl font-bold">👨‍🌾 Assign Caretaker</h2>
            <p>Select caretakers who will manage feeding and growth.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-2xl font-bold">🐔 Harvest & Earn</h2>
            <p>Track progress until your chicks become harvest-ready chickens.</p>
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          <a
            href="/customer/register"
            className="bg-green-600 text-white px-6 py-3 rounded-xl"
          >
            Register
          </a>

          <a
            href="/customer/login"
            className="bg-gray-800 text-white px-6 py-3 rounded-xl"
          >
            Login
          </a>
        </div>
      </div>
    </main>
  );
}