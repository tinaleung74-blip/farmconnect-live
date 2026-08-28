import { createClient } from "@supabase/supabase-js";
import { getKaFarmReply } from "@/lib/kafarm-brain";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: "Sign in first." }, 401);
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!projectUrl || !anonKey || !serviceKey) return json({ error: "Automatic replies are unavailable." }, 503);
  try {
    // Same accident-prevention rule as the browser client; never a permission boundary.
    if (["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
      && new URL(projectUrl).hostname === "bfckjrqrixbtqqvsxgjq.supabase.co") {
      return json({ error: "Use an isolated database for local tests." }, 403);
    }
    const input = await request.json().catch(() => null);
    if (!input || typeof input.operationKey !== "string" || !uuid.test(input.operationKey)
      || Object.keys(input).some(key => key !== "operationKey")) return json({ error: "Invalid request." }, 400);
    const auth = createClient(projectUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const user = await auth.auth.getUser(token);
    if (user.error || !user.data.user) return json({ error: "Sign in first." }, 401);
    const service = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const saved = await service.from("support_delivery_operations").select("request,reply_message_id")
      .eq("user_id", user.data.user.id).eq("operation_key", input.operationKey).maybeSingle();
    if (saved.error) return json({ error: "Automatic reply could not be loaded." }, 503);
    if (!saved.data) return json({ error: "Message receipt not found." }, 404);
    if (saved.data.reply_message_id) return json({ state: "saved" });
    const { role, body, escalate } = saved.data.request;
    if (!["customer", "caretaker"].includes(role) || typeof body !== "string") return json({ error: "Invalid receipt." }, 409);
    if (escalate) return json({ state: "skipped" });
    // The browser supplies only a receipt key, never reply text, actor, or role.
    const reply = getKaFarmReply(body, role);
    const result = await service.rpc("support_save_trusted_reply", {
      p_actor: user.data.user.id, p_key: input.operationKey, p_body: reply,
    });
    if (result.error) return json({ error: "Automatic reply could not be saved." }, 503);
    return json({ state: result.data ? "saved" : "skipped" });
  } catch {
    return json({ error: "Automatic replies are unavailable." }, 503);
  }
}
