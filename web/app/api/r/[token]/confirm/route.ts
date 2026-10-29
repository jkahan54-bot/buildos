import { NextRequest, NextResponse } from "next/server";
import { admin, lookupLink, logUse } from "@/lib/reportLinks";
import { rateLimit, getIP } from "@/lib/ratelimit";
import { criticalFields, sanitizeItems, ReportItem } from "@/lib/reportRouting";
import { fileConfirmedReport } from "@/lib/reportAlerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Decision = {
  id: string;
  ok: boolean;                                    // "Correct" tapped
  fix?: { text_en?: string; amount?: number | null; date?: string | null; quantity?: string | null; days?: number | null };
  ack?: Partial<Record<"amount" | "date" | "quantity" | "days", boolean>>;  // each large field confirmed one by one
};

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!rateLimit(`rl:cf:${getIP(req)}`, { windowMs: 60_000, max: 20 }).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const link = await lookupLink(params.token);
  if (!link) return NextResponse.json({ error: "This link is not active." }, { status: 404 });

  let body: { report_id?: string; decisions?: Decision[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.report_id || !Array.isArray(body.decisions)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // The report must belong to THIS link (only the recorder can confirm) and still be waiting
  const { data: report } = await admin.from("voice_reports").select("id, org_id, link_id, status, items")
    .eq("id", body.report_id).eq("link_id", link.id).maybeSingle();
  if (!report || report.status !== "needs_confirmation") return NextResponse.json({ error: "Nothing to confirm." }, { status: 409 });

  const original: ReportItem[] = Array.isArray(report.items) ? report.items : [];
  const byId = new Map(body.decisions.map(d => [d?.id, d]));
  const kept: ReportItem[] = [];
  for (const it of original) {
    const d = byId.get(it.id);
    if (!d) return NextResponse.json({ error: "Every item needs Correct or Fix before sending." }, { status: 400 });
    let item = { ...it };
    if (d.fix) {
      // Corrections come from the person who was there. Re-validate as if freshly extracted.
      const merged = sanitizeItems([{ ...item, ...d.fix, text_en: d.fix.text_en ?? item.text_en }], link.project_ids)[0];
      item = { ...merged, id: it.id, project_id: item.project_id, needs_person: item.needs_person && !d.fix.text_en };
    } else if (!d.ok) {
      continue; // "Not right" with no correction: dropped, never filed
    }
    for (const f of criticalFields(item)) {
      if (!d.ack?.[f]) return NextResponse.json({ error: `Please confirm the ${f} on: "${item.text_en.slice(0, 60)}"` }, { status: 400 });
    }
    kept.push(item);
  }

  // Atomic flip so a double-tap cannot file twice
  const { data: flipped } = await admin.from("voice_reports")
    .update({ status: "sent", confirmed_items: kept, sent_at: new Date().toISOString() })
    .eq("id", report.id).eq("status", "needs_confirmation").select("id");
  if (!flipped?.length) return NextResponse.json({ error: "Already sent." }, { status: 409 });
  await logUse(link.id, "confirm", req);

  const { data: projects } = link.project_ids.length
    ? await admin.from("projects").select("id, name").in("id", link.project_ids).eq("org_id", link.org_id)
    : { data: [] as { id: string; name: string }[] };
  const names = Object.fromEntries((projects ?? []).map(p => [p.id, p.name]));

  // Daily log: one entry per job from the confirmed progress/solved/issue items
  const perProject = new Map<string, { done: string[]; issues: string[] }>();
  for (const it of kept) {
    if (!it.project_id) continue;
    const e = perProject.get(it.project_id) ?? { done: [], issues: [] };
    if (it.kind === "progress" || it.kind === "solved") e.done.push(it.text_en);
    else if (it.kind !== "note") e.issues.push(it.text_en);
    perProject.set(it.project_id, e);
  }
  for (const [pid, e] of perProject) {
    await admin.from("daily_logs").insert({
      org_id: link.org_id, project_id: pid, work_done: e.done.join("\n") || null,
      issues: e.issues.join("\n") || null, materials: `Voice report by ${link.person_name}`,
    });
  }

  try {
    await fileConfirmedReport({ orgId: link.org_id, reportId: report.id, reporter: link.person_name, items: kept, projectNames: names });
  } catch (e) { console.error("[voice-report] alerts failed", e); } // report is saved either way
  return NextResponse.json({ ok: true, filed: kept.length });
}
