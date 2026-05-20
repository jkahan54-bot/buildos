"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Wrench } from "lucide-react";

const STATUS_META: Record<string,{c:string;b:string;l:string}> = {
  available:   { c:"#16a34a", b:"#dcfce7", l:"Available"   },
  on_site:     { c:"#2563eb", b:"#dbeafe", l:"On Site"      },
  maintenance: { c:"#d97706", b:"#fef3c7", l:"Maintenance"  },
  retired:     { c:"#6b7280", b:"#f3f4f6", l:"Retired"      },
};

export default function EquipmentPage() {
  const [items, setItems]     = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState("all");
  const [form, setForm] = useState({ name:"", type:"", serial_number:"", project_id:"", status:"available", last_maintenance:"", next_maintenance:"", notes:"" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm";

  useEffect(() => { load(); createClient().from("projects").select("id,name").then(({data})=>setProjects(data??[])); }, []);

  const load = async () => { const {data} = await createClient().from("equipment").select("*, projects(name)").order("name"); setItems(data??[]); };

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data:{user} } = await supabase.auth.getUser();
    const { data:prof } = await supabase.from("profiles").select("org_id").eq("id",user!.id).single();
    await supabase.from("equipment").insert({ ...form, org_id:prof?.org_id, project_id:form.project_id||null });
    setLoading(false); setShowForm(false); setForm({ name:"", type:"", serial_number:"", project_id:"", status:"available", last_maintenance:"", next_maintenance:"", notes:"" });
    await load();
  };

  const updateStatus = async (id:string, status:string, project_id?:string) => {
    await createClient().from("equipment").update({ status, ...(project_id!==undefined?{project_id:project_id||null}:{}) }).eq("id",id);
    await load();
  };

  const filtered = filter==="all" ? items : items.filter(i=>i.status===filter);
  const TYPES = ["Crane","Forklift","Excavator","Concrete Pump","Generator","Compressor","Scaffold","Lift","Truck","Tool","Other"];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Equipment</h1>
          <p className="text-gray-500 text-sm mt-0.5">{items.filter(i=>i.status==="on_site").length} on site · {items.filter(i=>i.status==="maintenance").length} in maintenance</p></div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}><Plus size={15} />Add Equipment</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Add Equipment</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                <input required value={form.name} onChange={e=>set("name",e.target.value)} className={inp} placeholder="Tower Crane #1" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                <select value={form.type} onChange={e=>set("type",e.target.value)} className={inp}><option value="">Select…</option>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Serial / ID</label>
                <input value={form.serial_number} onChange={e=>set("serial_number",e.target.value)} className={inp} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select value={form.status} onChange={e=>set("status",e.target.value)} className={inp}>{Object.entries(STATUS_META).map(([v,m])=><option key={v} value={v}>{m.l}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Site</label>
                <select value={form.project_id} onChange={e=>set("project_id",e.target.value)} className={inp}><option value="">None</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Next Maintenance</label>
                <input type="date" value={form.next_maintenance} onChange={e=>set("next_maintenance",e.target.value)} className={inp} /></div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>{loading?"Saving…":"Save"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {["all","available","on_site","maintenance","retired"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter===f?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{f.replace("_"," ")}</button>
        ))}
      </div>

      {filtered.length===0 ? <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">No equipment tracked yet</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(eq=>{
            const s=STATUS_META[eq.status]??STATUS_META.available;
            return (
              <div key={eq.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:s.b }}>
                  <Wrench size={18} style={{ color:s.c }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{eq.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:s.b,color:s.c }}>{s.l}</span>
                  </div>
                  <div className="text-xs text-gray-500">{eq.type}{eq.serial_number?` · #${eq.serial_number}`:""}{eq.projects?.name?` · ${eq.projects.name}`:""}</div>
                  {eq.next_maintenance && <div className="text-xs text-orange-500 mt-0.5">🔧 Next maintenance: {eq.next_maintenance}</div>}
                </div>
                <select value={eq.status} onChange={e=>updateStatus(eq.id,e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white text-gray-600 flex-shrink-0">
                  {Object.entries(STATUS_META).map(([v,m])=><option key={v} value={v}>{m.l}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
