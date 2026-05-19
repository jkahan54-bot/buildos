"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Building2, Plus, Star, X } from "lucide-react";

export default function SubcontractorsPage() {
  const router = useRouter();
  const [subs, setSubs]       = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name:"", contact:"", email:"", phone:"", trade:"", rating:"" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await createClient().from("subcontractors").select("*").order("name");
    setSubs(data ?? []);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("subcontractors").insert({ ...form, org_id: prof?.org_id, rating: form.rating ? parseFloat(form.rating) : null });
    setLoading(false); setShowForm(false); setForm({ name:"", contact:"", email:"", phone:"", trade:"", rating:"" });
    await load();
  };

  const TRADES = ["Electrical","Plumbing","HVAC","Concrete","Steel","Framing","Drywall","Flooring","Painting","Roofing","Safety","Demolition","Landscaping","Other"];
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-justify justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Subcontractors</h1>
          <p className="text-gray-500 text-sm mt-0.5">{subs.length} on file</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />Add Subcontractor
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">New Subcontractor</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Company name *</label>
                <input required value={form.name} onChange={e => set("name", e.target.value)} className={inp} placeholder="ABC Electric Inc." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Trade</label>
                <select value={form.trade} onChange={e => set("trade", e.target.value)} className={inp}>
                  <option value="">Select trade…</option>
                  {TRADES.map(t => <option key={t}>{t}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Contact name</label>
                <input value={form.contact} onChange={e => set("contact", e.target.value)} className={inp} placeholder="John Smith" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input value={form.phone} onChange={e => set("phone", e.target.value)} className={inp} placeholder="(555) 000-0000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inp} placeholder="contact@company.com" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Rating (1–5)</label>
                <input type="number" min="1" max="5" step="0.1" value={form.rating} onChange={e => set("rating", e.target.value)} className={inp} placeholder="4.5" /></div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {subs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No subcontractors yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {subs.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-4 px-5 py-4 ${i < subs.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg font-bold text-orange-500 flex-shrink-0">
                {s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {s.trade && <span className="mr-2">{s.trade}</span>}
                  {s.contact && <span className="mr-2">· {s.contact}</span>}
                  {s.phone && <span>{s.phone}</span>}
                </div>
              </div>
              {s.rating && (
                <div className="flex items-center gap-1 text-sm font-bold text-amber-500 flex-shrink-0">
                  <Star size={13} fill="currentColor" />{s.rating}
                </div>
              )}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${s.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                {s.status ?? "active"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
