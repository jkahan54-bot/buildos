"use client";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";

const PIE_COLORS = ["#F46519","#3B82F6","#22C55E","#A855F7"];
const fmt = (n: number) => "$" + n.toLocaleString();
const statusColor = (s: string) =>
  ({ "active":"#22C55E", "completed":"#3B82F6", "on_hold":"#F59E0B", "at_risk":"#EF4444" }[s] ?? "#6B7280");

export default function DashboardClient({
  profile, projects, totalBudget, totalSpent, openIncidents, openRFIs
}: any) {
  const remaining  = totalBudget - totalSpent;
  const spentPct   = totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0;

  const pieData = [
    { name: "Spent",     value: Math.round(totalSpent / 1000) },
    { name: "Remaining", value: Math.round(remaining / 1000)  },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            Welcome back, {profile?.full_name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
            {" · "}{projects.length} active project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/projects/new"
          className="bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">
          + New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Total Budget",    value: fmt(totalBudget), sub:"Across all projects",  color:"#3B82F6" },
          { label:"Total Spent",     value: fmt(totalSpent),  sub:`${spentPct}% of budget`, color:"#F46519" },
          { label:"Remaining",       value: fmt(remaining),   sub:"Budget left",           color:"#22C55E" },
          { label:"Safety Alerts",   value: openIncidents,    sub:"Open incidents",         color: openIncidents > 0 ? "#EF4444" : "#22C55E" },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-5">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">{s.label}</div>
            <div className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="font-bold text-sm mb-4">Budget Overview</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={4}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => `$${v}K`}
                contentStyle={{ background:"#16161A", border:"1px solid #222226", borderRadius:6, fontSize:12, color:"#F5F5F5" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="font-bold text-sm mb-4">Project Progress</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={projects.slice(0,6).map((p: any) => ({ name: p.name.split(" ")[0], progress: p.progress }))}>
              <XAxis dataKey="name" tick={{ fill:"#6B7280", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#6B7280", fontSize:11 }} axisLine={false} tickLine={false} domain={[0,100]} />
              <Tooltip contentStyle={{ background:"#16161A", border:"1px solid #222226", borderRadius:6, fontSize:12, color:"#F5F5F5" }} />
              <Bar dataKey="progress" fill="#F46519" radius={[4,4,0,0]} name="Progress %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Projects list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Projects</h2>
          <Link href="/projects" className="text-sm text-brand hover:underline">View all →</Link>
        </div>
        {projects.length === 0 ? (
          <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center">
            <div className="text-4xl mb-3">🏗</div>
            <p className="text-gray-400 font-semibold">No projects yet</p>
            <Link href="/projects/new" className="inline-block mt-4 bg-brand text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-brand-dark transition-colors">
              + Create First Project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.slice(0,5).map((p: any) => {
              const col = statusColor(p.status);
              const pct = p.budget > 0 ? Math.round(p.spent / p.budget * 100) : 0;
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="bg-surface rounded-xl border border-border p-4 flex items-center gap-4 hover:border-gray-500 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{p.phase ?? "—"} · {p.crew_size} crew · Due {p.deadline ?? "TBD"}</div>
                    <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width:`${p.progress}%`, background: col }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black text-lg font-mono" style={{ color: col }}>{p.progress}%</div>
                    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: col+"22", color: col }}>
                      {p.status}
                    </span>
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
