"use client";
import { useState } from "react";
import Link from "next/link";
import { Settings, Sparkles, Menu, X, LayoutDashboard, FolderKanban, DollarSign, Users, ShieldAlert, FileText, HelpCircle, Bot, MessageSquare, Milestone, LogOut, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

const MOBILE_NAV: Record<string, { href: string; label: string; icon: any }[]> = {
  admin: [
    { href:"/dashboard",  label:"Dashboard",  icon:LayoutDashboard },
    { href:"/projects",   label:"Projects",   icon:FolderKanban },
    { href:"/budget",     label:"Budget",     icon:DollarSign },
    { href:"/team",       label:"Team",       icon:Users },
    { href:"/safety",     label:"Safety",     icon:ShieldAlert },
    { href:"/rfis",       label:"RFIs",       icon:HelpCircle },
    { href:"/documents",  label:"Documents",  icon:FileText },
    { href:"/milestones", label:"Milestones", icon:Milestone },
    { href:"/ai-tools",   label:"AI Tools",   icon:Bot },
    { href:"/messages",   label:"Messages",   icon:MessageSquare },
    { href:"/settings",   label:"Settings",   icon:Settings },
  ],
  owner: [
    { href:"/dashboard",  label:"Dashboard",  icon:LayoutDashboard },
    { href:"/milestones", label:"Milestones", icon:Milestone },
    { href:"/projects",   label:"Projects",   icon:FolderKanban },
    { href:"/messages",   label:"Messages",   icon:MessageSquare },
  ],
  office: [
    { href:"/dashboard",  label:"Dashboard",  icon:LayoutDashboard },
    { href:"/budget",     label:"Budget",     icon:DollarSign },
    { href:"/documents",  label:"Documents",  icon:FileText },
    { href:"/messages",   label:"Messages",   icon:MessageSquare },
  ],
  field: [
    { href:"/dashboard",  label:"Dashboard",  icon:LayoutDashboard },
    { href:"/timelog",    label:"Time Log",   icon:Clock },
    { href:"/safety",     label:"Safety",     icon:ShieldAlert },
    { href:"/rfis",       label:"RFIs",       icon:HelpCircle },
    { href:"/messages",   label:"Messages",   icon:MessageSquare },
  ],
};

const ROLE_COLOR: Record<string, string> = {
  owner:"#7c3aed", admin:"#ea580c", office:"#2563eb", field:"#16a34a"
};

export default function TopBar({ profile }: { profile: any }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const org      = (profile as any)?.organizations?.name ?? "BuildOS";
  const role     = profile?.role ?? "field";
  const color    = ROLE_COLOR[role];
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)
    : "?";
  const nav = MOBILE_NAV[role] ?? MOBILE_NAV.field;

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    setMenuOpen(false);
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-3 flex-shrink-0">
        {/* Hamburger — mobile only */}
        <button onClick={() => setMenuOpen(true)}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all">
          <Menu size={20} />
        </button>

        {/* Logo — mobile only */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <span className="font-bold text-gray-900 text-sm">BuildOS</span>
        </div>

        <span className="hidden lg:block text-sm font-medium text-gray-500">{org}</span>
        <div className="flex-1" />

        <Link href="/ai-tools"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-all">
          <Sparkles size={12} />AI Tools
        </Link>
        <Link href="/settings"
          className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
          <Settings size={16} />
        </Link>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ background: color + "20", color }}>
          {initials}
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          {/* Panel */}
          <div className="relative w-[280px] bg-white h-full flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                  style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
                <div>
                  <div className="font-bold text-sm text-gray-900">BuildOS</div>
                  <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block"
                    style={{ color, background: color + "15" }}>{profile?.role}</div>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {nav.map(item => {
                const Icon   = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      active ? "text-white" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    style={active ? { background: color } : {}}>
                    <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-gray-100">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: color + "15", color }}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">{profile?.email}</div>
                </div>
              </div>
              <button onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all">
                <LogOut size={15} />Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
