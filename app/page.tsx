"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-100 via-white to-blue-100 p-8">
      <div className="max-w-7xl mx-auto">

        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-green-700">
            FarmConnect Live
          </h1>

          <p className="text-gray-600 mt-4 text-xl">
            Professional Livestock Investment Platform
          </p>

          <p className="text-gray-500 mt-2">
            Customer • Caretaker • Admin
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">

          {/* CUSTOMER */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border">
            <div className="text-6xl mb-4">🐣</div>

            <h2 className="text-2xl font-bold mb-4">
              Customer Portal
            </h2>

            <p className="text-gray-600 mb-6">
              Invest in livestock, monitor flock growth,
              harvest reports and earnings.
            </p>

            <div className="bg-green-50 rounded-xl p-4 mb-6">
              <div className="font-semibold">
                Demo Credentials
              </div>

              <div className="text-sm mt-2">
                Email: customer@demo.com
              </div>

              <div className="text-sm">
                Password: 123456
              </div>
            </div>

            <Link
              href="/customer/login"
              className="block text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
            >
              Open Customer Portal
            </Link>
          </div>

          {/* CARETAKER */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border">
            <div className="text-6xl mb-4">👨‍🌾</div>

            <h2 className="text-2xl font-bold mb-4">
              Caretaker Portal
            </h2>

            <p className="text-gray-600 mb-6">
              Feeding logs, mortality reports,
              weight updates and farm operations.
            </p>

            <div className="bg-yellow-50 rounded-xl p-4 mb-6">
              <div className="font-semibold">
                Demo Credentials
              </div>

              <div className="text-sm mt-2">
                Email: caretaker@demo.com
              </div>

              <div className="text-sm">
                Password: 123456
              </div>
            </div>

            <Link
              href="/caretaker/login"
              className="block text-center bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-xl"
            >
              Open Caretaker Portal
            </Link>
          </div>

          {/* ADMIN */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border">
            <div className="text-6xl mb-4">🏢</div>

            <h2 className="text-2xl font-bold mb-4">
              Admin Portal
            </h2>

            <p className="text-gray-600 mb-6">
              Executive dashboard, treasury,
              risk management and reports.
            </p>

            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <div className="font-semibold">
                Demo Credentials
              </div>

              <div className="text-sm mt-2">
                Email: admin@demo.com
              </div>

              <div className="text-sm">
                Password: 123456
              </div>
            </div>

            <Link
              href="/admin"
              className="block text-center bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl"
            >
              Open Admin Portal
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}