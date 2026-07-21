/**
 * GET /api/weekly-data
 * Key-protected (x-buildos-key) headless read used by the Thursday-night
 * weekly summary routine. Returns the last 7 days of everything needed to
 * write a per-site week-in-review: WhatsApp transcript, items created and
 * completed, safety incidents, open blockers, daily logs, and the stored
 * nightly AI reports.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID = "f18352de-979e-44d8-a874-c70aa8b05347";

export async function GET(req: NextRequest) {
  const secret = process.env.BUILDOS_WEBHOOK_SECRET;
  const key = req.headers.get("x-buildos-key") ?? new URL(req.url).searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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
      .select("content, sender, group_name, action, project_id, projects(name), sent_at")
      .eq("org_id", ORG_ID).gte("sent_at", since).order("sent_at", { ascending: true }),
    admin.from("punch_list_items")
      .select("title, description, source, priority, status, created_at, projects(name)")
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

  return NextResponse.json({
    since,
    transcript:      transcript      ?? [],
    items_created:   itemsCreated    ?? [],
    items_completed: itemsCompleted  ?? [],
    incidents:       incidents       ?? [],
    blockers:        blockers        ?? [],
    daily_logs:      dailyLogs       ?? [],
    nightly_reports: nightlyReports  ?? [],
  });
}
