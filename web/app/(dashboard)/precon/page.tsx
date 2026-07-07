"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Hourglass, CheckCircle, Circle, PlayCircle, MinusCircle, Rocket } from "lucide-react";
import { WAITING_ON_META, WAITING_ON_OPTIONS } from "@/lib/waitingOn";

// Default pre-con pipeline seeded per project (editable after seeding)
const DEFAULT_STAGES = [
  "Feasibility & Design",
  "Filings & Permits (DOB)",
  "Bidding & Buyout",
  "Contracts & Insurance",
  "Mobilization",
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  not_started: { label: "Not Started", color: "#9ca3af", bg: "#f3f4f6", icon: Circle },
  in_progress: { label: "In Progress", color: "#2563eb", bg: "#dbeafe", icon: PlayCircle },
  waiting:     { label: "Waiting",     color: "#d97706", bg: "#fef3c7", icon: Hourglass },
  done:        { label: "Done",        color: "#16a34a", bg: "#dcfce7", icon: CheckCircle },
  na:          { label: "N/A",         color: "#d1d5db", bg: "#f9fafb", icon: MinusCircle },
};

export default function PreconPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [stages, setStages]     = useState<any[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [seeding, setSeeding]   = useState<string | null>(null);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const supabase = createClient();
    const [{ data: projs }, { data: stgs, error }] = await Promise.all([
      supabase.from("projects").select("id,name,phase,status").order("created_at"),
      supabase.from("precon_stages").select("*").order("sort_order"),
    ]);
    setProjects(projs ?? []);
    if (error?.message?.includes("precon_stages")) setTableMissing(true);
    else setStages(stgs ?? []);
    setLoaded(true);
  };

  const seed = async (projectId: string) => {
    setSeeding(projectId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const { error } = await supabase.from("precon_stages").insert(
      // Explicit status on every row — PostgREST bulk inserts fill NULL (not the
      // column default) for keys missing from some rows in a batch, so relying
      // on the DB default here silently produced null-status rows before.
      DEFAULT_STAGES.map((stage, i) => ({ org_id: prof?.org_id, project_id: projectId, stage, sort_order: i, status: "not_started" }))
    );
    if (error) alert("Could not start pre-con tracking: " + error.message);
    setSeeding(null);
    await load();
  };

  const update = async (id: string, patch: Record<string, any>) => {
    // Optimistic update so selects feel instant
    setStages(s => s.map(st => st.id === id ? { ...st, ...patch } : st));
    const { error } = await createClient().from("precon_stages")
      .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { alert("Save failed: " + error.message); await load(); }
  };

  const setStatus = (st: any, status: string) =>
    update(st.id, {
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      ...(status !== "waiting" ? { waiting_on: null, waiting_for: null } : {}),
    });

  const inp = "bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-orange-500 shadow-sm";

  // "What are we waiting for now": the first not-done stage per project
  const currentStage = (projectId: string) => {
    const ps = stages.filter(s => s.project_id === projectId);
    return ps.find(s => s.status !== "done" && s.status !== "na") ?? null;
  };

  const tracked = projects.filter(p => stages.some(s => s.project_id === p.id));
  const untracked = projects.filter(p => !stages.some(s => s.project_id === p.id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Pre-Construction</h1>
        <p className="text-gray-500 text-sm mt-0.5">Design → Permits → Bidding → Contracts → Mobilization · whose court is the ball in</p>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          ⚠️ Pre-con tracking isn&apos;t set up in the database yet (migration 007_precon_stages.sql needs to run). Ask your admin to run it, then reload.
        </div>
      )}

      {/* What are we waiting for NOW — one line per tracked project */}
      {tracked.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
            <Hourglass size={15} className="text-gray-400" />What are we waiting for now
          </h2>
          <div className="space-y-1.5">
            {tracked.map(p => {
              const cur = currentStage(p.id);
              if (!cur) return (
                <div key={p.id} className="flex items-center gap-2 text-sm px-2 py-1.5">
                  <span className="font-medium text-gray-900 w-40 truncate flex-shrink-0">{p.name}</span>
                  <span className="text-green-600 text-xs font-semibold">✅ Pre-con complete — ready to build</span>
                </div>
              );
              const curMeta = STATUS_META[cur.status] ?? STATUS_META.not_started;
              const meta = cur.waiting_on ? WAITING_ON_META[cur.waiting_on as keyof typeof WAITING_ON_META] : null;
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 flex-wrap">
                  <span className="font-medium text-gray-900 w-40 truncate flex-shrink-0">{p.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: curMeta.bg, color: curMeta.color }}>
                    {cur.stage}
                  </span>
                  {cur.status === "waiting" && meta && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                      ⏳ ball in {meta.label}&apos;s court
                    </span>
                  )}
                  {cur.waiting_for && <span className="text-xs text-gray-500 truncate">— {cur.waiting_for}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-project stage boards */}
      {tracked.map(p => {
        const ps = stages.filter(s => s.project_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
        const doneCount = ps.filter(s => s.status === "done" || s.status === "na").length;
        return (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gray-900">{p.name}</span>
              <span className="text-xs text-gray-400">{doneCount}/{ps.length} stages done</span>
            </div>
            {/* Stage progress strip */}
            <div className="px-5 pt-4 flex gap-1.5">
              {ps.map(st => (
                <div key={st.id} className="flex-1 h-1.5 rounded-full" style={{ background: st.status === "done" ? "#16a34a" : st.status === "in_progress" ? "#2563eb" : st.status === "waiting" ? "#d97706" : "#e5e7eb" }} />
              ))}
            </div>
            <div className="p-5 pt-3 space-y-2">
              {ps.map(st => {
                const sm = STATUS_META[st.status] ?? STATUS_META.not_started;
                const Icon = sm.icon;
                return (
                  <div key={st.id} className="flex items-center gap-2 flex-wrap py-1.5 border-b border-gray-50 last:border-0">
                    <Icon size={15} style={{ color: sm.color }} className="flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 w-48 truncate">{st.stage}</span>
                    <select value={st.status ?? "not_started"} onChange={e => setStatus(st, e.target.value)} className={inp}>
                      {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                    </select>
                    {st.status === "waiting" && (
                      <>
                        <select value={st.waiting_on ?? ""} onChange={e => update(st.id, { waiting_on: e.target.value || null })} className={inp}>
                          <option value="">Waiting on…</option>
                          {WAITING_ON_OPTIONS.map(o => <option key={o} value={o}>{WAITING_ON_META[o].label}</option>)}
                        </select>
                        <input value={st.waiting_for ?? ""} onChange={e => setStages(s => s.map(x => x.id === st.id ? { ...x, waiting_for: e.target.value } : x))}
                          onBlur={e => update(st.id, { waiting_for: e.target.value || null })}
                          placeholder="waiting for what? e.g. stamped drawings" className={inp + " flex-1 min-w-[160px]"} />
                      </>
                    )}
                    {st.status !== "waiting" && (
                      <input type="date" value={st.target_date ?? ""} onChange={e => update(st.id, { target_date: e.target.value || null })}
                        className={inp} title="Target date" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Projects without pre-con tracking */}
      {loaded && !tableMissing && untracked.length > 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-3">Start pre-con tracking</h2>
          <div className="flex flex-wrap gap-2">
            {untracked.map(p => (
              <button key={p.id} onClick={() => seed(p.id)} disabled={seeding === p.id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 disabled:opacity-50 transition-all">
                <Rocket size={13} />{seeding === p.id ? "Setting up…" : p.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Adds the 5 standard stages — you can mark stages N/A if they don&apos;t apply.</p>
        </div>
      )}
    </div>
  );
}
