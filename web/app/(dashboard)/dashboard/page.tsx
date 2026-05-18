import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }, { data: incidents }, { data: openRFIs }] =
    await Promise.all([
      supabase.from("profiles").select("*, organizations(name)").eq("id", user.id).single(),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("safety_incidents").select("*").eq("status", "Open"),
      supabase.from("rfis").select("*").eq("status", "Open"),
    ]);

  const totalBudget = projects?.reduce((s, p) => s + (p.budget ?? 0), 0) ?? 0;
  const totalSpent  = projects?.reduce((s, p) => s + (p.spent  ?? 0), 0) ?? 0;

  return (
    <DashboardClient
      profile={profile}
      projects={projects ?? []}
      totalBudget={totalBudget}
      totalSpent={totalSpent}
      openIncidents={incidents?.length ?? 0}
      openRFIs={openRFIs?.length ?? 0}
    />
  );
}
