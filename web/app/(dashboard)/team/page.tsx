import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: members }, { data: timeLogs }, { data: profile }, { data: invitations }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, approval_status, assigned_project_id"),
    supabase.from("time_logs").select("profile_id, hours, clock_in").gte("clock_in", new Date(Date.now() - 7*86400000).toISOString()),
    supabase.from("profiles").select("role, org_id").eq("id", user!.id).single(),
    supabase.from("invitations").select("*").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <TeamClient
      members={members ?? []}
      timeLogs={timeLogs ?? []}
      invitations={invitations ?? []}
      projects={projects ?? []}
      isAdmin={profile?.role === "admin" || profile?.role === "owner"}
      isOwner={profile?.role === "owner"}
    />
  );
}
