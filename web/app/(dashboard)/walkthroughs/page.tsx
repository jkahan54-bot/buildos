"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plus, Camera, Upload, RefreshCw, CheckCircle, ChevronRight, AlertTriangle, X, Building2 } from "lucide-react";

const STATUS_META: Record<string,{color:string;bg:string;label:string}> = {
  scheduled:     { color:"#2563eb", bg:"#dbeafe", label:"Scheduled"     },
  in_progress:   { color:"#f97316", bg:"#fff7ed", label:"In Progress"    },
  completed:     { color:"#16a34a", bg:"#dcfce7", label:"Completed"      },
  bid_submitted: { color:"#7c3aed", bg:"#ede9fe", label:"Bid Submitted"  },
  won:           { color:"#16a34a", bg:"#dcfce7", label:"Won ✓"          },
  lost:          { color:"#dc2626", bg:"#fee2e2", label:"Lost"           },
};

const ICRA_COLORS: Record<string,string> = { I:"#16a34a", II:"#d97706", III:"#f97316", IV:"#dc2626" };

export default function WalkthroughsPage() {
  const router  = useRouter();
  const [walkthroughs, setWalkthroughs] = useState<any[]>([]);
  const [leads, setLeads]               = useState<any[]>([]);
  const [view, setView]                 = useState<"list"|"new"|"assess">("list");
  const [current, setCurrent]           = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [form, setForm] = useState({ facility_name:"", address:"", scheduled_date:"", lead_id:"", occupancy_type:"Nursing Home", sq_footage:"", floors:"1", building_age:"", estimated_value:"" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  useEffect(() => {
    load();
    createClient().from("leads").select("id,contact_name,company,status").eq("status","new").then(({data})=>setLeads(data??[]));
  }, []);

  const load = async () => {
    const { data } = await createClient().from("site_walkthroughs").select("*, profiles!conducted_by(full_name)").order("created_at",{ascending:false});
    setWalkthroughs(data??[]);
  };

  const createWalkthrough = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const { data: wt } = await supabase.from("site_walkthroughs").insert({
      ...form, org_id: prof?.org_id, created_by: user!.id, status:"scheduled",
      sq_footage: form.sq_footage ? parseInt(form.sq_footage) : null,
      floors: parseInt(form.floors) || 1,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      lead_id: form.lead_id || null,
    }).select().single();
    setLoading(false);
    if (wt) { setCurrent(wt); setView("assess"); await load(); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Site Walkthroughs</h1>
          <p className="text-gray-500 text-sm mt-0.5">Pre-bid facility assessments · {walkthroughs.filter(w=>w.status==="scheduled").length} upcoming</p>
        </div>
        {view === "list" && (
          <button onClick={() => setView("new")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
            <Plus size={15} />Schedule Walkthrough
          </button>
        )}
        {view !== "list" && (
          <button onClick={() => setView("list")} className="text-sm text-orange-500 hover:text-orange-600 font-medium">← Back</button>
        )}
      </div>

      {/* New walkthrough form */}
      {view === "new" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl">
          <h2 className="font-bold text-gray-900 mb-4">Schedule Site Walkthrough</h2>
          <form onSubmit={createWalkthrough} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Facility name *</label>
              <input required value={form.facility_name} onChange={e=>set("facility_name",e.target.value)} className={inp} placeholder="e.g. Sunrise Nursing & Rehab Center" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <input value={form.address} onChange={e=>set("address",e.target.value)} className={inp} placeholder="Full address" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Walkthrough date</label>
                <input type="date" value={form.scheduled_date} onChange={e=>set("scheduled_date",e.target.value)} className={inp} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Occupancy type</label>
                <select value={form.occupancy_type} onChange={e=>set("occupancy_type",e.target.value)} className={inp}>
                  {["Nursing Home","Assisted Living","Medical Office","Clinic","Hospital","Rehab Center","Other"].map(t=><option key={t}>{t}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Sq Footage</label>
                <input type="number" value={form.sq_footage} onChange={e=>set("sq_footage",e.target.value)} className={inp} placeholder="12000" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Floors</label>
                <input type="number" value={form.floors} onChange={e=>set("floors",e.target.value)} className={inp} placeholder="3" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Building age</label>
                <input value={form.building_age} onChange={e=>set("building_age",e.target.value)} className={inp} placeholder="1985" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated contract value ($)</label>
              <input type="number" value={form.estimated_value} onChange={e=>set("estimated_value",e.target.value)} className={inp} placeholder="500000" /></div>
            {leads.length > 0 && (
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Link to lead (optional)</label>
                <select value={form.lead_id} onChange={e=>set("lead_id",e.target.value)} className={inp}>
                  <option value="">No lead linked</option>
                  {leads.map(l=><option key={l.id} value={l.id}>{l.company||l.contact_name}</option>)}
                </select></div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={()=>setView("list")} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                {loading ? "Creating…" : "Create & Start Assessment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assessment view */}
      {view === "assess" && current && (
        <AssessmentView walkthrough={current} onComplete={async()=>{await load();setView("list");}} />
      )}

      {/* Walkthrough list */}
      {view === "list" && (
        walkthroughs.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Building2 size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No walkthroughs yet</p>
            <p className="text-gray-400 text-sm mt-1">Schedule your first facility assessment above</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {walkthroughs.map((wt, i) => {
              const s = STATUS_META[wt.status] ?? STATUS_META.scheduled;
              return (
                <div key={wt.id} onClick={()=>{setCurrent(wt);setView("assess");}}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-all ${i<walkthroughs.length-1?"border-b border-gray-100":""}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:s.bg }}>
                    <Building2 size={18} style={{ color:s.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{wt.facility_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {wt.occupancy_type} · {wt.address ? wt.address.split(",")[0] : "No address"}
                      {wt.sq_footage ? ` · ${wt.sq_footage.toLocaleString()} SF` : ""}
                      {wt.scheduled_date ? ` · ${wt.scheduled_date}` : ""}
                    </div>
                    {wt.icra_level && (
                      <div className="text-[10px] font-bold mt-1" style={{ color:ICRA_COLORS[wt.icra_level] }}>ICRA Level {wt.icra_level}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {wt.estimated_value > 0 && <span className="text-sm font-bold text-green-600 hidden sm:block">${(wt.estimated_value/1000).toFixed(0)}K</span>}
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:s.bg, color:s.color }}>{s.label}</span>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ── Assessment component ──────────────────────────────────────────────────────
function AssessmentView({ walkthrough, onComplete }: { walkthrough:any; onComplete:()=>void }) {
  const [rooms, setRooms]             = useState<any[]>(walkthrough.rooms || []);
  const [activeRoom, setActiveRoom]   = useState<number | null>(null);
  const [analyzing, setAnalyzing]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const addRoom = () => {
    if (!newRoomName.trim()) return;
    setRooms(r=>[...r, { name:newRoomName, condition:"Fair", icra_risk:"II", issues:[], scope_items:[], photos:[], notes:"", analyzed:false }]);
    setActiveRoom(rooms.length);
    setNewRoomName("");
  };

  const analyzePhotos = async (roomIndex: number, files: FileList) => {
    setAnalyzing(true);
    const form = new FormData();
    Array.from(files).forEach(f => form.append("images", f));
    form.append("room", rooms[roomIndex].name);
    form.append("notes", rooms[roomIndex].notes || "");
    try {
      const res  = await fetch("/api/ai/walkthrough", { method:"POST", body:form });
      const data = await res.json();
      if (data.result) {
        setRooms(r => r.map((room, i) => i === roomIndex ? {
          ...room, ...data.result, analyzed:true,
          photos: [...(room.photos||[]), ...Array.from(files).map((f:any)=>f.name)]
        } : room));
      }
    } catch {}
    setAnalyzing(false);
  };

  const saveAndComplete = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const icraLevels = rooms.map(r=>r.icra_risk).filter(Boolean);
    const maxIcra = icraLevels.includes("IV")?"IV":icraLevels.includes("III")?"III":icraLevels.includes("II")?"II":"I";
    await supabase.from("site_walkthroughs").update({
      rooms, status:"completed", conducted_date:new Date().toISOString().split("T")[0],
      conducted_by: user!.id, icra_level: maxIcra,
    }).eq("id", walkthrough.id);
    setSaving(false);
    onComplete();
  };

  const room = activeRoom !== null ? rooms[activeRoom] : null;
  const ICRA_DESCRIPTIONS = { I:"Low risk — minor work away from patients", II:"Medium risk — moderate work, barriers needed", III:"High risk — complex work, HEPA filtration required", IV:"Highest risk — demolition near patient areas, negative pressure room" };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="font-semibold text-blue-800">{walkthrough.facility_name}</div>
        <div className="text-xs text-blue-600 mt-1">{walkthrough.address} · {walkthrough.occupancy_type}</div>
        <div className="text-xs text-blue-500 mt-1">📸 Take photos in each room → AI analyzes condition and scope automatically</div>
      </div>

      {/* Room list */}
      {rooms.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {rooms.map((r, i) => (
            <div key={i} onClick={()=>setActiveRoom(i===activeRoom?null:i)}
              className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-gray-100 last:border-0 ${activeRoom===i?"bg-orange-50":""} hover:bg-gray-50`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${r.analyzed?"bg-green-500":"bg-gray-200"}`}>
                {r.analyzed ? <CheckCircle size={14} className="text-white" /> : <span className="text-[10px] font-bold text-gray-500">{i+1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{r.name}</div>
                {r.analyzed && <div className="text-xs text-gray-500">{r.condition} · ICRA {r.icra_risk} · {r.scope_items?.length||0} scope items</div>}
              </div>
              {r.icra_risk && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background:ICRA_COLORS[r.icra_risk]+"20", color:ICRA_COLORS[r.icra_risk] }}>ICRA {r.icra_risk}</span>}
              <ChevronRight size={14} className={`text-gray-400 transition-transform ${activeRoom===i?"rotate-90":""}`} />
            </div>
          ))}
        </div>
      )}

      {/* Active room detail */}
      {room && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900">{room.name}</div>
            <button onClick={()=>fileRef.current?.click()} disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              {analyzing ? <><RefreshCw size={13} className="animate-spin" />Analyzing…</> : <><Camera size={13} />Add Photos + AI Analyze</>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
              onChange={e=>e.target.files?.length && analyzePhotos(activeRoom!, e.target.files)} className="hidden" />
          </div>

          {room.analyzed ? (
            <div className="space-y-3">
              {/* Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Condition</div>
                  <div className={`font-bold text-sm ${room.condition==="Poor"?"text-red-600":room.condition==="Fair"?"text-orange-600":"text-green-600"}`}>{room.condition}</div>
                  <div className="text-xs text-gray-500 mt-1">{room.condition_notes}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">ICRA Level</div>
                  <div className="font-bold text-sm" style={{ color:ICRA_COLORS[room.icra_risk] }}>Level {room.icra_risk}</div>
                  <div className="text-xs text-gray-500 mt-1">{ICRA_DESCRIPTIONS[room.icra_risk as keyof typeof ICRA_DESCRIPTIONS]}</div>
                </div>
              </div>
              {/* Hazards */}
              {room.hazard_flags && (room.hazard_flags.asbestos||room.hazard_flags.lead||room.hazard_flags.mold) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <div className="text-xs text-red-700 font-semibold">
                    Hazards: {[room.hazard_flags.asbestos&&"Asbestos",room.hazard_flags.lead&&"Lead",room.hazard_flags.mold&&"Mold"].filter(Boolean).join(", ")}
                    {room.hazard_flags.notes && ` — ${room.hazard_flags.notes}`}
                  </div>
                </div>
              )}
              {/* Issues */}
              {room.issues?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Issues Found</div>
                  {room.issues.map((issue:string, i:number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700 mb-1">
                      <span className="text-orange-500 flex-shrink-0">•</span>{issue}
                    </div>
                  ))}
                </div>
              )}
              {/* Scope items */}
              {room.scope_items?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scope of Work</div>
                  {room.scope_items.map((item:any, i:number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                      <div className="text-sm text-gray-800">{item.description}</div>
                      <div className="flex gap-3 text-xs text-gray-500 flex-shrink-0">
                        <span className="font-semibold">{item.trade}</span>
                        <span>{item.estimated_qty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">
              <Camera size={28} className="mx-auto mb-2 text-gray-300" />
              Take photos of this room and AI will analyze condition, ICRA risk, and scope automatically
            </div>
          )}
        </div>
      )}

      {/* Add room */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex gap-2">
          <input value={newRoomName} onChange={e=>setNewRoomName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addRoom()}
            placeholder="Add area/room (e.g. Room 101, Corridor B, Nurses Station)"
            className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm" />
          <button onClick={addRoom} disabled={!newRoomName.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>Add</button>
        </div>
        <div className="text-xs text-gray-400 mt-2">Quick add: <span className="cursor-pointer hover:text-orange-500" onClick={()=>{setNewRoomName("Patient Room");addRoom();}}>Patient Room</span> · <span className="cursor-pointer hover:text-orange-500" onClick={()=>{setNewRoomName("Corridor");addRoom();}}>Corridor</span> · <span className="cursor-pointer hover:text-orange-500" onClick={()=>{setNewRoomName("Bathroom");addRoom();}}>Bathroom</span> · <span className="cursor-pointer hover:text-orange-500" onClick={()=>{setNewRoomName("Nurse Station");addRoom();}}>Nurse Station</span> · <span className="cursor-pointer hover:text-orange-500" onClick={()=>{setNewRoomName("Common Area");addRoom();}}>Common Area</span></div>
      </div>

      {/* Complete */}
      {rooms.length > 0 && (
        <button onClick={saveAndComplete} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-50"
          style={{ background:"linear-gradient(135deg,#16a34a,#15803d)" }}>
          <CheckCircle size={16} />
          {saving ? "Saving…" : `Complete Walkthrough (${rooms.length} area${rooms.length!==1?"s":""})`}
        </button>
      )}
    </div>
  );
}
