import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("*").order("created_at", { ascending: false });

  const statusColor = (s: string) =>
    ({ active:"#22C55E", completed:"#3B82F6", on_hold:"#F59E0B", cancelled:"#EF4444" }[s] ?? "#6B7280");

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{projects?.length ?? 0} total projects</p>
        </div>
        <Link href="/projects/new" className="bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">
          + New Project
        </Link>
      </div>

      {!projects?.length ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <div className="text-5xl mb-4">🏗</div>
          <p className="text-gray-400 font-semibold text-lg">No projects yet</p>
          <p className="text-gray-600 text-sm mt-1">Create your first project to get started</p>
          <Link href="/projects/new" className="inline-block mt-5 bg-brand text-white font-bold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-colors">
            + Create Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map(p => {
            const col = statusColor(p.status);
            const pct = p.budget > 0 ? Math.round((p.spent ?? 0) / p.budget * 100) : 0;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg">{p.name}</h2>
                      {p.type === "medical_facility" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          🏥 Medical
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      {p.sq_footage?.toLocaleString()} sq ft · {p.crew_size} crew · Due {p.deadline ?? "TBD"}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: col+"22", color: col }}>
                    {p.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Completion</div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${p.progress}%`, background: col }} />
                    </div>
                    <div className="text-sm font-bold font-mono mt-1" style={{ color: col }}>{p.progress}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Budget Used</div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${Math.min(pct,100)}%`, background: pct>90?"#EF4444":pct>75?"#F59E0B":"#22C55E" }} />
                    </div>
                    <div className="text-xs font-mono mt-1 text-gray-400">
                      ${(p.spent ?? 0).toLocaleString()} / ${(p.budget ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{p.phase ?? "No phase set"}</span>
                  <div className="flex gap-2">
                    <Link href={`/projects/${p.id}`} className="text-sm font-bold px-3 py-1.5 rounded-lg border border-border text-gray-300 hover:border-gray-400 transition-colors">View</Link>
                    <Link href={`/projects/${p.id}/edit`} className="text-sm font-bold px-3 py-1.5 rounded-lg bg-surface-card border border-border text-gray-300 hover:border-gray-400 transition-colors">Edit</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
