"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const SEV_COLOR: Record<string, string> = { Low:"#22C55E", Medium:"#F59E0B", High:"#F46519", Critical:"#EF4444" };
const STATUS_COLOR: Record<string, string> = { Open:"#F46519", "In Review":"#3B82F6", Closed:"#6B7280" };

export default function SafetyClient({ incidents, projects }: any) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ project_id:"", type:"Near Miss", severity:"Medium", description:"", location:"" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("safety_incidents").insert({ ...form, org_id: profile?.org_id, reported_by: user!.id });
    setLoading(false); setShowForm(false);
    router.refresh();
  };

  const resolve = async (id: string) => {
    const supabase = createClient();
    await supabase.from("safety_incidents").update({ status:"Closed" }).eq("id", id);
    router.refresh();
  };

  const inp = "w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand";

  const open   = incidents.filter((i: any) => i.status === "Open").length;
  const high   = incidents.filter((i: any) => i.severity === "High" || i.severity === "Critical").length;
  const closed = incidents.filter((i: any) => i.status === "Closed").length;

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Safety & Incidents</h1>
          <p className="text-gray-500 text-sm mt-1">Log and track safety issues, near misses & hazards</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">
          + Report Incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:"Open Incidents", value: open,   color:"#EF4444" },
          { label:"High Severity",  value: high,   color:"#F46519" },
          { label:"Closed (All)",   value: closed, color:"#22C55E" },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-3xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Report form */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-brand/50 p-6">
          <h2 className="font-bold text-lg mb-4">Report Incident</h2>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Project</label>
                <select value={form.project_id} onChange={e => setForm(f => ({...f, project_id: e.target.value}))} required className={inp}>
                  <option value="">Select project...</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className={inp}>
                  {["Near Miss","Injury","Hazard","Property Damage","Environmental"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Severity</label>
                <select value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))} className={inp}>
                  {["Low","Medium","High","Critical"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Location</label>
                <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} className={inp} placeholder="Level 5 - Grid C" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Description *</label>
              <textarea required value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3}
                className={inp + " resize-none"} placeholder="Describe what happened..." />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border text-gray-400 font-bold py-2.5 rounded-lg hover:border-gray-500 transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loading ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Incidents list */}
      <div className="space-y-3">
        {!incidents.length ? (
          <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-400 font-semibold">No incidents reported</p>
          </div>
        ) : incidents.map((inc: any) => (
          <div key={inc.id} className="bg-surface rounded-xl border border-border p-5"
            style={{ borderLeft: `4px solid ${SEV_COLOR[inc.severity] ?? "#6B7280"}` }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: SEV_COLOR[inc.severity]+"22", color: SEV_COLOR[inc.severity] }}>
                    {inc.severity} Severity
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-border text-gray-300">{inc.type}</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: STATUS_COLOR[inc.status]+"22", color: STATUS_COLOR[inc.status] }}>
                    {inc.status}
                  </span>
                </div>
                <p className="font-bold">{inc.description}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {inc.projects?.name ?? "—"} · {inc.profiles?.full_name ?? "Unknown"} · {new Date(inc.incident_date).toLocaleDateString()}
                  {inc.location && ` · ${inc.location}`}
                </p>
              </div>
              {inc.status === "Open" && (
                <button onClick={() => resolve(inc.id)}
                  className="ml-4 text-sm font-bold px-3 py-1.5 rounded-lg border border-border text-gray-300 hover:border-green-500 hover:text-green-400 transition-colors flex-shrink-0">
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
