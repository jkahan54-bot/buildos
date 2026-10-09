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

  return (
    <DashboardClient
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
