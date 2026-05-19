"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { TrendingUp, AlertTriangle, FolderOpen, DollarSign, Users, Plus, ArrowUpRight } from "lucide-react";

const fmtMoney = (n: number) => n >= 1000000
  ? `$${(n/1000000).toFixed(1)}M`
  : n >= 1000 ? `$${(n/1000).toFixed(0)}K`
  : `$${n.toLocaleString()}`;

const statusStyle = (s: string): { color: string; bg: string; text: string; label: string } =>
  (({
    active:    { color:"#16a34a", bg:"#dcfce7", text:"#15803d", label:"Active"    },
    completed: { color:"#2563eb", bg:"#dbeafe", text:"#1d4ed8", label:"Completed" },
    on_hold:   { color:"#d97706", bg:"#fef3c7", text:"#b45309", label:"On Hold"   },
    at_risk:   { color:"#dc2626", bg:"#fee2e2", text:"#b91c1c", label:"At Risk"   },
    cancelled: { color:"#9ca3af", bg:"#f3f4f6", text:"#6b7280", label:"Cancelled" },
  } as any)[s] ?? { color:"#9ca3af", bg:"#f3f4f6", text:"#6b7280", label:s });

export default function DashboardClient({ profile, projects, totalBudget, totalSpent, openIncidents, openRFIs }: any) {
  const remaining = totalBudget - totalSpent;
  const spentPct  = totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0;
  const name      = profile?.full_name?.split(" ")[0] ?? "there";

  const chartData = projects.slice(0,6).map((p: any) => ({
    name:    p.name.split(" ")[0],
    Budget:  Math.round((p.budget  ?? 0) / 1000),
    Spent:   Math.round((p.spent   ?? 0) / 1000),
    Progress: p.progress ?? 0,
  }));

  return (
    <div className="space-y-6 text-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {name} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
            <span className="mx-2 text-gray-300">·</span>
            {projects.length} active project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/projects/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Total Budget",    value:fmtMoney(totalBudget), sub:"across all projects",  icon:DollarSign, color:"#2563eb", light:"#dbeafe" },
          { label:"Total Spent",     value:fmtMoney(totalSpent),  sub:`${spentPct}% utilized`, icon:TrendingUp, color:"#f97316", light:"#fff7ed" },
          { label:"Remaining",       value:fmtMoney(remaining),   sub:"available",             icon:DollarSign, color:"#16a34a", light:"#dcfce7" },
          { label:"Open Incidents",  value:openIncidents,          sub:`${openRFIs} open RFIs`, icon:AlertTriangle,
            color: openIncidents > 0 ? "#dc2626" : "#16a34a",
            light: openIncidents > 0 ? "#fee2e2" : "#dcfce7" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{s.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: s.light }}>
                  <Icon size={15} style={{ color: s.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="font-semibold text-sm text-gray-900 mb-4">Budget vs Spent ($K)</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barGap={3} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill:"#9ca3af", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#9ca3af", fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, fontSize:12, boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  formatter={(v: any, name: string) => [`$${(v as number)}K`, name]} />
                <Bar dataKey="Budget" fill="#bfdbfe" radius={[3,3,0,0]} />
                <Bar dataKey="Spent"  fill="#f97316" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="font-semibold text-sm text-gray-900 mb-4">Completion (%)</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill:"#9ca3af", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#9ca3af", fontSize:11 }} axisLine={false} tickLine={false} domain={[0,100]} />
                <Tooltip
                  contentStyle={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, fontSize:12, boxShadow:"0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  formatter={(v: any) => [`${v}%`, "Progress"]} />
                <Bar dataKey="Progress" fill="#16a34a" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <FolderOpen size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No projects yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first project to get started</p>
            <Link href="/projects/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              <Plus size={14} />Create Project
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {projects.slice(0,6).map((p: any, idx: number) => {
              const st  = statusStyle(p.status);
              const pct = p.budget > 0 ? Math.round((p.spent ?? 0) / p.budget * 100) : 0;
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-all ${idx < projects.slice(0,6).length - 1 ? "border-b border-gray-100" : ""}`}>
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: st.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{p.phase ?? "—"} · {p.crew_size ?? 0} crew · Due {p.deadline ?? "TBD"}</div>
                  </div>
                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="hidden sm:block text-right">
                      <div className="text-xs text-gray-400">Budget used</div>
                      <div className="text-xs font-semibold" style={{ color: pct > 90 ? "#dc2626" : "#374151" }}>{pct}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Progress</div>
                      <div className="text-sm font-bold" style={{ color: st.color }}>{p.progress ?? 0}%</div>
                    </div>
                    <div className="w-20">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width:`${p.progress ?? 0}%`, background: st.color }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full hidden md:block"
                      style={{ background: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
