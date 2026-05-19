import { createClient } from "@/lib/supabase/server";
import MessagesClient from "./MessagesClient";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: channels }, { data: profile }] = await Promise.all([
    supabase.from("message_channels").select("*, projects(name)").order("created_at"),
    supabase.from("profiles").select("id, full_name").eq("id", user!.id).single(),
  ]);
  return <MessagesClient channels={channels ?? []} userId={user!.id} userName={profile?.full_name ?? "You"} />;
}
