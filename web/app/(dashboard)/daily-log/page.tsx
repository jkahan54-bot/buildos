"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, ClipboardList } from "lucide-react";

export default function DailyLogPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [logs, setLogs]         = useState<any[]>([]);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [form, setForm] = useState({ project_id:"", weather:"Clear", crew_count:"", work_done:"", materials:"", equipment:"", issues:"" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    createClient().from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("daily_logs").select("*, projects(name)").eq("profile_id", user!.id).order("created_at", { ascending:false }).limit(10);
    setLogs(data ?? []);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("daily_logs").insert({ ...form, org_id: prof?.org_id, profile_id: user!.id, crew_count: form.crew_count ? parseInt(form.crew_count) : null });
    setLoading(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setForm({ project_id:"", weather:"Clear", crew_count:"", work_done:"", materials:"", equipment:"", issues:"" });
    await loadLogs();
  };

  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Daily Log</h1>
        <p className="text-gray-500 text-sm mt-0.5">{today}</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-semibold">
          <CheckCircle size={16} />Log saved successfully!
        </div>
      )}

      <form onSubmit={save} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project *</label>
            <select required value={form.project_id} onChange={e => set("project_id", e.target.value)} className={inp}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Weather</label>
            <select value={form.weather} onChange={e => set("weather", e.target.value)} className={inp}>
              {["Clear","Cloudy","Rain","Snow","Hot","Cold","Windy"].map(w => <option key={w}>{w}</option>)}
            </select></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Crew on site</label>
          <input type="number" value={form.crew_count} onChange={e => set("crew_count", e.target.value)} className={inp} placeholder="22" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Work performed today *</label>
          <textarea required value={form.work_done} onChange={e => set("work_done", e.target.value)} rows={3} className={inp + " resize-none"} placeholder="Describe work completed today…" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Materials received</label>
          <input value={form.materials} onChange={e => set("materials", e.target.value)} className={inp} placeholder="e.g. 40 tons rebar, 200 sheets plywood" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Equipment used</label>
          <input value={form.equipment} onChange={e => set("equipment", e.target.value)} className={inp} placeholder="e.g. Tower crane, 2x concrete pumps" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Issues / delays</label>
          <textarea value={form.issues} onChange={e => set("issues", e.target.value)} rows={2} className={inp + " resize-none"} placeholder="Any issues, delays or safety concerns…" /></div>
        <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          {loading ? "Saving…" : "Save Daily Log"}
        </button>
      </form>

      {logs.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><ClipboardList size={16} className="text-orange-500" />Recent Logs</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {logs.slice(0,5).map(l => (
              <div key={l.id} className="px-5 py-4">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-900">{l.projects?.name}</span>
                  <span className="text-xs text-gray-400">{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{l.work_done}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
