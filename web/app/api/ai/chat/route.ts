import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, DEFAULT_PRIMARY_MODEL } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("ai_primary_model, role").eq("id", user.id).single();

  const { messages, context } = await req.json();
  const model = profile?.ai_primary_model ?? DEFAULT_PRIMARY_MODEL;

  const system = `You are BuildBot, an expert AI assistant for BuildOS construction management.
Help with scheduling, budget analysis, safety compliance (OSHA), RFI responses, crew coordination,
material procurement, change orders, and construction management.
Be concise and practical. User role: ${profile?.role}.
${context ? `Context: ${context}` : ""}`;

  const apiMessages = messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content }));

  try {
    const reply = await callAI(model, system, apiMessages.map((m: any) => `${m.role}: ${m.content}`).join("\n"), 1000);
    return NextResponse.json({ reply, model });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
