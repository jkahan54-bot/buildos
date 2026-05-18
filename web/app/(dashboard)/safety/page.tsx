import { createClient } from "@/lib/supabase/server";
import SafetyClient from "./SafetyClient";

export default async function SafetyPage() {
  const supabase = await createClient();
  const [{ data: incidents }, { data: projects }] = await Promise.all([
    supabase.from("safety_incidents").select("*, projects(name), profiles(full_name)").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name"),
  ]);
  return <SafetyClient incidents={incidents ?? []} projects={projects ?? []} />;
}
