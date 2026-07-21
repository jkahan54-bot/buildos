/**
 * POST /api/weekly-report/generate
 * Fully server-side (Vercel cron via GET, see below) — runs whether or not
 * anyone's Claude session/PC is on. Builds an end-of-week, per-site progress
 * report + next-week plan from data already captured during the week
 * (WhatsApp transcript, daily logs, punch list items, and each night's
 * stored AI report — which itself already folded in that night's email
 * scan). It does NOT re-read Outlook live; freshness of email content is
 * bounded by whatever the nightly runs captured during the week.
 * Emails the full report to info@ (Resend) and pushes a WhatsApp summary.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendReportEmail } from "@/lib/email";
import { sendOwnerAlert } from "@/lib/whatsapp";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID       = "f18352de-979e-44d8-a874-c70aa8b05347";
const REPORT_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
// TEMPORARY: Resend account is unverified for brookstonedevelopers.com, so it
// can only deliver to the account owner's own address. Switch REPORT_TO back
// to info@brookstonedevelopers.com once the domain is verified in Resend
// (Dashboard → Domains → add brookstonedevelopers.com → add the DNS records).
const REPORT_TO    = (process.env.WEEKLY_REPORT_TO || "jkahan54@gmail.com").split(",").map(s => s.trim());

// Vercel cron hits this Thursday evening — no auth header available from cron, use CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fakeReq = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: REPORT_TOKEN }),
  });
  return POST(new NextRequest(fakeReq));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!REPORT_TOKEN || body.token !== REPORT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekEndingLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

  const [
    { data: transcript },
    { data: itemsCreated },
    { data: itemsCompleted },
    { data: incidents },
    { data: blockers },
    { data: dailyLogs },
    { data: nightlyReports },
  ] = await Promise.all([
    admin.from("whatsapp_messages")
      .select("content, sender, group_name, project_id, projects(name), sent_at")
      .eq("org_id", ORG_ID).gte("sent_at", since).order("sent_at", { ascending: true }),
    admin.from("punch_list_items")
      .select("title, description, source, source_message, priority, status, created_at, projects(name)")
      .eq("org_id", ORG_ID).gte("created_at", since).order("created_at", { ascending: true }),
    admin.from("punch_list_items")
      .select("title, updated_at, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "completed").gte("updated_at", since),
    admin.from("safety_incidents")
      .select("type, severity, description, created_at, projects(name)")
      .eq("org_id", ORG_ID).gte("created_at", since),
    admin.from("punch_list_items")
      .select("title, blocked_by, waiting_on, projects(name)")
      .eq("org_id", ORG_ID).eq("status", "open").not("blocked_by", "is", null),
    admin.from("daily_logs")
      .select("crew_count, weather, work_done, materials, equipment, issues, created_at, projects(name)")
      .eq("org_id", ORG_ID).gte("created_at", since),
    admin.from("system_events")
      .select("details, created_at")
      .eq("org_id", ORG_ID).eq("type", "daily_report").gte("created_at", since)
      .order("created_at", { ascending: true }),
  ]);

  // ── Group everything by project name ────────────────────────────────────
  const bySite: Record<string, {
    whatsapp: any[]; items: any[]; completed: any[]; incidents: any[];
    blockers: any[]; logs: any[]; nightlySummaries: string[];
  }> = {};
  const ensure = (name: string) => (bySite[name] ??= { whatsapp: [], items: [], completed: [], incidents: [], blockers: [], logs: [], nightlySummaries: [] });

  for (const m of (transcript ?? [])) ensure((m as any).projects?.name ?? "Unmatched").whatsapp.push(m);
  for (const i of (itemsCreated ?? [])) ensure((i as any).projects?.name ?? "Unmatched").items.push(i);
  for (const i of (itemsCompleted ?? [])) ensure((i as any).projects?.name ?? "Unmatched").completed.push(i);
  for (const i of (incidents ?? [])) ensure((i as any).projects?.name ?? "Unmatched").incidents.push(i);
  for (const i of (blockers ?? [])) ensure((i as any).projects?.name ?? "Unmatched").blockers.push(i);
  for (const l of (dailyLogs ?? [])) ensure((l as any).projects?.name ?? "Unmatched").logs.push(l);
  for (const r of (nightlyReports ?? [])) {
    const details = (r as any).details;
    for (const p of (details?.projects ?? [])) {
      if (p.summary) ensure(p.name).nightlySummaries.push(`[${new Date((r as any).created_at).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" })}] ${p.summary}`);
    }
  }

  const siteNames = Object.keys(bySite).filter(n => n !== "Unmatched");

  const dataBlock = siteNames.map(name => {
    const s = bySite[name];
    const crewNums = s.logs.map(l => l.crew_count).filter((n: any) => n != null);
    return `
═══ ${name} ═══
Daily narratives this week (from nightly AI reports, chronological):
${s.nightlySummaries.join("\n") || "  (none captured)"}

Crew counts logged this week: ${crewNums.length ? crewNums.join(", ") : "none logged"}
Daily log entries: ${s.logs.map(l => `[${new Date(l.created_at).toLocaleDateString("en-US", { weekday: "short" })}] weather ${l.weather ?? "n/a"}; work: ${l.work_done ?? "n/a"}; materials: ${l.materials ?? "none"}; issues: ${l.issues ?? "none"}`).join("\n") || "  (none)"}

Punch-list items created this week (${s.items.length}, source in brackets):
${s.items.map((i: any) => `  - [${i.source}] ${i.title}${i.source_message ? ` — "${i.source_message}"` : ""}`).join("\n") || "  (none)"}

Completed this week (${s.completed.length}): ${s.completed.map((i: any) => i.title).join("; ") || "none"}

Open blockers: ${s.blockers.map((i: any) => `"${i.title}" waiting on ${i.blocked_by}`).join("; ") || "none"}

Safety incidents this week (${s.incidents.length}): ${s.incidents.map((i: any) => `[${i.severity}] ${i.type}: ${i.description ?? ""}`).join("; ") || "none"}

Raw WhatsApp field messages this week (${s.whatsapp.length}), for extra color/schedule mentions:
${s.whatsapp.slice(0, 150).map((m: any) => `  [${new Date(m.sent_at).toLocaleDateString("en-US", { weekday: "short" })}] ${m.sender ?? "?"}: ${m.content}`).join("\n") || "  (none)"}
`;
  }).join("\n") || "No site activity recorded this week.";

  // ── Ask Claude for the full weekly narrative ────────────────────────────
  let parsed: any = {};
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `You are writing Brookstone Developers' END-OF-WEEK construction report for week ending ${weekEndingLabel}. The owner forwards this to site owners, so it must be detailed, factual, and well-organized. Source data below is drawn from a week of WhatsApp field messages, daily logs, and each night's already-scanned email activity (folded into the "Daily narratives" per site) — do not fabricate anything beyond what's given.

${dataBlock}

Return ONLY valid JSON (no markdown fences):
{
  "week_at_a_glance": ["5-8 short bullets: the biggest items across all sites, most important first — wins, problems, money, decisions needed"],
  "sites": [
    {
      "name": "exact site name from data",
      "progress": "A detailed multi-paragraph narrative (aim for real substance, several sentences minimum) of what happened this site this week — synthesize the daily narratives, WhatsApp, and logged crew/work into a coherent week-in-review. Mention specific work, crew presence, deliveries, inspections, subcontractors, weather impacts.",
      "issues": "What's stuck or went wrong this week, and who it's waiting on. 'None' if nothing.",
      "safety": "Incidents this week, or 'No incidents reported.'",
      "money": "Invoices, deposits, fees mentioned with amounts, or 'None.'",
      "next_week": "What's planned next week, ONLY if the data actually supports it (explicit dates/schedule mentions). If nothing stated, write: 'No confirmed schedule communicated — recommend confirming with the field.'",
      "owner_forward": "A short (5-10 line) client-facing version: plain professional language, no internal jargon or vendor-chasing detail, no dollar amounts unless they're the client's own invoice. Week's progress + crew presence + next week's plan."
    }
  ],
  "no_activity_sites": ["names of any known sites with zero activity this week"]
}`
        }]
      }),
      signal: AbortSignal.timeout(45000),
    });
    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text ?? "";
    if (text) parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("[weekly-report/generate] AI call failed:", e);
  }

  if (!parsed.sites) {
    parsed = {
      week_at_a_glance: [`${siteNames.length} site(s) had activity this week.`],
      sites: siteNames.map(name => ({
        name, progress: bySite[name].nightlySummaries.join(" ") || "See raw data — AI summary unavailable this run.",
        issues: "See raw data.", safety: `${bySite[name].incidents.length} incident(s).`, money: "See raw data.",
        next_week: "See raw data.", owner_forward: bySite[name].nightlySummaries.join(" ") || "No summary available.",
      })),
      no_activity_sites: [],
    };
  }

  // ── Build HTML email ─────────────────────────────────────────────────────
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#1f2937">
      <h1 style="color:#ea580c">Brookstone Weekly Report — Week ending ${weekEndingLabel}</h1>
      <h3>Week at a glance</h3>
      <ul>${(parsed.week_at_a_glance ?? []).map((b: string) => `<li>${esc(b)}</li>`).join("")}</ul>
      <hr/>
      ${(parsed.sites ?? []).map((s: any) => `
        <h2 style="color:#1f2937;border-bottom:2px solid #ea580c;padding-bottom:4px">${esc(s.name)}</h2>
        <p><strong>Progress this week:</strong><br/>${esc(s.progress).replace(/\n/g, "<br/>")}</p>
        <p><strong>Issues &amp; blockers:</strong> ${esc(s.issues)}</p>
        <p><strong>Safety:</strong> ${esc(s.safety)}</p>
        <p><strong>Money:</strong> ${esc(s.money)}</p>
        <p><strong>Planned for next week:</strong> ${esc(s.next_week)}</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:8px">
          <strong style="font-size:11px;text-transform:uppercase;color:#6b7280">Owner-ready — forward as-is</strong>
          <p style="white-space:pre-line">${esc(s.owner_forward)}</p>
        </div>
      `).join("<hr/>")}
      ${(parsed.no_activity_sites ?? []).length ? `<h3>No activity this week</h3><p>${(parsed.no_activity_sites ?? []).map(esc).join(", ")}</p>` : ""}
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Generated automatically by BuildOS · buildos-six.vercel.app/daily-summary</p>
    </div>`;

  const emailResult = await sendReportEmail({
    to: REPORT_TO,
    subject: `Brookstone Weekly Report — Week ending ${weekEndingLabel}`,
    html,
  });

  await admin.from("system_events").insert({
    org_id: ORG_ID,
    type: "weekly_report",
    status: emailResult.ok ? "sent" : "generated_email_failed",
    details: { week_ending: weekEndingLabel, ...parsed, email_error: emailResult.error },
  });

  const waMsg =
    `📅 Weekly Report — week ending ${weekEndingLabel}\n\n` +
    (parsed.week_at_a_glance ?? []).map((b: string) => `• ${b}`).join("\n") +
    (emailResult.ok ? `\n\n✅ Full report emailed to ${REPORT_TO.join(", ")}` : `\n\n⚠️ Email send failed (${emailResult.error}) — full report saved, check buildos-six.vercel.app`);
  await sendOwnerAlert(waMsg);

  return NextResponse.json({ ok: true, email: emailResult, report: parsed });
}
