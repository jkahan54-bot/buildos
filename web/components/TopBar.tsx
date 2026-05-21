"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Settings, Sparkles, Menu, X, LayoutDashboard, FolderKanban, DollarSign, Users, ShieldAlert, FileText, HelpCircle, Bot, MessageSquare, Milestone, LogOut, Clock, ChevronDown, Eye, Receipt, GitPullRequest, Calculator, BarChart2, FileSignature, Building2, Calendar, Users2, Globe, ClipboardList, CalendarCheck, Camera, CheckSquare, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

const MOBILE_NAV: Record<string, { href: string; label: string; icon: any }[]> = {
  admin: [
    { href:"/dashboard",      label:"Dashboard",     icon:LayoutDashboard },
    { href:"/pipeline",       label:"Pipeline",      icon:GitPullRequest },
    { href:"/projects",       label:"Projects",      icon:FolderKanban },
    { href:"/budget",         label:"Budget",        icon:DollarSign },
    { href:"/change-orders",  label:"Change Orders", icon:GitPullRequest },
    { href:"/invoices",       label:"Invoices",      icon:Receipt },
    { href:"/quotes",         label:"Quote Builder", icon:Calculator },
    { href:"/reports",        label:"Reports",       icon:BarChart2 },
    { href:"/team",           label:"Team",          icon:Users },
    { href:"/safety",         label:"Safety",        icon:ShieldAlert },
    { href:"/rfis",           label:"RFIs",          icon:HelpCircle },
    { href:"/submittals",     label:"Submittals",    icon:FileSignature },
    { href:"/punch-list",     label:"Punch List",    icon:ClipboardList },
    { href:"/documents",      label:"Documents",     icon:FileText },
    { href:"/schedule",       label:"Schedule",      icon:Calendar },
    { href:"/milestones",     label:"Milestones",    icon:Milestone },
    { href:"/subcontractors", label:"Subcontractors",icon:Building2 },
    { href:"/equipment",      label:"Equipment",     icon:Package },
    { href:"/meetings",       label:"Meetings",      icon:Users2 },
    { href:"/ai-tools",       label:"AI Tools",      icon:Bot },
    { href:"/ai-camera",      label:"AI Camera",     icon:Camera },
    { href:"/ai-takeoff",     label:"AI Takeoff",    icon:Calculator },
    { href:"/portal",         label:"Client Portal", icon:Globe },
    { href:"/messages",       label:"Messages",      icon:MessageSquare },
    { href:"/settings",       label:"Settings",      icon:Settings },
  ],
  owner: [
    { href:"/dashboard",  label:"Dashboard",  icon:LayoutDashboard },
    { href:"/milestones", label:"Milestones", icon:Milestone },
    { href:"/projects",   label:"Projects",   icon:FolderKanban },
    { href:"/messages",   label:"Messages",   icon:MessageSquare },
  ],
  office: [
    { href:"/dashboard",      label:"Dashboard",     icon:LayoutDashboard },
    { href:"/projects",       label:"Projects",      icon:FolderKanban },
    { href:"/budget",         label:"Budget",        icon:DollarSign },
    { href:"/invoices",       label:"Invoices",      icon:Receipt },
    { href:"/change-orders",  label:"Change Orders", icon:GitPullRequest },
    { href:"/quotes",         label:"Quotes",        icon:Calculator },
    { href:"/reports",        label:"Reports",       icon:BarChart2 },
    { href:"/documents",      label:"Documents",     icon:FileText },
    { href:"/submittals",     label:"Submittals",    icon:FileSignature },
    { href:"/subcontractors", label:"Subcontractors",icon:Building2 },
    { href:"/team",           label:"Team",          icon:Users },
    { href:"/milestones",     label:"Milestones",    icon:Milestone },
    { href:"/schedule",       label:"Schedule",      icon:Calendar },
    { href:"/meetings",       label:"Meetings",      icon:Users2 },
    { href:"/portal",         label:"Client Portal", icon:Globe },
    { href:"/ai-tools",       label:"AI Tools",      icon:Bot },
    { href:"/messages",       label:"Messages",      icon:MessageSquare },
    { href:"/settings",       label:"Settings",      icon:Settings },
  ],
  field: [
    { href:"/dashboard",  label:"Dashboard",  icon:LayoutDashboard },
    { href:"/timelog",    label:"Time Log",   icon:Clock },
    { href:"/daily-log",  label:"Daily Log",  icon:CalendarCheck },
    { href:"/safety",     label:"Safety",     icon:ShieldAlert },
    { href:"/punch-list", label:"Punch List", icon:ClipboardList },
    { href:"/rfis",       label:"RFIs",       icon:HelpCircle },
    { href:"/photos",     label:"Photos",     icon:Camera },
    { href:"/checklist",  label:"Checklist",  icon:CheckSquare },
    { href:"/messages",   label:"Messages",   icon:MessageSquare },
  ],
};

const ROLE_META: Record<string, { color: string; label: string; bg: string }> = {
  owner:  { color:"#7c3aed", label:"Owner",          bg:"#ede9fe" },
  admin:  { color:"#ea580c", label:"Administrator",  bg:"#fff7ed" },
  office: { color:"#2563eb", label:"Office Manager", bg:"#eff6ff" },
  field:  { color:"#16a34a", label:"Field Worker",   bg:"#f0fdf4" },
};

export default function TopBar({ profile }: { profile: any }) {
  const [menuOpen, setMenuOpen]     = useState(false);
  const [rolePickerOpen, setRolePicker] = useState(false);
  const [previewRole, setPreviewRole]   = useState<string | null>(null);
  const router   = useRouter();
  const pathname = usePathname();

  const actualRole = profile?.role ?? "field";
  const isAdmin    = actualRole === "admin" || actualRole === "owner";

  // Load preview role from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("buildos_preview_role");
    if (stored && stored !== actualRole) setPreviewRole(stored);
  }, [actualRole]);

  const activeRole  = previewRole ?? actualRole;
  const meta        = ROLE_META[activeRole] ?? ROLE_META.field;
  const org         = (profile as any)?.organizations?.name ?? "BuildOS";
  const initials    = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)
    : "?";
  const nav = MOBILE_NAV[activeRole] ?? MOBILE_NAV.field;

  const switchRole = (role: string) => {
    if (role === actualRole) {
      localStorage.removeItem("buildos_preview_role");
      setPreviewRole(null);
    } else {
      localStorage.setItem("buildos_preview_role", role);
      setPreviewRole(role);
    }
    setRolePicker(false);
    // Dispatch event so Sidebar updates too
    window.dispatchEvent(new CustomEvent("buildos_role_change", { detail: role === actualRole ? null : role }));
    router.push("/dashboard");
  };

  const logout = async () => {
    localStorage.removeItem("buildos_preview_role");
    await createClient().auth.signOut();
    router.push("/login");
    setMenuOpen(false);
  };

  return (
    <>
      {/* Preview banner */}
      {previewRole && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-700">
            <Eye size={13} />
            <span>Previewing as <strong>{meta.label}</strong> — you are still an Administrator</span>
          </div>
          <button onClick={() => switchRole(actualRole)}
            className="text-amber-600 font-semibold hover:text-amber-800 transition-colors">
            Back to Admin ×
          </button>
        </div>
      )}

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

        {/* Role toggle — admin only */}
        {isAdmin && (
          <div className="relative hidden sm:block">
            <button onClick={() => setRolePicker(!rolePickerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-50"
              style={{ color: meta.color, borderColor: meta.color + "40", background: meta.bg }}>
              <Eye size={11} />
              {meta.label}
              <ChevronDown size={11} />
            </button>
            {rolePickerOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-50 w-44">
                <div className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">View as role</div>
                {Object.entries(ROLE_META).map(([r, m]) => (
                  <button key={r} onClick={() => switchRole(r)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-all ${activeRole === r ? "font-semibold" : ""}`}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span style={{ color: activeRole === r ? m.color : "#374151" }}>{m.label}</span>
                    {activeRole === r && <span className="ml-auto text-[10px] text-gray-400">{r === actualRole ? "you" : "preview"}</span>}
                  </button>
                ))}
              </div>
            )}
            {rolePickerOpen && <div className="fixed inset-0 z-40" onClick={() => setRolePicker(false)} />}
          </div>
        )}

        <Link href="/ai-tools"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-all">
          <Sparkles size={12} />AI Tools
        </Link>
        <Link href="/settings"
          className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
          <Settings size={16} />
        </Link>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ background: meta.color + "20", color: meta.color }}>
          {initials}
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="relative w-[280px] bg-white h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                  style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
                <div>
                  <div className="font-bold text-sm text-gray-900">BuildOS</div>
                  <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block"
                    style={{ color: meta.color, background: meta.bg }}>{meta.label}</div>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Mobile role switcher */}
            {isAdmin && (
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5 px-1">View as</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ROLE_META).map(([r, m]) => (
                    <button key={r} onClick={() => { switchRole(r); setMenuOpen(false); }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
                      style={ activeRole === r
                        ? { color: m.color, borderColor: m.color, background: m.bg }
                        : { color:"#6b7280", borderColor:"#e5e7eb" }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {nav.map(item => {
                const Icon   = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${active ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    style={active ? { background: meta.color } : {}}>
                    <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="px-3 py-4 border-t border-gray-100">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: meta.color + "15", color: meta.color }}>
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
