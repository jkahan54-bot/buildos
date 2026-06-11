import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side admin client — bypasses RLS so new users can create their org
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const { userId, orgName, role, fullName, approvalStatus } = await req.json();

  if (!userId || !orgName) {
    return NextResponse.json({ error: "Missing userId or orgName" }, { status: 400 });
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
