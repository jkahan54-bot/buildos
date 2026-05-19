"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Save, ArrowLeft } from "lucide-react";

const PHASES = ["Planning","Demo","Foundation","Structural","MEP Rough-In","Framing","Exterior","Interior","Finishing","Punch List","Complete"];

export default function EditProjectPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    createClient().from("projects").select("*").eq("id", id).single()
      .then(({ data }) => { setForm(data); setLoading(false); });
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    const { error } = await createClient().from("projects").update({
      name:        form.name,
      type:        form.type,
      status:      form.status,
      phase:       form.phase,
      address:     form.address,
      sq_footage:  form.sq_footage  ? parseInt(form.sq_footage)    : null,
      crew_size:   form.crew_size   ? parseInt(form.crew_size)     : 0,
      budget:      form.budget      ? parseFloat(form.budget)      : 0,
      spent:       form.spent       ? parseFloat(form.spent)       : 0,
      progress:    form.progress    ? parseInt(form.progress)      : 0,
      deadline:    form.deadline    || null,
      description: form.description || null,
    }).eq("id", id);
    if (error) { setError(error.message); setSaving(false); return; }
    router.push(`/projects/${id}`);
  };

  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";
  const lbl = "block text-sm font-medium text-gray-700 mb-1.5";

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading project…</div>
  );

  if (!form) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Project not found.</div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${id}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Project</h1>
          <p className="text-gray-500 text-sm">{form.name}</p>
        </div>
      </div>

      <form onSubmit={save} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Name */}
        <div>
          <label className={lbl}>Project name *</label>
          <input required value={form.name ?? ""} onChange={e => set("name", e.target.value)} className={inp} />
        </div>

        {/* Type */}
        <div>
          <label className={lbl}>Project type</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value:"standard",         label:"Standard",         icon:"🏗", desc:"General construction" },
              { value:"medical_facility", label:"Medical Facility", icon:"🏥", desc:"With room checklists" },
            ].map(t => (
              <button key={t.value} type="button" onClick={() => set("type", t.value)}
                className={`p-3 rounded-xl border text-left transition-all ${form.type === t.value ? "border-2 border-orange-500 bg-orange-50" : "border border-gray-200 hover:border-gray-300"}`}>
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="font-semibold text-sm text-gray-900">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Status + Phase */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Status</label>
            <select value={form.status ?? "active"} onChange={e => set("status", e.target.value)} className={inp}>
              {["active","on_hold","completed","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Phase</label>
            <select value={form.phase ?? "Planning"} onChange={e => set("phase", e.target.value)} className={inp}>
              {PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Progress */}
        <div>
          <label className={lbl}>Completion % ({form.progress ?? 0}%)</label>
          <input type="range" min="0" max="100" value={form.progress ?? 0}
            onChange={e => set("progress", e.target.value)}
            className="w-full accent-orange-500" />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
        </div>

        {/* Address */}
        <div>
          <label className={lbl}>Address</label>
          <input value={form.address ?? ""} onChange={e => set("address", e.target.value)} className={inp} placeholder="123 Main St, Miami FL" />
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Sq Footage</label>
            <input type="number" value={form.sq_footage ?? ""} onChange={e => set("sq_footage", e.target.value)} className={inp} placeholder="50000" />
          </div>
          <div>
            <label className={lbl}>Crew Size</label>
            <input type="number" value={form.crew_size ?? ""} onChange={e => set("crew_size", e.target.value)} className={inp} placeholder="24" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Total Budget ($)</label>
            <input type="number" value={form.budget ?? ""} onChange={e => set("budget", e.target.value)} className={inp} placeholder="4200000" />
          </div>
          <div>
            <label className={lbl}>Amount Spent ($)</label>
            <input type="number" value={form.spent ?? ""} onChange={e => set("spent", e.target.value)} className={inp} placeholder="0" />
          </div>
        </div>

        <div>
          <label className={lbl}>Deadline</label>
          <input type="date" value={form.deadline ?? ""} onChange={e => set("deadline", e.target.value)} className={inp} />
        </div>

        <div>
          <label className={lbl}>Description</label>
          <textarea value={form.description ?? ""} onChange={e => set("description", e.target.value)} rows={3}
            className={inp + " resize-none"} placeholder="Project overview…" />
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Link href={`/projects/${id}`}
            className="flex-1 text-center py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
            <Save size={14} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
