"use client";
import { useSyncExternalStore } from "react";
import { databaseConfigured, databaseProject } from "@/lib/supabase";
const subscribe = () => () => {};
const localSnapshot = () => ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
export function DatabaseTargetBanner() {
  const local = useSyncExternalStore(subscribe, localSnapshot, () => false);
  if (databaseConfigured && !local) return null;
  return <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-950">{!databaseConfigured ? "Database not configured. Set the Supabase environment variables and restart." : `Local preview · database: ${databaseProject}${databaseProject === "bfckjrqrixbtqqvsxgjq" ? " · production writes blocked" : " · verify this is your test project"}`}</div>;
}
