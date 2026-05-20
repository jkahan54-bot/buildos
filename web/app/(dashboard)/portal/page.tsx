import { createClient } from "@/lib/supabase/server";
import PortalClient from "./PortalClient";

export default async function ClientPortalPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, progress, phase, budget, spent, deadline")
    .order("name");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";
  return <PortalClient projects={projects ?? []} appUrl={appUrl} />;
}
