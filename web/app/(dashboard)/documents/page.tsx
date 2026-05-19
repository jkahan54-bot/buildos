"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const TYPE_COLORS: Record<string,string> = {
  PDF:"#EF4444", DOC:"#3B82F6", DOCX:"#3B82F6", XLSX:"#22C55E",
  XLS:"#22C55E", PNG:"#A855F7", JPG:"#A855F7", DWG:"#F59E0B", default:"#6B7280"
};
const fmt = (b: number) => !b ? "" : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`;

// Your actual SharePoint job site folders — discovered from your SharePoint
const JOB_FOLDERS = [
  { label:"123-125 Ditmas",         path:"123-125 ditmas" },
  { label:"1481 McDonald Ave",      path:"1481 McDonald Avenue" },
  { label:"West Park",              path:"West Park" },
  { label:"Virginia",               path:"Virginia" },
  { label:"840 Lefferts",           path:"840 Lefferts" },
  { label:"Rambam (other)",         path:"rambam other" },
  { label:"Crown Heights",          path:"Crown Heights" },
  { label:"2060-63",                path:"2060-63" },
  { label:"Belvidere",              path:"Belvidere 5110-19th Ave" },
  { label:"Rochester",              path:"Rochester" },
  { label:"Samuels",                path:"Other/Samuels" },
  { label:"Fairview Care",          path:"completed projects/Fairview Care" },
  { label:"Rambam (completed)",     path:"completed projects/Rambam Center" },
];

const SP_BASE = "https://brookstonedevelopers.sharepoint.com/Shared%20Documents/Projects";

export default function DocumentsPage() {
  const [tab, setTab]           = useState<"sharepoint"|"uploaded">("sharepoint");
  const [docs, setDocs]         = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selProj, setSelProj]   = useState("");
  const [spFiles, setSpFiles]   = useState<any[]>([]);
  const [spSearch, setSpSearch] = useState("");
  const [spLoading, setSpLoading] = useState(false);
  const [spError, setSpError]   = useState("");
  const [activeFolder, setActiveFolder] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [linking, setLinking]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]     = useState("");
  const [azureNeeded, setAzureNeeded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocs();
    createClient().from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
  }, []);

  const loadDocs = async () => {
    const { data } = await createClient().from("documents").select("*, projects(name)").order("created_at", { ascending: false });
    setDocs(data ?? []);
  };

  const browseFolder = async (folder: typeof JOB_FOLDERS[0]) => {
    setActiveFolder(folder);
    setSpFiles([]);
    setSpLoading(true);
    setSpError("");
    setSelectedFiles(new Set());
    try {
      const res = await fetch(`/api/sharepoint/browse?folder=${encodeURIComponent("Shared Documents/Projects/" + folder.path)}`);
      const data = await res.json();
      if (data.error === "azure_not_configured") { setAzureNeeded(true); setSpLoading(false); return; }
      if (data.error) { setSpError(data.error); setSpLoading(false); return; }
      setSpFiles(data.files?.filter((f: any) => !f.isFolder) ?? []);
    } catch (e: any) { setSpError(e.message); }
    setSpLoading(false);
  };

  const searchSP = async () => {
    if (!spSearch.trim()) return;
    setActiveFolder(null); setSpFiles([]); setSpLoading(true); setSpError(""); setSelectedFiles(new Set());
    try {
      const res = await fetch(`/api/sharepoint/browse?q=${encodeURIComponent(spSearch)}`);
      const data = await res.json();
      if (data.error === "azure_not_configured") { setAzureNeeded(true); setSpLoading(false); return; }
      if (data.error) { setSpError(data.error); setSpLoading(false); return; }
      setSpFiles(data.files ?? []);
    } catch (e: any) { setSpError(e.message); }
    setSpLoading(false);
  };

  const toggleFile = (url: string) =>
    setSelectedFiles(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n; });

  const linkSelected = async () => {
    if (!selProj || !selectedFiles.size) return;
    setLinking(true);
    const files = spFiles.filter(f => selectedFiles.has(f.webUrl));
    await fetch("/api/sharepoint/link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selProj, files }),
    });
    setLinking(false); setSelectedFiles(new Set()); await loadDocs();
    alert(`✓ ${files.length} file${files.length > 1 ? "s" : ""} linked to project`);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !selProj) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    for (const file of Array.from(files)) {
      const path = `documents/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const { error } = await supabase.storage.from("buildos").upload(path, file);
      if (error) continue;
      const { data: { publicUrl } } = supabase.storage.from("buildos").getPublicUrl(path);
      await supabase.from("documents").insert({
        org_id: prof?.org_id, project_id: selProj, uploaded_by: user!.id,
        name: file.name, file_type: file.name.split(".").pop()?.toUpperCase(),
        file_size: file.size, storage_path: path, url: publicUrl,
      });
    }
    setUploading(false); await loadDocs();
  };

  const spLinked  = docs.filter(d => d.storage_path?.startsWith("sharepoint:"));
  const localDocs = docs.filter(d => !d.storage_path?.startsWith("sharepoint:"));
  const filtered  = (tab === "sharepoint" ? spLinked : localDocs)
    .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.projects?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">Documents</h1>
          <p className="text-gray-500 text-sm mt-1">{spLinked.length} from SharePoint · {localDocs.length} uploaded directly</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selProj} onChange={e => setSelProj(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand">
            <option value="">Select project to link/upload to</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => fileRef.current?.click()} disabled={uploading || !selProj}
            className="border border-border text-gray-300 font-bold px-4 py-2 rounded-lg text-sm hover:border-gray-400 transition-colors disabled:opacity-40">
            {uploading ? "Uploading…" : "⬆ Upload File"}
          </button>
          <input ref={fileRef} type="file" multiple onChange={e => upload(e.target.files)} className="hidden" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl border border-border p-1 w-fit">
        <button onClick={() => setTab("sharepoint")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab==="sharepoint" ? "bg-brand text-white" : "text-gray-500 hover:text-gray-200"}`}>
          📁 SharePoint ({spLinked.length})
        </button>
        <button onClick={() => setTab("uploaded")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab==="uploaded" ? "bg-brand text-white" : "text-gray-500 hover:text-gray-200"}`}>
          ⬆ Uploaded ({localDocs.length})
        </button>
      </div>

      {/* ── SHAREPOINT TAB ──────────────────────────────────────── */}
      {tab === "sharepoint" && (
        <div className="space-y-4">

          {/* Azure setup needed */}
          {azureNeeded && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
              <div className="font-bold text-yellow-400 mb-2">⚙ Azure app setup needed to enable file browsing</div>
              <p className="text-gray-400 text-sm mb-3">
                Someone with Microsoft admin access at Brookstone needs to do a 5-min setup.
                Until then, use "Open in SharePoint ↗" to go directly to each folder, or paste file links manually below.
              </p>
              <div className="text-xs text-gray-500 space-y-0.5">
                <p>1. portal.azure.com → App registrations → New registration → name "BuildOS" → Register</p>
                <p>2. API permissions → Microsoft Graph → Sites.Read.All + Files.Read.All → Grant admin consent</p>
                <p>3. Certificates & secrets → New client secret → copy it</p>
                <p>4. Add to Vercel env vars: AZURE_TENANT_ID · AZURE_CLIENT_ID · AZURE_CLIENT_SECRET</p>
              </div>
            </div>
          )}

          {/* Job site folder grid */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-sm">Your Job Site Folders</div>
              <div className="flex gap-2">
                <input value={spSearch} onChange={e => setSpSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchSP()}
                  placeholder="Search across all SharePoint files…"
                  className="bg-surface-panel border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-brand w-64" />
                <button onClick={searchSP} disabled={!spSearch.trim() || spLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                  Search
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {JOB_FOLDERS.map(f => (
                <div key={f.path} className="flex gap-1">
                  {/* Browse in BuildOS (needs Azure) */}
                  <button onClick={() => browseFolder(f)} disabled={spLoading}
                    className={`flex-1 text-left px-3 py-2.5 rounded-lg border text-xs font-bold transition-colors truncate ${
                      activeFolder?.path === f.path ? "border-brand bg-brand/10 text-brand" : "border-border text-gray-400 hover:border-gray-400 hover:text-white"
                    }`}>
                    📁 {f.label}
                  </button>
                  {/* Direct SharePoint link — always works */}
                  <a href={`${SP_BASE}/${encodeURIComponent(f.path)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-2 py-2.5 rounded-lg border border-border text-gray-600 hover:border-blue-500 hover:text-blue-400 transition-colors text-xs"
                    title="Open folder in SharePoint">
                    ↗
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Loading */}
          {spLoading && (
            <div className="bg-surface rounded-xl border border-border p-8 text-center text-gray-500">
              <div className="text-2xl mb-2">🔍</div>Loading from SharePoint…
            </div>
          )}

          {/* Error */}
          {spError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{spError}</div>}

          {/* File browser results */}
          {!spLoading && spFiles.length > 0 && (
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
                <div className="text-sm font-bold">
                  {activeFolder ? `📁 ${activeFolder.label}` : "🔍 Search results"} — {spFiles.length} files
                  {selectedFiles.size > 0 && <span className="text-brand ml-2">{selectedFiles.size} selected</span>}
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => setSelectedFiles(new Set(spFiles.map(f => f.webUrl)))}
                    className="text-xs text-gray-500 hover:text-white transition-colors">Select all</button>
                  {selectedFiles.size > 0 && (
                    selProj ? (
                      <button onClick={linkSelected} disabled={linking}
                        className="bg-brand text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-brand-dark transition-colors disabled:opacity-50">
                        {linking ? "Linking…" : `Link ${selectedFiles.size} file${selectedFiles.size > 1 ? "s" : ""} → Project`}
                      </button>
                    ) : (
                      <span className="text-xs text-yellow-400">↑ Select a project first</span>
                    )
                  )}
                </div>
              </div>
              <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
                {spFiles.map(f => {
                  const ext = f.ext ?? "—";
                  const color = TYPE_COLORS[ext] ?? TYPE_COLORS.default;
                  const checked = selectedFiles.has(f.webUrl);
                  return (
                    <div key={f.webUrl} onClick={() => toggleFile(f.webUrl)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? "bg-brand/5" : "hover:bg-surface-card"}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "bg-brand border-brand" : "border-gray-600 hover:border-brand"}`}>
                        {checked && <span className="text-white text-xs font-bold leading-none">✓</span>}
                      </div>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                        style={{ background: color+"22", border:`1px solid ${color}33`, color }}>
                        {ext}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{f.name}</div>
                        <div className="text-gray-500 text-xs">{f.modified ? new Date(f.modified).toLocaleDateString() : ""}  {fmt(f.size)}</div>
                      </div>
                      <a href={f.webUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="text-xs font-bold px-2.5 py-1.5 rounded border border-border text-gray-400 hover:text-white hover:border-gray-300 transition-colors flex-shrink-0">
                        Open ↗
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Already-linked files */}
          {filtered.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-gray-400">Linked to Projects ({filtered.length})</div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…"
                  className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-brand w-48" />
              </div>
              <div className="space-y-2">
                {filtered.map(doc => {
                  const ext = doc.file_type ?? "FILE";
                  const color = TYPE_COLORS[ext] ?? TYPE_COLORS.default;
                  return (
                    <div key={doc.id} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                        style={{ background: color+"22", border:`1px solid ${color}33`, color }}>
                        {ext}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{doc.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{doc.projects?.name} · {new Date(doc.created_at).toLocaleDateString()}</div>
                      </div>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors flex-shrink-0">
                        Open in SharePoint ↗
                      </a>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!spLoading && spFiles.length === 0 && filtered.length === 0 && (
            <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center">
              <div className="text-4xl mb-3">📁</div>
              <p className="text-gray-400 font-semibold">Click any job folder above to browse its files</p>
              <p className="text-gray-600 text-sm mt-1">The ↗ buttons open directly in SharePoint without needing Azure setup</p>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOADED TAB ────────────────────────────────────────── */}
      {tab === "uploaded" && (
        <div className="space-y-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search uploaded files…"
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand" />
          <div onDrop={e => { e.preventDefault(); selProj && upload(e.dataTransfer.files); }}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-brand/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}>
            <div className="text-3xl mb-2">📁</div>
            <p className="text-gray-400 font-semibold text-sm">Drop files or click to upload</p>
            {!selProj && <p className="text-yellow-400 text-xs mt-1">Select a project in the top-right first</p>}
          </div>
          {filtered.length === 0 ? (
            <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">📄</div><p className="font-semibold">No uploaded files yet</p>
            </div>
          ) : filtered.map(doc => {
            const ext = doc.file_type ?? "FILE";
            const color = TYPE_COLORS[ext] ?? TYPE_COLORS.default;
            return (
              <div key={doc.id} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ background: color+"22", border:`1px solid ${color}33`, color }}>
                  {ext}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{doc.name}</div>
                  <div className="text-xs text-gray-500">{doc.projects?.name} · {new Date(doc.created_at).toLocaleDateString()}{doc.file_size ? ` · ${fmt(doc.file_size)}` : ""}</div>
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border text-gray-300 hover:border-gray-400 transition-colors flex-shrink-0">
                    View ↗
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
