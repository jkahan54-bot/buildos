import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ORG_ID = "f18352de-979e-44d8-a874-c70aa8b05347";

// GET /api/daily-summary — list the current pending-review items so the nightly
// email scan can dedupe before posting (and so the PM UI can render the queue).
// Auth: the shared webhook key (header x-buildos-key or ?key=) for headless
// callers, OR a logged-in PM/Admin/Office/Field browser session.
export async function GET(req: NextRequest) {
  const secret = process.env.BUILDOS_WEBHOOK_SECRET;
  const key = req.headers.get("x-buildos-key") ?? new URL(req.url).searchParams.get("key");
  let orgId: string;

  if (secret && key === secret) {
    orgId = ORG_ID;
  } else {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role, org_id").eq("id", user.id).single();
    const canView = !!profile && ["owner", "admin", "office", "field"].includes(profile.role ?? "");
    if (!profile || !canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    orgId = profile.org_id;
  }

  const { data, error } = await admin
    .from("punch_list_items")
    .select("id, title, source, priority, created_at, projects(name)")
    .eq("org_id", orgId)
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pending = (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    project: r.projects?.name ?? null,
    source: r.source,
    priority: r.priority,
    created_at: r.created_at,
  }));
  return NextResponse.json({ pending, count: pending.length });
}

// POST /api/daily-summary
// body: { action: "approve" | "reject" | "approve_all", itemId?: string, projectId?: string }
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, org_id, assigned_project_id").eq("id", user.id).single();
  const canApprove = !!profile && ["owner","admin","office","field"].includes(profile.role ?? "");
  if (!profile || !canApprove) return NextResponse.json({ error: "Only PM/Admin/Office/Field can approve items" }, { status: 403 });

  // Field workers only act on WhatsApp items for their assigned site; office only on email items.
  const source = profile.role === "field" ? "whatsapp" : profile.role === "office" ? "email" : null;

  const { action, itemId, projectId, newTitle } = await req.json();

  if (action === "approve" && itemId) {
    // Approve single item — move from pending_review → open
    const update: any = { status: "open" };
    if (newTitle) update.title = newTitle;
    let q = admin.from("punch_list_items").update(update).eq("id", itemId).eq("org_id", profile.org_id);
    if (source) q = q.eq("source", source);
    if (profile.role === "field" && profile.assigned_project_id) q = q.eq("project_id", profile.assigned_project_id);
    await q;
    return NextResponse.json({ success: true });
  }

  if (action === "reject" && itemId) {
    // Reject — delete the item entirely
    let q = admin.from("punch_list_items").delete().eq("id", itemId).eq("org_id", profile.org_id);
    if (source) q = q.eq("source", source);
    if (profile.role === "field" && profile.assigned_project_id) q = q.eq("project_id", profile.assigned_project_id);
    await q;
    return NextResponse.json({ success: true });
  }

  if (action === "approve_all") {
    // Approve all pending items (optionally scoped to a project)
    let q = admin.from("punch_list_items").update({ status: "open" }).eq("status", "pending_review").eq("org_id", profile.org_id);
    if (projectId) q = q.eq("project_id", projectId);
    if (source) q = q.eq("source", source);
    if (profile.role === "field" && profile.assigned_project_id) q = q.eq("project_id", profile.assigned_project_id);
    await q;
    return NextResponse.json({ success: true });
  }

  if (action === "reject_all") {
    let q = admin.from("punch_list_items").delete().eq("status", "pending_review").eq("org_id", profile.org_id);
    if (projectId) q = q.eq("project_id", projectId);
    if (source) q = q.eq("source", source);
    if (profile.role === "field" && profile.assigned_project_id) q = q.eq("project_id", profile.assigned_project_id);
    await q;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
