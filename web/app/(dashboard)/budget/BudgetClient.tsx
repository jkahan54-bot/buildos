"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CATEGORIES = ["Structural","Foundation","MEP","Framing","Finishes","Equipment","Labor","Other"];
const UNITS = ["SF","LF","CY","ea","ton","SQ","RMS","LS"];
const fmt = (n: number) => "$" + (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function BudgetClient({ projects, items, invoices }: any) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview"|"items"|"invoices">("overview");
  const [showForm, setShowForm] = useState(false);
  const [showInvForm, setShowInvForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ project_id:"", category:"Structural", description:"", quantity:"1", unit:"ea", unit_cost:"0", labor_cost:"0" });
  const [invForm, setInvForm] = useState({ project_id:"", vendor:"", amount:"", due_date:"", notes:"" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setI = (k: string, v: string) => setInvForm(f => ({ ...f, [k]: v }));

  const totalBudget = projects.reduce((s: number, p: any) => s + (p.budget ?? 0), 0);
  const totalSpent  = projects.reduce((s: number, p: any) => s + (p.spent ?? 0), 0);
  const totalInvoiced = invoices.filter((i: any) => i.status !== "paid").reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const overdue = invoices.filter((i: any) => i.status === "overdue").length;

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("budget_items").insert({ ...form, org_id: prof?.org_id, quantity: parseFloat(form.quantity), unit_cost: parseFloat(form.unit_cost), labor_cost: parseFloat(form.labor_cost) });
    setLoading(false); setShowForm(false); setForm({ project_id:"", category:"Structural", description:"", quantity:"1", unit:"ea", unit_cost:"0", labor_cost:"0" });
    router.refresh();
  };

  const saveInvoice = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("invoices").insert({ ...invForm, org_id: prof?.org_id, amount: parseFloat(invForm.amount), due_date: invForm.due_date || null });
    setLoading(false); setShowInvForm(false); setInvForm({ project_id:"", vendor:"", amount:"", due_date:"", notes:"" });
    router.refresh();
  };

  const updateInvoiceStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from("invoices").update({ status }).eq("id", id);
    router.refresh();
  };

  const inp = "w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand";
  const statusColors: Record<string, string> = { pending:"#F59E0B", approved:"#22C55E", paid:"#6B7280", overdue:"#EF4444" };

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Budget Management</h1>
          <p className="text-gray-500 text-sm mt-1">Cost tracking, line items & invoices</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowInvForm(!showInvForm); setShowForm(false); }} className="border border-border text-gray-300 font-bold px-4 py-2 rounded-lg text-sm hover:border-gray-400 transition-colors">+ Invoice</button>
          <button onClick={() => { setShowForm(!showForm); setShowInvForm(false); }} className="bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">+ Line Item</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Total Budget",    value: fmt(totalBudget),   color:"#3B82F6" },
          { label:"Total Spent",     value: fmt(totalSpent),    color:"#F46519" },
          { label:"Remaining",       value: fmt(totalBudget - totalSpent), color: totalBudget - totalSpent < 0 ? "#EF4444" : "#22C55E" },
          { label:"Outstanding Inv", value: fmt(totalInvoiced), color: overdue > 0 ? "#EF4444" : "#F59E0B" },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add line item form */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-brand/50 p-6">
          <h2 className="font-bold text-lg mb-4">New Budget Line Item</h2>
          <form onSubmit={saveItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Project</label>
                <select value={form.project_id} onChange={e => set("project_id", e.target.value)} required className={inp}>
                  <option value="">Select...</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                <select value={form.category} onChange={e => set("category", e.target.value)} className={inp}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
              <input value={form.description} onChange={e => set("description", e.target.value)} required className={inp} placeholder="e.g. Concrete Foundation – 180 CY" />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Qty</label>
                <input type="number" value={form.quantity} onChange={e => set("quantity", e.target.value)} className={inp} />
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Unit</label>
                <select value={form.unit} onChange={e => set("unit", e.target.value)} className={inp}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Material $/Unit</label>
                <input type="number" value={form.unit_cost} onChange={e => set("unit_cost", e.target.value)} className={inp} />
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Labor $/Unit</label>
                <input type="number" value={form.labor_cost} onChange={e => set("labor_cost", e.target.value)} className={inp} />
              </div>
            </div>
            <div className="bg-surface-card rounded-lg p-3 border border-border text-sm text-gray-400">
              Total: <span className="text-green-400 font-bold font-mono">${((parseFloat(form.quantity)||0) * ((parseFloat(form.unit_cost)||0) + (parseFloat(form.labor_cost)||0))).toLocaleString(undefined,{maximumFractionDigits:0})}</span>
            </div>
            <div className="flex gap-3"><button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border text-gray-400 font-bold py-2.5 rounded-lg">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-brand text-white font-bold py-2.5 rounded-lg disabled:opacity-50">{loading ? "Saving…" : "Save Line Item"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Add invoice form */}
      {showInvForm && (
        <div className="bg-surface rounded-xl border border-yellow-500/50 p-6">
          <h2 className="font-bold text-lg mb-4">New Invoice</h2>
          <form onSubmit={saveInvoice} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Project</label>
                <select value={invForm.project_id} onChange={e => setI("project_id", e.target.value)} required className={inp}>
                  <option value="">Select...</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Vendor</label>
                <input value={invForm.vendor} onChange={e => setI("vendor", e.target.value)} required className={inp} placeholder="Steel Supply Co." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Amount ($)</label>
                <input type="number" value={invForm.amount} onChange={e => setI("amount", e.target.value)} required className={inp} />
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Due Date</label>
                <input type="date" value={invForm.due_date} onChange={e => setI("due_date", e.target.value)} className={inp} />
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
              <input value={invForm.notes} onChange={e => setI("notes", e.target.value)} className={inp} placeholder="Optional notes" />
            </div>
            <div className="flex gap-3"><button type="button" onClick={() => setShowInvForm(false)} className="flex-1 border border-border text-gray-400 font-bold py-2.5 rounded-lg">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-yellow-500 text-black font-bold py-2.5 rounded-lg disabled:opacity-50">{loading ? "Saving…" : "Save Invoice"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl border border-border p-1 w-fit">
        {(["overview","items","invoices"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${tab===t ? "bg-brand text-white" : "text-gray-500 hover:text-gray-900"}`}>
            {t}{t === "items" ? ` (${items.length})` : t === "invoices" ? ` (${invoices.length})` : ""}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="font-bold text-sm mb-4">Budget vs Spent by Project</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projects.map((p: any) => ({ name: p.name.split(" ")[0], budget: Math.round((p.budget??0)/1000), spent: Math.round((p.spent??0)/1000) }))} barGap={4}>
                <XAxis dataKey="name" tick={{ fill:"#6B7280", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#6B7280", fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:"#f9fafb", border:"1px solid #222226", borderRadius:6, color:"#111827", fontSize:12 }} formatter={(v: any) => `$${v}K`} />
                <Bar dataKey="budget" fill="#3B82F6" radius={[4,4,0,0]} name="Budget ($K)" />
                <Bar dataKey="spent" fill="#F46519" radius={[4,4,0,0]} name="Spent ($K)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {projects.map((p: any) => {
            const pct = p.budget > 0 ? Math.round((p.spent??0)/p.budget*100) : 0;
            const col = pct > 90 ? "#EF4444" : pct > 75 ? "#F59E0B" : "#22C55E";
            return (
              <div key={p.id} className="bg-surface rounded-xl border border-border p-5">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-bold">{p.name}</div>
                  <div className="flex gap-4 text-sm font-mono">
                    <span className="text-gray-500">Budget: <b className="text-white">{fmt(p.budget)}</b></span>
                    <span className="text-gray-500">Spent: <b style={{ color: col }}>{fmt(p.spent)}</b></span>
                    <span className="text-gray-500">Left: <b className="text-green-400">{fmt((p.budget??0)-(p.spent??0))}</b></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(pct,100)}%`, background: col }} />
                  </div>
                  <span className="font-bold font-mono text-sm" style={{ color: col }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Line items */}
      {tab === "items" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border">
              {["Project","Category","Description","Qty","Unit","Material","Labor","Total"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {!items.length ? (
                <tr><td colSpan={8} className="text-center text-gray-500 py-12">No line items yet — click "+ Line Item" to add one</td></tr>
              ) : items.map((item: any) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-surface-card transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[120px]">{item.projects?.name?.split(" ")[0]}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded bg-border text-gray-300">{item.category}</span></td>
                  <td className="px-4 py-3 text-sm font-semibold">{item.description}</td>
                  <td className="px-4 py-3 text-sm font-mono text-brand">{item.quantity}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3 text-sm font-mono">{fmt(item.unit_cost)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-purple-400">{fmt(item.labor_cost)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-green-400">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
            {items.length > 0 && (
              <tfoot><tr className="border-t-2 border-border">
                <td colSpan={7} className="px-4 py-3 font-bold text-right">TOTAL</td>
                <td className="px-4 py-3 text-lg font-black font-mono text-green-400">
                  {fmt(items.reduce((s: number, i: any) => s + (i.total ?? 0), 0))}
                </td>
              </tr></tfoot>
            )}
          </table>
        </div>
      )}

      {/* Invoices */}
      {tab === "invoices" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border">
              {["Project","Vendor","Amount","Due Date","Status","Action"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {!invoices.length ? (
                <tr><td colSpan={6} className="text-center text-gray-500 py-12">No invoices yet</td></tr>
              ) : invoices.map((inv: any) => (
                <tr key={inv.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-sm text-gray-400">{inv.projects?.name?.split(" ")[0]}</td>
                  <td className="px-4 py-3 font-semibold">{inv.vendor}</td>
                  <td className="px-4 py-3 font-mono font-bold text-white">{fmt(inv.amount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{inv.due_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:(statusColors[inv.status]??"#6B7280")+"22", color:statusColors[inv.status]??"#6B7280" }}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={inv.status} onChange={e => updateInvoiceStatus(inv.id, e.target.value)}
                      className="bg-surface-panel border border-border rounded px-2 py-1 text-xs text-gray-900 outline-none">
                      {["pending","approved","paid","overdue"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
