"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";

const STATUS_COLOR: Record<string,string> = { not_started:"#6b7280", in_progress:"#2563eb", complete:"#16a34a", delayed:"#dc2626" };
const TRADE_COLORS = ["#f97316","#2563eb","#16a34a","#7c3aed","#dc2626","#d97706","#0891b2","#6b7280"];

export default function SchedulePage() {
  const [tasks, setTasks]     = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selProj, setSelProj] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ project_id:"", title:"", trade:"", start_date:"", end_date:"", assigned_to:"", status:"not_started" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm";

  useEffect(() => { load(); createClient().from("projects").select("id,name").then(({data})=>{ setProjects(data??[]); if(data?.[0]) setSelProj(data[0].id); }); }, []);
  useEffect(() => { if(selProj) load(); }, [selProj]);

  const load = async () => {
    const q = createClient().from("schedule_tasks").select("*, projects(name)").order("start_date");
    const {data} = selProj ? await q.eq("project_id",selProj) : await q;
    setTasks(data??[]);
  };

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data:{user} } = await supabase.auth.getUser();
    const { data:prof } = await supabase.from("profiles").select("org_id").eq("id",user!.id).single();
    await supabase.from("schedule_tasks").insert({ ...form, org_id:prof?.org_id });
    setLoading(false); setShowForm(false); setForm({ project_id:selProj, title:"", trade:"", start_date:"", end_date:"", assigned_to:"", status:"not_started" });
    await load();
  };

  const updateProgress = async (id:string, progress:number, status:string) => {
    await createClient().from("schedule_tasks").update({ progress, status }).eq("id",id);
    await load();
  };

  // Calculate Gantt positions
  const allDates = tasks.flatMap(t=>[new Date(t.start_date),new Date(t.end_date)]);
  const minDate  = allDates.length ? new Date(Math.min(...allDates.map(d=>d.getTime()))) : new Date();
  const maxDate  = allDates.length ? new Date(Math.max(...allDates.map(d=>d.getTime()))) : new Date(Date.now()+30*86400000);
  const span     = Math.max((maxDate.getTime()-minDate.getTime())/86400000, 30);
  const pct      = (d:Date) => Math.max(0,Math.min(100,(d.getTime()-minDate.getTime())/86400000/span*100));
  const width    = (s:Date,e:Date) => Math.max(1,(e.getTime()-s.getTime())/86400000/span*100);

  const trades = [...new Set(tasks.map(t=>t.trade).filter(Boolean))];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500 text-sm mt-0.5">Project timeline — {tasks.length} tasks</p></div>
        <div className="flex gap-2">
          <select value={selProj} onChange={e=>setSelProj(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none shadow-sm">
            <option value="">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={()=>{ setForm(f=>({...f,project_id:selProj})); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}><Plus size={15} />Add Task</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Add Task</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project *</label>
                <select required value={form.project_id} onChange={e=>set("project_id",e.target.value)} className={inp}><option value="">Select…</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Trade / Phase</label>
                <input value={form.trade} onChange={e=>set("trade",e.target.value)} className={inp} placeholder="Foundation, Framing, MEP…" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Task name *</label>
              <input required value={form.title} onChange={e=>set("title",e.target.value)} className={inp} placeholder="e.g. Pour foundation slab" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Start *</label>
                <input required type="date" value={form.start_date} onChange={e=>set("start_date",e.target.value)} className={inp} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">End *</label>
                <input required type="date" value={form.end_date} onChange={e=>set("end_date",e.target.value)} className={inp} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned To</label>
                <input value={form.assigned_to} onChange={e=>set("assigned_to",e.target.value)} className={inp} /></div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>{loading?"Saving…":"Add Task"}</button>
            </div>
          </form>
        </div>
      )}

      {tasks.length===0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">No tasks yet — add your project schedule above</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Legend */}
          {trades.length>0 && (
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-4 flex-wrap">
              {trades.map((t,i)=>(
                <div key={t} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-3 h-3 rounded-sm" style={{ background:TRADE_COLORS[i%TRADE_COLORS.length] }} />{t}
                </div>
              ))}
            </div>
          )}
          {/* Gantt rows */}
          <div className="divide-y divide-gray-100">
            {tasks.map(task=>{
              const s   = new Date(task.start_date);
              const e   = new Date(task.end_date);
              const col = TRADE_COLORS[trades.indexOf(task.trade??"")] || "#9ca3af";
              const sc  = STATUS_COLOR[task.status]??"#6b7280";
              const dur = Math.round((e.getTime()-s.getTime())/86400000);
              return (
                <div key={task.id} className="flex items-center gap-4 px-5 py-3">
                  {/* Task info */}
                  <div className="w-48 flex-shrink-0 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{task.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-2 h-2 rounded-full" style={{ background:sc }} />
                      <span className="text-[10px] text-gray-500 capitalize">{task.status.replace("_"," ")}</span>
                      <span className="text-[10px] text-gray-400">{dur}d</span>
                    </div>
                  </div>
                  {/* Bar */}
                  <div className="flex-1 relative h-8 bg-gray-50 rounded-lg overflow-hidden">
                    <div className="absolute inset-y-1.5 rounded-md flex items-center px-2 text-white text-[10px] font-semibold overflow-hidden"
                      style={{ left:`${pct(s)}%`, width:`${width(s,e)}%`, minWidth:"4px", background:col, opacity:0.9 }}>
                      {width(s,e)>10 ? task.title : ""}
                    </div>
                    {/* Today line */}
                    <div className="absolute inset-y-0 w-px bg-red-400 opacity-70" style={{ left:`${pct(new Date())}%` }} />
                  </div>
                  {/* Progress */}
                  <div className="w-24 flex-shrink-0">
                    <input type="range" min="0" max="100" value={task.progress??0}
                      onChange={e=>updateProgress(task.id,+e.target.value,+e.target.value===100?"complete":+e.target.value>0?"in_progress":"not_started")}
                      className="w-full accent-orange-500" />
                    <div className="text-[10px] text-gray-500 text-center">{task.progress??0}%</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Date labels */}
          <div className="px-5 pb-2 flex justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2" style={{ paddingLeft:"calc(1.25rem + 192px + 1rem)" }}>
            <span>{minDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            <span>{new Date((minDate.getTime()+maxDate.getTime())/2).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            <span>{maxDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
          </div>
        </div>
      )}
    </div>
  );
}
