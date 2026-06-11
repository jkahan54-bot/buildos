"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, CheckCircle } from "lucide-react";

export default function PunchListPage() {
  const [items, setItems]     = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState("open");
  const [selProj, setSelProj] = useState("all");
  const [form, setForm] = useState({ project_id:"", title:"", description:"", location:"", trade:"", priority:"medium", assigned_to:"", due_date:"" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm";

  useEffect(() => { load(); createClient().from("projects").select("id,name").then(({data})=>setProjects(data??[])); }, []);

  const load = async () => { const {data} = await createClient().from("punch_list_items").select("*, projects(name)").order("created_at",{ascending:false}); setItems(data??[]); };

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data:{user} } = await supabase.auth.getUser();
    const { data:prof } = await supabase.from("profiles").select("org_id").eq("id",user!.id).single();
    await supabase.from("punch_list_items").insert({ ...form, org_id:prof?.org_id, created_by:user!.id });
    setLoading(false); setShowForm(false); setForm({ project_id:"", title:"", description:"", location:"", trade:"", priority:"medium", assigned_to:"", due_date:"" });
    await load();
  };

  const updateStatus = async (id:string, status:string) => {
    await createClient().from("punch_list_items").update({ status, ...(status==="completed"?{completed_date:new Date().toISOString().split("T")[0]}:{}) }).eq("id",id);
    await load();
  };

  const PRIORITY_COLOR: Record<string,string> = { low:"#16a34a", medium:"#d97706", high:"#dc2626" };
  const STATUS_COLOR:   Record<string,{c:string;b:string}> = { open:{c:"#f97316",b:"#fff7ed"}, in_progress:{c:"#2563eb",b:"#dbeafe"}, completed:{c:"#16a34a",b:"#dcfce7"}, verified:{c:"#7c3aed",b:"#ede9fe"} };

  const filtered = items
    .filter(i => filter==="all" || i.status===filter)
    .filter(i => selProj==="all" || i.project_id===selProj);

  const openCount = items.filter(i=>i.status==="open").length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Punch List</h1>
          <p className="text-gray-500 text-sm mt-0.5">{openCount} open items · {items.filter(i=>i.status==="completed").length} completed</p></div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}><Plus size={15} />Add Item</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">New Punch List Item</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project *</label>
                <select required value={form.project_id} onChange={e=>set("project_id",e.target.value)} className={inp}><option value="">Select…</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                <select value={form.priority} onChange={e=>set("priority",e.target.value)} className={inp}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Item *</label>
              <input required value={form.title} onChange={e=>set("title",e.target.value)} className={inp} placeholder="e.g. Paint touch-up lobby ceiling" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                <input value={form.location} onChange={e=>set("location",e.target.value)} className={inp} placeholder="Room / Floor" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned To</label>
                <input value={form.assigned_to} onChange={e=>set("assigned_to",e.target.value)} className={inp} placeholder="Sub or name" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                <input type="date" value={form.due_date} onChange={e=>set("due_date",e.target.value)} className={inp} /></div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>{loading?"Saving…":"Add"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {["all","open","in_progress","completed","verified"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter===f?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{f.replace("_"," ")}</button>
          ))}
        </div>
        <select value={selProj} onChange={e=>setSelProj(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 outline-none">
          <option value="all">All Projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {filtered.length===0 ? <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">{filter==="open"?"No open punch list items — good job!":"No items found"}</div> : (
        <div className="space-y-2">
          {filtered.map(item=>{
            const sc = STATUS_COLOR[item.status]??{c:"#6b7280",b:"#f3f4f6"};
            return (
              <div key={item.id} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3 ${item.status==="completed"||item.status==="verified"?"opacity-70":""}`}>
                <button onClick={()=>updateStatus(item.id, item.status==="open"?"completed":item.status==="in_progress"?"completed":"open")}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${item.status==="completed"||item.status==="verified"?"bg-green-500 border-green-500":"border-gray-300 hover:border-orange-400"}`}>
                  {(item.status==="completed"||item.status==="verified")&&<CheckCircle size={13} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${item.status==="completed"?"line-through text-gray-400":"text-gray-900"}`}>{item.title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:PRIORITY_COLOR[item.priority]+"20", color:PRIORITY_COLOR[item.priority] }}>{item.priority}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:sc.b, color:sc.c }}>{item.status.replace("_"," ")}</span>
                    {item.blocked_by && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">⏳ {item.blocked_by}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.projects?.name}{item.location?` · ${item.location}`:""}{item.assigned_to?` · ${item.assigned_to}`:""}{item.due_date?` · Due ${item.due_date}`:""}</div>
                </div>
                {item.status==="open" && (
                  <button onClick={()=>updateStatus(item.id,"in_progress")} className="text-xs text-blue-500 hover:text-blue-700 font-semibold flex-shrink-0 whitespace-nowrap">Start</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
