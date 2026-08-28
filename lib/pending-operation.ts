export async function pendingOperation(scope: string, payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  const storageKey = `farmconnect.pending.${scope}`;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    const old = JSON.parse(stored) as { key: string; fingerprint: string };
    if (old.fingerprint !== fingerprint) throw new Error("A previous submission is still unconfirmed. Retry its original details or check your saved history before changing it.");
    return { key: old.key, storageKey };
  }
  const key = crypto.randomUUID();
  localStorage.setItem(storageKey, JSON.stringify({ key, fingerprint }));
  return { key, storageKey };
}
