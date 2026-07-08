import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID       = "f18352de-979e-44d8-a874-c70aa8b05347";
const REPORT_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

async function sendCallMeBot(message: string) {
  const phone  = process.env.CALLMEBOT_PHONE!;
  const apiKey = process.env.CALLMEBOT_KEY!;
  if (!phone || !apiKey) return;
  const encoded = encodeURIComponent(message);
  await fetch(
    `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`,
    { signal: AbortSignal.timeout(8000) }
  ).catch(() => {});
}

// POST /api/daily-report — called by the nightly SKILL.md scan
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, report_date, overall_summary, projects, emails_scanned, tasks_created } = body;

  if (!REPORT_TOKEN || token !== REPORT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await admin.from("system_events").insert({
    org_id:  ORG_ID,
    type:    "daily_report",
    status:  "generated",
    details: { report_date, overall_summary, projects, emails_scanned, tasks_created },
  });

  // Push a WhatsApp summary to the PM's phone
  const projLines = (projects as { name: string; summary: string }[])
    .map(p => `• ${p.name}: ${p.summary}`)
    .join("\n");
  const msg =
    `📊 BuildOS Daily Report — ${report_date}\n\n` +
    `${overall_summary}\n\n` +
    `${projLines}\n\n` +
    `📧 ${emails_scanned} email${emails_scanned !== 1 ? "s" : ""} scanned` +
    ` • ✅ ${tasks_created} task${tasks_created !== 1 ? "s" : ""} created` +
    `\n\nbuildos-six.vercel.app/daily-summary`;
  await sendCallMeBot(msg);

  return NextResponse.json({ ok: true });
}

// GET /api/daily-report — called by the daily-summary page to load today's report
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return the most recent report from the last 36 hours so it's visible
  // even if the scan ran yesterday evening and today's hasn't fired yet.
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("system_events")
    .select("details, created_at")
    .eq("type", "daily_report")
    .eq("org_id", ORG_ID)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json({ report: data?.[0]?.details ?? null });
}
