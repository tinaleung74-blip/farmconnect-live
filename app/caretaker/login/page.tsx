"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CaretakerLoginPage() {
  const [result, setResult] = useState("");

  async function testConnection() {
    const { data, error } = await supabase
      .from("caretakers")
      .select("*");

    console.log(data, error);

    setResult(
      JSON.stringify(
        {
          rows: data,
          error,
        },
        null,
        2
      )
    );
  }

  return (
    <main
      style={{
        padding: 40,
      }}
    >
      <h1>Caretaker Diagnostic</h1>

      <button onClick={testConnection}>
        Test Supabase
      </button>

      <pre
        style={{
          marginTop: 20,
          whiteSpace: "pre-wrap",
        }}
      >
        {result}
      </pre>
    </main>
  );
}