"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PRIO_COLORS: Record<string,string> = { Low:"#22C55E", Medium:"#F59E0B", High:"#EF4444" };
const STATUS_COLORS: Record<string,string> = { Open:"#F46519", Review:"#3B82F6", Closed:"#6B7280" };

export default function RFIsClient({ rfis, projects }: any) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ project_id:"", title:"", description:"", priority:"Medium" });
  const [response, setResponse] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("rfis").insert({ ...form, org_id: prof?.org_id, submitted_by: user!.id });
    setLoading(false); setShowForm(false); setForm({ project_id:"", title:"", description:"", priority:"Medium" });
    router.refresh();
  };

  const updateStatus = async (id: string, status: string, resp?: string) => {
    const supabase = createClient();
    await supabase.from("rfis").update({ status, ...(resp ? { response: resp } : {}) }).eq("id", id);
    setSelected(null); setResponse(""); router.refresh();
  };

  const inp = "w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand";

  const open   = rfis.filter((r: any) => r.status === "Open").length;
  const review = rfis.filter((r: any) => r.status === "Review").length;
  const closed = rfis.filter((r: any) => r.status === "Closed").length;

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">RFIs</h1>
          <p className="text-gray-500 text-sm mt-1">Requests for Information — {open} open, {review} in review</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">
          + New RFI
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[{ label:"Open", value:open, color:"#F46519" }, { label:"In Review", value:review, color:"#3B82F6" }, { label:"Closed", value:closed, color:"#6B7280" }].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-5 text-center">
            <div className="text-3xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-brand/50 p-6">
          <h2 className="font-bold text-lg mb-4">New RFI</h2>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Project</label>
                <select value={form.project_id} onChange={e => set("project_id", e.target.value)} required className={inp}>
                  <option value="">Select...</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                <select value={form.priority} onChange={e => set("priority", e.target.value)} className={inp}>
                  {["Low","Medium","High"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Title *</label>
              <input value={form.title} onChange={e => set("title", e.target.value)} required className={inp} placeholder="e.g. Beam connection detail at Grid C-4" />
            </div>
            <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
                className={inp + " resize-none"} placeholder="Provide details about the information requested..." />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border text-gray-400 font-bold py-2.5 rounded-lg">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-brand text-white font-bold py-2.5 rounded-lg disabled:opacity-50">{loading ? "Submitting…" : "Submit RFI"}</button>
            </div>
          </form>
        </div>
      )}

      {/* RFI detail modal */}
      {selected && (
        <div className="bg-surface rounded-xl border border-blue-500/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex gap-2 mb-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:PRIO_COLORS[selected.priority]+"22", color:PRIO_COLORS[selected.priority] }}>{selected.priority}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:STATUS_COLORS[selected.status]+"22", color:STATUS_COLORS[selected.status] }}>{selected.status}</span>
              </div>
              <h2 className="font-bold text-lg">{selected.title}</h2>
              <p className="text-gray-500 text-sm mt-1">{selected.projects?.name} · {selected.profiles?.full_name} · {new Date(selected.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900">✕</button>
          </div>
          {selected.description && <p className="text-gray-300 text-sm mb-4 bg-surface-card rounded-lg p-3">{selected.description}</p>}
          {selected.response && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Response</div>
              <p className="text-gray-200 text-sm bg-green-500/10 border border-green-500/30 rounded-lg p-3">{selected.response}</p>
            </div>
          )}
          {selected.status !== "Closed" && (
            <div className="space-y-3">
              <textarea value={response} onChange={e => setResponse(e.target.value)} rows={3} placeholder="Add response..."
                className={inp + " resize-none"} />
              <div className="flex gap-2">
                <button onClick={() => updateStatus(selected.id, "Review")} className="flex-1 border border-blue-500 text-blue-400 font-bold py-2 rounded-lg text-sm hover:bg-blue-500/10 transition-colors">Move to Review</button>
                <button onClick={() => updateStatus(selected.id, "Closed", response)} className="flex-1 bg-green-500 text-white font-bold py-2 rounded-lg text-sm hover:bg-green-600 transition-colors">Close RFI</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RFI list */}
      <div className="space-y-3">
        {!rfis.length ? (
          <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center">
            <div className="text-4xl mb-3">?</div>
            <p className="text-gray-400 font-semibold">No RFIs yet</p>
          </div>
        ) : rfis.map((r: any) => (
          <div key={r.id} className="bg-surface rounded-xl border border-border p-5 cursor-pointer hover:border-gray-500 transition-colors"
            style={{ borderLeft: `4px solid ${PRIO_COLORS[r.priority]}` }}
            onClick={() => setSelected(r)}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-mono">RFI-{r.id.slice(-4).toUpperCase()}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:PRIO_COLORS[r.priority]+"22", color:PRIO_COLORS[r.priority] }}>{r.priority}</span>
                </div>
                <p className="font-bold">{r.title}</p>
                <p className="text-sm text-gray-500 mt-1">{r.projects?.name} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background:STATUS_COLORS[r.status]+"22", color:STATUS_COLORS[r.status] }}>
                {r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
