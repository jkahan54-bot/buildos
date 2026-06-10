"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Phone, Mail, DollarSign, Calendar, ArrowRight, CheckCircle, X, ChevronDown, MessageSquare, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

const STAGES = [
  { id:"new",           label:"New Lead",       color:"#6b7280", bg:"#f3f4f6",  emoji:"📥" },
  { id:"contacted",     label:"Contacted",      color:"#2563eb", bg:"#dbeafe",  emoji:"📞" },
  { id:"proposal_sent", label:"Proposal Sent",  color:"#7c3aed", bg:"#ede9fe",  emoji:"📋" },
  { id:"negotiating",   label:"Negotiating",    color:"#d97706", bg:"#fef3c7",  emoji:"🤝" },
  { id:"won",           label:"Won",            color:"#16a34a", bg:"#dcfce7",  emoji:"🎉" },
  { id:"lost",          label:"Lost",           color:"#dc2626", bg:"#fee2e2",  emoji:"❌" },
  { id:"on_hold",       label:"On Hold",        color:"#9ca3af", bg:"#f9fafb",  emoji:"⏸" },
];

const SOURCES = ["Referral","Phone call","Walk-in","Website","Word of mouth","Existing client","Other"];

const fmtMoney = (n: number) => !n ? "—" : n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
const daysUntil = (d: string) => { const diff = new Date(d).getTime() - Date.now(); return Math.ceil(diff/86400000); };

export default function PipelinePage() {
  const router  = useRouter();
  const [leads, setLeads]       = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes]       = useState<any[]>([]);
  const [newNote, setNewNote]   = useState("");
  const [converting, setConverting] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [view, setView]         = useState<"board"|"list">("board");
  const [form, setForm] = useState({
    contact_name:"", company:"", phone:"", email:"", address:"",
    project_description:"", project_type:"standard", estimated_value:"",
    status:"new", source:"", next_followup:"", notes:""
  });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selected) loadNotes(selected.id); }, [selected]);

  const load = async () => {
    const { data } = await createClient().from("leads").select("*, profiles(full_name)").order("updated_at", { ascending:false });
    setLeads(data ?? []);
  };

  const loadNotes = async (leadId: string) => {
    const { data } = await createClient().from("lead_notes").select("*, profiles(full_name)").eq("lead_id", leadId).order("created_at");
    setNotes(data ?? []);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    // `notes` is a UI-only field — the leads table has no such column, so strip it out
    const { notes: firstNote, next_followup, ...leadFields } = form;
    const payload = {
      ...leadFields,
      org_id: prof?.org_id,
      created_by: user!.id,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      next_followup: next_followup || null,
    };
    const { data: newLead, error } = await supabase.from("leads").insert(payload).select().single();
    if (error) {
      setLoading(false);
      alert("Could not save lead: " + error.message);
      return;
    }
    // If the user typed an opening note, save it to the conversation log
    if (firstNote.trim() && newLead) {
      await supabase.from("lead_notes").insert({ lead_id: newLead.id, note: firstNote.trim(), created_by: user!.id });
    }
    setLoading(false); setShowForm(false);
    setForm({ contact_name:"", company:"", phone:"", email:"", address:"", project_description:"", project_type:"standard", estimated_value:"", status:"new", source:"", next_followup:"", notes:"" });
    await load();
  };

  const updateStatus = async (id: string, status: string) => {
    await createClient().from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (selected?.id === id) setSelected((s:any) => ({...s, status}));
    await load();
  };

  const updateFollowup = async (id: string, date: string) => {
    await createClient().from("leads").update({ next_followup: date, last_contact: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString() }).eq("id", id);
    if (selected?.id === id) setSelected((s:any) => ({...s, next_followup: date}));
    await load();
  };

  const addNote = async () => {
    if (!newNote.trim() || !selected) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("lead_notes").insert({ lead_id: selected.id, note: newNote.trim(), created_by: user!.id });
    await supabase.from("leads").update({ last_contact: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString() }).eq("id", selected.id);
    setNewNote(""); await loadNotes(selected.id); await load();
  };

  const convertToProject = async () => {
    if (!selected) return;
    setConverting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const { data: project } = await supabase.from("projects").insert({
      name: selected.company || selected.contact_name,
      org_id: prof?.org_id,
      created_by: user!.id,
      status: "active",
      phase: "Planning",
      type: selected.project_type || "standard",
      address: selected.address,
      budget: selected.estimated_value || 0,
      description: selected.project_description,
      progress: 0,
    }).select().single();
    if (project) {
      await supabase.from("leads").update({ status:"won", converted_project_id: project.id, updated_at: new Date().toISOString() }).eq("id", selected.id);
      setConverting(false);
      router.push(`/projects/${project.id}/edit`);
    } else {
      setConverting(false);
    }
  };

  const totalPipelineValue = leads.filter(l=>!["won","lost"].includes(l.status)).reduce((s,l)=>s+(l.estimated_value??0),0);
  const wonValue = leads.filter(l=>l.status==="won").reduce((s,l)=>s+(l.estimated_value??0),0);
  const followupToday = leads.filter(l=>l.next_followup && daysUntil(l.next_followup)<=0 && !["won","lost"].includes(l.status)).length;

  const stageById = (id:string) => STAGES.find(s=>s.id===id) ?? STAGES[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {leads.filter(l=>!["won","lost"].includes(l.status)).length} active leads
            {followupToday > 0 && <span className="ml-2 text-orange-500 font-semibold">· {followupToday} follow-up{followupToday>1?"s":""} due today!</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={()=>setView("board")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view==="board"?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>Board</button>
            <button onClick={()=>setView("list")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view==="list"?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>List</button>
          </div>
          <button onClick={()=>setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
            <Plus size={15} />Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Pipeline Value",  value:fmtMoney(totalPipelineValue), color:"#2563eb", sub:`${leads.filter(l=>!["won","lost"].includes(l.status)).length} leads` },
          { label:"Won This Year",   value:fmtMoney(wonValue),           color:"#16a34a", sub:`${leads.filter(l=>l.status==="won").length} projects` },
          { label:"Follow-ups Due",  value:followupToday,                color: followupToday>0?"#dc2626":"#16a34a", sub:followupToday>0?"Needs attention":"All up to date" },
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className="text-xl font-bold" style={{ color:s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* New lead form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">New Lead</h2>
            <button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Contact name *</label>
                <input required value={form.contact_name} onChange={e=>set("contact_name",e.target.value)} className={inp} placeholder="John Smith" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                <input value={form.company} onChange={e=>set("company",e.target.value)} className={inp} placeholder="Smith Properties LLC" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input value={form.phone} onChange={e=>set("phone",e.target.value)} className={inp} placeholder="(555) 000-0000" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} className={inp} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project description</label>
              <textarea value={form.project_description} onChange={e=>set("project_description",e.target.value)} rows={2} className={inp+" resize-none"} placeholder="What do they want to build? Where? Any details from the call…" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Est. Value ($)</label>
                <input type="number" value={form.estimated_value} onChange={e=>set("estimated_value",e.target.value)} className={inp} placeholder="500000" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project type</label>
                <select value={form.project_type} onChange={e=>set("project_type",e.target.value)} className={inp}>
                  <option value="standard">Standard</option>
                  <option value="medical_facility">Medical Facility</option>
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
                <select value={form.source} onChange={e=>set("source",e.target.value)} className={inp}>
                  <option value="">How did they find us?</option>
                  {SOURCES.map(s=><option key={s}>{s}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Address / Location</label>
                <input value={form.address} onChange={e=>set("address",e.target.value)} className={inp} placeholder="Project address if known" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Follow-up date</label>
                <input type="date" value={form.next_followup} onChange={e=>set("next_followup",e.target.value)} className={inp} /></div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                {loading ? "Saving…" : "Add Lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Board view */}
      {view === "board" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGES.filter(s=>s.id!=="lost").map(stage=>{
              const stageLeads = leads.filter(l=>l.status===stage.id);
              const stageValue = stageLeads.reduce((s,l)=>s+(l.estimated_value??0),0);
              return (
                <div key={stage.id} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <div className="flex items-center gap-1.5">
                      <span>{stage.emoji}</span>
                      <span className="text-xs font-bold text-gray-700">{stage.label}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">{stageLeads.length}</span>
                    </div>
                    {stageValue > 0 && <span className="text-xs font-semibold text-gray-500">{fmtMoney(stageValue)}</span>}
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map(lead=>{
                      const followupDue = lead.next_followup && daysUntil(lead.next_followup) <= 0;
                      const followupSoon = lead.next_followup && daysUntil(lead.next_followup) <= 2 && daysUntil(lead.next_followup) > 0;
                      return (
                        <div key={lead.id} onClick={()=>setSelected(lead)}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 cursor-pointer hover:border-orange-200 hover:shadow-md transition-all">
                          <div className="font-semibold text-sm text-gray-900 truncate">{lead.company || lead.contact_name}</div>
                          {lead.company && <div className="text-xs text-gray-500 truncate">{lead.contact_name}</div>}
                          {lead.project_description && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{lead.project_description}</div>}
                          <div className="flex items-center justify-between mt-2.5">
                            {lead.estimated_value ? (
                              <span className="text-xs font-bold text-green-600">{fmtMoney(lead.estimated_value)}</span>
                            ) : <span />}
                            {lead.next_followup && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${followupDue?"bg-red-100 text-red-600":followupSoon?"bg-orange-100 text-orange-600":"bg-gray-100 text-gray-500"}`}>
                                {followupDue ? "⚠ Follow up!" : followupSoon ? `${daysUntil(lead.next_followup)}d` : lead.next_followup}
                              </span>
                            )}
                          </div>
                          {lead.source && <div className="text-[10px] text-gray-400 mt-1">{lead.source}</div>}
                        </div>
                      );
                    })}
                    {stageLeads.length === 0 && (
                      <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">No leads</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No leads yet — add your first one above</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {leads.map(lead=>{
                const stage = stageById(lead.status);
                const followupDue = lead.next_followup && daysUntil(lead.next_followup) <= 0 && !["won","lost"].includes(lead.status);
                return (
                  <div key={lead.id} onClick={()=>setSelected(lead)}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">{lead.company || lead.contact_name}</span>
                        {lead.company && <span className="text-xs text-gray-400">· {lead.contact_name}</span>}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">{lead.project_description}</div>
                    </div>
                    <div className="hidden sm:block text-sm font-bold text-green-600 flex-shrink-0">{fmtMoney(lead.estimated_value??0)}</div>
                    {followupDue && <span className="text-xs font-bold text-red-500 flex-shrink-0">⚠ Follow up!</span>}
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background:stage.bg, color:stage.color }}>{stage.emoji} {stage.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lead detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={(e)=>{ if(e.target===e.currentTarget) setSelected(null); }}>
          <div className="absolute inset-0 bg-black/30" onClick={()=>setSelected(null)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between bg-white">
              <div>
                <div className="font-bold text-gray-900">{selected.company || selected.contact_name}</div>
                {selected.company && <div className="text-sm text-gray-500">{selected.contact_name}</div>}
                {selected.estimated_value > 0 && <div className="text-sm font-bold text-green-600 mt-0.5">{fmtMoney(selected.estimated_value)}</div>}
              </div>
              <button onClick={()=>setSelected(null)} className="text-gray-400 hover:text-gray-600 mt-1"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Status + Convert */}
              <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                {/* Stage picker */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Stage</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map(s=>(
                      <button key={s.id} onClick={()=>updateStatus(selected.id, s.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                        style={ selected.status===s.id
                          ? { background:s.bg, borderColor:s.color, color:s.color }
                          : { background:"#f9fafb", borderColor:"#e5e7eb", color:"#6b7280" }}>
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Convert to project */}
                {!["won","lost"].includes(selected.status) && (
                  <button onClick={convertToProject} disabled={converting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all disabled:opacity-60"
                    style={{ background:"linear-gradient(135deg,#16a34a,#15803d)" }}>
                    <CheckCircle size={15} />
                    {converting ? "Converting…" : "✓ Convert to Project"}
                  </button>
                )}
                {selected.status === "won" && selected.converted_project_id && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span>Converted to project</span>
                    <button onClick={()=>router.push(`/projects/${selected.converted_project_id}`)} className="ml-auto text-xs font-bold text-green-600 hover:text-green-800">View →</button>
                  </div>
                )}
              </div>

              {/* Contact info */}
              <div className="px-5 py-4 border-b border-gray-100 space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact</div>
                {selected.phone && <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-orange-500 transition-colors"><Phone size={14} className="text-gray-400" />{selected.phone}</a>}
                {selected.email && <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-orange-500 transition-colors"><Mail size={14} className="text-gray-400" />{selected.email}</a>}
                {selected.address && <div className="flex items-start gap-2 text-sm text-gray-600"><Building2 size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />{selected.address}</div>}
                {selected.source && <div className="text-xs text-gray-400">Source: {selected.source}</div>}
              </div>

              {/* Project description */}
              {selected.project_description && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Project Details</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{selected.project_description}</p>
                </div>
              )}

              {/* Follow-up */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Follow-up Date</div>
                <input type="date" defaultValue={selected.next_followup??""} onChange={e=>updateFollowup(selected.id, e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm" />
                {selected.next_followup && (
                  <div className={`text-xs mt-1.5 font-semibold ${daysUntil(selected.next_followup)<=0?"text-red-500":daysUntil(selected.next_followup)<=3?"text-orange-500":"text-gray-400"}`}>
                    {daysUntil(selected.next_followup)<=0 ? "⚠ Overdue!" : daysUntil(selected.next_followup)===1 ? "Tomorrow" : `In ${daysUntil(selected.next_followup)} days`}
                  </div>
                )}
              </div>

              {/* Notes / call log */}
              <div className="px-5 py-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Conversation Log</div>
                <div className="space-y-3 mb-4">
                  {notes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No notes yet — log your first call or meeting below</p>
                  ) : notes.map(n=>(
                    <div key={n.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-sm text-gray-800 leading-relaxed">{n.note}</p>
                      <div className="text-[10px] text-gray-400 mt-1.5">{n.profiles?.full_name} · {new Date(n.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea value={newNote} onChange={e=>setNewNote(e.target.value)}
                    placeholder="Log a call, email, or meeting…"
                    onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); addNote(); }}}
                    rows={2} className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm resize-none" />
                  <button onClick={addNote} disabled={!newNote.trim()}
                    className="px-3 py-2.5 rounded-xl text-white font-bold disabled:opacity-40 flex-shrink-0"
                    style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">Press Enter to save</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
