"use client";

import { useEffect } from "react";

export default function HarvestRedirectPage() {
  useEffect(() => {
    window.location.href = "/customer/sell-chicken";
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-black">
        Redirecting to Sell Chicken...
      </h1>
    </main>
  );
}