/**
 * Weekly Progress report — the Friday "Weekly Progress" format Brookstone posts to site owners:
 * one header per site, 3-6 short outcome bullets, no money or private legal detail.
 *
 * Runs fully server-side from a Vercel cron (Friday morning), independent of anyone's PC.
 * Inputs (last 7 days): WhatsApp transcript (real message times), tasks captured from
 * WhatsApp + email, open "waiting on" items, and each project's status summary.
 * It does NOT read Outlook live — email content is only as fresh as the last email scan,
 * and the report says so when email data looks stale.
 *
 * Delivery: tries info@brookstonedevelopers.com (needs the domain verified in Resend), and
 * falls back to the owner's Gmail so a report always lands somewhere.
 *
 * POST body { token, dry: true } returns the report without emailing (for testing).
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

// Vercel's default function limit is 10s, which silently killed the previous weekly cron mid-AI-call
// (no report was ever produced after the July test runs). Ask for the max a Hobby plan allows.
export const maxDuration = 60;

const ORG_ID       = "f18352de-979e-44d8-a874-c70aa8b05347";
const REPORT_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PRIMARY_TO   = (process.env.WEEKLY_REPORT_TO || "info@brookstonedevelopers.com").split(",").map(s => s.trim());
const FALLBACK_TO  = ["jkahan54@gmail.com"];
const VERIFIED_FROM = "BuildOS Reports <reports@brookstonedevelopers.com>";

// Sites that appear in the owner-facing report (same set as the existing Friday report).
const OWNER_SITES: { db: string; label: string }[] = [
  { db: "123-125 Ditmas",    label: "125 Ditmas" },
  { db: "1187 Ocean Avenue", label: "1187 Ocean Ave" },
  { db: "910 Onderdonk",     label: "910 Onderdonk" },
  { db: "57-23 Myrtle Ave",  label: "57 - 23 Myrtle" },
  { db: "517 Nostrand Ave",  label: "517 Nostrand" },
  { db: "185 Concord",       label: "185 Concord" },
];
const SKIP_PROJECTS = new Set(["?? Unverified Site"]);

// Vercel cron hits this Friday morning (GET + CRON_SECRET)
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

const etDate = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: "America/New_York", ...opts });
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!REPORT_TOKEN || body.token !== REPORT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since = start.toISOString();
  const rangeLabel = `${etDate(start, { month: "long", day: "numeric" })} – ${etDate(now, { month: "long", day: "numeric", year: "numeric" })}`;
  const title = `Weekly Progress — Week of ${rangeLabel}`;

  const [{ data: wa }, { data: created }, { data: waiting }, { data: projects }, { data: latestEmail }] = await Promise.all([
    admin.from("whatsapp_messages").select("content, sender, group_name, sent_at, projects(name)")
      .eq("org_id", ORG_ID).gte("sent_at", since).order("sent_at", { ascending: true }),
    admin.from("punch_list_items").select("title, description, source, status, created_at, projects(name)")
      .eq("org_id", ORG_ID).gte("created_at", since).order("created_at", { ascending: true }),
    admin.from("punch_list_items").select("title, waiting_on, projects(name)")
      .eq("org_id", ORG_ID).in("status", ["open", "in_progress", "pending_review"]).not("waiting_on", "is", null),
    admin.from("projects").select("name, phase, description").eq("org_id", ORG_ID).eq("status", "active"),
    admin.from("punch_list_items").select("created_at").eq("org_id", ORG_ID).eq("source", "email").order("created_at", { ascending: false }).limit(1),
  ]);

  const names = (projects ?? []).map((p: any) => p.name).filter((n: string) => !SKIP_PROJECTS.has(n));
  type Bucket = { wa: any[]; items: any[]; waiting: any[]; desc?: string; phase?: string };
  const by: Record<string, Bucket> = {};
  for (const n of names) by[n] = { wa: [], items: [], waiting: [] };
  for (const p of (projects ?? []) as any[]) if (by[p.name]) { by[p.name].desc = p.description; by[p.name].phase = p.phase; }
  for (const m of (wa ?? []) as any[]) by[m.projects?.name]?.wa.push(m);
  for (const i of (created ?? []) as any[]) by[i.projects?.name]?.items.push(i);
  for (const i of (waiting ?? []) as any[]) by[i.projects?.name]?.waiting.push(i);

  const block = (name: string) => {
    const b = by[name];
    return `=== ${name} (${b.phase ?? "stage unknown"}) ===
Status summary on file: ${b.desc ?? "none"}
Tasks captured this week (${b.items.length}):
${b.items.slice(0, 40).map(i => `- [${i.source}] ${i.title}${i.description && i.description !== i.title ? ` — ${String(i.description).slice(0, 220)}` : ""}`).join("\n") || "- none"}
Currently waiting on:
${b.waiting.slice(0, 25).map(i => `- ${i.title} (waiting on ${i.waiting_on})`).join("\n") || "- none"}
WhatsApp this week (${b.wa.length} messages):
${b.wa.slice(0, 120).map(m => `[${etDate(new Date(m.sent_at), { weekday: "short" })}] ${m.content}`).join("\n") || "none"}
`;
  };

  const ownerBlocks = OWNER_SITES.filter(s => by[s.db]).map(s => block(s.db)).join("\n");
  const otherNames = names.filter(n => !OWNER_SITES.some(s => s.db === n) && (by[n].items.length || by[n].wa.length));
  const otherBlocks = otherNames.map(block).join("\n");

  const prompt = `You are writing Brookstone Developers' Friday "Weekly Progress" update for the week of ${rangeLabel}. It is posted to site owners, so it must read exactly like this previous week's example — short, factual, outcome-focused bullets:

Weekly Progress
Week of October 9 – October 16, 2026
*125 Ditmas*
• As-built drawings under final review.
• Elevator inspection scheduled for Oct 27.
• Gas up and running.
*1187 Ocean Ave*
• Continued coordination of MEP openings and sleeve drawings with the design team.
• Sent out pricing requests for scaffolding, kitchens, appliances, tiles, lighting, flooring and plumbing fixtures to vendors.
• Foundation plans approved.

RULES
- 3 to 6 bullets per site. State what was DONE, RECEIVED, APPROVED, FILED, SCHEDULED or is BLOCKED this week. One short sentence each.
- NO dollar amounts, NO invoices/payment chasing, NO private legal commentary or negotiation detail, NO internal gripes about people.
- Use ONLY facts in the data below. Never invent progress, dates or approvals. If a site had little real activity, write fewer bullets rather than padding.
- WhatsApp chatter ("ok", "thanks", questions) is noise — extract only real field progress, deliveries, inspections and schedule facts.
- Put upcoming dated events (inspections, mobilization, deadlines) in key_dates.

OWNER SITES (always include each one that has data):
${ownerBlocks || "(no data)"}

OTHER ACTIVE SITES (internal only; brief, 2-4 bullets; skip sites with nothing real):
${otherBlocks || "(none)"}

Return ONLY valid JSON, no markdown fences:
{"sites":[{"name":"<exact label>","bullets":["..."]}],"others":[{"name":"<project name>","bullets":["..."]}],"key_dates":["Mon Oct 26 — ..."]}
Use these exact labels for sites, in this order: ${OWNER_SITES.map(s => `"${s.label}"`).join(", ")}.`;

  let parsed: any = null;
  let aiError: string | undefined;
  for (const [model, timeoutMs] of [["claude-sonnet-5-5", 36000], ["claude-haiku-4-5-20251001", 14000]] as const) {
    try {
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const aiData = await aiRes.json();
      const text = aiData.content?.[0]?.text ?? "";
      if (!text) { aiError = JSON.stringify(aiData).slice(0, 300); continue; }
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      break;
    } catch (e: any) { aiError = e.message; }
  }
  if (!parsed?.sites) {
    parsed = {
      sites: OWNER_SITES.filter(s => by[s.db]).map(s => ({ name: s.label, bullets: by[s.db].items.slice(0, 5).map(i => i.title) })),
      others: [], key_dates: [],
    };
  }

  // ── Freshness notes ──────────────────────────────────────────────────────
  const lastEmailAt = (latestEmail as any)?.[0]?.created_at ? new Date((latestEmail as any)[0].created_at) : null;
  const emailAgeDays = lastEmailAt ? Math.floor((now.getTime() - lastEmailAt.getTime()) / 86400000) : null;
  const emailStale = emailAgeDays === null || emailAgeDays >= 4;
  const waCount = (wa ?? []).length;
  const notes: string[] = [];
  if (emailStale) notes.push(`⚠ Email coverage may be thin: the last email scan was ${emailAgeDays === null ? "never" : `${emailAgeDays} days ago`}. Sites driven mostly by email (permits, engineers) may be under-reported.`);
  if (waCount < 20) notes.push(`⚠ Only ${waCount} WhatsApp messages were captured this week — check the WhatsApp listener is running.`);

  // ── Build outputs ────────────────────────────────────────────────────────
  const sites: { name: string; bullets: string[] }[] = parsed.sites ?? [];
  const others: { name: string; bullets: string[] }[] = parsed.others ?? [];
  const keyDates: string[] = parsed.key_dates ?? [];

  const waText =
    `Weekly Progress\nWeek of ${rangeLabel}\n` +
    sites.filter(s => s.bullets?.length).map(s => `*${s.name}*\n${s.bullets.map(b => `• ${b}`).join("\n")}`).join("\n");

  const ul = (arr: string[]) => `<ul style="margin:4px 0 14px 18px;padding:0">${arr.map(b => `<li style="margin:3px 0">${esc(b)}</li>`).join("")}</ul>`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1f2937;line-height:1.45">
      <h2 style="margin:0 0 2px">Weekly Progress</h2>
      <div style="color:#6b7280;margin-bottom:18px"><b>Week of ${esc(rangeLabel)}</b></div>
      ${sites.filter(s => s.bullets?.length).map(s => `<h3 style="margin:16px 0 2px;font-size:16px">${esc(s.name)}</h3>${ul(s.bullets)}`).join("")}
      ${keyDates.length ? `<h3 style="margin:16px 0 2px;font-size:16px">Key dates next week</h3>${ul(keyDates)}` : ""}
      ${others.filter(o => o.bullets?.length).length ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/><div style="font-size:12px;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Other active sites — internal, not part of the owner report</div>${others.filter(o => o.bullets?.length).map(o => `<h3 style="margin:12px 0 2px;font-size:15px">${esc(o.name)}</h3>${ul(o.bullets)}`).join("")}` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
      <div style="font-size:12px;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Paste-ready for WhatsApp</div>
      <pre style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:13px">${esc(waText)}</pre>
      ${notes.map(n => `<p style="color:#b45309;font-size:13px">${esc(n)}</p>`).join("")}
      <p style="color:#9ca3af;font-size:12px">Built automatically by BuildOS from WhatsApp field groups and the captured email tasks. Payment amounts and private legal detail are left out.</p>
    </div>`;

  if (body.dry) {
    return NextResponse.json({ ok: true, dry: true, title, waText, notes, report: parsed, aiError, counts: { whatsapp: waCount, tasks: (created ?? []).length } });
  }

  // ── Send: info@ first (needs verified domain), then fall back to Gmail ───
  let delivered: string[] = PRIMARY_TO;
  let emailResult = await sendReportEmail({ to: PRIMARY_TO, subject: title, html, text: waText, from: VERIFIED_FROM });
  if (!emailResult.ok) {
    const firstError = emailResult.error;
    delivered = FALLBACK_TO;
    emailResult = await sendReportEmail({ to: FALLBACK_TO, subject: title, html, text: waText });
    if (emailResult.ok) emailResult.error = `info@ not deliverable yet (${String(firstError).slice(0, 160)}) — sent to ${FALLBACK_TO.join(", ")} instead`;
  }

  await admin.from("system_events").insert({
    org_id: ORG_ID,
    type: "weekly_report",
    status: emailResult.ok ? "sent" : "generated_email_failed",
    details: { title, delivered_to: emailResult.ok ? delivered : [], note: emailResult.error, notes, report: parsed },
  });

  await sendOwnerAlert(`📅 ${title}\n\n${emailResult.ok ? `Emailed to ${delivered.join(", ")}.` : `⚠️ Email failed (${emailResult.error})`}${notes.length ? `\n\n${notes.join("\n")}` : ""}`);

  return NextResponse.json({ ok: emailResult.ok, delivered, email: emailResult, report: parsed });
}
