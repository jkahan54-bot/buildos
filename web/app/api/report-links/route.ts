import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { admin, newToken, hashToken, LINK_TTL_DAYS } from "@/lib/reportLinks";

const STAFF = ["owner", "admin"];
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
const expiry = () => new Date(Date.now() + LINK_TTL_DAYS * 86400_000).toISOString();

export async function GET() {
  const { ctx, res } = await requireRole(STAFF);
  if (res) return res;
  const { data } = await admin.from("report_links")
    .select("id, person_name, phone, email, language, project_ids, expires_at, revoked_at, created_at, last_used_at")
    .eq("org_id", ctx.orgId).order("created_at", { ascending: false });
  return NextResponse.json({ links: data ?? [] });
}

// Create a link. The full URL is returned ONCE; only a hash is stored.
export async function POST(req: NextRequest) {
  const { ctx, res } = await requireRole(STAFF);
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const name = String(b.person_name ?? "").trim().slice(0, 80);
  const lang = ["en", "es", "yi", "mixed"].includes(b.language) ? b.language : "en";
  const ids: string[] = Array.isArray(b.project_ids) ? b.project_ids.filter((x: any) => typeof x === "string").slice(0, 30) : [];
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  // Only projects in the caller's org
  const { data: ok } = ids.length ? await admin.from("projects").select("id").in("id", ids).eq("org_id", ctx.orgId) : { data: [] };
  const token = newToken();
  const { data, error } = await admin.from("report_links").insert({
    org_id: ctx.orgId, person_name: name, phone: b.phone ? String(b.phone).slice(0, 30) : null,
    email: b.email ? String(b.email).slice(0, 120) : null, language: lang,
    project_ids: (ok ?? []).map(p => p.id), token_hash: hashToken(token), expires_at: expiry(), created_by: ctx.userId,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Could not create link" }, { status: 500 });
  return NextResponse.json({ id: data.id, url: `${APP()}/r/${token}` });
}

// action: "revoke" | "replace" (new token, old one dies) | "renew" (extend expiry)
export async function PATCH(req: NextRequest) {
  const { ctx, res } = await requireRole(STAFF);
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const { data: link } = await admin.from("report_links").select("id").eq("id", b.id).eq("org_id", ctx.orgId).maybeSingle();
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (b.action === "revoke") {
    await admin.from("report_links").update({ revoked_at: new Date().toISOString() }).eq("id", link.id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "replace") {
    const token = newToken();
    await admin.from("report_links").update({ token_hash: hashToken(token), revoked_at: null, expires_at: expiry() }).eq("id", link.id);
    return NextResponse.json({ ok: true, url: `${APP()}/r/${token}` });
  }
  if (b.action === "renew") {
    await admin.from("report_links").update({ expires_at: expiry() }).eq("id", link.id).is("revoked_at", null);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Bad action" }, { status: 400 });
}
