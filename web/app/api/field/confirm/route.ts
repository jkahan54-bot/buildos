import { NextRequest, NextResponse } from "next/server";
import { admin, resolveLink } from "@/lib/fieldLink";
import { sendReportEmail } from "@/lib/email";
import { auditLog, getRequestMeta } from "@/lib/audit";

const clip = (s: unknown, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const list = (a: unknown) => (Array.isArray(a) ? a : []);

// Step 2: the manager confirmed (or corrected) the read-back. Only now does anything get filed.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const link = await resolveLink(b.token);
  if (!link) return NextResponse.json({ error: "This link is not valid any more." }, { status: 401 });

  const { data: rep } = await admin.from("voice_reports").select("*").eq("id", b.report_id).eq("link_id", link.id).single();
  if (!rep || rep.status !== "draft") return NextResponse.json({ error: "Report not found or already sent" }, { status: 404 });

  if (b.action === "discard") {
    await admin.from("voice_reports").update({ status: "discarded" }).eq("id", rep.id);
    return NextResponse.json({ success: true });
  }

  // The manager may have edited the lines; use their corrected version, bounded and cleaned.
  const e = b.extracted ?? rep.extracted ?? {};
  const progress: string[]   = list(e.progress).map((x) => clip(x)).filter(Boolean);
  const solved: string[]     = list(e.issues_solved).map((x) => clip(x)).filter(Boolean);
  const issues               = list(e.issues_new).map((x: any) => ({ text: clip(x?.text ?? x), priority: ["high", "medium", "low"].includes(x?.priority) ? x.priority : "medium" })).filter((x) => x.text);
  const costs                = list(e.costs).map((x: any) => ({ text: clip(x?.text ?? x), amount: clip(x?.amount, 40) })).filter((x) => x.text);
  const cos                  = list(e.change_orders).map((x: any) => ({ text: clip(x?.text ?? x), amount: clip(x?.amount, 40) })).filter((x) => x.text);
  const delays               = list(e.delays).map((x: any) => ({ text: clip(x?.text ?? x), days: Number.isFinite(+x?.days) ? +x.days : null })).filter((x) => x.text);
  const crew                 = Number.isFinite(+e.crew_count) && +e.crew_count > 0 ? Math.round(+e.crew_count) : null;
  const urgent               = !!e.urgent;
  const reason               = clip(e.urgent_reason, 200);
  const who = link.person_name;
  const src = `Voice report — ${who}`;
  const common = { org_id: link.org_id, project_id: rep.project_id, source: "voice", source_message: clip(rep.transcript, 500) };

  // Daily log (progress + issues + what was solved)
  await admin.from("daily_logs").insert({
    org_id: link.org_id, project_id: rep.project_id, crew_count: crew,
    work_done: progress.join("\n") || clip(e.summary_en, 500),
    issues: [...issues.map((i) => i.text), ...solved.map((s) => `Resolved: ${s}`)].join("\n") || null,
  });

  // Tasks: new issues open; money + delays wait for human review. Nothing touches budget or schedule automatically.
  const rows: any[] = [
    ...issues.map((i) => ({ ...common, title: `[ISSUE] ${i.text} (${who})`, status: "open", priority: i.priority })),
    ...cos.map((c) => ({ ...common, title: `[CHANGE ORDER] ${c.text}${c.amount ? ` — ${c.amount}` : ""} (${who})`, status: "pending_review", priority: "high" })),
    ...costs.map((c) => ({ ...common, title: `[COST] ${c.text}${c.amount ? ` — ${c.amount}` : ""} (${who})`, status: "pending_review", priority: "high" })),
    ...delays.map((d) => ({ ...common, title: `[DELAY] ${d.text}${d.days ? ` — ${d.days} day(s)` : ""} (${who})`, status: "pending_review", priority: "high" })),
  ];
  if (rows.length) await admin.from("punch_list_items").insert(rows);

  await admin.from("voice_reports").update({ status: "confirmed", confirmed_at: new Date().toISOString(), extracted: e, priority: urgent ? "urgent" : "normal" }).eq("id", rep.id);
  await auditLog({ action: "voice_report_filed", orgId: link.org_id, resourceId: rep.id, details: { person: who, items: rows.length, urgent }, ...getRequestMeta(req) });

  // Priority routing
  let notified = false;
  if (urgent || cos.length || costs.length) {
    const { data: proj } = await admin.from("projects").select("name").eq("id", rep.project_id).single();
    const to = link.notify_emails.length ? link.notify_emails : (process.env.VOICE_ALERT_EMAILS ?? "jkahan54@gmail.com").split(",").map((s) => s.trim());
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const li = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="margin:0">${urgent ? "URGENT — " : ""}${esc(proj?.name ?? "Site")}</h2>
      <p style="color:#6b7280;margin:2px 0 14px">${esc(src)}</p>
      ${urgent && reason ? `<p style="background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:8px"><b>Why urgent:</b> ${esc(reason)}</p>` : ""}
      <p>${esc(clip(e.summary_en, 600))}</p>
      ${cos.length ? `<b>Change orders (need approval)</b>${li(cos.map((c) => c.text + (c.amount ? ` — ${c.amount}` : "")))}` : ""}
      ${costs.length ? `<b>New costs (need review)</b>${li(costs.map((c) => c.text + (c.amount ? ` — ${c.amount}` : "")))}` : ""}
      ${issues.length ? `<b>New issues</b>${li(issues.map((i) => i.text))}` : ""}
      ${delays.length ? `<b>Delays</b>${li(delays.map((d) => d.text))}` : ""}
      <p style="color:#9ca3af;font-size:12px">Filed in BuildOS. Money items are waiting for review — nothing was approved automatically.</p></div>`;
    const subject = `${urgent ? "URGENT: " : ""}${proj?.name ?? "Site"} — ${who}`;
    let r = await sendReportEmail({ to, subject, html });
    if (!r.ok) r = await sendReportEmail({ to: ["jkahan54@gmail.com"], subject: `${subject} (for: ${to.join(", ")})`, html });
    notified = r.ok;
  }

  return NextResponse.json({ success: true, filed: rows.length, notified });
}
