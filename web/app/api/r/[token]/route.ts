import { NextRequest, NextResponse } from "next/server";
import { admin, lookupLink, logUse } from "@/lib/reportLinks";
import { rateLimit, getIP } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const NOPE = () => NextResponse.json({ error: "This link is not active. Ask the office for a new one." }, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  // Guessing protection: limit failed + total lookups per IP
  if (!rateLimit(`rl:get:${getIP(req)}`, { windowMs: 60_000, max: 30 }).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const link = await lookupLink(params.token);
  if (!link) return NOPE();
  await logUse(link.id, "open", req);

  const { data: projects } = link.project_ids.length
    ? await admin.from("projects").select("id, name").in("id", link.project_ids).eq("org_id", link.org_id)
    : { data: [] as { id: string; name: string }[] };
  const { data: reports } = await admin
    .from("voice_reports")
    .select("id, report_date, status, items, transcript_english, low_confidence, created_at")
    .eq("link_id", link.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const pending = (reports ?? []).find(r => r.status === "needs_confirmation") ?? null;
  return NextResponse.json({
    person: link.person_name,
    language: link.language,
    projects: projects ?? [],
    pending,
    history: (reports ?? []).filter(r => r.status === "sent").slice(0, 5).map(r => ({ id: r.id, date: r.report_date, items: Array.isArray(r.items) ? r.items.length : 0 })),
  }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
