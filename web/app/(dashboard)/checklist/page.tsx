import { createClient } from "@/lib/supabase/server";
import ChecklistClient from "./ChecklistClient";

export default async function ChecklistPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: checklists }] = await Promise.all([
    supabase.from("projects").select("id, name, type").order("name"),
    supabase.from("medical_checklists").select("*, projects(name), medical_checklist_items(id, checked)").order("created_at"),
  ]);
  return <ChecklistClient projects={projects ?? []} checklists={checklists ?? []} />;
}
