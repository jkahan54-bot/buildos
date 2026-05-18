import { createClient } from "@/lib/supabase/server";
import TimeLogClient from "./TimeLogClient";

export default async function TimeLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: logs }, { data: projects }, { data: current }] = await Promise.all([
    supabase.from("time_logs").select("*, projects(name)").eq("profile_id", user!.id).order("clock_in", { ascending: false }).limit(30),
    supabase.from("projects").select("id, name"),
    supabase.from("time_logs").select("*").eq("profile_id", user!.id).is("clock_out", null).single(),
  ]);
  return <TimeLogClient logs={logs ?? []} projects={projects ?? []} currentEntry={current} />;
}
