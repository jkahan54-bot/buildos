import { createClient } from "@/lib/supabase/server";
import MilestonesClient from "./MilestonesClient";

export default async function MilestonesPage() {
  const supabase = await createClient();
  const [{ data: milestones }, { data: projects }] = await Promise.all([
    supabase.from("milestones").select("*, projects(name)").order("due_date"),
    supabase.from("projects").select("id, name"),
  ]);
  return <MilestonesClient milestones={milestones ?? []} projects={projects ?? []} />;
}
