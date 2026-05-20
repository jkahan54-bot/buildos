"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Check, Users } from "lucide-react";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [loading, setLoading]  = useState(false);
  const [form, setForm] = useState({ project_id:"", title:"", meeting_date: new Date().toISOString().split("T")[0], location:"", notes:"", attendees_text:"", action_items_text:"" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm";

  useEffect(() => { load(); createClient().from("projects").select("id,name").then(({data})=>setProjects(data??[])); }, []);
  const load = async () => { const {data} = await createClient().from("meeting_minutes").select("*, projects(name), profiles(full_name)").order("meeting_date",{ascending:false}); setMeetings(data??[]); };

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data:{user} } = await supabase.auth.getUser();
    const { data:prof } = await supabase.from("profiles").select("org_id").eq("id",user!.id).single();
    const attendees = form.attendees_text.split("\n").map(s=>s.trim()).filter(Boolean);
    const action_items = form.action_items_text.split("\n").filter(Boolean).map((line,i)=>({ id:i+1, text:line, done:false }));
    await supabase.from("meeting_minutes").insert({ project_id:form.project_id||null, title:form.title, meeting_date:form.meeting_date, location:form.location, notes:form.notes, attendees, action_items, org_id:prof?.org_id, created_by:user!.id });
    setLoading(false); setShowForm(false); setForm({ project_id:"", title:"", meeting_date:new Date().toISOString().split("T")[0], location:"", notes:"", attendees_text:"", action_items_text:"" });
    await load();
  };

  const toggleAction = async (meetingId:string, actionIndex:number, done:boolean) => {
    const meeting = meetings.find(m=>m.id===meetingId);
    if (!meeting) return;
    const items = Array.isArray(meeting.action_items) ? meeting.action_items : [];
    items[actionIndex] = { ...items[actionIndex], done };
    await createClient().from("meeting_minutes").update({ action_items:items }).eq("id",meetingId);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Meeting Minutes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meetings.length} meetings logged</p></div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}><Plus size={15} />New Meeting</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">New Meeting Minutes</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input required value={form.title} onChange={e=>set("title",e.target.value)} className={inp} placeholder="OAC Meeting, Safety Mtg…" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input type="date" value={form.meeting_date} onChange={e=>set("meeting_date",e.target.value)} className={inp} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
                <select value={form.project_id} onChange={e=>set("project_id",e.target.value)} className={inp}><option value="">General</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
              <input value={form.location} onChange={e=>set("location",e.target.value)} className={inp} placeholder="Site office, Zoom…" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Attendees (one per line)</label>
                <textarea value={form.attendees_text} onChange={e=>set("attendees_text",e.target.value)} rows={4} className={inp+" resize-none"} placeholder={"Joel Kahan\nArchitect Name\nEngineer Name"} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Action Items (one per line)</label>
                <textarea value={form.action_items_text} onChange={e=>set("action_items_text",e.target.value)} rows={4} className={inp+" resize-none"} placeholder={"Submit RFI by Friday\nGet permit approval\nSchedule inspection"} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Notes / Discussion</label>
              <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={4} className={inp+" resize-none"} placeholder="Discussion points, decisions made…" /></div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>{loading?"Saving…":"Save Minutes"}</button>
            </div>
          </form>
        </div>
      )}

      {meetings.length===0 ? <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">No meetings logged yet</div> : (
        <div className="space-y-3">
          {meetings.map(m=>{
            const actions = Array.isArray(m.action_items) ? m.action_items : [];
            const openActions = actions.filter((a:any)=>!a.done).length;
            const isOpen = expanded===m.id;
            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button onClick={()=>setExpanded(isOpen?null:m.id)} className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0"><Users size={18} className="text-orange-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{m.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{m.projects?.name||"General"} · {m.meeting_date}{m.location?` · ${m.location}`:""}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {openActions>0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{openActions} open actions</span>}
                    <span className="text-gray-400">{isOpen?"▲":"▼"}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                    {m.attendees?.length>0 && <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Attendees</div><div className="flex flex-wrap gap-2">{m.attendees.map((a:string,i:number)=><span key={i} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{a}</span>)}</div></div>}
                    {m.notes && <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</div><p className="text-sm text-gray-700 whitespace-pre-wrap">{m.notes}</p></div>}
                    {actions.length>0 && (
                      <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Action Items</div>
                        <div className="space-y-2">
                          {actions.map((a:any,i:number)=>(
                            <div key={i} className="flex items-center gap-3">
                              <button onClick={()=>toggleAction(m.id,i,!a.done)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${a.done?"bg-green-500 border-green-500":"border-gray-300 hover:border-orange-400"}`}>
                                {a.done&&<Check size={11} className="text-white" />}
                              </button>
                              <span className={`text-sm ${a.done?"line-through text-gray-400":"text-gray-800"}`}>{a.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
