"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  owner: [
    { href: "/dashboard",    label: "Dashboard",      icon: "⊞" },
    { href: "/milestones",   label: "Milestones",     icon: "◉" },
    { href: "/messages",     label: "Messages",       icon: "💬" },
  ],
  admin: [
    { href: "/dashboard",      label: "Dashboard",        icon: "⊞" },
    { href: "/projects",       label: "Projects",         icon: "⊟" },
    { href: "/budget",         label: "Budget",           icon: "$" },
    { href: "/team",           label: "Team",             icon: "◉" },
    { href: "/safety",         label: "Safety",           icon: "⚠" },
    { href: "/documents",      label: "Documents",        icon: "▣" },
    { href: "/rfis",           label: "RFIs",             icon: "?" },
    { href: "/subcontractors", label: "Subcontractors",   icon: "📧" },
    { href: "/ai-tools",       label: "AI Tools",         icon: "🤖" },
    { href: "/messages",       label: "Messages",         icon: "💬" },
    { href: "/settings",       label: "Settings",         icon: "⚙" },
  ],
  office: [
    { href: "/dashboard",      label: "Dashboard",        icon: "⊞" },
    { href: "/budget",         label: "Budget",           icon: "$" },
    { href: "/invoices",       label: "Invoices",         icon: "▤" },
    { href: "/documents",      label: "Documents",        icon: "▣" },
    { href: "/subcontractors", label: "Subcontractors",   icon: "📧" },
    { href: "/ai-tools",       label: "AI Tools",         icon: "🤖" },
    { href: "/messages",       label: "Messages",         icon: "💬" },
  ],
  field: [
    { href: "/my-day",    label: "My Day",      icon: "⊙" },
    { href: "/timelog",   label: "Time Log",    icon: "◷" },
    { href: "/daily-log", label: "Daily Log",   icon: "▣" },
    { href: "/safety",    label: "Safety",      icon: "⚠" },
    { href: "/photos",    label: "Photos",      icon: "📷" },
    { href: "/rfis",      label: "RFIs",        icon: "?" },
    { href: "/messages",  label: "Messages",    icon: "💬" },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  owner: "#A855F7", admin: "#F46519", office: "#3B82F6", field: "#22C55E",
};

export default function Sidebar({ profile }: { profile: any }) {
  const pathname = usePathname();
  const router   = useRouter();
  const role     = profile?.role ?? "field";
  const nav      = NAV[role] ?? NAV.field;
  const color    = ROLE_COLORS[role];

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-lg flex-shrink-0">🏗</div>
        <div>
          <div className="font-black text-sm">BuildOS</div>
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
            {profile?.role?.replace(/^\w/, (c: string) => c.toUpperCase()) ?? "Field"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${active
                  ? "font-bold"
                  : "text-gray-500 hover:text-gray-200 hover:bg-surface-card"}`}
              style={active ? { background: color + "22", color, borderLeft: `3px solid ${color}` } : {}}>
              <span className="w-5 text-center text-sm flex-shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-brand/30 border border-brand/40 flex items-center justify-center text-xs font-bold text-brand flex-shrink-0">
            {profile?.full_name?.[0] ?? "?"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">{profile?.full_name ?? "User"}</div>
            <div className="text-xs text-gray-600 truncate">{profile?.email}</div>
          </div>
        </div>
        <button onClick={logout}
          className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-surface-card transition-colors">
          ◀ Sign Out
        </button>
      </div>
    </aside>
  );
}
