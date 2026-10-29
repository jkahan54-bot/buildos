"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Check, AlertTriangle, Lock, Wand2 } from "lucide-react";
import { reschedule, slipDays, downstream, daysBetween, addWorkdays, TEMPLATES, type SchedTask } from "@/lib/schedule";

const PILL: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-50 text-blue-700",
  complete: "bg-green-50 text-green-700",
  delayed: "bg-red-50 text-red-700",
};
const LABEL: Record<string, string> = { not_started: "Not started", in_progress: "In progress", complete: "Complete", delayed: "Delayed" };
const fmt = (s: string) => new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const inp = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400";

export default function SchedulePage() {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<SchedTask[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [proj, setProj] = useState("");
  const [tab, setTab] = useState<"workflow" | "timeline">("workflow");
  const [showForm, setShowForm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [form, setForm] = useState({ title: "", trade: "", assigned_to: "", duration_days: 5, start_date: todayISO(), depends_on: "" });

  const load = useCallback(async (p: string) => {
    if (!p) return;
    const { data, error } = await supabase.from("schedule_tasks").select("*").eq("project_id", p).order("sort_order").order("start_date");
    if (error && /duration_days|depends_on|column/i.test(error.message)) { setSetupNeeded(true); return; }
    setSetupNeeded(false);
    setTasks((data ?? []).map((t: any) => ({ ...t, depends_on: t.depends_on ?? [], duration_days: t.duration_days ?? Math.max(1, daysBetween(t.start_date, t.end_date)) })));
  }, [supabase]);

  useEffect(() => {
    supabase.from("projects").select("id,name").eq("status", "active").order("name").then(({ data }) => { setProjects(data ?? []); if (data?.[0]) setProj(data[0].id); });
  }, [supabase]);
  useEffect(() => { load(proj); }, [proj, load]);

  // Apply a change, recompute the whole schedule, save every date that moved, and report the ripple.
  const applyChange = async (id: string, patch: Partial<SchedTask>, reason?: string) => {
    const before = new Map(tasks.map((t) => [t.id, t]));
    const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    const { updates } = reschedule(next);
    const moved = Object.entries(updates).filter(([tid]) => tid !== id || patch.duration_days || patch.start_date);
    const writes = [supabase.from("schedule_tasks").update({ ...patch, ...(updates[id] ?? {}) }).eq("id", id)];
    for (const [tid, u] of Object.entries(updates)) {
      if (tid === id) continue;
      const pushed = daysBetween(before.get(tid)!.end_date, u.end_date);
      writes.push(supabase.from("schedule_tasks").update({ ...u, delay_reason: pushed > 0 ? (reason ?? `Pushed by "${before.get(id)?.title}"`) : null }).eq("id", tid));
    }
    await Promise.all(writes);
    const downs = Object.keys(updates).filter((k) => k !== id).length;
    setNotice(downs ? `${downs} downstream item${downs > 1 ? "s" : ""} re-scheduled automatically.` : "");
    await load(proj);
    void moved;
  };

  const complete = (t: SchedTask) => applyChange(t.id, { status: "complete", progress: 100, end_date: t.end_date > todayISO() ? todayISO() : t.end_date });
  const setDuration = (t: SchedTask, d: number) => applyChange(t.id, { duration_days: Math.max(1, d), end_date: addWorkdays(t.start_date, Math.max(1, d) - 1) }, `"${t.title}" duration changed to ${d}d`);
  const delay = (t: SchedTask, days: number, why: string) => applyChange(t.id, { duration_days: t.duration_days + days, status: "delayed", delay_reason: why || "Delayed", end_date: addWorkdays(t.start_date, t.duration_days + days - 1) }, why || `"${t.title}" delayed`);

  const generate = async (key: string) => {
    if (!proj) return;
    const tpl = TEMPLATES[key];
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const rows = tpl.items.map((it, i) => ({ id: crypto.randomUUID(), org_id: prof?.org_id, project_id: proj, title: it.title, trade: it.trade, stage: tpl.label, duration_days: it.days, sort_order: i + 1, status: "not_started", start_date: todayISO(), end_date: todayISO() }));
    const withDeps: any[] = rows.map((r, i) => ({ ...r, depends_on: tpl.items[i].after.map((a) => rows[a].id) }));
    const { updates, all } = reschedule(withDeps as SchedTask[]);
    const final = all.map((t: any) => ({ ...t, ...(updates[t.id] ?? {}), original_start: (updates[t.id] ?? t).start_date, original_end: (updates[t.id] ?? t).end_date }));
    await supabase.from("schedule_tasks").insert(final);
    setNotice(`Built a ${final.length}-step schedule. Change any duration or mark items complete and everything after it moves.`);
    await load(proj);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const deps = form.depends_on ? [form.depends_on] : [];
    const draft: any = { id: crypto.randomUUID(), org_id: prof?.org_id, project_id: proj, title: form.title, trade: form.trade, assigned_to: form.assigned_to, duration_days: form.duration_days, depends_on: deps, status: "not_started", start_date: form.start_date, end_date: form.start_date, sort_order: tasks.length + 1 };
    const { updates, all } = reschedule([...tasks, draft]);
    const me = { ...draft, ...(updates[draft.id] ?? {}) };
    await supabase.from("schedule_tasks").insert({ ...me, original_start: me.start_date, original_end: me.end_date });
    setShowForm(false); setForm({ title: "", trade: "", assigned_to: "", duration_days: 5, start_date: todayISO(), depends_on: "" });
    void all; await load(proj);
  };

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const slipped = tasks.filter((t) => slipDays(t) > 0 && t.status !== "complete");
  const finish = tasks.length ? tasks.map((t) => t.end_date).sort().pop()! : null;
  const origFinish = tasks.length ? tasks.map((t) => t.original_end ?? t.end_date).sort().pop()! : null;
  const projSlip = finish && origFinish ? Math.max(0, daysBetween(origFinish, finish)) : 0;

  // Timeline geometry
  const minD = tasks.length ? tasks.map((t) => t.original_start ?? t.start_date).concat(tasks.map((t) => t.start_date)).sort()[0] : todayISO();
  const maxD = finish ?? todayISO();
  const span = Math.max(30, daysBetween(minD, maxD) + 7);
  const pos = (d: string) => Math.max(0, Math.min(100, (daysBetween(minD, d) / span) * 100));
  const wid = (a: string, b: string) => Math.max(1, ((daysBetween(a, b) + 1) / span) * 100);
  const months: { label: string; left: number }[] = [];
  for (let i = 0; i <= span; i += 1) {
    const d = new Date(new Date(minD + "T12:00:00Z").getTime() + i * 86400000);
    if (d.getUTCDate() === 1 || i === 0) months.push({ label: d.toLocaleDateString("en-US", { month: "short", year: i === 0 ? "2-digit" : undefined, timeZone: "UTC" }), left: (i / span) * 100 });
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Workflow &amp; Timeline</h1>
          <p className="text-gray-500 text-sm mt-1">One plan. Change a duration or finish an item and everything that depends on it moves.</p>
        </div>
        <div className="flex gap-2">
          <select value={proj} onChange={(e) => setProj(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} disabled={setupNeeded} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 disabled:opacity-40"><Plus size={15} />Add item</button>
        </div>
      </div>

      {setupNeeded && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm p-4">The schedule database upgrade hasn&apos;t been applied yet. It will activate as soon as it is.</div>}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: "Items", v: tasks.length, sub: `${tasks.filter((t) => t.status === "complete").length} complete` },
          { k: "Finish", v: finish ? fmt(finish) : "—", sub: origFinish ? `Original ${fmt(origFinish)}` : "" },
          { k: "Behind plan", v: projSlip ? `${projSlip}d` : "On plan", sub: projSlip ? "Project finish has slipped" : "No slip" },
          { k: "Delayed items", v: slipped.length, sub: "Later than original" },
        ].map((c) => (
          <div key={c.k} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">{c.k}</div>
            <div className={`text-2xl font-semibold mt-1 ${c.k === "Behind plan" && projSlip ? "text-red-600" : "text-gray-900"}`}>{c.v}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {notice && <div className="flex items-start justify-between rounded-xl border border-blue-100 bg-blue-50 text-blue-800 text-sm px-4 py-3"><span>{notice}</span><button onClick={() => setNotice("")}><X size={14} /></button></div>}

      {/* Tabs */}
      <div className="inline-flex p-1 bg-gray-100 rounded-lg text-sm">
        {(["workflow", "timeline"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md font-medium capitalize ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>{t}</button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={addItem} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex justify-between"><h2 className="font-semibold">New item</h2><button type="button" onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="text-xs text-gray-500">What needs to happen *</label><input required className={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Pour 2nd floor slab" /></div>
            <div><label className="text-xs text-gray-500">Responsible (one person)</label><input className={inp} value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">Trade</label><input className={inp} value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">Duration (workdays)</label><input type="number" min={1} className={inp} value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: +e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">Blocked by</label>
              <select className={inp} value={form.depends_on} onChange={(e) => setForm({ ...form, depends_on: e.target.value })}>
                <option value="">Nothing — can start on its own</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select></div>
            {!form.depends_on && <div><label className="text-xs text-gray-500">Start date</label><input type="date" className={inp} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>}
          </div>
          <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-900">Add to schedule</button>
        </form>
      )}

      {proj && tasks.length === 0 && !setupNeeded && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <Wand2 className="mx-auto text-gray-400" size={22} />
          <div className="font-semibold mt-2">Start with a template</div>
          <p className="text-sm text-gray-500 mt-1">Builds the stages, durations and dependencies for you. Edit anything afterward.</p>
          <div className="flex justify-center gap-2 mt-4">
            {Object.entries(TEMPLATES).map(([k, t]) => <button key={k} onClick={() => generate(k)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:border-gray-400">{t.label}</button>)}
          </div>
        </div>
      )}

      {tasks.length > 0 && tab === "workflow" && (
        <div className="space-y-2">
          {tasks.map((t) => {
            const blockers = (t.depends_on ?? []).map((d) => byId.get(d)).filter(Boolean) as SchedTask[];
            const blocks = downstream(tasks, t.id).filter((x) => (x.depends_on ?? []).includes(t.id));
            const slip = slipDays(t);
            const late = t.status !== "complete" && t.end_date < todayISO();
            const status = late ? "delayed" : t.status;
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <button onClick={() => (t.status === "complete" ? undefined : complete(t))} title="Mark complete"
                    className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${t.status === "complete" ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-500"}`}>
                    {t.status === "complete" && <Check size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium text-sm ${t.status === "complete" ? "line-through text-gray-400" : "text-gray-900"}`}>{t.title}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PILL[status] ?? PILL.not_started}`}>{LABEL[status] ?? status}</span>
                      {t.locked && <Lock size={12} className="text-gray-400" />}
                      {slip > 0 && t.status !== "complete" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">+{slip}d</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {fmt(t.start_date)} → {fmt(t.end_date)} · {t.duration_days} workdays{t.assigned_to ? ` · ${t.assigned_to}` : t.trade ? ` · ${t.trade}` : ""}
                    </div>
                    {blockers.length > 0 && <div className="text-xs text-gray-400 mt-1">Blocked by: {blockers.map((b) => b.title).join(", ")}</div>}
                    {blocks.length > 0 && <div className="text-xs text-gray-400">Blocks: {blocks.map((b) => b.title).join(", ")}</div>}
                    {t.delay_reason && t.status !== "complete" && <div className="flex items-center gap-1 text-xs text-amber-700 mt-1"><AlertTriangle size={12} />{t.delay_reason}</div>}
                    {open === t.id && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">Duration</span>
                        <input type="number" min={1} defaultValue={t.duration_days} onBlur={(e) => +e.target.value !== t.duration_days && setDuration(t, +e.target.value)} className="w-16 border border-gray-200 rounded px-2 py-1" />
                        <button onClick={() => { const w = prompt("Why is it delayed?") ?? ""; const d = +(prompt("How many workdays?", "3") ?? 0); if (d > 0) delay(t, d, w); }} className="px-2.5 py-1 rounded border border-gray-200 hover:border-gray-400">Report delay</button>
                        <button onClick={() => applyChange(t.id, { locked: !t.locked })} className="px-2.5 py-1 rounded border border-gray-200 hover:border-gray-400">{t.locked ? "Unlock date" : "Lock date"}</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setOpen(open === t.id ? null : t.id)} className="text-xs text-gray-400 hover:text-gray-700">{open === t.id ? "Close" : "Edit"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tasks.length > 0 && tab === "timeline" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="flex border-b border-gray-100 text-[11px] text-gray-400">
              <div className="w-56 flex-shrink-0 px-4 py-2">Work item</div>
              <div className="flex-1 relative h-8">{months.map((m) => <span key={m.left} className="absolute top-2" style={{ left: `${m.left}%` }}>{m.label}</span>)}</div>
            </div>
            {tasks.map((t) => {
              const slip = slipDays(t);
              const hasBase = t.original_start && t.original_end;
              const color = t.status === "complete" ? "#16a34a" : slip > 0 ? "#dc2626" : "#2563eb";
              return (
                <div key={t.id} className="flex items-center border-b border-gray-50 last:border-0">
                  <div className="w-56 flex-shrink-0 px-4 py-3 min-w-0">
                    <div className="text-sm text-gray-900 truncate">{t.title}</div>
                    <div className="text-[11px] text-gray-400">{hasBase && slip > 0 ? `Original ${fmt(t.original_end!)} → now ${fmt(t.end_date)}` : `${fmt(t.start_date)} → ${fmt(t.end_date)}`}</div>
                  </div>
                  <div className="flex-1 relative h-12">
                    {hasBase && <div className="absolute top-2 h-1.5 rounded bg-gray-200" style={{ left: `${pos(t.original_start!)}%`, width: `${wid(t.original_start!, t.original_end!)}%` }} />}
                    <div className="absolute top-4 h-5 rounded-md" style={{ left: `${pos(t.start_date)}%`, width: `${wid(t.start_date, t.end_date)}%`, background: color, opacity: t.status === "complete" ? 0.5 : 0.9 }} />
                    <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: `${pos(todayISO())}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">Grey bar = original plan · colored bar = current plan · red line = today</div>
        </div>
      )}
    </div>
  );
}
