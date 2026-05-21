"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Clock, ShieldAlert, ClipboardList,
  MessageSquare, FolderKanban, DollarSign, Users, FileText,
  HelpCircle, Milestone, BarChart2, Bot, Camera, CheckSquare,
  CalendarCheck, GitPullRequest, Package
} from "lucide-react";

// Bottom nav items per role — max 5 for clean mobile UX
const BOTTOM_NAV: Record<string, { href:string; label:string; icon:any }[]> = {
  field: [
    { href:"/dashboard",  label:"My Day",     icon:LayoutDashboard },
    { href:"/timelog",    label:"Time",        icon:Clock },
    { href:"/daily-log",  label:"Daily Log",   icon:CalendarCheck },
    { href:"/safety",     label:"Safety",      icon:ShieldAlert },
    { href:"/punch-list", label:"Punch",       icon:ClipboardList },
  ],
  admin: [
    { href:"/dashboard",  label:"Home",        icon:LayoutDashboard },
    { href:"/projects",   label:"Projects",    icon:FolderKanban },
    { href:"/pipeline",   label:"Pipeline",    icon:GitPullRequest },
    { href:"/safety",     label:"Safety",      icon:ShieldAlert },
    { href:"/messages",   label:"Messages",    icon:MessageSquare },
  ],
  owner: [
    { href:"/dashboard",  label:"Home",        icon:LayoutDashboard },
    { href:"/projects",   label:"Projects",    icon:FolderKanban },
    { href:"/milestones", label:"Milestones",  icon:Milestone },
    { href:"/messages",   label:"Messages",    icon:MessageSquare },
  ],
  office: [
    { href:"/dashboard",  label:"Home",        icon:LayoutDashboard },
    { href:"/budget",     label:"Budget",      icon:DollarSign },
    { href:"/reports",    label:"Reports",     icon:BarChart2 },
    { href:"/documents",  label:"Docs",        icon:FileText },
    { href:"/messages",   label:"Messages",    icon:MessageSquare },
  ],
};

export default function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const nav = BOTTOM_NAV[role] ?? BOTTOM_NAV.field;
  const color = { owner:"#7c3aed", admin:"#f97316", office:"#2563eb", field:"#16a34a" }[role] ?? "#f97316";

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-pb"
      style={{ paddingBottom:"env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {nav.map(item => {
          const Icon   = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0 flex-1"
              style={active ? { background: color + "12" } : {}}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8}
                style={{ color: active ? color : "#9ca3af" }} />
              <span className="text-[10px] font-semibold truncate w-full text-center"
                style={{ color: active ? color : "#9ca3af" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
