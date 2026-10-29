import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { auditLog, getRequestMeta } from "@/lib/audit";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Admin-only: get the sign-up link for a pending invite so it can be sent by WhatsApp/text
// when the invite email doesn't arrive. The link is shown only to the admin who asks for it.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!me || !["owner", "admin"].includes(me.role)) return NextResponse.json({ error: "Only owners and admins can do this" }, { status: 403 });

  const { invite_id } = await req.json();
  const { data: inv } = await admin.from("invitations").select("id, org_id, email, role, status").eq("id", invite_id).single();
  if (!inv || inv.org_id !== me.org_id || inv.status !== "pending") return NextResponse.json({ error: "Invite not found or already used" }, { status: 404 });
  if ((inv.role === "owner" || inv.role === "admin") && me.role !== "owner") return NextResponse.json({ error: "Only the Master Owner can do this for admins or owners" }, { status: 403 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
  const redirectTo = `${appUrl}/invite/accept?invite_id=${inv.id}`;
  let link: string | undefined;
  for (const type of ["invite", "magiclink"] as const) {
    const { data, error } = await admin.auth.admin.generateLink({ type, email: inv.email.toLowerCase(), options: { redirectTo } });
    if (!error && data?.properties?.action_link) { link = data.properties.action_link; break; }
  }
  if (!link) return NextResponse.json({ error: "Could not create a link" }, { status: 500 });

  await auditLog({ action: "user_invited", userId: user.id, orgId: me.org_id, resourceId: inv.id, details: { invitedEmail: inv.email, role: inv.role, via: "copied_link" }, ...getRequestMeta(req) });
  return NextResponse.json({ link });
}
