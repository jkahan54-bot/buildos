import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST — send invite
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return NextResponse.json({ error: "Only admins can invite members" }, { status: 403 });
  }

  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: "Email and role required" }, { status: 400 });

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
    // Clean up invite record if email fails
    await admin.from("invitations").delete().eq("id", invite.id);
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, invite_id: invite.id });
}

// PATCH — update a member's role
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 });

  const { userId, role } = await req.json();
  if (!userId || !role) return NextResponse.json({ error: "userId and role required" }, { status: 400 });

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE — revoke a pending invite
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviteId = searchParams.get("id");
  if (!inviteId) return NextResponse.json({ error: "invite id required" }, { status: 400 });
  await admin.from("invitations").delete().eq("id", inviteId);
  return NextResponse.json({ success: true });
}
