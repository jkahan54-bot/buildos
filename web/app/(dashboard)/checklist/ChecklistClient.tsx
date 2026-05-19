"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { CheckSquare, ChevronRight, ArrowLeft } from "lucide-react";

export default function ChecklistClient({ projects, checklists }: any) {
  const router = useRouter();
  const [selProj, setSelProj] = useState<any>(null);
  const [selList, setSelList] = useState<any>(null);
  const [items, setItems]     = useState<any[]>([]);
  const [search, setSearch]   = useState("");

  const loadItems = async (checklistId: string) => {
    const { data } = await createClient().from("medical_checklist_items")
      .select("*, profiles(full_name)").eq("checklist_id", checklistId).order("category, product_name");
    setItems(data ?? []);
  };

  const toggle = async (item: any) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const newVal = !item.checked;
    await supabase.from("medical_checklist_items").update({
      checked: newVal, checked_by: newVal ? user!.id : null, checked_at: newVal ? new Date().toISOString() : null,
    }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newVal } : i));
  };

  const toggleMod = async (item: any) => {
    await createClient().from("medical_checklist_items").update({ modified: !item.modified }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, modified: !i.modified } : i));
  };

  const projChecklists = checklists.filter((c: any) => c.project_id === selProj?.id);
  const filtered = items.filter(i => !search || i.product_name?.toLowerCase().includes(search.toLowerCase()) || i.category?.toLowerCase().includes(search.toLowerCase()));
  const categories = [...new Set(filtered.map((i: any) => i.category ?? "General"))];
  const checkedCount = items.filter(i => i.checked).length;
  const pct = items.length > 0 ? Math.round(checkedCount / items.length * 100) : 0;

  if (!selProj) return (
    <div className="space-y-5">
      <div><h1 className="text-xl lg:text-2xl font-bold text-gray-900">Medical Checklists</h1>
        <p className="text-gray-500 text-sm mt-0.5">Select a project to view its checklists</p></div>
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <CheckSquare size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No projects yet</p>
          <Link href="/projects/new" className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>Create Project</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {projects.map((p: any, i: number) => {
            const projLists = checklists.filter((c: any) => c.project_id === p.id);
            const total = projLists.reduce((s: number, c: any) => s + (c.medical_checklist_items?.length ?? 0), 0);
            const done  = projLists.reduce((s: number, c: any) => s + (c.medical_checklist_items?.filter((x: any) => x.checked).length ?? 0), 0);
            return (
              <button key={p.id} onClick={() => setSelProj(p)}
                className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 text-left transition-all ${i < projects.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{projLists.length} checklist{projLists.length !== 1 ? "s" : ""}{total > 0 ? ` · ${done}/${total} items` : ""}</div>
                  {total > 0 && <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-32"><div className="h-full bg-orange-400 rounded-full" style={{ width:`${Math.round(done/total*100)}%` }} /></div>}
                </div>
                {p.type === "medical_facility" && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-50 text-purple-600">🏥 Medical</span>}
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!selList) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelProj(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><ArrowLeft size={16} /></button>
        <div><h1 className="text-xl font-bold text-gray-900">{selProj.name}</h1>
          <p className="text-gray-500 text-sm">Select a room checklist</p></div>
        <Link href={`/projects/${selProj.id}/import-checklist`} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>📊 Import Excel</Link>
      </div>
      {projChecklists.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500 font-medium">No checklists imported yet</p>
          <Link href={`/projects/${selProj.id}/import-checklist`} className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>Import from Excel</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {projChecklists.map((cl: any, i: number) => {
            const t = cl.medical_checklist_items?.length ?? 0;
            const d = cl.medical_checklist_items?.filter((x: any) => x.checked).length ?? 0;
            return (
              <button key={cl.id} onClick={() => { setSelList(cl); loadItems(cl.id); }}
                className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 text-left transition-all ${i < projChecklists.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900">{cl.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{d}/{t} installed</div>
                  {t > 0 && <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-24"><div className="h-full bg-green-500 rounded-full" style={{ width:`${Math.round(d/t*100)}%` }} /></div>}
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => { setSelList(null); setItems([]); setSearch(""); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><ArrowLeft size={16} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{selList.name}</h1>
          <p className="text-gray-500 text-sm">{selProj.name}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex justify-between text-sm mb-2"><span className="font-medium text-gray-700">{checkedCount} / {items.length} installed</span><span className="font-bold" style={{ color: pct === 100 ? "#16a34a" : "#f97316" }}>{pct}%</span></div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: pct === 100 ? "#16a34a" : "#f97316" }} /></div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm" />
      <div className="space-y-4">
        {categories.map(cat => (
          <div key={cat}>
            <div className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 px-1">{cat}</div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {filtered.filter((i: any) => (i.category ?? "General") === cat).map((item: any, idx: number, arr: any[]) => (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-3.5 ${idx < arr.length - 1 ? "border-b border-gray-100" : ""} ${item.checked ? "bg-gray-50" : ""}`}>
                  <button onClick={() => toggle(item)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.checked ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-orange-400"}`}>
                    {item.checked && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${item.checked ? "text-gray-400 line-through" : "text-gray-900"} truncate`}>{item.product_name}</div>
                    {item.product_code && <div className="text-xs text-gray-400">#{item.product_code}</div>}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">Qty: {item.quantity_needed ?? 1}</div>
                  <button onClick={() => toggleMod(item)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex-shrink-0 ${item.modified ? "bg-amber-50 border-amber-300 text-amber-600" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}>
                    MOD
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
