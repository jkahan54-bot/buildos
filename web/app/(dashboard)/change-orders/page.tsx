"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, DollarSign, CheckCircle, XCircle, Clock, X } from "lucide-react";
import { WAITING_ON_META, WAITING_ON_OPTIONS } from "@/lib/waitingOn";

const STATUS_META: Record<string,{color:string;bg:string;label:string}> = {
  draft:     { color:"#6b7280", bg:"#f3f4f6", label:"Draft"     },
  submitted: { color:"#d97706", bg:"#fef3c7", label:"Submitted" },
  approved:  { color:"#16a34a", bg:"#dcfce7", label:"Approved"  },
  rejected:  { color:"#dc2626", bg:"#fee2e2", label:"Rejected"  },
};

const fmtMoney = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n.toLocaleString()}`;

export default function ChangeOrdersPage() {
  const router = useRouter();
  const [orders, setOrders]   = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]  = useState(false);
  const [filter, setFilter]    = useState("all");
  const [form, setForm] = useState({ project_id:"", title:"", description:"", reason:"", amount:"0", waiting_on:"Owner" });
  const set = (k:string,v:string) => setForm(f => ({...f,[k]:v}));

  useEffect(() => { load(); createClient().from("projects").select("id,name").then(({data}) => setProjects(data??[])); }, []);

  const load = async () => {
    const { data } = await createClient().from("change_orders").select("*, projects(name), profiles!requested_by(full_name)").order("created_at", { ascending:false });
    setOrders(data ?? []);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    const count = orders.filter(o => o.project_id === form.project_id).length + 1;
    await supabase.from("change_orders").insert({
      ...form, org_id: prof?.org_id, requested_by: user!.id, amount: parseFloat(form.amount) || 0,
      number: `CO-${String(count).padStart(3,"0")}`, status: "submitted",
    });
    setLoading(false); setShowForm(false); setForm({ project_id:"", title:"", description:"", reason:"", amount:"0", waiting_on:"Owner" });
    await load();
  };

  const updateStatus = async (id:string, status:string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("change_orders").update({ status, waiting_on: null, ...(status==="approved"?{approved_by:user!.id, approved_at:new Date().toISOString()}:{}) }).eq("id", id);
    await load();
  };

  const filtered = filter==="all" ? orders : orders.filter(o=>o.status===filter);
  const totalApproved = orders.filter(o=>o.status==="approved").reduce((s,o)=>s+(o.amount??0),0);
  const totalPending  = orders.filter(o=>o.status==="submitted").reduce((s,o)=>s+(o.amount??0),0);
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Change Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{orders.length} total · {fmtMoney(totalApproved)} approved · {fmtMoney(totalPending)} pending</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />New CO
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Approved",  value:fmtMoney(totalApproved), color:"#16a34a", bg:"#dcfce7", icon:CheckCircle },
          { label:"Pending",   value:fmtMoney(totalPending),  color:"#d97706", bg:"#fef3c7", icon:Clock },
          { label:"Total COs", value:orders.length,           color:"#2563eb", bg:"#dbeafe", icon:DollarSign },
        ].map(s => { const Icon = s.icon; return (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:s.bg }}><Icon size={13} style={{ color:s.color }} /></div>
              <span className="text-xs font-medium text-gray-500">{s.label}</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
          </div>
        )})}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">New Change Order</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project *</label>
                <select required value={form.project_id} onChange={e=>set("project_id",e.target.value)} className={inp}>
                  <option value="">Select…</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Amount ($)</label>
                <input type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} className={inp} placeholder="0" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input required value={form.title} onChange={e=>set("title",e.target.value)} className={inp} placeholder="e.g. Add waterproofing to basement walls" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for change</label>
              <input value={form.reason} onChange={e=>set("reason",e.target.value)} className={inp} placeholder="e.g. Owner request, unforeseen condition…" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Waiting On (who needs to approve)</label>
              <select value={form.waiting_on} onChange={e=>set("waiting_on",e.target.value)} className={inp}>
                {WAITING_ON_OPTIONS.map(o => <option key={o} value={o}>{WAITING_ON_META[o].label}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={2} className={inp+" resize-none"} placeholder="Scope of work for this change…" /></div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>{loading?"Saving…":"Submit CO"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {["all","submitted","approved","rejected","draft"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter===f?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
          {filter==="all" ? "No change orders yet — create your first one" : `No ${filter} change orders`}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {filtered.map((co,i) => {
            const s = STATUS_META[co.status] ?? STATUS_META.draft;
            return (
              <div key={co.id} className={`p-5 ${i<filtered.length-1?"border-b border-gray-100":""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-gray-400">{co.number}</span>
                      <span className="font-semibold text-gray-900">{co.title}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:s.bg, color:s.color }}>{s.label}</span>
                      {co.waiting_on && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: WAITING_ON_META[co.waiting_on as keyof typeof WAITING_ON_META]?.bg, color: WAITING_ON_META[co.waiting_on as keyof typeof WAITING_ON_META]?.color }}>
                          ⏳ {WAITING_ON_META[co.waiting_on as keyof typeof WAITING_ON_META]?.label ?? co.waiting_on}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{co.projects?.name} · {co.profiles?.full_name} · {new Date(co.created_at).toLocaleDateString()}</div>
                    {co.reason && <div className="text-sm text-gray-600 mt-1">{co.reason}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black" style={{ color: co.amount>0?"#16a34a":"#6b7280" }}>{fmtMoney(co.amount)}</div>
                    {co.status==="submitted" && (
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={()=>updateStatus(co.id,"approved")} className="px-2.5 py-1 rounded-lg bg-green-50 text-green-600 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-all">Approve</button>
                        <button onClick={()=>updateStatus(co.id,"rejected")} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-all">Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
