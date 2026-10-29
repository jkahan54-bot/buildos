import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { auditLog, getRequestMeta } from "@/lib/audit";
import { isValidEmail } from "@/lib/sanitize";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Owner/admin: add a member directly with a temporary password the admin chooses.
// No email is sent. The member must set their own password at first sign-in.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!me || !["owner", "admin"].includes(me.role)) return NextResponse.json({ error: "Only owners and admins can add members" }, { status: 403 });

  const b = await req.json();
  const email = String(b.email ?? "").trim().toLowerCase();
  const fullName = String(b.full_name ?? "").trim().slice(0, 80);
  const role = String(b.role ?? "");
  const password = String(b.password ?? "");
  if (!isValidEmail(email)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  if (!fullName) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!["jobsite_owner", "admin", "office", "field"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (role === "admin" && me.role !== "owner") return NextResponse.json({ error: "Only the Master Owner can add an Administrator" }, { status: 403 });
  if (password.length < 12) return NextResponse.json({ error: "Temporary password must be at least 12 characters" }, { status: 400 });

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, must_change_password: true },
  });
  if (error || !data?.user) return NextResponse.json({ error: error?.message ?? "Could not create the account" }, { status: 400 });

  // Profile row is created by the signup trigger; attach it to this org with the chosen role.
  const { error: pErr } = await admin.from("profiles").upsert({ id: data.user.id, email, full_name: fullName, org_id: me.org_id, role, approval_status: "approved" });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  await auditLog({ action: "user_invited", userId: user.id, orgId: me.org_id, resourceType: "profile", resourceId: data.user.id, details: { invitedEmail: email, role, via: "temp_password" }, ...getRequestMeta(req) });
  return NextResponse.json({ success: true, id: data.user.id });
}
