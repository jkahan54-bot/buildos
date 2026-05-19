"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const TYPE_COLORS: Record<string,string> = { PDF:"#EF4444", DOC:"#3B82F6", DOCX:"#3B82F6", XLSX:"#22C55E", XLS:"#22C55E", PNG:"#A855F7", JPG:"#A855F7", default:"#6B7280" };
const fmt = (bytes: number) => bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes/1024).toFixed(0)}KB` : `${(bytes/1048576).toFixed(1)}MB`;

export default function DocumentsPage() {
  const [docs, setDocs]         = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selProj, setSelProj]   = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    createClient().from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
  }, []);

  const load = async () => {
    const { data } = await createClient().from("documents").select("*, projects(name)").order("created_at", { ascending: false });
    setDocs(data ?? []);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!selProj) { alert("Select a project first"); return; }
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();

    for (const file of Array.from(files)) {
      const path = `documents/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const { error: upErr } = await supabase.storage.from("buildos").upload(path, file);
      if (upErr) { console.error(upErr); continue; }
      const { data: { publicUrl } } = supabase.storage.from("buildos").getPublicUrl(path);
      await supabase.from("documents").insert({
        org_id: prof?.org_id, project_id: selProj, uploaded_by: user!.id,
        name: file.name, file_type: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
        file_size: file.size, storage_path: path, url: publicUrl,
      });
    }
    setUploading(false); await load();
  };

  const filtered = docs.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.projects?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Documents</h1>
          <p className="text-gray-500 text-sm mt-1">{docs.length} files stored</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
          {uploading ? "Uploading…" : "⬆ Upload Files"}
        </button>
        <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.dwg,.csv"
          onChange={e => upload(e.target.files)} className="hidden" />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..."
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand" />
        <select value={selProj} onChange={e => setSelProj(e.target.value)}
          className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand">
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Upload hint */}
      {!selProj && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-300">
          ⚠ Select a project from the dropdown above before uploading to tag documents to a project.
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-brand/50 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}>
        <div className="text-3xl mb-2">📁</div>
        <p className="text-gray-400 font-semibold">Drop files here or click to browse</p>
        <p className="text-gray-600 text-sm mt-1">PDF, Word, Excel, Images, DWG</p>
      </div>

      {/* Documents grid */}
      {!filtered.length ? (
        <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">📄</div>
          <p className="font-semibold">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const ext = doc.file_type ?? "FILE";
            const color = TYPE_COLORS[ext] ?? TYPE_COLORS.default;
            return (
              <div key={doc.id} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-4 hover:border-gray-500 transition-colors">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ background: color+"22", border:`1px solid ${color}33`, color }}>
                  {ext}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{doc.name}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {doc.projects?.name ?? "No project"} · {new Date(doc.created_at).toLocaleDateString()}
                    {doc.file_size && ` · ${fmt(doc.file_size)}`}
                  </div>
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-bold px-3 py-1.5 rounded-lg border border-border text-gray-300 hover:border-gray-400 transition-colors flex-shrink-0">
                    View
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
