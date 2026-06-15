"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { WAITING_ON_META, WAITING_ON_OPTIONS } from "@/lib/waitingOn";

const STATUS_META: Record<string,{color:string;bg:string;label:string}> = {
  pending:            { color:"#d97706", bg:"#fef3c7", label:"Pending"           },
  under_review:       { color:"#2563eb", bg:"#dbeafe", label:"Under Review"      },
  approved:           { color:"#16a34a", bg:"#dcfce7", label:"Approved"          },
  approved_as_noted:  { color:"#0891b2", bg:"#e0f2fe", label:"Approved as Noted" },
  rejected:           { color:"#dc2626", bg:"#fee2e2", label:"Rejected"          },
};

export default function SubmittalsPage() {
  const router = useRouter();
  const [items, setItems]     = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState("all");
  const [form, setForm] = useState({ project_id:"", title:"", spec_section:"", trade:"", submitted_by:"", required_date:"", status:"pending", notes:"", waiting_on:"Architect" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm";

  useEffect(() => { load(); createClient().from("projects").select("id,name").then(({data})=>setProjects(data??[])); }, []);

  const load = async () => { const {data} = await createClient().from("submittals").select("*, projects(name)").order("created_at",{ascending:false}); setItems(data??[]); };

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data:{user} } = await supabase.auth.getUser();
    const { data:prof } = await supabase.from("profiles").select("org_id").eq("id",user!.id).single();
    const count = items.filter(i=>i.project_id===form.project_id).length+1;
    await supabase.from("submittals").insert({ ...form, org_id:prof?.org_id, number:`SUB-${String(count).padStart(3,"0")}`, submitted_date:new Date().toISOString().split("T")[0] });
    setLoading(false); setShowForm(false); setForm({ project_id:"", title:"", spec_section:"", trade:"", submitted_by:"", required_date:"", status:"pending", notes:"", waiting_on:"Architect" });
    await load();
  };

  const updateStatus = async (id:string, status:string) => {
    const resolved = ["approved","approved_as_noted","rejected"].includes(status);
    await createClient().from("submittals").update({ status, ...(resolved ? { returned_date:new Date().toISOString().split("T")[0], waiting_on:null } : {}) }).eq("id",id);
    await load();
  };

  const filtered = filter==="all" ? items : items.filter(i=>i.status===filter);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Submittals</h1>
          <p className="text-gray-500 text-sm mt-0.5">Shop drawings, product data, samples · {items.filter(i=>i.status==="pending"||i.status==="under_review").length} awaiting review</p></div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}><Plus size={15} />New Submittal</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">New Submittal</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project *</label>
                <select required value={form.project_id} onChange={e=>set("project_id",e.target.value)} className={inp}><option value="">Select…</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Trade</label>
                <input value={form.trade} onChange={e=>set("trade",e.target.value)} className={inp} placeholder="Electrical, Plumbing…" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input required value={form.title} onChange={e=>set("title",e.target.value)} className={inp} placeholder="e.g. Electrical Panel Shop Drawings" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Spec Section</label>
                <input value={form.spec_section} onChange={e=>set("spec_section",e.target.value)} className={inp} placeholder="16000" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Submitted By</label>
                <input value={form.submitted_by} onChange={e=>set("submitted_by",e.target.value)} className={inp} placeholder="Sub name" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Required By</label>
                <input type="date" value={form.required_date} onChange={e=>set("required_date",e.target.value)} className={inp} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Waiting On (who needs to review)</label>
              <select value={form.waiting_on} onChange={e=>set("waiting_on",e.target.value)} className={inp}>
                {WAITING_ON_OPTIONS.map(o => <option key={o} value={o}>{WAITING_ON_META[o].label}</option>)}
              </select></div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>{loading?"Saving…":"Submit"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {["all","pending","under_review","approved","approved_as_noted","rejected"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter===f?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{f.replace("_"," ")}</button>
        ))}
      </div>

      {filtered.length===0 ? <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">No submittals {filter!=="all"?`with status "${filter}"`:""}</div> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {filtered.map((item,i)=>{
            const s=STATUS_META[item.status]??STATUS_META.pending;
            return (
              <div key={item.id} className={`flex items-start gap-4 p-5 ${i<filtered.length-1?"border-b border-gray-100":""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-gray-400">{item.number}</span>
                    <span className="font-semibold text-gray-900">{item.title}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:s.bg,color:s.color }}>{s.label}</span>
                    {item.waiting_on && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: WAITING_ON_META[item.waiting_on as keyof typeof WAITING_ON_META]?.bg, color: WAITING_ON_META[item.waiting_on as keyof typeof WAITING_ON_META]?.color }}>
                        ⏳ {WAITING_ON_META[item.waiting_on as keyof typeof WAITING_ON_META]?.label ?? item.waiting_on}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{item.projects?.name}{item.trade?` · ${item.trade}`:""}{item.submitted_by?` · ${item.submitted_by}`:""}{item.required_date?` · Due ${item.required_date}`:""}</div>
                </div>
                {(item.status==="pending"||item.status==="under_review") && (
                  <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                    <button onClick={()=>updateStatus(item.id,"approved")} className="px-2.5 py-1 rounded-lg bg-green-50 text-green-600 border border-green-200 text-xs font-semibold hover:bg-green-100">Approve</button>
                    <button onClick={()=>updateStatus(item.id,"approved_as_noted")} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 text-xs font-semibold hover:bg-blue-100">As Noted</button>
                    <button onClick={()=>updateStatus(item.id,"rejected")} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-100">Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
