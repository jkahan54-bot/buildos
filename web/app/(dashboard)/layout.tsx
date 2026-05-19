import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*, organizations(name)").eq("id", user.id).single();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — hidden on mobile, shown on desktop */}
      <div className="hidden lg:flex">
        <Sidebar profile={profile} />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar profile={profile} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
