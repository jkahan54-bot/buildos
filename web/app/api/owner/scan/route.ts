/**
 * POST /api/owner/scan  — manual trigger from command center
 * GET  /api/owner/scan  — Vercel cron (Friday nights)
 *
 * Full master scan: all projects, all open items, blockers, safety,
 * budget anomalies, stale items. Claude writes a comprehensive weekly
 * briefing stored in system_events and pushed via WhatsApp.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

import { sendOwnerAlert } from "@/lib/whatsapp";

const ORG_ID = "f18352de-979e-44d8-a874-c70aa8b05347";

async function runScan() {
  const now  = new Date();
  const date = now.toISOString().split("T")[0];
  const week_ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: projects },
    { data: openItems },
    { data: pendingItems },
    { data: blockedItems },
    { data: staleItems },
    { data: incidents },
    { data: highPriority },
    { data: recentlyCompleted },
    { data: budgetItems },
  ] = await Promise.all([
    admin.from("projects").select("id, name, status").eq("org_id", ORG_ID),

    admin.from("punch_list_items")
      .select("id, title, priority, status, source, created_at, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "open")
      .order("priority", { ascending: false }),

    admin.from("punch_list_items")
      .select("title, source, created_at, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "pending_review"),

    admin.from("punch_list_items")
      .select("title, blocked_by, waiting_on, created_at, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "open").not("blocked_by", "is", null),

    // Items open for >7 days — stale
    admin.from("punch_list_items")
      .select("title, priority, created_at, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "open")
      .lt("created_at", week_ago)
      .order("created_at", { ascending: true }).limit(20),

    admin.from("safety_incidents")
      .select("type, severity, description, status, incident_date, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "Open"),

    admin.from("punch_list_items")
      .select("title, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "open").eq("priority", "high"),

    admin.from("punch_list_items")
      .select("title, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "completed")
      .gte("updated_at", week_ago),

    admin.from("budget_items")
      .select("description, budgeted_amount, actual_amount, projects(name)")
      .eq("org_id", ORG_ID).limit(30),
  ]);

  // Build project-grouped summaries
  const byProject: Record<string, { name: string; open: number; high: number; blocked: number; stale: number }> = {};
  for (const p of (projects ?? [])) {
    byProject[p.id] = { name: p.name, open: 0, high: 0, blocked: 0, stale: 0 };
  }
  for (const i of (openItems ?? [])) {
    const pid = (i as any).project_id;
    if (byProject[pid]) {
      byProject[pid].open++;
      if (i.priority === "high") byProject[pid].high++;
    }
  }
  for (const i of (blockedItems ?? [])) {
    const pid = (i as any).project_id;
    if (byProject[pid]) byProject[pid].blocked++;
  }
  for (const i of (staleItems ?? [])) {
    const pid = (i as any).project_id;
    if (byProject[pid]) byProject[pid].stale++;
  }

  // Budget overruns
  const overruns = (budgetItems ?? []).filter((b: any) =>
    b.actual_amount && b.budgeted_amount && b.actual_amount > b.budgeted_amount
  );

  const dataBlock = `
MASTER SCAN — ${date}

PROJECTS: ${(projects ?? []).map(p => p.name).join(", ")}

OPEN ITEMS SUMMARY PER PROJECT:
${Object.values(byProject).map(p =>
  `  ${p.name}: ${p.open} open (${p.high} high priority, ${p.blocked} blocked, ${p.stale} stale >7d)`
).join("\n")}

HIGH PRIORITY OPEN ITEMS (${(highPriority ?? []).length}):
${(highPriority ?? []).map(i => `  - ${(i as any).projects?.name}: ${i.title}`).join("\n") || "  (none)"}

PENDING REVIEW (${(pendingItems ?? []).length} waiting for approval):
${(pendingItems ?? []).map(i => `  - ${(i as any).projects?.name}: ${i.title} [${i.source}]`).join("\n") || "  (none)"}

OPEN BLOCKERS (${(blockedItems ?? []).length}):
${(blockedItems ?? []).map(i => `  - ${(i as any).projects?.name}: "${i.title}" | blocked by: ${i.blocked_by}`).join("\n") || "  (none)"}

STALE ITEMS >7 DAYS (${(staleItems ?? []).length}):
${(staleItems ?? []).map(i => {
  const age = Math.floor((Date.now() - new Date(i.created_at).getTime()) / (1000*60*60*24));
  return `  - [${age}d] ${(i as any).projects?.name}: ${i.title}`;
}).join("\n") || "  (none)"}

OPEN SAFETY INCIDENTS (${(incidents ?? []).length}):
${(incidents ?? []).map(i => `  - [${i.severity}] ${(i as any).projects?.name ?? "unlinked"}: ${i.type} — ${i.description?.slice(0,80)}`).join("\n") || "  (none — all clear)"}

COMPLETED THIS WEEK (${(recentlyCompleted ?? []).length} items):
${(recentlyCompleted ?? []).map(i => `  - ${(i as any).projects?.name}: ${i.title}`).join("\n") || "  (none)"}

BUDGET OVERRUNS (${overruns.length}):
${overruns.map((b: any) => `  - ${b.projects?.name}: ${b.description} | budgeted $${b.budgeted_amount} vs actual $${b.actual_amount}`).join("\n") || "  (none)"}
`.trim();

  // Claude writes the weekly briefing
  let briefing = "";
  let projectSummaries: { name: string; status: string; action_needed: string }[] = [];
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 2000,
        system: "You are a construction project management AI generating a weekly master briefing for the company owner. Be direct, factual, and actionable. Flag risks clearly.",
        messages: [{
          role: "user",
          content: `${dataBlock}\n\nWrite a weekly master briefing for the owner. Return ONLY valid JSON:\n{\n  "executive_summary": "3-4 sentences: overall company health, biggest wins, biggest risks this week",\n  "attention_required": ["specific item needing owner attention — be concrete"],\n  "projects": [\n    {\n      "name": "project name",\n      "status": "On Track | At Risk | Blocked | Critical",\n      "action_needed": "1 sentence: what needs to happen next on this site"\n    }\n  ],\n  "safety_status": "All Clear | Issues Open",\n  "safety_notes": "brief safety summary or empty string"\n}`
        }],
      }),
      signal: AbortSignal.timeout(40000),
    });
    const aiData = await aiRes.json();
    const text   = aiData.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    briefing         = parsed.executive_summary ?? "";
    projectSummaries = parsed.projects ?? [];

    // Store full result
    await admin.from("system_events").insert({
      org_id:  ORG_ID,
      type:    "master_scan",
      status:  "completed",
      details: {
        scan_date:          date,
        executive_summary:  briefing,
        attention_required: parsed.attention_required ?? [],
        projects:           projectSummaries,
        safety_status:      parsed.safety_status,
        safety_notes:       parsed.safety_notes,
        stats: {
          total_open:      (openItems ?? []).length,
          high_priority:   (highPriority ?? []).length,
          pending_review:  (pendingItems ?? []).length,
          blocked:         (blockedItems ?? []).length,
          stale:           (staleItems ?? []).length,
          incidents:       (incidents ?? []).length,
          completed_week:  (recentlyCompleted ?? []).length,
          budget_overruns: overruns.length,
        },
      },
    });
  } catch (e) {
    console.error("[owner/scan] AI failed:", e);
    briefing = `Scan completed ${date}. ${(openItems ?? []).length} open items, ${(blockedItems ?? []).length} blocked, ${(incidents ?? []).length} safety incidents open.`;
  }

  // WhatsApp push
  const safetyFlag = (incidents ?? []).length > 0 ? `\n🚨 ${(incidents ?? []).length} OPEN SAFETY INCIDENT(S)` : "";
  const msg =
    `👑 BuildOS Master Scan — ${date}\n\n` +
    `${briefing}\n` +
    safetyFlag +
    `\n\n📊 ${(openItems ?? []).length} open · ⚡ ${(highPriority ?? []).length} high priority · ⏳ ${(blockedItems ?? []).length} blocked · 🕐 ${(staleItems ?? []).length} stale` +
    `\n\nbuildos-six.vercel.app/command`;
  await sendOwnerAlert(msg);

  return { ok: true, scan_date: date, summary: briefing };
}

// Manual trigger from command center (authenticated)
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["owner", "admin"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  const result = await runScan();
  return NextResponse.json(result);
}

// Vercel cron trigger (Friday nights)
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runScan();
  return NextResponse.json(result);
}
