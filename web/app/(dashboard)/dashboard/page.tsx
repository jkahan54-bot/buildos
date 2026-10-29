import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }, { data: incidents }, { data: openRFIs }, { data: waitingRFIs }, { data: waitingSubmittals }, { data: waitingCOs }, { data: waitingPunch }, { data: preconStages }] =
    await Promise.all([
      supabase.from("profiles").select("*, organizations(name)").eq("id", user.id).single(),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("safety_incidents").select("*").eq("status", "Open"),
      supabase.from("rfis").select("*").eq("status", "Open"),
      supabase.from("rfis").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).neq("status", "Closed"),
      supabase.from("submittals").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).in("status", ["pending", "under_review"]),
      supabase.from("change_orders").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).eq("status", "submitted"),
      supabase.from("punch_list_items").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).in("status", ["open", "in_progress"]),
      supabase.from("precon_stages").select("*").order("sort_order"),
    ]);

  const totalBudget = projects?.reduce((s, p) => s + (p.budget ?? 0), 0) ?? 0;
  const totalSpent  = projects?.reduce((s, p) => s + (p.spent  ?? 0), 0) ?? 0;

  // Lane a project into Pre-Con / Pending / Running from its precon_stages rows.
  // No rows at all (never had pre-con tracked), or every stage done/na → Running.
  // Only the last stage (Mobilization) still open → Pending. Anything earlier open → Pre-Con.
  const stagesByProject = new Map<string, any[]>();
  for (const s of preconStages ?? []) {
    const list = stagesByProject.get(s.project_id) ?? [];
    list.push(s);
    stagesByProject.set(s.project_id, list);
  }

  const preconProjects: any[] = [];
  const pendingProjects: any[] = [];
  const runningProjects: any[] = [];

  for (const p of projects ?? []) {
    const stages = stagesByProject.get(p.id) ?? [];
    const incomplete = stages.filter(s => !["done", "na"].includes(s.status));

    if (stages.length === 0 || incomplete.length === 0 || p.status !== "active") {
      runningProjects.push(p);
      continue;
    }

    const lastStage = stages.reduce((a, b) => (b.sort_order > a.sort_order ? b : a));
    const onlyMobilizationLeft = incomplete.length === 1 && incomplete[0].id === lastStage.id;
    const currentStage = incomplete.sort((a, b) => a.sort_order - b.sort_order)[0];
    const enriched = { ...p, currentStage: currentStage.stage, stageStatus: currentStage.status, waitingOn: currentStage.waiting_on, waitingFor: currentStage.waiting_for };

    if (onlyMobilizationLeft) pendingProjects.push(enriched);
    else preconProjects.push(enriched);
  }

  const waitingPrecon = (preconStages ?? [])
    .filter(s => s.status === "waiting" && s.waiting_on)
    .map(s => {
      const proj = projects?.find(p => p.id === s.project_id);
      return { id: s.id, title: s.stage, waiting_on: s.waiting_on, created_at: s.updated_at ?? s.created_at, projects: { name: proj?.name }, type: "Pre-Con" };
    });

  const waitingOn = [
    ...(waitingRFIs ?? []).map((r: any) => ({ ...r, type: "RFI" })),
    ...(waitingSubmittals ?? []).map((r: any) => ({ ...r, type: "Submittal" })),
    ...(waitingCOs ?? []).map((r: any) => ({ ...r, type: "Change Order" })),
    ...(waitingPunch ?? []).map((r: any) => ({ ...r, type: "Punch List" })),
    ...waitingPrecon,
  ];

  // ── Per-project health: how fresh is our information, and how long has the oldest ask been open ──
  // Derived from real captured activity (WhatsApp/email tasks + field messages), not hand-set.
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: recentItems }, { data: recentWA }, { data: openAsks }] = await Promise.all([
    supabase.from("punch_list_items").select("project_id, created_at").gte("created_at", since30).order("created_at", { ascending: false }).limit(3000),
    supabase.from("whatsapp_messages").select("project_id, sent_at").gte("sent_at", since30).order("sent_at", { ascending: false }).limit(3000),
    supabase.from("punch_list_items").select("project_id, waiting_on, created_at").not("waiting_on", "is", null).in("status", ["open", "in_progress", "pending_review"]),
  ]);
  const lastUpdate = new Map<string, number>();
  const bump = (id: string | null, iso: string) => { if (!id) return; const t = new Date(iso).getTime(); if (t > (lastUpdate.get(id) ?? 0)) lastUpdate.set(id, t); };
  for (const r of recentItems ?? []) bump((r as any).project_id, (r as any).created_at);
  for (const r of recentWA ?? []) bump((r as any).project_id, (r as any).sent_at);
  const oldestAsk = new Map<string, { days: number; on: string }>();
  for (const r of openAsks ?? []) {
    const id = (r as any).project_id; if (!id) continue;
    const days = Math.floor((Date.now() - new Date((r as any).created_at).getTime()) / 86400000);
    if (days > (oldestAsk.get(id)?.days ?? -1)) oldestAsk.set(id, { days, on: (r as any).waiting_on });
  }
  const health: Record<string, { status: "on_track" | "at_risk" | "needs_attention" | "unknown"; updatedDays: number | null; askDays: number | null; askOn: string | null }> = {};
  for (const p of projects ?? []) {
    const lu = lastUpdate.get(p.id);
    const updatedDays = lu ? Math.floor((Date.now() - lu) / 86400000) : null;
    const ask = oldestAsk.get(p.id);
    const askDays = ask?.days ?? null;
    let status: "on_track" | "at_risk" | "needs_attention" | "unknown";
    if (updatedDays === null) status = "unknown";
    else if ((askDays ?? 0) >= 10 || updatedDays >= 7) status = "needs_attention";
    else if ((askDays ?? 0) >= 5 || updatedDays >= 4) status = "at_risk";
    else status = "on_track";
    health[p.id] = { status, updatedDays, askDays, askOn: ask?.on ?? null };
  }

  return (
    <DashboardClient
      health={health}
      profile={profile}
      projects={runningProjects}
      preconProjects={preconProjects}
      pendingProjects={pendingProjects}
      totalBudget={totalBudget}
      totalSpent={totalSpent}
      openIncidents={incidents?.length ?? 0}
      openRFIs={openRFIs?.length ?? 0}
      waitingOn={waitingOn}
    />
  );
}
