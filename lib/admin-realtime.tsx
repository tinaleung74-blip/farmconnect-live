"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AdminRealtimeState = "connecting" | "connected" | "reconnecting" | "offline";

type Options = {
  tables: string[];
  refresh: () => void | Promise<void>;
  pollMs?: number;
};

export function useAdminRealtime({ tables, refresh, pollMs = 45_000 }: Options) {
  const refreshRef = useRef(refresh);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const [state, setState] = useState<AdminRealtimeState>("connecting");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [notice, setNotice] = useState("Connecting to live Admin updates...");
  const tableSignature = tables.join("|");

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const subscribedTables = tableSignature.split("|").filter(Boolean);
    const channelName = `admin-live-${subscribedTables.join("-").replace(/[^a-z0-9-]/gi, "").slice(0, 70)}-${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase.channel(channelName);

    const sync = async (message?: string) => {
      try {
        await refreshRef.current();
        if (!active) return;
        setLastSync(new Date());
        if (message) setNotice(message);
      } catch {
        if (!active) return;
        setState("reconnecting");
        setNotice("Live update could not refresh. Safety polling will retry automatically.");
      }
    };

    const scheduleEventSync = (table: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const label = table.replaceAll("_", " ");
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
          new Notification("FarmConnect Admin update", { body: `New ${label} activity is waiting.` });
        }
        try {
          const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            const context = new AudioContextClass();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = 660;
            gain.gain.setValueAtTime(0.035, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.16);
            oscillator.addEventListener("ended", () => void context.close());
          }
        } catch {
          // Browsers may block sound until the Admin has interacted with the page.
        }
        void sync(`New ${label} activity received. Queue refreshed.`);
      }, 500);
    };

    for (const table of subscribedTables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleEventSync(table),
      );
    }

    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        setState("connected");
        setNotice("Live updates connected. New work appears automatically.");
        if (initializedRef.current) void sync("Connection restored. Missed queue changes reconciled.");
        initializedRef.current = true;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setState("reconnecting");
        setNotice("Realtime is reconnecting. Safety polling remains active.");
      } else if (status === "CLOSED") {
        setState(navigator.onLine ? "reconnecting" : "offline");
        setNotice(navigator.onLine ? "Realtime disconnected. Safety polling remains active." : "Device is offline. Queues will sync when connection returns.");
      }
    });

    const poll = window.setInterval(() => void sync(), pollMs);
    const onFocus = () => void sync("Admin queue reconciled after returning to this page.");
    const onOnline = () => {
      setState("reconnecting");
      void sync("Internet restored. Reconciling Admin queues...");
    };
    const onOffline = () => {
      setState("offline");
      setNotice("Device is offline. No decision was lost; queues will sync after reconnection.");
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void supabase.removeChannel(channel);
    };
  }, [pollMs, tableSignature]);

  return { state, lastSync, notice };
}

export function AdminRealtimeStatus({ state, lastSync, notice }: ReturnType<typeof useAdminRealtime>) {
  const connected = state === "connected";
  const offline = state === "offline";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-900" : offline ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : offline ? "bg-red-500" : "animate-pulse bg-amber-500"}`} />{connected ? "LIVE" : offline ? "OFFLINE" : "RECONNECTING"}</span>
        <span className="text-xs opacity-75">45-second safety sync{lastSync ? ` / last ${lastSync.toLocaleTimeString()}` : ""}</span>
      </div>
      <p className="mt-1 text-xs">{notice}</p>
    </div>
  );
}
