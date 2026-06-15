"use client";

import Link from "next/link";
import { useState } from "react";

type Message = {
  role: "customer" | "ai";
  text: string;
};

export default function CustomerServicePage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Hello! I am FarmConnect AI Assistant. How can I help you today?",
    },
  ]);

  function sendMessage() {
    if (!input.trim()) return;

    const question = input.trim();
    const lower = question.toLowerCase();

    let reply =
      "I understand. Please provide your batch number, transaction reference, or screenshot if available. I can help guide your request before it goes to FarmConnect Admin Support.";

    if (
      lower.includes("cash in") ||
      lower.includes("cash-in") ||
      lower.includes("gcash") ||
      lower.includes("maya")
    ) {
      reply =
        "For cash-in, go to Wallet, choose GCash or Maya, send payment to the FarmConnect number shown, enter the amount and reference number, then submit. Admin will verify and credit your wallet.";
    }

    if (
      lower.includes("cash out") ||
      lower.includes("cash-out") ||
      lower.includes("withdraw")
    ) {
      reply =
        "For cash-out, go to Wallet, enter your GCash or Maya payout details and amount. A 2% technical fee applies. Admin will process the payout after verification.";
    }

    if (lower.includes("inventory") || lower.includes("feed")) {
      reply =
        "Marketplace supplies should sync to your Inventory after checkout. Please check the selected flock and remaining quantity.";
    }

    if (
      lower.includes("sell") ||
      lower.includes("chicken") ||
      lower.includes("tandang")
    ) {
      reply =
        "For selling chickens, use the Sell Chicken module. Select a mature flock, enter quantity, and submit a sell request for admin approval.";
    }

    if (lower.includes("wallet") || lower.includes("payment")) {
      reply =
        "Wallet records show cash-ins, cash-outs, marketplace purchases, and approved chicken sale earnings. Pending transactions require admin approval.";
    }

    if (lower.includes("photo") || lower.includes("weight")) {
      reply =
        "Weight and photo updates are shown from farm records once connected to your flock. Check Weight Tracker or Photo Updates.";
    }

    setMessages((prev) => [
      ...prev,
      { role: "customer", text: question },
      { role: "ai", text: reply },
    ]);

    setInput("");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-lime-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-green-900">
              🤖 FarmConnect AI Assistant
            </h1>
            <p className="font-semibold text-green-700">
              Ask help about flock, inventory, wallet, selling, and farm updates.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-full bg-green-700 px-5 py-3 font-black text-white"
          >
            Back
          </Link>
        </div>

        <section className="rounded-3xl border bg-white p-5 shadow-xl">
          <div className="mb-5 h-[520px] overflow-y-auto rounded-3xl bg-gray-50 p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-3 flex ${
                  msg.role === "customer" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-3xl p-4 font-semibold ${
                    msg.role === "customer"
                      ? "bg-green-700 text-white"
                      : "bg-white text-gray-800 shadow"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask FarmConnect AI..."
              className="w-full rounded-2xl border p-4 font-bold"
            />

            <button
              onClick={sendMessage}
              className="rounded-2xl bg-green-700 px-6 font-black text-white"
            >
              Send
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}