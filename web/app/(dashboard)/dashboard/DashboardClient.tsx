"use client";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { TrendingUp, TrendingDown, AlertTriangle, FolderOpen, DollarSign, Users, Plus } from "lucide-react";

const fmt = (n: number) => n >= 1000000
  ? `$${(n/1000000).toFixed(1)}M`
  : n >= 1000 ? `$${(n/1000).toFixed(0)}K`
  : `$${n}`;

const statusStyle = (s: string) => ({
  active:    { color:"#34d399", bg:"#34d39915", label:"Active"    },
  completed: { color:"#60a5fa", bg:"#60a5fa15", label:"Completed" },
  on_hold:   { color:"#fbbf24", bg:"#fbbf2415", label:"On Hold"   },
  at_risk:   { color:"#f87171", bg:"#f8717115", label:"At Risk"   },
  cancelled: { color:"#6b7280", bg:"#6b728015", label:"Cancelled" },
} as Record<string,any>)[s] ?? { color:"#6b7280", bg:"#6b728015", label:s };

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#16161f] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {fmt(p.value * 1000)}</div>
      ))}
    </div>
  );
};

export default function DashboardClient({ profile, projects, totalBudget, totalSpent, openIncidents, openRFIs }: any) {
  const remaining = totalBudget - totalSpent;
  const spentPct  = totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0;
  const name      = profile?.full_name?.split(" ")[0] ?? "there";

  const chartData = projects.slice(0,6).map((p: any) => ({
    name:    p.name.split(" ")[0],
    budget:  Math.round((p.budget  ?? 0) / 1000),
    spent:   Math.round((p.spent   ?? 0) / 1000),
    progress: p.progress ?? 0,
  }));

  const stats = [
    { label:"Total Budget",    value: fmt(totalBudget),      sub:"across all projects",        icon:DollarSign,    color:"#60a5fa",  trend: null },
    { label:"Spent",           value: fmt(totalSpent),       sub:`${spentPct}% utilized`,      icon:TrendingUp,    color:"#f97316",  trend: spentPct },
    { label:"Remaining",       value: fmt(remaining),        sub:"available budget",           icon:TrendingDown,  color:"#34d399",  trend: null },
    { label:"Open Incidents",  value: openIncidents,         sub:`${openRFIs} open RFIs`,      icon:AlertTriangle, color: openIncidents > 0 ? "#f87171" : "#34d399", trend: null },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
            <span className="mx-1.5 text-gray-700">·</span>
            {projects.length} active project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/projects/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-lg shadow-orange-500/20"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />
          New Project
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-xl border border-white/[0.06] p-4 relative overflow-hidden"
              style={{ background:"linear-gradient(135deg,#0f0f17,#0a0a0f)" }}>
              <div className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: s.color + "15" }}>
                <Icon size={15} style={{ color: s.color }} />
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</div>
              <div className="text-2xl font-bold text-white font-mono tracking-tight">{s.value}</div>
              <div className="text-xs text-gray-600 mt-1">{s.sub}</div>
              {s.trend != null && (
                <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(s.trend,100)}%`, background: s.color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] p-5"
            style={{ background:"linear-gradient(135deg,#0f0f17,#0a0a0f)" }}>
            <div className="font-semibold text-sm text-white mb-4">Budget vs Spent by Project</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barGap={3} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill:"#6b7280", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#6b7280", fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CUSTOM_TOOLTIP />} cursor={{ fill:"rgba(255,255,255,0.03)" }} />
                <Bar dataKey="budget" fill="#60a5fa" radius={[3,3,0,0]} name="Budget" />
                <Bar dataKey="spent"  fill="#f97316" radius={[3,3,0,0]} name="Spent"  />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-5"
            style={{ background:"linear-gradient(135deg,#0f0f17,#0a0a0f)" }}>
            <div className="font-semibold text-sm text-white mb-4">Completion Progress</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill:"#6b7280", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#6b7280", fontSize:11 }} axisLine={false} tickLine={false} domain={[0,100]} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-[#16161f] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
                    <div className="text-gray-400 mb-1">{label}</div>
                    <div className="text-orange-400 font-semibold">{payload[0].value}% complete</div>
                  </div>
                ) : null} cursor={{ fill:"rgba(255,255,255,0.03)" }} />
                <Bar dataKey="progress" radius={[3,3,0,0]} name="Progress">
                  {chartData.map((_: any, i: number) => (
                    <rect key={i} fill="#f97316" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Projects list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Projects</h2>
          <Link href="/projects" className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors">
            View all →
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center"
            style={{ background:"rgba(15,15,23,0.5)" }}>
            <FolderOpen size={36} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No projects yet</p>
            <p className="text-gray-600 text-sm mt-1">Create your first project to get started</p>
            <Link href="/projects/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-orange-500/20"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              <Plus size={14} /> Create Project
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.slice(0,6).map((p: any) => {
              const st  = statusStyle(p.status);
              const pct = p.budget > 0 ? Math.round((p.spent ?? 0) / p.budget * 100) : 0;
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-white/[0.06] px-4 py-3.5 hover:border-white/[0.12] transition-all"
                  style={{ background:"linear-gradient(135deg,#0f0f17,#0a0a0f)" }}>
                  <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: st.color + "60" }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white truncate group-hover:text-orange-300 transition-colors">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{p.phase ?? "—"} · {p.crew_size ?? 0} crew · Due {p.deadline ?? "TBD"}</div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-500">Budget used</div>
                      <div className="text-xs font-mono font-semibold" style={{ color: pct > 90 ? "#f87171" : "#9ca3af" }}>{pct}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Progress</div>
                      <div className="text-sm font-bold font-mono" style={{ color: st.color }}>{p.progress ?? 0}%</div>
                    </div>
                    <div className="w-16">
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width:`${p.progress ?? 0}%`, background: st.color }} />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full hidden md:block"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
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
