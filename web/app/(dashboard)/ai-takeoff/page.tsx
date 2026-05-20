"use client";
import { useState, useRef } from "react";
import { Upload, RefreshCw, FileText, DollarSign, Calculator } from "lucide-react";

const MARKUP_DEFAULT = 15;

export default function AITakeoffPage() {
  const [image, setImage]       = useState<string|null>(null);
  const [file, setFile]         = useState<File|null>(null);
  const [project, setProject]   = useState("");
  const [markup, setMarkup]     = useState(MARKUP_DEFAULT);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [error, setError]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f); setResult(null); setError("");
    const r = new FileReader(); r.onload = e => setImage(e.target?.result as string); r.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true); setResult(null); setError("");
    const form = new FormData();
    form.append("image", file);
    form.append("project", project || "Project");
    try {
      const res  = await fetch("/api/ai/takeoff", { method:"POST", body:form });
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data.result);
    } catch (e: any) { setError(e.message); }
    setAnalyzing(false);
  };

  const subtotal   = result?.items?.reduce((s:number,i:any)=>s+(i.quantity*(i.unitCost+i.laborCost)),0) ?? 0;
  const markupAmt  = subtotal * markup / 100;
  const total      = subtotal + markupAmt;
  const fmt        = (n:number) => "$"+n.toLocaleString(undefined,{maximumFractionDigits:0});
  const CAT_COLORS: Record<string,string> = { Concrete:"#2563eb",Steel:"#6b7280",Framing:"#d97706",MEP:"#7c3aed",Finishes:"#16a34a",Roofing:"#dc2626",Sitework:"#0891b2",Other:"#9ca3af" };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">AI Takeoff</h1>
        <p className="text-gray-500 text-sm mt-0.5">Upload any blueprint or plan — Claude reads it and generates a full quantity takeoff with costs</p>
      </div>

      {/* Upload panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project name</label>
            <input value={project} onChange={e=>setProject(e.target.value)} placeholder="e.g. 123-125 Ditmas"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Markup %</label>
            <input type="number" value={markup} onChange={e=>setMarkup(+e.target.value)} min={0} max={100}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm" /></div>
        </div>
        <div
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
          onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-all">
          {image ? (
            <img src={image} alt="plan" className="max-h-48 mx-auto rounded-lg object-contain" />
          ) : (
            <>
              <FileText size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Drop a blueprint, floor plan, or site plan</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG — any plan or drawing</p>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])} className="hidden" />
        </div>
        <div className="flex gap-3">
          {image && <button onClick={()=>{setImage(null);setFile(null);setResult(null);}} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 bg-white"><RefreshCw size={14} className="inline mr-1.5" />Clear</button>}
          <button onClick={analyze} disabled={!file||analyzing}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
            {analyzing?<><RefreshCw size={14} className="animate-spin" />Reading plan…</>:<><Calculator size={14} />Generate Takeoff</>}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label:"Project Type",  value:result.projectType??"-",      color:"#2563eb" },
              { label:"Est. Area",     value:result.estimatedArea??"-",    color:"#f97316" },
              { label:"Line Items",    value:result.items?.length??0,      color:"#7c3aed" },
              { label:"Confidence",    value:result.confidence??"-",       color:result.confidence==="High"?"#16a34a":result.confidence==="Medium"?"#d97706":"#dc2626" },
            ].map(s=>(
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                <div className="font-bold text-gray-900" style={{ color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {result.planNotes && <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">{result.planNotes}</div>}

          {/* Takeoff table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm text-gray-900">Quantity Takeoff — {project||"Project"}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  {["Category","Description","Qty","Unit","Material","Labor","Total","Notes"].map(h=>(
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.items?.map((item:any,i:number)=>{
                    const lineTotal = item.quantity*(item.unitCost+item.laborCost);
                    const catColor  = CAT_COLORS[item.category]??"#9ca3af";
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:catColor+"15",color:catColor }}>{item.category}</span></td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">{item.description}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-orange-600">{item.quantity?.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-700">${item.unitCost?.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-700">${item.laborCost?.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-green-600">{fmt(lineTotal)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">{item.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr><td colSpan={6} className="px-3 py-3 text-right font-bold text-gray-700">Subtotal</td>
                    <td className="px-3 py-3 font-bold font-mono text-gray-900">{fmt(subtotal)}</td><td /></tr>
                  <tr><td colSpan={6} className="px-3 py-1 text-right text-sm text-gray-500">Markup ({markup}%)</td>
                    <td className="px-3 py-1 font-mono text-gray-600">{fmt(markupAmt)}</td><td /></tr>
                  <tr><td colSpan={6} className="px-3 py-3 text-right font-black text-gray-900 text-base">TOTAL</td>
                    <td className="px-3 py-3 font-black font-mono text-xl text-green-600">{fmt(total)}</td><td /></tr>
                </tfoot>
              </table>
            </div>
          </div>
          {result.assumptions?.length>0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-semibold text-amber-800 text-sm mb-2">Assumptions</div>
              {result.assumptions.map((a:string,i:number)=><div key={i} className="text-sm text-amber-700">• {a}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
