import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { auditLog, getRequestMeta } from "@/lib/audit";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Owner only. Removes a member entirely so they can be invited again from scratch.
// If records they created still point at them, the account is deactivated instead (can't sign in, no org).
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (me?.role !== "owner") return NextResponse.json({ error: "Only the Master Owner can remove members" }, { status: 403 });

  const userId = new URL(req.url).searchParams.get("id");
  if (!userId) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (userId === user.id) return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });

  const { data: target } = await admin.from("profiles").select("id, org_id, role, email").eq("id", userId).single();
  if (!target || target.org_id !== me.org_id) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "An owner can't be removed" }, { status: 403 });

  // Clear their access settings and any pending invite for the same email, so a fresh invite starts clean.
  await admin.from("user_menu_prefs").delete().eq("user_id", userId);
  await admin.from("user_project_access").delete().eq("user_id", userId);
  if (target.email) await admin.from("invitations").delete().eq("org_id", me.org_id).ilike("email", target.email);

  const { error } = await admin.auth.admin.deleteUser(userId);
  let mode: "deleted" | "deactivated" = "deleted";
  if (error) {
    // Records they created reference them. Lock the account out instead of deleting.
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    await admin.from("profiles").update({ org_id: null, approval_status: "rejected", role: "field", assigned_project_id: null }).eq("id", userId);
    mode = "deactivated";
  }

  await auditLog({ action: "user_rejected", userId: user.id, orgId: me.org_id, resourceType: "profile", resourceId: userId, severity: "warning", details: { removed: target.email, mode }, ...getRequestMeta(req) });
  return NextResponse.json({ success: true, mode });
}
