"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PHASES = ["Planning","Demo","Foundation","Structural","MEP Rough-In","Framing","Exterior","Interior","Finishing","Punch List","Complete"];

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", type: "standard", phase: "Planning", address: "",
    sq_footage: "", crew_size: "", budget: "", deadline: "",
    description: "", status: "active",
  });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();

    const { error } = await supabase.from("projects").insert({
      ...form,
      org_id: profile?.org_id,
      created_by: user!.id,
      sq_footage: form.sq_footage ? parseInt(form.sq_footage) : null,
      crew_size:  form.crew_size  ? parseInt(form.crew_size)  : 0,
      budget:     form.budget     ? parseFloat(form.budget)   : 0,
      deadline:   form.deadline   || null,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/projects");
  };

  const Field = ({ label, children }: any) => (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
  const inp = "w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black">New Project</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in the project details below</p>
      </div>

      <form onSubmit={save} className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <Field label="Project name *">
          <input required value={form.name} onChange={e => set("name", e.target.value)} className={inp} placeholder="Riverside Tower" />
        </Field>

        {/* Project type */}
        <Field label="Project type">
          <div className="grid grid-cols-2 gap-3">
            {[
              { value:"standard",         label:"Standard",           icon:"🏗", desc:"General construction project" },
              { value:"medical_facility", label:"Medical Facility",   icon:"🏥", desc:"Separate division with checklists" },
            ].map(t => (
              <button key={t.value} type="button" onClick={() => set("type", t.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${form.type === t.value ? "border-brand bg-brand/10" : "border-border hover:border-gray-500"}`}>
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="font-bold text-sm">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Phase">
            <select value={form.phase} onChange={e => set("phase", e.target.value)} className={inp}>
              {PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => set("status", e.target.value)} className={inp}>
              {["active","on_hold","completed","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Address">
          <input value={form.address} onChange={e => set("address", e.target.value)} className={inp} placeholder="123 Main St, Miami FL" />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Sq Footage">
            <input type="number" value={form.sq_footage} onChange={e => set("sq_footage", e.target.value)} className={inp} placeholder="50000" />
          </Field>
          <Field label="Crew Size">
            <input type="number" value={form.crew_size} onChange={e => set("crew_size", e.target.value)} className={inp} placeholder="24" />
          </Field>
          <Field label="Deadline">
            <input type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} className={inp} />
          </Field>
        </div>

        <Field label="Total Budget ($)">
          <input type="number" value={form.budget} onChange={e => set("budget", e.target.value)} className={inp} placeholder="4200000" />
        </Field>

        <Field label="Description (optional)">
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
            className={inp + " resize-none"} placeholder="Project overview..." />
        </Field>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 border border-border text-gray-400 font-bold py-2.5 rounded-lg hover:border-gray-500 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {loading ? "Creating…" : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
