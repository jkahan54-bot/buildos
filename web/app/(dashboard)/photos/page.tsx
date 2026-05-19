"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, Upload, Tag } from "lucide-react";

const TAGS = ["Progress","Inspection","Safety","Materials","General"];
const TAG_COLORS: Record<string,string> = { Progress:"#16a34a", Inspection:"#2563eb", Safety:"#dc2626", Materials:"#d97706", General:"#6b7280" };

export default function PhotosPage() {
  const [photos, setPhotos]   = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selProj, setSelProj] = useState("");
  const [selTag, setSelTag]   = useState("Progress");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createClient().from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    const { data } = await createClient().from("site_photos").select("*, projects(name)").order("taken_at", { ascending:false }).limit(50);
    setPhotos(data ?? []);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !selProj) { alert("Select a project first"); return; }
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    for (const file of Array.from(files)) {
      const path = `site-photos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const { error } = await supabase.storage.from("buildos").upload(path, file);
      if (error) { console.error(error); continue; }
      const { data: { publicUrl } } = supabase.storage.from("buildos").getPublicUrl(path);
      await supabase.from("site_photos").insert({
        org_id: prof?.org_id, project_id: selProj, taken_by: user!.id,
        label: `${selTag} — ${new Date().toLocaleDateString()}`,
        tag: selTag, url: publicUrl, storage_path: path,
      });
    }
    setUploading(false); await loadPhotos();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Site Photos</h1>
        <p className="text-gray-500 text-sm mt-0.5">{photos.length} photos logged</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
            <select value={selProj} onChange={e => setSelProj(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm">
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Photo tag</label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map(t => (
                <button key={t} type="button" onClick={() => setSelTag(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={selTag === t ? { background: TAG_COLORS[t]+"15", borderColor: TAG_COLORS[t], color: TAG_COLORS[t] } : { borderColor:"#e5e7eb", color:"#6b7280" }}>
                  {t}
                </button>
              ))}
            </div></div>
        </div>
        <div
          onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-all">
          <Upload size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">{uploading ? "Uploading…" : "Drop photos here or click to upload"}</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, HEIC</p>
          <input ref={fileRef} type="file" multiple accept="image/*" onChange={e => upload(e.target.files)} className="hidden" />
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Camera size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {p.url ? (
                <img src={p.url} alt={p.label} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gray-100 flex items-center justify-center"><Camera size={20} className="text-gray-300" /></div>
              )}
              <div className="p-2.5">
                <div className="text-xs font-semibold px-1.5 py-0.5 rounded-full inline-block mb-1"
                  style={{ background:(TAG_COLORS[p.tag]??"#6b7280")+"15", color:TAG_COLORS[p.tag]??"#6b7280" }}>
                  {p.tag ?? "Photo"}
                </div>
                <div className="text-xs text-gray-500 truncate">{p.projects?.name}</div>
                <div className="text-[10px] text-gray-400">{new Date(p.taken_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
