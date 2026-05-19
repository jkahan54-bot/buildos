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
    { href:"/ai-tools",       label:"AI Tools",        icon:Bot,        badge:"AI" },
    { href:"/messages",       label:"Messages",        icon:MessageSquare },
    { href:"/settings",       label:"Settings",        icon:Settings },
    { href:"/system",         label:"System Health",   icon:Settings,   badge:"⚡" },
  ],
  office: [
    { href:"/dashboard",      label:"Dashboard",       icon:LayoutDashboard },
    { href:"/budget",         label:"Budget",          icon:DollarSign },
    { href:"/invoices",       label:"Invoices",        icon:Receipt },
    { href:"/documents",      label:"Documents",       icon:FileText },
    { href:"/subcontractors", label:"Subcontractors",  icon:Building2 },
    { href:"/ai-tools",       label:"AI Tools",        icon:Bot,        badge:"AI" },
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
  owner:  { label:"Owner",          color:"#7c3aed", bg:"#ede9fe" },
  admin:  { label:"Administrator",  color:"#ea580c", bg:"#fff7ed" },
  office: { label:"Office Manager", color:"#2563eb", bg:"#eff6ff" },
  field:  { label:"Field Worker",   color:"#16a34a", bg:"#f0fdf4" },
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
    <aside className="w-[220px] flex flex-col flex-shrink-0 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-black text-sm shadow-sm"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <div>
            <div className="font-bold text-sm text-gray-900">BuildOS</div>
            <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ color: meta.color, background: meta.bg }}>
              {meta.label}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {nav.map(item => {
          const Icon   = item.icon;
          const active = pathname === item.href ||
            (item.href !== "/dashboard" && item.href !== "/my-day" && pathname.startsWith(item.href + "/"));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              style={active ? { background: meta.color } : {}}>
              <Icon size={15} className="flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm"
            style={{ background: meta.bg, color: meta.color }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">{profile?.full_name ?? "User"}</div>
            <div className="text-[10px] text-gray-500 truncate">{profile?.email}</div>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all">
          <LogOut size={13} />Sign Out
        </button>
      </div>
    </aside>
  );
}
