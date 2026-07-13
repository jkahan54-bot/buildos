/**
 * GET /api/owner/stats
 * Quick system stats + last master scan for the Command Center header.
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

export async function GET(req: NextRequest) {
  // Headless callers (the nightly email scan) may authenticate with the shared
  // webhook key (header x-buildos-key or ?key=) instead of a browser session.
  // Browser callers still use the logged-in Supabase session.
  const secret = process.env.BUILDOS_WEBHOOK_SECRET;
  const key = req.headers.get("x-buildos-key") ?? new URL(req.url).searchParams.get("key");
  const keyOk = !!secret && key === secret;
  if (!keyOk) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const week_ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalOpen },
    { count: highPriority },
    { count: blocked },
    { count: pending },
    { count: incidents },
    { count: stale },
    { data: lastScanRow },
  ] = await Promise.all([
    admin.from("punch_list_items").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "open"),
    admin.from("punch_list_items").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "open").eq("priority", "high"),
    admin.from("punch_list_items").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "open").not("blocked_by", "is", null),
    admin.from("punch_list_items").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "pending_review"),
    admin.from("safety_incidents").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "Open"),
    admin.from("punch_list_items").select("*", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "open").lt("created_at", week_ago),
    admin.from("system_events").select("details, created_at").eq("org_id", ORG_ID).eq("type", "master_scan").order("created_at", { ascending: false }).limit(1),
  ]);

  return NextResponse.json({
    stats: {
      total_open:    totalOpen   ?? 0,
      high_priority: highPriority ?? 0,
      blocked:       blocked      ?? 0,
      pending:       pending      ?? 0,
      incidents:     incidents    ?? 0,
      stale:         stale        ?? 0,
    },
    lastScan: lastScanRow?.[0]?.details ?? null,
  });
}
