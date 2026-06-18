/**
 * POST /api/owner/prompt
 * Owner-only AI assistant. Queries live BuildOS data then asks Claude
 * to answer the question or describe what action to take.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID = "f18352de-979e-44d8-a874-c70aa8b05347";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["owner", "admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const { prompt } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: "No prompt" }, { status: 400 });

  // ── Pull live system context from Supabase ─────────────────────────────
  const [
    { data: projects },
    { data: openItems },
    { data: pendingItems },
    { data: blockedItems },
    { data: incidents },
    { data: recentReport },
  ] = await Promise.all([
    admin.from("projects").select("id, name, status").eq("org_id", ORG_ID),

    admin.from("punch_list_items")
      .select("title, priority, status, source, blocked_by, waiting_on, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "open")
      .order("priority", { ascending: false }).limit(40),

    admin.from("punch_list_items")
      .select("title, priority, source, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "pending_review").limit(20),

    admin.from("punch_list_items")
      .select("title, blocked_by, waiting_on, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "open").not("blocked_by", "is", null).limit(20),

    admin.from("safety_incidents")
      .select("type, severity, description, status, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "Open").limit(10),

    admin.from("system_events")
      .select("details, created_at")
      .eq("org_id", ORG_ID).eq("type", "daily_report")
      .order("created_at", { ascending: false }).limit(1),
  ]);

  const context = `
BUILDOS LIVE SYSTEM CONTEXT — ${new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}

ACTIVE PROJECTS (${(projects ?? []).length}):
${(projects ?? []).map(p => `  - ${p.name} [${p.status ?? "active"}]`).join("\n")}

OPEN PUNCH LIST ITEMS (${(openItems ?? []).length}):
${(openItems ?? []).map(i => `  - [${i.priority}] ${(i as any).projects?.name}: ${i.title}${i.blocked_by ? ` ⏳ waiting on: ${i.blocked_by}` : ""}`).join("\n") || "  (none)"}

PENDING REVIEW (${(pendingItems ?? []).length} items need approval):
${(pendingItems ?? []).map(i => `  - ${(i as any).projects?.name}: ${i.title} [${i.source}]`).join("\n") || "  (none)"}

OPEN BLOCKERS (${(blockedItems ?? []).length}):
${(blockedItems ?? []).map(i => `  - ${(i as any).projects?.name}: "${i.title}" — waiting on: ${i.blocked_by}`).join("\n") || "  (none)"}

OPEN SAFETY INCIDENTS (${(incidents ?? []).length}):
${(incidents ?? []).map(i => `  - [${i.severity}] ${(i as any).projects?.name ?? "unlinked"}: ${i.type} — ${i.description?.slice(0, 80)}`).join("\n") || "  (none)"}

MOST RECENT DAILY REPORT:
${recentReport?.[0]?.details?.overall_summary ?? "(no recent report)"}
`.trim();

  // ── Ask Claude ─────────────────────────────────────────────────────────
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `You are BuildOS AI, an intelligent assistant for a construction project management company called Brookstone Developers. You have access to live data from their active jobsites. Answer questions factually based on the context provided. Be direct and specific — this is a busy PM who needs clear answers. If asked to run an action (scan, generate report, etc.) explain what you would do and note they can use the action buttons below.`,
      messages: [
        { role: "user", content: `${context}\n\n---\n\nOWNER'S QUESTION / COMMAND:\n${prompt}` }
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  const aiData = await aiRes.json();
  const answer = aiData.content?.[0]?.text ?? "Sorry, I couldn't generate a response. Please try again.";

  return NextResponse.json({ answer });
}
