"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, CheckCircle, Camera, X, ArrowLeft, AlertTriangle } from "lucide-react";

const PRIORITY_COLOR: Record<string,{c:string;b:string}> = {
  low:       { c:"#16a34a", b:"#dcfce7" },
  medium:    { c:"#d97706", b:"#fef3c7" },
  high:      { c:"#f97316", b:"#fff7ed" },
  fire_code: { c:"#dc2626", b:"#fee2e2" },
};

export default function ProjectPunchListPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [project, setProject]   = useState<any>(null);
  const [items, setItems]       = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("field");
  const [userId, setUserId]     = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState<"open"|"all"|"done">("open");
  const [form, setForm] = useState({ title:"", description:"", location:"", trade:"", priority:"medium", assigned_to:"" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
      setUserId(user!.id);
      setUserRole(prof?.role ?? "field");
      const { data: proj } = await supabase.from("projects").select("id,name,status").eq("id", id).single();
      setProject(proj);
      load();
    })();
  }, [id]);

  const load = async () => {
    const { data } = await createClient().from("punch_list_items")
      .select("*, profiles!created_by(full_name), profiles!verified_by(full_name)")
      .eq("project_id", id)
      .order("priority")
      .order("created_at", { ascending:false });
    setItems(data ?? []);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("punch_list_items").insert({
      ...form, project_id: id, org_id: prof?.org_id,
      created_by: user!.id, status: "open", source:"manual",
    });
    // Alert owner if fire code priority
    if (form.priority === "fire_code") {
      try {
        await fetch("/api/whatsapp-log", { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ type:"message", message:`🚨 FIRE CODE PUNCH ITEM — ${project?.name}: ${form.title} (${form.location||"no location"})`, from:"system", timestamp:new Date().toISOString() }) });
      } catch {}
    }
    setLoading(false); setShowForm(false);
    setForm({ title:"", description:"", location:"", trade:"", priority:"medium", assigned_to:"" });
    await load();
  };

  const verify = async (item: any) => {
    if (userRole !== "admin" && userRole !== "owner") return;
    await createClient().from("punch_list_items").update({
      status:"verified", verified_by: userId, verified_at: new Date().toISOString()
    }).eq("id", item.id);
    await load();
  };

  const startItem = async (id: string) => {
    await createClient().from("punch_list_items").update({ status:"in_progress" }).eq("id", id);
    await load();
  };

  const isAdmin = userRole === "admin" || userRole === "owner";
  const open   = items.filter(i=>i.status==="open"||i.status==="in_progress").length;
  const done   = items.filter(i=>i.status==="completed"||i.status==="verified").length;
  const fire   = items.filter(i=>i.priority==="fire_code"&&i.status!=="verified").length;

  const filtered = items.filter(i => {
    if (filter === "open") return i.status === "open" || i.status === "in_progress";
    if (filter === "done") return i.status === "completed" || i.status === "verified";
    return true;
  });

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <button onClick={()=>router.push(`/projects/${id}`)} className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 mb-2">
          <ArrowLeft size={14} />Back to project
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Punch List</h1>
            <p className="text-gray-500 text-sm mt-0.5 font-medium">{project?.name}</p>
          </div>
          <button onClick={()=>setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
            <Plus size={15} />Add Item
          </button>
        </div>
      </div>

      {/* Fire code alert */}
      {fire > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <div className="font-bold text-red-700 text-sm">{fire} fire code item{fire>1?"s":""} require immediate attention</div>
            <div className="text-xs text-red-600 mt-0.5">Owner has been notified via WhatsApp</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Open",      value:open, color:"#f97316" },
          { label:"Completed", value:done, color:"#16a34a" },
          { label:"Total",     value:items.length, color:"#2563eb" },
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
            <div className="text-2xl font-bold" style={{ color:s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add item form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Add Punch List Item</h2>
            <button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <form onSubmit={addItem} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Item *</label>
              <input required value={form.title} onChange={e=>set("title",e.target.value)} className={inp} placeholder="e.g. Paint touch-up hallway ceiling, Fix cracked tile Room 205" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                <select value={form.priority} onChange={e=>set("priority",e.target.value)} className={inp}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="fire_code">🚨 Fire Code / Life Safety</option>
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Trade</label>
                <input value={form.trade} onChange={e=>set("trade",e.target.value)} className={inp} placeholder="Painting, Flooring…" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Location in building</label>
                <input value={form.location} onChange={e=>set("location",e.target.value)} className={inp} placeholder="Room 205, 2nd floor corridor" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned to</label>
                <input value={form.assigned_to} onChange={e=>set("assigned_to",e.target.value)} className={inp} placeholder="Sub or worker name" /></div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                {loading ? "Saving…" : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["open","done","all"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter===f?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            {f==="open"?`Open (${open})`:f==="done"?`Done (${done})`:"All"}
          </button>
        ))}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <CheckCircle size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium text-sm">{filter==="open"?"No open items — nice work!":"No items yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item=>{
            const pc = PRIORITY_COLOR[item.priority]??PRIORITY_COLOR.medium;
            const isDone = item.status==="completed"||item.status==="verified";
            return (
              <div key={item.id} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 ${isDone?"opacity-60":""}`}>
                <div className="flex items-start gap-3">
                  {/* Check circle - PM/admin only verifies */}
                  <button
                    onClick={()=>!isDone&&isAdmin&&verify(item)}
                    disabled={isDone||(!isAdmin&&item.status!=="completed")}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      isDone?"bg-green-500 border-green-500":
                      isAdmin?"border-gray-300 hover:border-green-500 cursor-pointer":"border-gray-300 cursor-default"}`}>
                    {isDone && <CheckCircle size={12} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background:pc.b, color:pc.c }}>
                        {item.priority==="fire_code"?"🚨 FIRE CODE":item.priority.toUpperCase()}
                      </span>
                      {item.status==="in_progress"&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">IN PROGRESS</span>}
                      {item.status==="verified"&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">✓ VERIFIED</span>}
                      {item.source==="whatsapp"&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">📱 WhatsApp</span>}
                    </div>
                    <p className={`text-sm font-medium ${isDone?"text-gray-400 line-through":"text-gray-900"}`}>{item.title}</p>
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
                      {item.location && <span>📍 {item.location}</span>}
                      {item.trade && <span>🔧 {item.trade}</span>}
                      {item.assigned_to && <span>👤 {item.assigned_to}</span>}
                    </div>
                    {item.status==="verified"&&item.profiles__verified_by?.full_name && (
                      <div className="text-[10px] text-green-600 mt-1">Verified by {item.profiles__verified_by.full_name}</div>
                    )}
                  </div>
                  {/* Actions */}
                  {!isDone && (
                    <div className="flex gap-2 flex-shrink-0">
                      {item.status==="open" && (
                        <button onClick={()=>startItem(item.id)} className="text-xs font-semibold text-blue-500 hover:text-blue-700 whitespace-nowrap">Start</button>
                      )}
                      {isAdmin && item.status==="in_progress" && (
                        <button onClick={()=>verify(item)} className="text-xs font-semibold text-green-500 hover:text-green-700 whitespace-nowrap">Verify</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <div className="text-xs text-gray-400 text-center bg-gray-50 rounded-lg p-3">
          As {userRole}, you can verify completed items. Field workers can add and start items.
        </div>
      )}
    </div>
  );
}
