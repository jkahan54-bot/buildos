"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const WAITING_TYPES = [
  "Waiting: Architect drawings",
  "Waiting: Engineer approval",
  "Waiting: Permit",
  "Waiting: Inspection",
  "Waiting: Material delivery",
  "Waiting: Subcontractor",
  "Waiting: Owner approval",
  "Waiting: Weather",
  "Custom…",
];

export default function MilestonesClient({ milestones, projects }: any) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ project_id:"", title:"", due_date:"", critical:false });
  const [customTitle, setCustomTitle] = useState("");
  const [selectedType, setSelectedType] = useState(WAITING_TYPES[0]);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const title = selectedType === "Custom…" ? customTitle : selectedType;
    await supabase.from("milestones").insert({ ...form, title, org_id: prof?.org_id, due_date: form.due_date || null });
    setLoading(false); setShowForm(false); setForm({ project_id:"", title:"", due_date:"", critical:false });
    router.refresh();
  };

  const toggle = async (id: string, completed: boolean) => {
    const supabase = createClient();
    await supabase.from("milestones").update({ completed }).eq("id", id);
    router.refresh();
  };

  const inp = "w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand";
  const upcoming = milestones.filter((m: any) => !m.completed);
  const completed = milestones.filter((m: any) => m.completed);

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Milestones & Progress Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">{upcoming.length} pending · {completed.length} completed</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">
          + Add Milestone
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-brand/50 p-6">
          <h2 className="font-bold text-lg mb-4">Add Milestone</h2>
          <form onSubmit={submit} className="space-y-4">
            <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Project</label>
              <select value={form.project_id} onChange={e => set("project_id", e.target.value)} required className={inp}>
                <option value="">Select...</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Milestone Type</label>
              <div className="flex flex-wrap gap-2">
                {WAITING_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setSelectedType(t)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${selectedType===t ? "border-brand bg-brand/10 text-brand" : "border-border text-gray-500 hover:border-gray-400"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {selectedType === "Custom…" && (
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Custom Title</label>
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} required className={inp} placeholder="e.g. Waiting: City inspection approval" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Due Date</label>
                <input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} className={inp} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input type="checkbox" id="critical" checked={form.critical} onChange={e => set("critical", e.target.checked)} className="w-4 h-4 accent-red-500" />
                <label htmlFor="critical" className="text-sm text-gray-300 font-semibold">Critical Path</label>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border text-gray-400 font-bold py-2.5 rounded-lg">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-brand text-white font-bold py-2.5 rounded-lg disabled:opacity-50">{loading ? "Saving…" : "Save Milestone"}</button>
            </div>
          </form>
        </div>
      )}

      {/* How it works */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <div className="font-bold text-blue-400 text-sm mb-2">📧 How email auto-detection works</div>
        <p className="text-gray-500 text-sm">
          Click <b className="text-white">"Check Emails for Updates"</b> and the AI scans your recent Outlook emails.
          When it finds an email that matches a pending milestone — like the architect sending "drawings approved" or
          the city confirming a permit — it surfaces it here so you can mark the milestone complete with one click.
        </p>
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="font-bold text-lg mb-3">Pending ({upcoming.length})</h2>
        {!upcoming.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            <div className="text-3xl mb-2">✓</div>No pending milestones
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m: any) => {
              const isOverdue = m.due_date && new Date(m.due_date) < new Date();
              const isWaiting = m.title.startsWith("Waiting:");
              return (
                <div key={m.id} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-4"
                  style={{ borderLeft: `4px solid ${m.critical ? "#EF4444" : isWaiting ? "#3B82F6" : "#e5e7eb"}` }}>
                  <button onClick={() => toggle(m.id, true)}
                    className="w-7 h-7 rounded-full border-2 border-gray-600 hover:border-green-500 flex items-center justify-center transition-colors flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-transparent" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">
                      {isWaiting && <span className="text-blue-400 text-xs font-bold mr-2">⏳ BLOCKED</span>}
                      {m.title}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {m.projects?.name}
                      {m.due_date && <span className={`ml-2 ${isOverdue ? "text-red-400 font-bold" : ""}`}>· Due {m.due_date}{isOverdue ? " (overdue)" : ""}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {m.critical && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Critical</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="font-bold text-lg mb-3 text-gray-500">Completed ({completed.length})</h2>
          <div className="space-y-2">
            {completed.map((m: any) => (
              <div key={m.id} className="bg-surface rounded-xl border border-border/50 p-4 flex items-center gap-4 opacity-60">
                <button onClick={() => toggle(m.id, false)}
                  className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">✓</span>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm line-through text-gray-500">{m.title}</div>
                  <div className="text-gray-600 text-xs mt-0.5">{m.projects?.name}{m.due_date && ` · ${m.due_date}`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
