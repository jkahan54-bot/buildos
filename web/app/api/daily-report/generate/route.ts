/**
 * POST /api/daily-report/generate
 * Called by the nightly SKILL.md after the email scan.
 * Pulls ALL of today's activity from Supabase (WhatsApp + email items,
 * completions, safety incidents) and asks Claude to write a real per-project
 * narrative, then stores it and sends a WhatsApp push.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID        = "f18352de-979e-44d8-a874-c70aa8b05347";
const REPORT_TOKEN  = process.env.WHATSAPP_VERIFY_TOKEN || "buildos_webhook_verified";
const CALLMEBOT_PHONE = "18456626789";
const CALLMEBOT_KEY   = "8598005";

async function sendCallMeBot(message: string) {
  const encoded = encodeURIComponent(message);
  await fetch(
    `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}&text=${encoded}&apikey=${CALLMEBOT_KEY}`,
    { signal: AbortSignal.timeout(8000) }
  ).catch(() => {});
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, report_date, emails_scanned = 0, email_context = "" } = body;

  if (token !== REPORT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = report_date ?? new Date().toISOString().split("T")[0];
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd   = `${today}T23:59:59.999Z`;

  // ── Pull all today's activity from the database ─────────────────────────
  const [
    { data: newItems },
    { data: approvedItems },
    { data: completedItems },
    { data: incidents },
    { data: blockers },
  ] = await Promise.all([
    // All new punch list items created today (WhatsApp + email)
    admin.from("punch_list_items")
      .select("title, description, source, source_message, priority, status, projects(name)")
      .eq("org_id", ORG_ID)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true }),

    // Items moved to open (approved from review) today
    admin.from("punch_list_items")
      .select("title, projects(name)")
      .eq("org_id", ORG_ID)
      .eq("status", "open")
      .gte("updated_at", dayStart)
      .lte("updated_at", dayEnd),

    // Items completed today
    admin.from("punch_list_items")
      .select("title, projects(name)")
      .eq("org_id", ORG_ID)
      .eq("status", "completed")
      .gte("updated_at", dayStart)
      .lte("updated_at", dayEnd),

    // Safety incidents today
    admin.from("safety_incidents")
      .select("type, severity, description, project_id, projects(name)")
      .eq("org_id", ORG_ID)
      .gte("created_at", dayStart)
      .lte("updated_at", dayEnd),

    // Open high-priority blockers (not just today — ongoing)
    admin.from("punch_list_items")
      .select("title, blocked_by, waiting_on, projects(name)")
      .eq("org_id", ORG_ID)
      .eq("status", "open")
      .not("blocked_by", "is", null),
  ]);

  // ── Group new items by project ──────────────────────────────────────────
  const byProject: Record<string, { name: string; whatsapp: any[]; email: any[] }> = {};
  for (const item of (newItems ?? [])) {
    const name = (item as any).projects?.name ?? "Unknown";
    if (!byProject[name]) byProject[name] = { name, whatsapp: [], email: [] };
    if (item.source === "whatsapp") byProject[name].whatsapp.push(item);
    else byProject[name].email.push(item);
  }

  const waCount    = (newItems ?? []).filter(i => i.source === "whatsapp").length;
  const emailCount = (newItems ?? []).filter(i => i.source === "email").length;

  // ── Build a structured data block for Claude ────────────────────────────
  const dataBlock = `
DATE: ${today}

NEW ITEMS TODAY (${(newItems ?? []).length} total — ${waCount} WhatsApp, ${emailCount} email):
${Object.values(byProject).map(p => `
  Project: ${p.name}
  WhatsApp items (${p.whatsapp.length}):
${p.whatsapp.map(i => `    - [${i.priority}] ${i.title}${i.source_message ? ` | "${i.source_message.slice(0, 120)}"` : ""}`).join("\n") || "    (none)"}
  Email items (${p.email.length}):
${p.email.map(i => `    - [${i.priority}] ${i.title}${i.description ? ` | ${i.description.slice(0, 120)}` : ""}`).join("\n") || "    (none)"}
`).join("") || "  (no new items today)"}

ITEMS APPROVED TODAY: ${(approvedItems ?? []).length}
${(approvedItems ?? []).map(i => `  - ${(i as any).projects?.name}: ${i.title}`).join("\n") || "  (none)"}

ITEMS COMPLETED TODAY: ${(completedItems ?? []).length}
${(completedItems ?? []).map(i => `  - ${(i as any).projects?.name}: ${i.title}`).join("\n") || "  (none)"}

SAFETY INCIDENTS TODAY: ${(incidents ?? []).length}
${(incidents ?? []).map(i => `  - [${i.severity}] ${i.type}: ${i.description?.slice(0, 100)}`).join("\n") || "  (none)"}

OPEN BLOCKERS ACROSS ALL SITES: ${(blockers ?? []).length}
${(blockers ?? []).map(i => `  - ${(i as any).projects?.name}: waiting on "${i.blocked_by}" (${i.waiting_on ?? "other"})`).join("\n") || "  (none)"}

EMAIL SCAN: ${emails_scanned} emails scanned today.
${email_context ? `EMAIL NOTES: ${email_context}` : ""}
`.trim();

  // ── Ask Claude for a real narrative ────────────────────────────────────
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You are summarizing a construction PM's day across multiple active jobsites. Write a concise, factual daily report based ONLY on the data below. No fluff, no fabrication.

${dataBlock}

Return ONLY valid JSON with this shape:
{
  "overall_summary": "2-3 sentences covering the whole day: what projects were active, any urgent items, any completions or blockers worth flagging",
  "projects": [
    {
      "name": "exact project name from data",
      "summary": "1-2 sentences: what happened on this site today — combine WhatsApp field reports and email items into a single plain-English update. Be specific about the actual issues/tasks.",
      "whatsapp_count": <number>,
      "email_count": <number>,
      "task_count": <total new items>
    }
  ],
  "completed_count": <number>,
  "blocker_count": <number>,
  "incident_count": <number>
}

Only include projects that had activity today. If a project had items completed but no new items, include it anyway with task_count 0 and note the completion in the summary.`
      }]
    }),
  });

  const aiData = await aiRes.json();
  const text   = aiData.content?.[0]?.text ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    parsed = { overall_summary: text.slice(0, 300), projects: [] };
  }

  const report = {
    report_date:     today,
    overall_summary: parsed.overall_summary ?? "",
    projects:        parsed.projects ?? [],
    emails_scanned:  emails_scanned,
    tasks_created:   (newItems ?? []).length,
    whatsapp_count:  waCount,
    email_count:     emailCount,
    completed_count: parsed.completed_count ?? (completedItems ?? []).length,
    blocker_count:   parsed.blocker_count   ?? (blockers ?? []).length,
    incident_count:  parsed.incident_count  ?? (incidents ?? []).length,
  };

  // ── Store in system_events ──────────────────────────────────────────────
  await admin.from("system_events").insert({
    org_id:  ORG_ID,
    type:    "daily_report",
    status:  "generated",
    details: report,
  });

  // ── WhatsApp push ───────────────────────────────────────────────────────
  const projLines = (parsed.projects ?? [])
    .map((p: any) => `• ${p.name}: ${p.summary}`)
    .join("\n");

  const flags = [
    report.incident_count  > 0 ? `🚨 ${report.incident_count} safety incident(s)` : null,
    report.blocker_count   > 0 ? `⏳ ${report.blocker_count} open blocker(s)`     : null,
    report.completed_count > 0 ? `✅ ${report.completed_count} completed today`    : null,
  ].filter(Boolean).join("  |  ");

  const msg =
    `📊 BuildOS Daily Report — ${today}\n\n` +
    `${report.overall_summary}\n\n` +
    `${projLines}` +
    (flags ? `\n\n${flags}` : "") +
    `\n\n📱 ${waCount} WhatsApp  📧 ${emailCount} email  →  buildos-six.vercel.app/daily-summary`;

  await sendCallMeBot(msg);

  return NextResponse.json({ ok: true, report });
}
