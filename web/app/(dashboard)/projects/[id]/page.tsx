import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const [{ data: project }, { data: checklists }, { data: incidents }, { data: rfis }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", params.id).single(),
    supabase.from("medical_checklists").select("*, medical_checklist_items(id, checked)").eq("project_id", params.id),
    supabase.from("safety_incidents").select("id, status").eq("project_id", params.id),
    supabase.from("rfis").select("id, status").eq("project_id", params.id),
  ]);

  if (!project) notFound();

  const statusColor = (s: string) =>
    ({ active:"#22C55E", completed:"#3B82F6", on_hold:"#F59E0B", cancelled:"#EF4444" }[s] ?? "#6B7280");
  const col = statusColor(project.status);
  const pct = project.budget > 0 ? Math.round((project.spent ?? 0) / project.budget * 100) : 0;

  const totalChecklistItems    = checklists?.reduce((s, cl) => s + (cl.medical_checklist_items?.length ?? 0), 0) ?? 0;
  const completedChecklistItems = checklists?.reduce((s, cl) => s + (cl.medical_checklist_items?.filter((i: any) => i.checked).length ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/projects" className="text-sm text-brand hover:underline">← All Projects</Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-black">{project.name}</h1>
            {project.type === "medical_facility" && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                🏥 Medical
              </span>
            )}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: col+"22", color: col }}>
              {project.status}
            </span>
          </div>
          {project.address && <p className="text-gray-500 text-sm mt-1">📍 {project.address}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${params.id}/edit`}
            className="px-4 py-2 border border-border text-gray-300 rounded-lg text-sm font-bold hover:border-gray-400 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Budget",    value:`$${(project.budget ?? 0).toLocaleString()}`,   color:"#3B82F6" },
          { label:"Spent",     value:`$${(project.spent ?? 0).toLocaleString()}`,    color: pct>90?"#EF4444":"#F46519" },
          { label:"Progress",  value:`${project.progress ?? 0}%`,                    color: col },
          { label:"Crew",      value: project.crew_size ?? 0,                        color:"#A855F7" },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Completion</span>
              <span className="font-bold font-mono" style={{ color: col }}>{project.progress ?? 0}%</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width:`${project.progress ?? 0}%`, background: col }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Budget Used</span>
              <span className="font-bold font-mono" style={{ color: pct>90?"#EF4444":pct>75?"#F59E0B":"#22C55E" }}>{pct}%</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(pct,100)}%`, background: pct>90?"#EF4444":pct>75?"#F59E0B":"#22C55E" }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-border text-sm">
          <div><span className="text-gray-500">Phase: </span><span className="font-semibold">{project.phase ?? "—"}</span></div>
          <div><span className="text-gray-500">Sq Ft: </span><span className="font-semibold">{project.sq_footage?.toLocaleString() ?? "—"}</span></div>
          <div><span className="text-gray-500">Deadline: </span><span className="font-semibold">{project.deadline ?? "—"}</span></div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon:"⚠",  label:"Safety",    sub:`${incidents?.filter(i=>i.status==="Open").length ?? 0} open`,    href:`/safety` },
          { icon:"?",  label:"RFIs",      sub:`${rfis?.filter(r=>r.status==="Open").length ?? 0} open`,          href:`/rfis` },
          { icon:"$",  label:"Budget",    sub:"Line items",                                                        href:`/budget` },
          { icon:"▣",  label:"Documents", sub:"Files",                                                             href:`/documents` },
        ].map(q => (
          <Link key={q.label} href={q.href} className="bg-surface rounded-xl border border-border p-4 hover:border-gray-500 transition-colors">
            <div className="text-xl mb-2">{q.icon}</div>
            <div className="font-bold text-sm">{q.label}</div>
            <div className="text-xs text-gray-500 mt-1">{q.sub}</div>
          </Link>
        ))}
      </div>

      {/* Medical checklist section */}
      {project.type === "medical_facility" && (
        <div className="bg-surface rounded-xl border border-purple-500/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-lg flex items-center gap-2">🏥 Medical Facility Checklist</div>
              <div className="text-gray-500 text-sm mt-1">
                {checklists?.length ?? 0} rooms · {completedChecklistItems}/{totalChecklistItems} items installed
              </div>
            </div>
            <Link href={`/projects/${params.id}/import-checklist`}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">
              📊 Import from Excel
            </Link>
          </div>

          {totalChecklistItems > 0 && (
            <>
              <div className="h-2 bg-border rounded-full overflow-hidden mb-4">
                <div className="h-full rounded-full bg-purple-500 transition-all"
                  style={{ width:`${Math.round(completedChecklistItems/totalChecklistItems*100)}%` }} />
              </div>
              <div className="grid gap-2">
                {checklists?.map((cl: any) => {
                  const total   = cl.medical_checklist_items?.length ?? 0;
                  const checked = cl.medical_checklist_items?.filter((i: any) => i.checked).length ?? 0;
                  const pct     = total > 0 ? Math.round(checked/total*100) : 0;
                  return (
                    <div key={cl.id} className="flex items-center gap-3 p-3 bg-surface-card rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{cl.name}</div>
                        <div className="h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width:`${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-sm font-mono text-purple-400 font-bold flex-shrink-0">{checked}/{total}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {(checklists?.length ?? 0) === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-3">📊</div>
              <p className="font-semibold">No checklist imported yet</p>
              <p className="text-sm mt-1 text-gray-600">Upload your proposal Excel to auto-create all room checklists</p>
            </div>
          )}
        </div>
      )}

      {project.description && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="font-bold mb-2">Description</div>
          <p className="text-gray-400 text-sm leading-relaxed">{project.description}</p>
        </div>
      )}
    </div>
  );
}
