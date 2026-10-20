"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, FolderKanban, DollarSign, Users, ShieldAlert,
  FileText, HelpCircle, Bot, Settings, Clock, CalendarCheck,
  Camera, MessageSquare, CheckSquare, LogOut, Building2, Milestone,
  Receipt, ChevronRight, GitPullRequest, ClipboardList, Package,
  Calendar, BarChart2, Calculator, FileSignature, Globe, Wrench,
  Users2, Shield, Lock
} from "lucide-react";

export const NAV: Record<string, { href:string; label:string; icon:any; badge?:string }[]> = {
  // Master Owner — everything
  owner: [
    { href:"/dashboard",       label:"Dashboard",       icon:LayoutDashboard },
    { href:"/command",         label:"Command Center",  icon:Bot },
    { href:"/sites",           label:"Site Command",    icon:BarChart2 },
    { href:"/daily-summary",   label:"Daily Review",    icon:ClipboardList },
    { href:"/pipeline",        label:"Pipeline",        icon:GitPullRequest },
    { href:"/precon",          label:"Pre-Con",         icon:FileSignature },
    { href:"/walkthroughs",    label:"Walkthroughs",    icon:Camera },
    { href:"/projects",        label:"Projects",        icon:FolderKanban },
    { href:"/milestones",      label:"Milestones",      icon:Milestone },
    { href:"/budget",          label:"Budget",          icon:DollarSign },
    { href:"/team",            label:"Team",            icon:Users },
    { href:"/safety",          label:"Safety",          icon:ShieldAlert },
    { href:"/rfis",            label:"RFIs",            icon:HelpCircle },
    { href:"/documents",       label:"Documents",       icon:FileText },
    { href:"/subcontractors",  label:"Subcontractors",  icon:Building2 },
    { href:"/change-orders",   label:"Change Orders",   icon:GitPullRequest },
    { href:"/submittals",      label:"Submittals",      icon:FileSignature },
    { href:"/punch-list",      label:"Punch List",      icon:ClipboardList },
    { href:"/schedule",        label:"Schedule",        icon:Calendar },
    { href:"/equipment",       label:"Equipment",       icon:Package },
    { href:"/meetings",        label:"Meetings",        icon:Users2 },
    { href:"/invoices",        label:"Invoices",        icon:Receipt },
    { href:"/reports",         label:"Reports",         icon:BarChart2 },
    { href:"/ai-tools",        label:"AI Tools",        icon:Bot,        badge:"AI" },
    { href:"/ai-camera",       label:"AI Camera",       icon:Camera,     badge:"AI" },
    { href:"/ai-takeoff",      label:"AI Takeoff",      icon:Calculator, badge:"AI" },
    { href:"/quotes",          label:"Quote Builder",   icon:Receipt },
    { href:"/portal",          label:"Client Portal",   icon:Globe },
    { href:"/messages",        label:"Messages",        icon:MessageSquare },
    { href:"/permissions",     label:"Role Access",     icon:Lock },
    { href:"/settings",        label:"Settings",        icon:Settings },
    { href:"/security",        label:"Security Log",    icon:Shield },
    { href:"/system",          label:"System Health",   icon:Settings },
  ],
  // Jobsite Owner — high-level project visibility only
  jobsite_owner: [
    { href:"/dashboard",  label:"Dashboard",   icon:LayoutDashboard },
    { href:"/milestones", label:"Milestones",   icon:Milestone },
    { href:"/projects",   label:"Projects",     icon:FolderKanban },
    { href:"/schedule",   label:"Schedule",     icon:Calendar },
    { href:"/documents",  label:"Documents",    icon:FileText },
    { href:"/messages",   label:"Messages",     icon:MessageSquare },
  ],
  admin: [
    { href:"/dashboard",      label:"Dashboard",       icon:LayoutDashboard },
    { href:"/sites",          label:"Site Command",    icon:BarChart2 },
    { href:"/daily-summary",  label:"Daily Review",    icon:ClipboardList },
    { href:"/pipeline",       label:"Pipeline",        icon:GitPullRequest },
    { href:"/precon",         label:"Pre-Con",         icon:FileSignature },
    { href:"/walkthroughs",   label:"Walkthroughs",    icon:Camera },
    { href:"/projects",       label:"Projects",        icon:FolderKanban },
    { href:"/milestones",     label:"Milestones",      icon:Milestone },
    { href:"/budget",         label:"Budget",          icon:DollarSign },
    { href:"/team",           label:"Team",            icon:Users },
    { href:"/safety",         label:"Safety",          icon:ShieldAlert },
    { href:"/rfis",           label:"RFIs",            icon:HelpCircle },
    { href:"/documents",      label:"Documents",       icon:FileText },
    { href:"/subcontractors", label:"Subcontractors",  icon:Building2 },
    { href:"/change-orders",  label:"Change Orders",   icon:GitPullRequest },
    { href:"/submittals",     label:"Submittals",      icon:FileSignature },
    { href:"/punch-list",     label:"Punch List",      icon:ClipboardList },
    { href:"/schedule",       label:"Schedule",        icon:Calendar },
    { href:"/equipment",      label:"Equipment",       icon:Package },
    { href:"/meetings",       label:"Meetings",        icon:Users2 },
    { href:"/reports",        label:"Reports",         icon:BarChart2 },
    { href:"/ai-tools",       label:"AI Tools",        icon:Bot,        badge:"AI" },
    { href:"/ai-camera",      label:"AI Camera",       icon:Camera,     badge:"AI" },
    { href:"/ai-takeoff",     label:"AI Takeoff",      icon:Calculator, badge:"AI" },
    { href:"/quotes",         label:"Quote Builder",   icon:Receipt },
    { href:"/portal",         label:"Client Portal",   icon:Globe },
    { href:"/messages",       label:"Messages",        icon:MessageSquare },
    { href:"/permissions",    label:"Role Access",     icon:Lock },
    { href:"/settings",       label:"Settings",        icon:Settings },
    { href:"/security",       label:"Security Log",    icon:Shield },
    { href:"/system",         label:"System Health",   icon:Settings },
  ],
  office: [
    { href:"/dashboard",      label:"Dashboard",       icon:LayoutDashboard },
    { href:"/sites",          label:"Site Command",    icon:BarChart2 },
    { href:"/daily-summary",  label:"Daily Review",    icon:ClipboardList },
    { href:"/pipeline",       label:"Pipeline",        icon:GitPullRequest },
    { href:"/precon",         label:"Pre-Con",         icon:FileSignature },
    { href:"/projects",       label:"Projects",        icon:FolderKanban },
    { href:"/budget",         label:"Budget",          icon:DollarSign },
    { href:"/invoices",       label:"Invoices",        icon:Receipt },
    { href:"/change-orders",  label:"Change Orders",   icon:GitPullRequest },
    { href:"/quotes",         label:"Quote Builder",   icon:Calculator },
    { href:"/reports",        label:"Reports",         icon:BarChart2 },
    { href:"/documents",      label:"Documents",       icon:FileText },
    { href:"/submittals",     label:"Submittals",      icon:FileSignature },
    { href:"/subcontractors", label:"Subcontractors",  icon:Building2 },
    { href:"/team",           label:"Team",            icon:Users },
    { href:"/milestones",     label:"Milestones",      icon:Milestone },
    { href:"/schedule",       label:"Schedule",        icon:Calendar },
    { href:"/meetings",       label:"Meetings",        icon:Users2 },
    { href:"/portal",         label:"Client Portal",   icon:Globe },
    { href:"/ai-tools",       label:"AI Tools",        icon:Bot,        badge:"AI" },
    { href:"/ai-takeoff",     label:"AI Takeoff",      icon:Calculator, badge:"AI" },
    { href:"/messages",       label:"Messages",        icon:MessageSquare },
    { href:"/settings",       label:"Settings",        icon:Settings },
  ],
  field: [
    { href:"/my-day",         label:"My Day",        icon:LayoutDashboard },
    { href:"/daily-summary",  label:"Daily Review",  icon:ClipboardList },
    { href:"/timelog",        label:"Time Log",      icon:Clock },
    { href:"/daily-log",      label:"Daily Log",     icon:CalendarCheck },
    { href:"/walkthroughs",   label:"Walkthroughs",  icon:Camera },
    { href:"/projects",       label:"Projects",      icon:FolderKanban },
    { href:"/schedule",       label:"Schedule",      icon:Calendar },
    { href:"/milestones",     label:"Milestones",    icon:Milestone },
    { href:"/safety",         label:"Safety",        icon:ShieldAlert },
    { href:"/photos",         label:"Photos",        icon:Camera },
    { href:"/ai-camera",      label:"AI Camera",     icon:Bot,           badge:"AI" },
    { href:"/ai-tools",       label:"AI Tools",      icon:Bot,           badge:"AI" },
    { href:"/rfis",           label:"RFIs",          icon:HelpCircle },
    { href:"/punch-list",     label:"Punch List",    icon:ClipboardList },
    { href:"/checklist",      label:"Checklist",     icon:CheckSquare },
    { href:"/subcontractors", label:"Subcontractors",icon:Building2 },
    { href:"/documents",      label:"Documents",     icon:FileText },
    { href:"/messages",       label:"Messages",      icon:MessageSquare },
  ],
};

// Flat, desaturated role tints — a label and a color, no decorative icons.
export const ROLE_META: Record<string,{ label:string; color:string; bg:string; icon?:string }> = {
  owner:         { label:"Master Owner",   color:"#92400e", bg:"#fef3c7" },
  jobsite_owner: { label:"Jobsite Owner",  color:"#6d28d9", bg:"#f3f0ff" },
  admin:         { label:"Administrator",  color:"#c2410c", bg:"#fff1e8" },
  office:        { label:"Office Manager", color:"#1d4ed8", bg:"#eef3ff" },
  field:         { label:"Field Worker",   color:"#15803d", bg:"#effaf1" },
};

// Menu sections — items are grouped under these headers in the sidebar.
// Any href not listed falls into "General". Section order below.
export const SECTION_ORDER = ["Overview", "Pre-Construction", "Project", "Field", "Financial", "People", "Tools", "Admin"] as const;
export const SECTION_MAP: Record<string, string> = {
  "/dashboard": "Overview", "/my-day": "Overview", "/sites": "Overview", "/command": "Overview", "/daily-summary": "Overview",
  "/pipeline": "Pre-Construction", "/precon": "Pre-Construction", "/quotes": "Pre-Construction", "/ai-takeoff": "Pre-Construction",
  "/projects": "Project", "/milestones": "Project", "/schedule": "Project", "/punch-list": "Project", "/rfis": "Project",
  "/submittals": "Project", "/change-orders": "Project", "/walkthroughs": "Project", "/documents": "Project",
  "/safety": "Field", "/photos": "Field", "/daily-log": "Field", "/timelog": "Field", "/checklist": "Field",
  "/ai-camera": "Field", "/equipment": "Field",
  "/budget": "Financial", "/invoices": "Financial", "/reports": "Financial",
  "/team": "People", "/subcontractors": "People", "/meetings": "People", "/messages": "People", "/portal": "People",
  "/ai-tools": "Tools",
  "/permissions": "Admin", "/settings": "Admin", "/security": "Admin", "/system": "Admin",
};

export function groupNav(nav: { href:string; label:string; icon:any; badge?:string }[]) {
  const groups: { section: string; items: typeof nav }[] = [];
  for (const section of [...SECTION_ORDER, "General"]) {
    const items = nav.filter(i => (SECTION_MAP[i.href] ?? "General") === section);
    if (items.length) groups.push({ section, items });
  }
  return groups;
}

export default function Sidebar({ profile, menuPrefs }: { profile: any; menuPrefs?: Record<string, string[]> }) {
  const pathname = usePathname();
  const router   = useRouter();
  const actualRole = profile?.role ?? "field";
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  useEffect(() => {
    // Load preview role from localStorage
    const stored = localStorage.getItem("buildos_preview_role");
    if (stored && stored !== actualRole) setPreviewRole(stored);
    // Listen for role changes from TopBar
    const handler = (e: CustomEvent) => setPreviewRole(e.detail);
    window.addEventListener("buildos_role_change", handler as EventListener);
    return () => window.removeEventListener("buildos_role_change", handler as EventListener);
  }, [actualRole]);

  const role = previewRole ?? actualRole;
  // Admin can hide menu items per role via the Role Access page; filter those out.
  // The Role Access page itself is never hidden so an admin can't lock themselves out.
  const hidden = menuPrefs?.[role] ?? [];
  const nav  = (NAV[role] ?? NAV.field).filter(item => item.href === "/permissions" || !hidden.includes(item.href));
  const meta = ROLE_META[role];

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)
    : "?";

  const groups = groupNav(nav);

  return (
    <aside className="w-[230px] flex flex-col flex-shrink-0 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm bg-gray-900">B</div>
          <div>
            <div className="font-semibold text-sm text-gray-900 tracking-tight">BuildOS</div>
            <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-flex items-center"
              style={{ color: meta.color, background: meta.bg }}>
              {meta.label}
            </div>
          </div>
        </div>
      </div>

      {/* Nav — grouped sections */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {groups.map(({ section, items }) => (
          <div key={section} className="mb-3">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">{section}</div>
            <div className="space-y-px">
              {items.map(item => {
                const Icon   = item.icon;
                const active = pathname === item.href ||
                  (item.href !== "/dashboard" && item.href !== "/my-day" && pathname.startsWith(item.href + "/"));
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-all ${
                      active
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}>
                    <Icon size={15} className="flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${active ? "bg-white/15 text-white" : "bg-gray-100 text-gray-500"}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: meta.bg, color: meta.color }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">{profile?.full_name ?? "User"}</div>
            <div className="text-[10px] text-gray-500 truncate">{profile?.email}</div>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all">
          <LogOut size={13} />Sign Out
        </button>
      </div>
    </aside>
  );
}
