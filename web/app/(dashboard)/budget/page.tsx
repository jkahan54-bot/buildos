import { createClient } from "@/lib/supabase/server";
import BudgetClient from "./BudgetClient";

export default async function BudgetPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: items }, { data: invoices }] = await Promise.all([
    supabase.from("projects").select("id, name, budget, spent").order("created_at"),
    supabase.from("budget_items").select("*, projects(name)").order("created_at", { ascending: false }),
    supabase.from("invoices").select("*, projects(name)").order("created_at", { ascending: false }),
  ]);
  return <BudgetClient projects={projects ?? []} items={items ?? []} invoices={invoices ?? []} />;
}
