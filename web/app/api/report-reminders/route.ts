import { NextRequest, NextResponse } from "next/server";
import { bearerOk } from "@/lib/apiAuth";
import { admin } from "@/lib/reportLinks";
import { alertCategory } from "@/lib/reportAlerts";

export const dynamic = "force-dynamic";

const ny = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); // YYYY-MM-DD

// Cron: ?mode=evening (alerts the PM about today) or ?mode=morning (escalates yesterday's gaps to the owner).
export async function GET(req: NextRequest) {
  if (!bearerOk(req, process.env.CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const morning = new URL(req.url).searchParams.get("mode") === "morning";
  const day = ny(new Date(Date.now() - (morning ? 24 * 3600 * 1000 : 0)));
  const dow = new Date(day + "T12:00:00Z").getUTCDay();
  if (dow === 0 || dow === 6) return NextResponse.json({ skipped: "weekend" });

  const { data: links } = await admin.from("report_links").select("id, org_id, person_name, project_ids")
    .is("revoked_at", null).gt("expires_at", new Date().toISOString());
  const byOrg = new Map<string, string[]>();
  for (const l of links ?? []) {
    if (!l.project_ids?.length) continue;
    const { count } = await admin.from("voice_reports").select("id", { count: "exact", head: true })
      .eq("link_id", l.id).eq("status", "sent").gte("sent_at", day + "T00:00:00-05:00").lt("sent_at", day + "T23:59:59-04:00");
    if (!count) byOrg.set(l.org_id, [...(byOrg.get(l.org_id) ?? []), l.person_name]);
  }
  for (const [org, names] of byOrg) {
    await alertCategory(org, morning ? "owner" : "missing_report",
      morning ? `No daily report yesterday: ${names.length}` : `No daily report yet today: ${names.length}`,
      names.map(n => `${n} has not sent a confirmed report for ${day}`));
  }
  return NextResponse.json({ day, missing: Object.fromEntries(byOrg) });
}
