"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Download, TrendingUp, DollarSign, ShieldAlert, Clock } from "lucide-react";

const COLORS = ["#f97316","#2563eb","#16a34a","#7c3aed","#dc2626","#d97706"];

export default function ReportsPage() {
  const [tab, setTab]           = useState("budget");
  const [projects, setProjects] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    const s = createClient();
    Promise.all([
      s.from("projects").select("*"),
      s.from("safety_incidents").select("*").order("created_at"),
      s.from("time_logs").select("*, profiles(full_name), projects(name)").order("clock_in",{ascending:false}).limit(200),
      s.from("invoices").select("*, projects(name)").order("created_at",{ascending:false}),
    ]).then(([{data:p},{data:inc},{data:tl},{data:inv}])=>{
      setProjects(p??[]); setIncidents(inc??[]); setTimeLogs(tl??[]); setInvoices(inv??[]);
    });
  },[]);

  const budgetData = projects.map(p=>({ name:p.name.split(" ")[0], Budget:Math.round((p.budget??0)/1000), Spent:Math.round((p.spent??0)/1000) }));
  const safetyBySeverity = ["Low","Medium","High","Critical"].map(s=>({ name:s, value:incidents.filter(i=>i.severity===s).length })).filter(d=>d.value>0);
  const totalBudget = projects.reduce((s,p)=>s+(p.budget??0),0);
  const totalSpent  = projects.reduce((s,p)=>s+(p.spent??0),0);
  const totalHours  = timeLogs.reduce((s,l)=>s+(l.hours??0),0);
  const openIncidents = incidents.filter(i=>i.status==="Open").length;
  const fmt = (n:number) => n>=1000000?`$${(n/1000000).toFixed(1)}M`:n>=1000?`$${(n/1000).toFixed(0)}K`:`$${n.toLocaleString()}`;

  const exportCSV = (data:any[], filename:string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv  = [keys.join(","), ...data.map(r=>keys.map(k=>JSON.stringify(r[k]??"",-1)).join(","))].join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download = filename+".csv"; a.click();
  };

  const TABS = [
    { id:"budget",   label:"Budget",  icon:DollarSign },
    { id:"safety",   label:"Safety",  icon:ShieldAlert },
    { id:"labor",    label:"Labor",   icon:Clock },
    { id:"invoices", label:"Invoices",icon:TrendingUp },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Performance insights across all projects</p></div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Total Budget",    value:fmt(totalBudget),     color:"#2563eb", bg:"#dbeafe" },
          { label:"Total Spent",     value:fmt(totalSpent),      color:"#f97316", bg:"#fff7ed" },
          { label:"Open Incidents",  value:openIncidents,        color:"#dc2626", bg:"#fee2e2" },
          { label:"Total Hours",     value:totalHours.toFixed(1), color:"#16a34a",bg:"#dcfce7" },
        ].map(s=>(
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className="text-xl font-bold" style={{ color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(t=>{ const Icon=t.icon; return (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${tab===t.id?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            <Icon size={12} />{t.label}
          </button>
        );})}
      </div>

      {tab==="budget" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-900">Budget vs Spent by Project ($K)</div>
              <button onClick={()=>exportCSV(budgetData,"budget-report")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"><Download size={12} />Export CSV</button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetData} barGap={3} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{fill:"#9ca3af",fontSize:11}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:"#9ca3af",fontSize:11}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12}} formatter={(v:any,n:string)=>[`$${v}K`,n]} />
                <Bar dataKey="Budget" fill="#bfdbfe" radius={[3,3,0,0]} />
                <Bar dataKey="Spent"  fill="#f97316" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                {["Project","Budget","Spent","Remaining","% Used","Status"].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody>{projects.map((p,i)=>{
                const pct=p.budget>0?Math.round((p.spent??0)/p.budget*100):0;
                return <tr key={p.id} className={`${i<projects.length-1?"border-b border-gray-100":""} hover:bg-gray-50`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{fmt(p.budget??0)}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{fmt(p.spent??0)}</td>
                  <td className="px-4 py-3 font-mono text-green-600">{fmt((p.budget??0)-(p.spent??0))}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width:`${Math.min(pct,100)}%`, background:pct>90?"#dc2626":pct>75?"#d97706":"#16a34a" }} /></div><span className="text-xs font-bold" style={{ color:pct>90?"#dc2626":pct>75?"#d97706":"#16a34a" }}>{pct}%</span></div></td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status==="active"?"bg-green-50 text-green-600":"bg-gray-100 text-gray-500"}`}>{p.status}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="safety" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="font-semibold text-gray-900 mb-4">Incidents by Severity</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart><Pie data={safetyBySeverity} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name,value})=>`${name}: ${value}`}>
                  {safetyBySeverity.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="font-semibold text-gray-900 mb-4">Safety Summary</div>
              {[
                { label:"Total Incidents",      value:incidents.length },
                { label:"Open",                 value:incidents.filter(i=>i.status==="Open").length,     color:"#dc2626" },
                { label:"High / Critical",      value:incidents.filter(i=>["High","Critical"].includes(i.severity)).length, color:"#f97316" },
                { label:"Closed",               value:incidents.filter(i=>i.status==="Closed").length,   color:"#16a34a" },
              ].map(s=>(
                <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{s.label}</span>
                  <span className="font-bold text-lg" style={{ color:s.color||"#374151" }}>{s.value}</span>
                </div>
              ))}
              <button onClick={()=>exportCSV(incidents,"safety-report")} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 w-full justify-center"><Download size={12} />Export Safety Report CSV</button>
            </div>
          </div>
        </div>
      )}

      {tab==="labor" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Time Entries — Recent 200</span>
            <button onClick={()=>exportCSV(timeLogs,"labor-report")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"><Download size={12} />Export CSV</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {["Worker","Project","Date","Hours","OT"].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>{timeLogs.slice(0,50).map((l,i)=>(
              <tr key={l.id} className={`${i<49?"border-b border-gray-100":""} hover:bg-gray-50`}>
                <td className="px-4 py-2.5 font-medium text-gray-900">{l.profiles?.full_name??"-"}</td>
                <td className="px-4 py-2.5 text-gray-600">{l.projects?.name??"-"}</td>
                <td className="px-4 py-2.5 text-gray-600">{new Date(l.clock_in).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 font-mono font-bold" style={{ color:(l.hours??0)>9?"#d97706":"#374151" }}>{(l.hours??0).toFixed(2)}</td>
                <td className="px-4 py-2.5 font-mono text-orange-600">{(l.hours??0)>8?`${((l.hours??0)-8).toFixed(1)}h`:"-"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab==="invoices" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Invoice Report</span>
            <button onClick={()=>exportCSV(invoices,"invoice-report")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"><Download size={12} />Export CSV</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {["Vendor","Project","Amount","Due Date","Status"].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>{invoices.map((inv,i)=>(
              <tr key={inv.id} className={`${i<invoices.length-1?"border-b border-gray-100":""} hover:bg-gray-50`}>
                <td className="px-4 py-2.5 font-medium text-gray-900">{inv.vendor}</td>
                <td className="px-4 py-2.5 text-gray-600">{inv.projects?.name??"-"}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-gray-900">${(inv.amount??0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-gray-600">{inv.due_date??"-"}</td>
                <td className="px-4 py-2.5"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${{paid:"bg-green-50 text-green-600",approved:"bg-blue-50 text-blue-600",overdue:"bg-red-50 text-red-600",pending:"bg-yellow-50 text-yellow-600"}[inv.status]||"bg-gray-100 text-gray-500"}`}>{inv.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
