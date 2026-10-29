import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { admin } from "@/lib/reportLinks";

const STAFF = ["owner", "admin"];

export async function GET() {
  const { ctx, res } = await requireRole(STAFF);
  if (res) return res;
  const [{ data: s }, { data: routes }] = await Promise.all([
    admin.from("report_settings").select("*").eq("org_id", ctx.orgId).maybeSingle(),
    admin.from("report_routes").select("id, category, recipient_name, recipient_email, recipient_whatsapp").eq("org_id", ctx.orgId),
  ]);
  return NextResponse.json({ settings: s ?? null, routes: routes ?? [] });
}

export async function PUT(req: NextRequest) {
  const { ctx, res } = await requireRole(STAFF);
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const amt = b.cost_alert_amount === null || b.cost_alert_amount === "" ? null : Number(b.cost_alert_amount);
  if (amt !== null && (!isFinite(amt) || amt < 0 || amt > 100_000_000)) return NextResponse.json({ error: "Bad amount" }, { status: 400 });
  const days = Math.min(60, Math.max(0, parseInt(b.delay_alert_days ?? 3, 10) || 3));
  await admin.from("report_settings").upsert({ org_id: ctx.orgId, cost_alert_amount: amt, delay_alert_days: days });
  if (Array.isArray(b.routes)) {
    await admin.from("report_routes").delete().eq("org_id", ctx.orgId);
    const rows = b.routes.slice(0, 40)
      .filter((r: any) => ["owner", "office", "pm", "missing_report"].includes(r?.category) && String(r?.recipient_name ?? "").trim())
      .map((r: any) => ({
        org_id: ctx.orgId, category: r.category, recipient_name: String(r.recipient_name).slice(0, 80),
        recipient_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.recipient_email ?? "")) ? String(r.recipient_email).slice(0, 120) : null,
        recipient_whatsapp: !!r.recipient_whatsapp,
      }));
    if (rows.length) await admin.from("report_routes").insert(rows);
  }
  return NextResponse.json({ ok: true });
}
