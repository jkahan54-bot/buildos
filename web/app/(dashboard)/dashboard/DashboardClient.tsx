"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { TrendingUp, AlertTriangle, FolderOpen, DollarSign, Plus, ArrowUpRight, ShieldAlert, HelpCircle, FileText, Hourglass } from "lucide-react";
import { WAITING_ON_META, WAITING_ON_OPTIONS } from "@/lib/waitingOn";

const TYPE_HREF: Record<string,string> = { RFI:"/rfis", Submittal:"/submittals", "Change Order":"/change-orders", "Punch List":"/punch-list" };

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

const fmtMoney = (n: number) => n >= 1000000
  ? `$${(n/1000000).toFixed(1)}M`
  : n >= 1000 ? `$${(n/1000).toFixed(0)}K`
  : `$${n.toLocaleString()}`;

const statusStyle = (s: string): { color:string; bg:string; text:string; label:string } =>
  (({
    active:    { color:"#16a34a", bg:"#dcfce7", text:"#15803d", label:"Active"    },
    completed: { color:"#2563eb", bg:"#dbeafe", text:"#1d4ed8", label:"Completed" },
    on_hold:   { color:"#d97706", bg:"#fef3c7", text:"#b45309", label:"On Hold"   },
    at_risk:   { color:"#dc2626", bg:"#fee2e2", text:"#b91c1c", label:"At Risk"   },
    cancelled: { color:"#9ca3af", bg:"#f3f4f6", text:"#6b7280", label:"Cancelled" },
  } as any)[s] ?? { color:"#9ca3af", bg:"#f3f4f6", text:"#6b7280", label:s });

export default function DashboardClient({ profile, projects, totalBudget, totalSpent, openIncidents, openRFIs, waitingOn = [] }: any) {
  const remaining = totalBudget - totalSpent;
  const spentPct  = totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0;
  const name      = profile?.full_name?.split(" ")[0] ?? "there";

  const waitingGroups = WAITING_ON_OPTIONS
    .map(category => ({
      category,
      items: waitingOn
        .filter((i: any) => i.waiting_on === category)
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }))
    .filter(g => g.items.length > 0);

  const chartData = projects.slice(0,5).map((p: any) => ({
    name:    p.name.split(" ")[0],
    Budget:  Math.round((p.budget ?? 0) / 1000),
    Spent:   Math.round((p.spent  ?? 0) / 1000),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {name} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{projects.length} active project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/projects/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Stats — 2 cols mobile, 4 desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Total Budget",   value:fmtMoney(totalBudget), sub:`${spentPct}% used`,      icon:DollarSign,  color:"#2563eb", light:"#dbeafe" },
          { label:"Remaining",      value:fmtMoney(remaining),   sub:"available",              icon:TrendingUp,  color:"#16a34a", light:"#dcfce7" },
          { label:"Incidents",      value:openIncidents,          sub:`${openRFIs} open RFIs`, icon:ShieldAlert, color: openIncidents > 0 ? "#dc2626" : "#16a34a", light: openIncidents > 0 ? "#fee2e2" : "#dcfce7" },
          { label:"Projects",       value:projects.length,        sub:"total active",           icon:FolderOpen,  color:"#f97316", light:"#fff7ed" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 leading-tight">{s.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.light }}>
                  <Icon size={13} style={{ color: s.color }} />
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Who We're Waiting On */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Hourglass size={15} className="text-gray-400" />
            <h2 className="font-semibold text-sm text-gray-900">Who We're Waiting On</h2>
          </div>
          {waitingOn.length > 0 && <span className="text-xs text-gray-400">{waitingOn.length} open item{waitingOn.length !== 1 ? "s" : ""}</span>}
        </div>
        {waitingGroups.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400">Nothing pending — the ball's in our court 🎉</div>
        ) : (
          <div className="space-y-4">
            {waitingGroups.map(({ category, items }) => {
              const meta = WAITING_ON_META[category];
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    <span className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((item: any) => (
                      <Link key={`${item.type}-${item.id}`} href={TYPE_HREF[item.type] ?? "#"}
                        className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-all">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{item.type}</span>
                          <span className="text-gray-700 truncate">{item.title}</span>
                          {item.projects?.name && <span className="text-gray-400 text-xs flex-shrink-0 hidden sm:inline">· {item.projects.name}</span>}
                        </div>
                        <span className={`text-xs flex-shrink-0 ${daysAgo(item.created_at) >= 5 ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                          {daysAgo(item.created_at)}d
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart — sm+ only */}
      {projects.length > 0 && (
        <div className="hidden sm:block bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="font-semibold text-sm text-gray-900 mb-4">Budget vs Spent ($K)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barGap={3} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill:"#9ca3af", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#9ca3af", fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, fontSize:12 }}
                formatter={(v: any, name: string) => [`$${v}K`, name]} />
              <Bar dataKey="Budget" fill="#bfdbfe" radius={[3,3,0,0]} />
              <Bar dataKey="Spent"  fill="#f97316" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Projects</h2>
          <Link href="/projects" className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-0.5">
            View all <ArrowUpRight size={12} />
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <FolderOpen size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">No projects yet</p>
            <Link href="/projects/new"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              <Plus size={14} />Create Project
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {projects.slice(0,6).map((p: any, idx: number) => {
              const st = statusStyle(p.status);
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-all ${idx < Math.min(projects.length,6) - 1 ? "border-b border-gray-100" : ""}`}>
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: st.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{p.phase ?? "—"} · {p.crew_size ?? 0} crew</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: st.color }}>{p.progress ?? 0}%</div>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div className="h-full rounded-full" style={{ width:`${p.progress ?? 0}%`, background: st.color }} />
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full hidden sm:block"
                      style={{ background: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile quick actions */}
      <div className="lg:hidden grid grid-cols-2 gap-3">
        {[
          { href:"/safety",    icon:ShieldAlert, label:"Report Incident", color:"#dc2626", bg:"#fee2e2" },
          { href:"/rfis",      icon:HelpCircle,  label:"Submit RFI",      color:"#2563eb", bg:"#dbeafe" },
          { href:"/budget",    icon:DollarSign,  label:"Budget",          color:"#16a34a", bg:"#dcfce7" },
          { href:"/documents", icon:FileText,    label:"Documents",       color:"#f97316", bg:"#fff7ed" },
        ].map(a => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm active:bg-gray-50 transition-all">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
                <Icon size={16} style={{ color: a.color }} />
              </div>
              <span className="text-sm font-medium text-gray-700">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
