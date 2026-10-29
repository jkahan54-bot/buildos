import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Server-side admin client — bypasses RLS so new users can create their org
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const { userId, orgName, fullName, inviteId } = await req.json();
  // role / approval are NEVER taken from the browser — only from a verified invitation, or locked to the lowest level.
  let role = "field";
  let approvalStatus = "pending";

  if (!userId || !orgName) {
    return NextResponse.json({ error: "Missing userId or orgName" }, { status: 400 });
  }

  // Callers may only register THEMSELVES — otherwise anyone could rewrite
  // another user's role/org/approval via their userId.
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Valid invitation (issued by an admin to THIS email) → join the inviting org with the invited role.
  if (inviteId) {
    const { data: inv } = await adminClient.from("invitations").select("id, org_id, role, email, status").eq("id", inviteId).single();
    if (inv && inv.status !== "accepted" && inv.email?.toLowerCase() === user.email?.toLowerCase()) {
      const { error: e } = await adminClient.from("profiles").update({ org_id: inv.org_id, role: inv.role, full_name: fullName, approval_status: "approved" }).eq("id", userId);
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      await adminClient.from("invitations").update({ status: "accepted" }).eq("id", inv.id);
      return NextResponse.json({ orgId: inv.org_id, invited: true });
    }
    return NextResponse.json({ error: "This invitation is invalid, expired or already used" }, { status: 403 });
  }

  // A profile that already belongs to an org can't re-register (org hijack guard)
  const { data: existing } = await adminClient.from("profiles").select("org_id").eq("id", userId).single();
  if (existing?.org_id) {
    return NextResponse.json({ error: "Account already registered to an organization" }, { status: 403 });
  }

  try {
    // 1. Create the organization
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const { data: org, error: orgErr } = await adminClient
      .from("organizations")
      .insert({ name: orgName, slug })
      .select()
      .single();

    if (orgErr) {
      // If slug already exists, try with a suffix
      if (orgErr.code === "23505") {
        const { data: org2, error: orgErr2 } = await adminClient
          .from("organizations")
          .insert({ name: orgName, slug: slug + "-" + Date.now().toString().slice(-4) })
          .select()
          .single();
        if (orgErr2) return NextResponse.json({ error: orgErr2.message }, { status: 500 });
        // Update profile with new org
        const status = approvalStatus ?? "approved";
        await adminClient.from("profiles").update({ org_id: org2.id, role, full_name: fullName, approval_status: status }).eq("id", userId);
        return NextResponse.json({ orgId: org2.id });
      }
      return NextResponse.json({ error: orgErr.message }, { status: 500 });
    }

    // 2. Link user profile to org and set role + name
    const status = approvalStatus ?? "approved";
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({ org_id: org.id, role, full_name: fullName, approval_status: status })
      .eq("id", userId);

    if (profileErr) {
      // Profile might not exist yet (trigger delay) — upsert it
      await adminClient.from("profiles").upsert({
        id: userId, org_id: org.id, role, full_name: fullName, approval_status: status,
      });
    }

    return NextResponse.json({ orgId: org.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
