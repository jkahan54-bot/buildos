import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }, { data: incidents }, { data: openRFIs }, { data: waitingRFIs }, { data: waitingSubmittals }, { data: waitingCOs }, { data: waitingPunch }] =
    await Promise.all([
      supabase.from("profiles").select("*, organizations(name)").eq("id", user.id).single(),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("safety_incidents").select("*").eq("status", "Open"),
      supabase.from("rfis").select("*").eq("status", "Open"),
      supabase.from("rfis").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).neq("status", "Closed"),
      supabase.from("submittals").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).in("status", ["pending", "under_review"]),
      supabase.from("change_orders").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).eq("status", "submitted"),
      supabase.from("punch_list_items").select("id, title, waiting_on, created_at, projects(name)").not("waiting_on", "is", null).in("status", ["open", "in_progress"]),
    ]);

  const totalBudget = projects?.reduce((s, p) => s + (p.budget ?? 0), 0) ?? 0;
  const totalSpent  = projects?.reduce((s, p) => s + (p.spent  ?? 0), 0) ?? 0;

  const waitingOn = [
    ...(waitingRFIs ?? []).map((r: any) => ({ ...r, type: "RFI" })),
    ...(waitingSubmittals ?? []).map((r: any) => ({ ...r, type: "Submittal" })),
    ...(waitingCOs ?? []).map((r: any) => ({ ...r, type: "Change Order" })),
    ...(waitingPunch ?? []).map((r: any) => ({ ...r, type: "Punch List" })),
  ];

  return (
    <DashboardClient
      profile={profile}
      projects={projects ?? []}
      totalBudget={totalBudget}
      totalSpent={totalSpent}
      openIncidents={incidents?.length ?? 0}
      openRFIs={openRFIs?.length ?? 0}
      waitingOn={waitingOn}
    />
  );
}
