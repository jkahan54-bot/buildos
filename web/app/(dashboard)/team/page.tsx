import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const supabase = await createClient();
  const [{ data: members }, { data: projects }, { data: timeLogs }] = await Promise.all([
    supabase.from("profiles").select("*, organizations(name)"),
    supabase.from("projects").select("id, name"),
    supabase.from("time_logs").select("profile_id, hours, clock_in").gte("clock_in", new Date(Date.now() - 7*86400000).toISOString()),
  ]);
  return <TeamClient members={members ?? []} projects={projects ?? []} timeLogs={timeLogs ?? []} />;
}
