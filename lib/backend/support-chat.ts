import { supabase } from "@/lib/supabase";

export type SupportRole = "customer" | "caretaker";
export type AdminSupportAction = "join" | "reply" | "end" | "complete";

export async function getSupportMessages(sessionId: string) {
  return supabase
    .from("support_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
}

export async function getSupportSessionStatus(sessionId: string) {
  return supabase
    .from("support_chat_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();
}

export async function getLatestSupportSessionId() {
  return supabase
    .from("support_chat_sessions")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function sendSupportMessage({
  role,
  sessionId,
  body,
  forceEscalate = false,
}: {
  role: SupportRole;
  sessionId?: string | null;
  body: string;
  forceEscalate?: boolean;
}) {
  const functionName = role === "customer" ? "customer_support_send_message" : "caretaker_support_send_message";
  return supabase.rpc(functionName, {
    p_session_id: sessionId || null,
    p_body: body,
    p_force_escalate: forceEscalate,
  });
}

export async function saveKaFarmSupportMessage(operationKey: string) {
  const controller=new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unavailable={error:{message:"Reply not confirmed. Retry using the same receipt."}};
  try {
    return await Promise.race([
      (async()=>{
        const { data, error } = await supabase.auth.getSession();
        if(controller.signal.aborted)return unavailable;
        if (error || !data.session) return { error: { message: "Sign in first." } };
        const response = await fetch("/api/support/reply", {
          method: "POST", signal:controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({ operationKey }),
        });
        if(!response.ok)return unavailable;
        const receipt=await response.json();
        return receipt && ["saved","skipped"].includes(receipt.state) ? {error:null} : unavailable;
      })(),
      new Promise<typeof unavailable>(resolve=>{
        timer=setTimeout(()=>{resolve(unavailable);controller.abort();},15000);
      }),
    ]);
  } catch {return unavailable;}
  finally {if(timer!==undefined)clearTimeout(timer);}
}

export async function getAdminEscalatedChats() {
  return supabase
    .from("admin_support_escalated_chats")
    .select("*")
    .order("updated_at", { ascending: false });
}

export async function runAdminSupportAction({
  action,
  sessionId,
  body,
}: {
  action: AdminSupportAction;
  sessionId: string;
  body?: string;
}) {
  const functionName =
    action === "reply"
      ? "admin_support_send_message"
      : action === "end"
        ? "admin_support_end_chat"
        : action === "complete"
          ? "admin_support_complete_chat"
          : "admin_support_join_chat";

  const payload: Record<string, string> = { p_session_id: sessionId };
  if (action === "reply") payload.p_body = body || "";

  return supabase.rpc(functionName, payload);
}
