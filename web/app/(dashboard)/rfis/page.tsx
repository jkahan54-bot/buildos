import { createClient } from "@/lib/supabase/server";
import RFIsClient from "./RFIsClient";

export default async function RFIsPage() {
  const supabase = await createClient();
  const [{ data: rfis }, { data: projects }] = await Promise.all([
    supabase.from("rfis").select("*, projects(name), profiles(full_name)").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name"),
  ]);
  return <RFIsClient rfis={rfis ?? []} projects={projects ?? []} />;
}
