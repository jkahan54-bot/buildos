"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, FileText, Send, CheckCircle, XCircle, Sparkles, X, Trash2 } from "lucide-react";

const STATUS_META: Record<string,{color:string;bg:string;label:string}> = {
  draft:    { color:"#6b7280", bg:"#f3f4f6", label:"Draft"    },
  sent:     { color:"#2563eb", bg:"#dbeafe", label:"Sent"     },
  accepted: { color:"#16a34a", bg:"#dcfce7", label:"Accepted" },
  declined: { color:"#dc2626", bg:"#fee2e2", label:"Declined" },
};
const UNITS = ["SF","LF","CY","EA","TON","LS","HR"];
const CATS  = ["Structural","Foundation","MEP","Framing","Finishes","Roofing","Sitework","Other"];

export default function QuotesPage() {
  const [quotes, setQuotes]   = useState<any[]>([]);
  const [view, setView]       = useState<"list"|"edit">("list");
  const [current, setCurrent] = useState<any>(null);
  const [genLoading, setGen]  = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => { const {data} = await createClient().from("quotes").select("*, projects(name)").order("created_at",{ascending:false}); setQuotes(data??[]); };

  const newQuote = () => {
    setCurrent({ client:"", title:"New Quote", markup_pct:15, status:"draft", line_items:[{ desc:"", qty:1, unit:"EA", unitCost:0, labor:0, category:"Other" }] });
    setView("edit");
  };

  const openQuote = (q:any) => { setCurrent({...q, line_items: Array.isArray(q.line_items)?q.line_items:JSON.parse(q.line_items||"[]")}); setView("edit"); };

  const addLine = () => setCurrent((c:any)=>({...c, line_items:[...c.line_items,{ desc:"",qty:1,unit:"EA",unitCost:0,labor:0,category:"Other" }]}));
  const removeLine = (i:number) => setCurrent((c:any)=>({...c, line_items:c.line_items.filter((_:any,j:number)=>j!==i)}));
  const setLine = (i:number,k:string,v:any) => setCurrent((c:any)=>({...c, line_items:c.line_items.map((l:any,j:number)=>j===i?{...l,[k]:v}:l)}));

  const subtotal = (c:any) => (c?.line_items??[]).reduce((s:number,l:any)=>s+(+l.qty*(+l.unitCost+(+(l.labor??0)))),0);
  const total    = (c:any) => { const sub=subtotal(c); return sub*(1+(+c?.markup_pct||0)/100); };
  const fmt      = (n:number) => "$"+n.toLocaleString(undefined,{maximumFractionDigits:0});

  const save = async () => {
    const supabase = createClient();
    const { data:{user} } = await supabase.auth.getUser();
    const { data:prof } = await supabase.from("profiles").select("org_id").eq("id",user!.id).single();
    const sub = subtotal(current); const tot = total(current);
    const payload = { ...current, org_id:prof?.org_id, subtotal:sub, total:tot };
    if (current.id) { await supabase.from("quotes").update(payload).eq("id",current.id); }
    else { await supabase.from("quotes").insert(payload); }
    await load(); setView("list");
  };

  const generateCoverLetter = async () => {
    if (!current) return; setGen(true);
    try {
      const res = await fetch("/api/ai/chat", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ messages:[{ role:"user", content:`Write a professional construction quote cover letter. Client: ${current.client}, Title: ${current.title||"Construction Quote"}, Total: ${fmt(total(current))}, Scope: ${(current.line_items||[]).map((l:any)=>l.desc).filter(Boolean).join(", ")}, Markup: ${current.markup_pct}%. 3 short paragraphs, professional tone, no markdown.` }] })});
      const {reply} = await res.json();
      setCurrent((c:any)=>({...c,cover_letter:reply}));
    } catch {}
    setGen(false);
  };

  const inp = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm";

  if (view==="edit" && current) return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={()=>setView("list")} className="text-sm text-orange-500 hover:text-orange-600 mb-1">← Back to quotes</button>
          <h1 className="text-xl font-bold text-gray-900">{current.id?"Edit Quote":"New Quote"}</h1>
        </div>
        <button onClick={save} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>Save Quote</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1.5">Client / Project name *</label>
            <input value={current.client} onChange={e=>setCurrent((c:any)=>({...c,client:e.target.value}))} className={inp} placeholder="Brookstone Developers" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Markup %</label>
            <input type="number" value={current.markup_pct} onChange={e=>setCurrent((c:any)=>({...c,markup_pct:+e.target.value}))} className={inp} /></div>
        </div>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-0 bg-gray-50 px-3 py-2 border-b border-gray-200">
            {["Description","Cat","Qty","Unit","Material $","Labor $","Total",""].map((h,i)=>(
              <div key={i} className={`text-xs font-semibold text-gray-500 uppercase ${i===0?"col-span-3":i===7?"col-span-1":"col-span-1"}`}>{h}</div>
            ))}
          </div>
          {(current.line_items||[]).map((line:any,i:number)=>(
            <div key={i} className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-gray-100 items-center">
              <input value={line.desc} onChange={e=>setLine(i,"desc",e.target.value)} placeholder="Item description" className="col-span-3 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-orange-400" />
              <select value={line.category} onChange={e=>setLine(i,"category",e.target.value)} className="col-span-1 bg-white border border-gray-200 rounded px-1 py-1.5 text-xs outline-none">
                {CATS.map(c=><option key={c}>{c}</option>)}</select>
              <input type="number" value={line.qty} onChange={e=>setLine(i,"qty",+e.target.value)} className="col-span-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm outline-none text-center" />
              <select value={line.unit} onChange={e=>setLine(i,"unit",e.target.value)} className="col-span-1 bg-white border border-gray-200 rounded px-1 py-1.5 text-xs outline-none">
                {UNITS.map(u=><option key={u}>{u}</option>)}</select>
              <input type="number" value={line.unitCost} onChange={e=>setLine(i,"unitCost",+e.target.value)} className="col-span-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm outline-none" />
              <input type="number" value={line.labor||0} onChange={e=>setLine(i,"labor",+e.target.value)} className="col-span-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm outline-none" />
              <div className="col-span-2 text-sm font-bold text-green-600 font-mono">{fmt(line.qty*(line.unitCost+(line.labor||0)))}</div>
              <button onClick={()=>removeLine(i)} className="col-span-1 text-gray-300 hover:text-red-400 transition-colors flex justify-end"><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="px-3 py-2 flex items-center justify-between bg-gray-50 border-t-2 border-gray-200">
            <button onClick={addLine} className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"><Plus size={13} />Add line</button>
            <div className="text-right space-y-0.5">
              <div className="text-sm text-gray-500">Subtotal: <span className="font-bold text-gray-800">{fmt(subtotal(current))}</span></div>
              <div className="text-sm text-gray-500">Markup ({current.markup_pct}%): <span className="font-bold text-gray-800">{fmt(subtotal(current)*current.markup_pct/100)}</span></div>
              <div className="text-base font-black text-green-600">TOTAL: {fmt(total(current))}</div>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Cover Letter</label>
            <button onClick={generateCoverLetter} disabled={genLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 disabled:opacity-50">
              <Sparkles size={11} />{genLoading?"Generating…":"Generate with AI"}
            </button>
          </div>
          <textarea value={current.cover_letter||""} onChange={e=>setCurrent((c:any)=>({...c,cover_letter:e.target.value}))} rows={6}
            className={inp+" resize-none"} placeholder="AI will generate this, or type your own cover letter…" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Quote Builder</h1>
          <p className="text-gray-500 text-sm mt-0.5">{quotes.length} quotes · AI writes the cover letter</p></div>
        <button onClick={newQuote} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />New Quote</button>
      </div>
      {quotes.length===0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400 text-sm">No quotes yet</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {quotes.map((q,i)=>{
            const s=STATUS_META[q.status]??STATUS_META.draft;
            return (
              <div key={q.id} onClick={()=>openQuote(q)} className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-all ${i<quotes.length-1?"border-b border-gray-100":""}`}>
                <FileText size={18} className="text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{q.title||"Quote"} — {q.client}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{q.projects?.name} · {new Date(q.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-green-600">${(q.total??0).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background:s.bg, color:s.color }}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
