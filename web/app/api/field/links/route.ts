import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { admin, newToken, hashToken } from "@/lib/fieldLink";
import { auditLog, getRequestMeta } from "@/lib/audit";

// Owner/admin only: create, list and revoke personal field links.
async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!p || !["owner", "admin"].includes(p.role)) return null;
  return { user, org_id: p.org_id as string };
}

export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await admin.from("field_links")
    .select("id, person_name, language, project_ids, notify_emails, expires_at, revoked, last_used_at, created_at")
    .eq("org_id", me.org_id).order("created_at", { ascending: false });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();
  const name = String(b.person_name ?? "").trim().slice(0, 80);
  const projectIds: string[] = Array.isArray(b.project_ids) ? b.project_ids : [];
  if (!name || projectIds.length === 0) return NextResponse.json({ error: "Name and at least one site are required" }, { status: 400 });

  // Only sites in this org may be attached
  const { data: ok } = await admin.from("projects").select("id").eq("org_id", me.org_id).in("id", projectIds);
  if ((ok?.length ?? 0) !== projectIds.length) return NextResponse.json({ error: "Invalid site" }, { status: 400 });

  const token = newToken();
  const days = Math.min(Math.max(parseInt(b.days ?? "90", 10) || 90, 1), 365);
  const emails = (Array.isArray(b.notify_emails) ? b.notify_emails : []).map((e: string) => String(e).trim().toLowerCase()).filter((e: string) => /^\S+@\S+\.\S+$/.test(e));
  const { data, error } = await admin.from("field_links").insert({
    org_id: me.org_id, person_name: name, language: ["en", "es", "yi"].includes(b.language) ? b.language : "en",
    project_ids: projectIds, notify_emails: emails, token_hash: hashToken(token),
    expires_at: new Date(Date.now() + days * 86400000).toISOString(), created_by: me.user.id,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog({ action: "field_link_created", userId: me.user.id, orgId: me.org_id, resourceId: data.id, details: { person: name, sites: projectIds.length }, ...getRequestMeta(req) });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
  // The full link is shown once; only its hash is stored.
  return NextResponse.json({ id: data.id, url: `${appUrl}/r/${token}` });
}

export async function DELETE(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await admin.from("field_links").update({ revoked: true }).eq("id", id).eq("org_id", me.org_id);
  await auditLog({ action: "field_link_revoked", userId: me.user.id, orgId: me.org_id, resourceId: id, ...getRequestMeta(req) });
  return NextResponse.json({ success: true });
}
