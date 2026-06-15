import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { auditLog, getRequestMeta } from "@/lib/audit";
import { isValidEmail } from "@/lib/sanitize";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Role hierarchy — higher index = more power
const ROLE_RANK: Record<string, number> = { field: 0, office: 1, jobsite_owner: 1, admin: 2, owner: 3 };
const isOwner = (r?: string) => r === "owner";
const isAdminOrAbove = (r?: string) => (ROLE_RANK[r ?? ""] ?? -1) >= 2;

// POST — send invite
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile || !isAdminOrAbove(profile.role)) {
    return NextResponse.json({ error: "Only administrators or above can invite members" }, { status: 403 });
  }

  const { email, role } = await req.json();
  const meta = getRequestMeta(req);
  if (!email || !role) return NextResponse.json({ error: "Email and role required" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

  // Only owner can invite/create another owner or admin
  if ((role === "owner" || role === "admin") && !isOwner(profile.role)) {
    await auditLog({ action:"suspicious_activity", userId:user.id, orgId:profile.org_id, severity:"warning", details:{ reason:"tried to invite admin without owner role", targetEmail:email }, ...meta });
    return NextResponse.json({ error: "Only the Master Owner can invite Admins or Owners" }, { status: 403 });
  }

  // Save invitation record
  const { data: invite, error: invErr } = await admin
    .from("invitations")
    .insert({ org_id: profile.org_id, email, role, invited_by: user.id })
    .select().single();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  // Send invite email via Supabase Auth
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
  const { error: authErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/invite/accept?invite_id=${invite.id}`,
    data: { role, org_id: profile.org_id, invite_id: invite.id },
  });

  if (authErr) {
    await admin.from("invitations").delete().eq("id", invite.id);
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  await auditLog({ action:"user_invited", userId:user.id, orgId:profile.org_id, details:{ invitedEmail:email, role }, ...meta });
  return NextResponse.json({ success: true, invite_id: invite.id });
}

// PATCH — update a member's role
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminOrAbove(myProfile?.role)) {
    return NextResponse.json({ error: "Only administrators can change roles" }, { status: 403 });
  }

  const { userId, role, assignedProjectId } = await req.json();
  if (!userId || (!role && assignedProjectId === undefined)) {
    return NextResponse.json({ error: "userId and role or assignedProjectId required" }, { status: 400 });
  }

  // Fetch the target user's current role
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();

  // Can't touch an owner account unless you are also the owner
  if (target?.role === "owner" && !isOwner(myProfile?.role)) {
    return NextResponse.json({ error: "Cannot change the Master Owner's role" }, { status: 403 });
  }

  if (role) {
    // Admins cannot promote someone to admin or owner
    if ((role === "admin" || role === "owner") && !isOwner(myProfile?.role)) {
      return NextResponse.json({ error: "Only the Master Owner can assign Admin or Owner roles" }, { status: 403 });
    }

    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const meta2 = getRequestMeta(req);
    await auditLog({ action:"user_role_changed", userId:user.id, resourceType:"profile", resourceId:userId, details:{ fromRole:target?.role, toRole:role }, ...meta2 });
  }

  if (assignedProjectId !== undefined) {
    const { error } = await admin.from("profiles").update({ assigned_project_id: assignedProjectId || null }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — revoke a pending invite
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: myProfile } = await supabase.from("profiles").select("role, org_id").eq("id", user.id).single();
  if (!isAdminOrAbove(myProfile?.role)) {
    return NextResponse.json({ error: "Only administrators can revoke invites" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const inviteId = searchParams.get("id");
  if (!inviteId) return NextResponse.json({ error: "invite id required" }, { status: 400 });
  await admin.from("invitations").delete().eq("id", inviteId);
  const meta3 = getRequestMeta(req);
  await auditLog({ action:"invite_revoked", userId:user.id, orgId:myProfile?.org_id, resourceId:inviteId, ...meta3 });
  return NextResponse.json({ success: true });
}

// PUT — approve or reject a user (only owner can approve)
export async function PUT(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminOrAbove(myProfile?.role)) {
    return NextResponse.json({ error: "Only administrators or above can approve members" }, { status: 403 });
  }

  const { userId, action } = await req.json(); // action: "approve" | "reject"
  if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 });

  // Protect owner accounts from being rejected
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Cannot reject the Master Owner account" }, { status: 403 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  await admin.from("profiles").update({ approval_status: newStatus }).eq("id", userId);

  const metaPut = getRequestMeta(req);
  const { data: myProfileFull } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  await auditLog({
    action: action === "approve" ? "user_approved" : "user_rejected",
    userId: user.id, orgId: myProfileFull?.org_id,
    resourceType: "profile", resourceId: userId,
    severity: action === "reject" ? "warning" : "info",
    ...metaPut,
  });
  return NextResponse.json({ success: true });
}
