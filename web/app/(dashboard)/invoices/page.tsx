"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, DollarSign, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

const STATUS_META: Record<string,{color:string;bg:string;label:string}> = {
  pending:  { color:"#d97706", bg:"#fef3c7", label:"Pending"  },
  approved: { color:"#2563eb", bg:"#dbeafe", label:"Approved" },
  paid:     { color:"#16a34a", bg:"#dcfce7", label:"Paid"     },
  overdue:  { color:"#dc2626", bg:"#fee2e2", label:"Overdue"  },
};

const fmt = (n: number) => "$" + (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function InvoicesPage() {
  const router  = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]  = useState(false);
  const [filter, setFilter]    = useState("all");
  const [form, setForm] = useState({ project_id:"", vendor:"", amount:"", due_date:"", notes:"", status:"pending" });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  useEffect(() => {
    load();
    createClient().from("projects").select("id,name").then(({data}) => setProjects(data ?? []));
  }, []);

  const load = async () => {
    const { data } = await createClient().from("invoices").select("*, projects(name)").order("created_at", { ascending:false });
    setInvoices(data ?? []);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("invoices").insert({
      ...form, org_id: prof?.org_id,
      amount: parseFloat(form.amount) || 0,
      due_date: form.due_date || null,
    });
    setLoading(false); setShowForm(false);
    setForm({ project_id:"", vendor:"", amount:"", due_date:"", notes:"", status:"pending" });
    await load();
  };

  const updateStatus = async (id: string, status: string) => {
    await createClient().from("invoices").update({ status }).eq("id", id);
    await load();
  };

  const filtered = filter === "all" ? invoices : invoices.filter(i => i.status === filter);

  const totalPending  = invoices.filter(i=>i.status==="pending").reduce((s,i)=>s+(i.amount??0),0);
  const totalOverdue  = invoices.filter(i=>i.status==="overdue").reduce((s,i)=>s+(i.amount??0),0);
  const totalPaid     = invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+(i.amount??0),0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-0.5">{invoices.length} total · {invoices.filter(i=>i.status==="overdue").length} overdue</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Pending",  value:fmt(totalPending), color:"#d97706", bg:"#fef3c7", icon:Clock       },
          { label:"Overdue",  value:fmt(totalOverdue), color:"#dc2626", bg:"#fee2e2", icon:AlertCircle  },
          { label:"Paid",     value:fmt(totalPaid),    color:"#16a34a", bg:"#dcfce7", icon:CheckCircle  },
        ].map(s => { const Icon = s.icon; return (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:s.bg }}>
                <Icon size={13} style={{ color:s.color }} />
              </div>
              <span className="text-xs font-medium text-gray-500">{s.label}</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
          </div>
        );})}
      </div>

      {/* New invoice form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">New Invoice</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
                <select value={form.project_id} onChange={e=>set("project_id",e.target.value)} className={inp}>
                  <option value="">No specific project</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select value={form.status} onChange={e=>set("status",e.target.value)} className={inp}>
                  {["pending","approved","paid","overdue"].map(s=><option key={s} value={s}>{STATUS_META[s]?.label}</option>)}
                </select></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor / Supplier *</label>
              <input required value={form.vendor} onChange={e=>set("vendor",e.target.value)} className={inp} placeholder="e.g. Steel Supply Co." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Amount ($) *</label>
                <input required type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} className={inp} placeholder="0" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                <input type="date" value={form.due_date} onChange={e=>set("due_date",e.target.value)} className={inp} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input value={form.notes} onChange={e=>set("notes",e.target.value)} className={inp} placeholder="Optional notes..." /></div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                {loading ? "Saving…" : "Save Invoice"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {["all","pending","approved","paid","overdue"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter===f?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <DollarSign size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{filter === "all" ? "No invoices yet" : `No ${filter} invoices`}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table header - hidden on mobile */}
          <div className="hidden sm:grid grid-cols-5 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <span className="col-span-2">Vendor</span><span>Amount</span><span>Due Date</span><span>Status</span>
          </div>
          {filtered.map((inv, i) => {
            const s = STATUS_META[inv.status] ?? STATUS_META.pending;
            const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paid";
            return (
              <div key={inv.id} className={`flex flex-col sm:grid sm:grid-cols-5 sm:gap-2 items-start sm:items-center px-5 py-4 gap-2 ${i < filtered.length-1 ? "border-b border-gray-100" : ""} ${isOverdue ? "bg-red-50/30" : "hover:bg-gray-50"} transition-all`}>
                <div className="col-span-2 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{inv.vendor}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{inv.projects?.name ?? "General"}{inv.notes ? ` · ${inv.notes}` : ""}</div>
                </div>
                <div className="font-bold text-gray-900 font-mono">{fmt(inv.amount)}</div>
                <div className={`text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                  {inv.due_date ?? "—"}
                  {isOverdue && " ⚠"}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:s.bg, color:s.color }}>{s.label}</span>
                  {/* Quick status actions */}
                  {inv.status === "pending" && (
                    <button onClick={()=>updateStatus(inv.id,"approved")}
                      className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors">Approve</button>
                  )}
                  {inv.status === "approved" && (
                    <button onClick={()=>updateStatus(inv.id,"paid")}
                      className="text-xs font-semibold text-green-500 hover:text-green-700 transition-colors">Mark Paid</button>
                  )}
                  {(inv.status === "pending" || inv.status === "approved") && (
                    <button onClick={()=>updateStatus(inv.id,"overdue")}
                      className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors">Overdue</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
