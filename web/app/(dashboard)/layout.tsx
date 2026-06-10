import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import SessionTimeout from "@/components/SessionTimeout";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*, organizations(name)").eq("id", user.id).single();

  // If user is awaiting approval, show holding screen instead of dashboard
  if (profile?.approval_status === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white text-2xl shadow-md mx-auto mb-6"
            style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-500 mb-6">
            Your account has been created successfully. An administrator needs to approve your access before you can log in.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 mb-6">
            ⏳ You'll receive an email once your account is approved. You can also contact your manager directly.
          </div>
          <div className="text-xs text-gray-400">
            Logged in as <span className="font-semibold">{profile?.email ?? user.email}</span>
          </div>
          <form action="/api/auth/signout" method="POST" className="mt-4">
            <button type="submit" className="text-sm text-gray-500 hover:text-red-500 underline">Sign out</button>
          </form>
        </div>
      </div>
    );
  }

  const role = profile?.role ?? "field";

  // Per-role menu visibility set by an admin on the Role Access page.
  // Guarded: if the table doesn't exist yet, everyone just sees the defaults.
  const menuPrefs: Record<string, string[]> = {};
  if (profile?.org_id) {
    const { data: prefs } = await supabase
      .from("role_menu_prefs").select("role, hidden").eq("org_id", profile.org_id);
    for (const p of prefs ?? []) menuPrefs[p.role] = p.hidden ?? [];
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — desktop only */}
      <div className="hidden lg:flex">
        <Sidebar profile={profile} menuPrefs={menuPrefs} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar profile={profile} />
        {/* Extra padding at bottom on mobile so content doesn't hide behind bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav role={role} />

      {/* Auto-logout after 30 min inactivity */}
      <SessionTimeout />
    </div>
  );
}
