"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MyAnimal = {
  id: string;
  animals: {
    name: string;
    type: string;
    code: string;
    current_weight: number;
    target_weight: number;
  };
};

export default function WeightUpdatesPage() {
  const [items, setItems] = useState<MyAnimal[]>([]);

  useEffect(() => {
    loadMyAnimals();
  }, []);

  async function loadMyAnimals() {
    const savedUser = localStorage.getItem("farmconnect_user");
    if (!savedUser) {
      window.location.href = "/customer/login";
      return;
    }

    const user = JSON.parse(savedUser);

    const { data, error } = await supabase
      .from("customer_animals")
      .select(`
        id,
        animals (
          name,
          type,
          code,
          current_weight,
          target_weight
        )
      `)
      .eq("customer_id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    setItems((data || []) as MyAnimal[]);
  }

  return (
    <main className="min-h-screen bg-green-50 p-10">
      <h1 className="text-4xl font-bold text-green-700 mb-8">
        ⚖️ Daily Weight Updates
      </h1>

      <div className="grid gap-6">
        {items.map((item) => {
          const current = item.animals.current_weight;
          const target = item.animals.target_weight;
          const progress = Math.min(Math.round((current / target) * 100), 100);

          return (
            <div key={item.id} className="bg-white p-6 rounded-2xl shadow">
              <h2 className="text-3xl font-bold">
                {item.animals.type === "Cow" && "🐄"}
                {item.animals.type === "Swine" && "🐖"}
                {item.animals.type === "Chicken" && "🐔"} {item.animals.name}
              </h2>

              <p>Code: {item.animals.code}</p>
              <p>Current Weight: {current} KG</p>
              <p>Target Weight: {target} KG</p>
              <p>Progress: {progress}%</p>

              <div className="w-full bg-gray-200 rounded-full h-4 mt-3">
                <div
                  className="bg-green-600 h-4 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}