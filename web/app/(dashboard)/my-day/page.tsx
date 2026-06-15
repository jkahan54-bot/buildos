import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MyDayClient from "./MyDayClient";

export default async function MyDayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const assignedProjectId = profile?.assigned_project_id ?? null;

  let project: any = null;
  if (assignedProjectId) {
    const { data } = await supabase.from("projects").select("*").eq("id", assignedProjectId).maybeSingle();
    project = data;
  } else {
    const { data } = await supabase.from("projects").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    project = data;
  }

  const projectId = project?.id ?? null;

  const [{ data: currentEntry }, { data: todayLog }, { data: punchItems }, { data: incidents }] = await Promise.all([
    supabase.from("time_logs").select("*").eq("profile_id", user.id).is("clock_out", null).maybeSingle(),
    supabase.from("daily_logs").select("created_at").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    projectId
      ? supabase.from("punch_list_items").select("id, title, priority").eq("project_id", projectId).in("status", ["open","in_progress"]).order("created_at", { ascending: false }).limit(8)
      : supabase.from("punch_list_items").select("id, title, priority").in("status", ["open","in_progress"]).order("created_at", { ascending: false }).limit(8),
    projectId
      ? supabase.from("safety_incidents").select("id").eq("project_id", projectId).eq("status", "Open")
      : supabase.from("safety_incidents").select("id").eq("status", "Open"),
  ]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayLogDone = !!todayLog?.created_at && String(todayLog.created_at).startsWith(todayStr);

  return (
    <MyDayClient
      profile={profile}
      project={project}
      currentEntry={currentEntry}
      todayLogDone={todayLogDone}
      punchItems={punchItems ?? []}
      openIncidents={incidents?.length ?? 0}
    />
  );
}
