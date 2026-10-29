import { admin } from "./reportLinks";
import { sendOwnerAlert } from "./whatsapp";
import { sendReportEmail } from "./email";
import { routeItem, draftKind, ReportItem, RouteSettings } from "./reportRouting";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";

export async function getSettings(orgId: string): Promise<RouteSettings & { missingHour: number }> {
  const { data } = await admin.from("report_settings").select("*").eq("org_id", orgId).maybeSingle();
  return {
    costAlertAmount: data?.cost_alert_amount != null ? Number(data.cost_alert_amount) : null,
    delayAlertDays: data?.delay_alert_days ?? 3,
    missingHour: data?.missing_hour_local ?? 17,
  };
}

async function recipients(orgId: string, category: string) {
  const { data } = await admin.from("report_routes").select("recipient_name, recipient_email, recipient_whatsapp").eq("org_id", orgId).eq("category", category);
  return data ?? [];
}

/** Send one alert to a category (owner / office / pm / missing_report) by email and, for owner, WhatsApp. */
export async function alertCategory(orgId: string, category: "owner" | "office" | "pm" | "missing_report", subject: string, lines: string[], reportId?: string) {
  const link = reportId ? `${APP}/voice-reports?open=${reportId}` : `${APP}/voice-reports`;
  const to = new Set<string>();
  let whatsapp = category === "owner";
  for (const r of await recipients(orgId, category)) {
    if (r.recipient_email) to.add(r.recipient_email);
    if (r.recipient_whatsapp) whatsapp = true;
  }
  const text = `${subject}\n\n${lines.join("\n")}\n\n${link}`;
  const html = `<p><b>${esc(subject)}</b></p><ul>${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul><p><a href="${link}">Open transcript and audio</a></p>`;
  const results: string[] = [];
  if (to.size) {
    const r = await sendReportEmail({ to: [...to], subject, html, text });
    results.push(r.ok ? "email" : `email failed: ${r.error}`);
  }
  if (whatsapp) {
    const r = await sendOwnerAlert(text);
    results.push(r.ok ? "whatsapp" : `whatsapp failed: ${r.error}`);
  }
  if (!results.length) console.warn(`[voice-report] no recipients configured for category ${category}`);
  return results;
}

/** After a manager confirms: create drafts and send immediate alerts. Never approves anything. */
export async function fileConfirmedReport(opts: {
  orgId: string; reportId: string; reporter: string; items: ReportItem[]; projectNames: Record<string, string>;
}) {
  const s = await getSettings(opts.orgId);
  const buckets: Record<"owner" | "office" | "pm", string[]> = { owner: [], office: [], pm: [] };
  const draftRows: any[] = [];
  for (const it of opts.items) {
    const dk = draftKind(it);
    if (dk) {
      draftRows.push({
        org_id: opts.orgId, report_id: opts.reportId, project_id: it.project_id, kind: dk,
        summary: it.text_en, amount: it.amount ?? null, days: it.days ?? null,
        proposed_date: it.date ?? null, reason_code: it.reason_code ?? null,
      });
    }
    const pn = it.project_id ? opts.projectNames[it.project_id] ?? "job" : "job not identified";
    for (const t of routeItem(it, s)) {
      if (t.immediate) buckets[t.who].push(`${pn}: ${it.text_en}${it.amount != null ? ` ($${it.amount})` : ""}${it.needs_person ? " [needs a person to check]" : ""}`);
    }
  }
  if (draftRows.length) await admin.from("report_drafts").insert(draftRows);
  const label = { owner: "URGENT", office: "Cost / change order", pm: "Needs PM" } as const;
  for (const who of ["owner", "office", "pm"] as const) {
    if (buckets[who].length) await alertCategory(opts.orgId, who, `${label[who]} from ${opts.reporter}`, buckets[who], opts.reportId);
  }
}
