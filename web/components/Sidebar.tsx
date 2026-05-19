"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, FolderKanban, DollarSign, Users, ShieldAlert,
  FileText, HelpCircle, Mail, Bot, Settings, Clock, CalendarCheck,
  Camera, MessageSquare, CheckSquare, LogOut, Building2, Milestone,
  Receipt, ChevronRight
} from "lucide-react";

const NAV: Record<string, { href:string; label:string; icon:any; badge?:string }[]> = {
  owner: [
    { href:"/dashboard",  label:"Dashboard",   icon:LayoutDashboard },
    { href:"/milestones", label:"Milestones",   icon:Milestone },
    { href:"/projects",   label:"Projects",     icon:FolderKanban },
    { href:"/messages",   label:"Messages",     icon:MessageSquare },
  ],
  admin: [
    { href:"/dashboard",      label:"Dashboard",       icon:LayoutDashboard },
    { href:"/projects",       label:"Projects",        icon:FolderKanban },
    { href:"/milestones",     label:"Milestones",      icon:Milestone },
    { href:"/budget",         label:"Budget",          icon:DollarSign },
    { href:"/team",           label:"Team",            icon:Users },
    { href:"/safety",         label:"Safety",          icon:ShieldAlert },
    { href:"/rfis",           label:"RFIs",            icon:HelpCircle },
    { href:"/documents",      label:"Documents",       icon:FileText },
    { href:"/subcontractors", label:"Subcontractors",  icon:Building2 },
    { href:"/ai-tools",       label:"AI Tools",        icon:Bot, badge:"AI" },
    { href:"/messages",       label:"Messages",        icon:MessageSquare },
    { href:"/settings",       label:"Settings",        icon:Settings },
  ],
  office: [
    { href:"/dashboard",      label:"Dashboard",       icon:LayoutDashboard },
    { href:"/budget",         label:"Budget",          icon:DollarSign },
    { href:"/invoices",       label:"Invoices",        icon:Receipt },
    { href:"/documents",      label:"Documents",       icon:FileText },
    { href:"/subcontractors", label:"Subcontractors",  icon:Building2 },
    { href:"/ai-tools",       label:"AI Tools",        icon:Bot, badge:"AI" },
    { href:"/messages",       label:"Messages",        icon:MessageSquare },
  ],
  field: [
    { href:"/my-day",    label:"My Day",       icon:LayoutDashboard },
    { href:"/timelog",   label:"Time Log",     icon:Clock },
    { href:"/daily-log", label:"Daily Log",    icon:CalendarCheck },
    { href:"/safety",    label:"Safety",       icon:ShieldAlert },
    { href:"/photos",    label:"Photos",       icon:Camera },
    { href:"/rfis",      label:"RFIs",         icon:HelpCircle },
    { href:"/checklist", label:"Checklist",    icon:CheckSquare },
    { href:"/messages",  label:"Messages",     icon:MessageSquare },
  ],
};

const ROLE_META: Record<string,{ label:string; color:string; bg:string }> = {
  owner:  { label:"Owner",          color:"#a78bfa", bg:"#a78bfa1a" },
  admin:  { label:"Administrator",  color:"#f97316", bg:"#f973161a" },
  office: { label:"Office Manager", color:"#60a5fa", bg:"#60a5fa1a" },
  field:  { label:"Field Worker",   color:"#34d399", bg:"#34d3991a" },
};

export default function Sidebar({ profile }: { profile: any }) {
  const pathname = usePathname();
  const router   = useRouter();
  const role     = profile?.role ?? "field";
  const nav      = NAV[role] ?? NAV.field;
  const meta     = ROLE_META[role];

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)
    : "?";

  return (
    <aside className="w-[220px] flex flex-col flex-shrink-0 border-r border-white/[0.06]"
      style={{ background:"linear-gradient(180deg,#0f0f17 0%,#0a0a0f 100%)" }}>

      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-black text-sm"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <div>
            <div className="font-bold text-sm text-white tracking-tight">BuildOS</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: meta.color }}>
              {meta.label}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-0.5">
        {nav.map(item => {
          const Icon   = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/my-day" && pathname.startsWith(item.href + "/"));
          return (
            <Link key={item.href} href={item.href}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                active
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
              }`}
              style={active ? { background: meta.bg, color: meta.color } : {}}>
              <Icon size={15} className="flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: meta.bg, color: meta.color }}>
                  {item.badge}
                </span>
              )}
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: meta.color }} />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-2.5 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: meta.bg, color: meta.color }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{profile?.full_name ?? "User"}</div>
            <div className="text-[10px] text-gray-600 truncate">{profile?.email}</div>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all mt-0.5">
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
