"use client";
import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ImportChecklistPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(""); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".xlsx")) { setFile(f); setResult(null); setError(""); }
  };

  const importFile = async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", id);

    try {
      const res  = await fetch("/api/medical/import", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e: any) {
      setError("Import failed: " + e.message);
    }
    setLoading(false);
  };

  const inp = "bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/projects/${id}`} className="text-brand text-sm hover:underline">← Back to project</Link>
        <h1 className="text-2xl font-black mt-3">Import Medical Checklist</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload your proposal Excel file — we'll auto-create one checklist per room with all items pre-loaded.
        </p>
      </div>

      {/* Format guide */}
      <div className="bg-surface rounded-xl border border-border p-5 mb-5">
        <div className="font-bold text-sm mb-3">Expected Excel format</div>
        <div className="space-y-1.5 text-sm text-gray-400">
          {[
            "Sheet named: Basic Proposal",
            "Headers in row 11: Category Code, Area Code, Area (description), QTY, UOM, Cost Per Item…",
            "Category codes: LE, FC, WL, DVW, FN",
            "Area codes: ML, EXT, RRC, RR, RB, DR, PTR, VB, CR",
          ].map((t, i) => (
            <div key={i} className="flex gap-2"><span className="text-brand">✓</span>{t}</div>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-600">Matches your "Roswell GA Final Proposal" format exactly.</div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-5 ${
          file ? "border-brand bg-brand/5" : "border-border hover:border-gray-500"
        }`}>
        <div className="text-4xl mb-3">{file ? "📊" : "📁"}</div>
        {file ? (
          <>
            <p className="font-bold text-white">{file.name}</p>
            <p className="text-gray-500 text-sm mt-1">{(file.size / 1024).toFixed(0)} KB — ready to import</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-gray-400">Drop your .xlsx file here</p>
            <p className="text-gray-600 text-sm mt-1">or click to browse</p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFile} className="hidden" />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 text-red-400 text-sm">{error}</div>
      )}

      {/* Success */}
      {result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-5">
          <div className="font-bold text-green-400 text-lg mb-3">✓ Import Complete</div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-brand">{result.checklists}</div>
              <div className="text-xs text-gray-500 mt-1">Rooms created</div>
            </div>
            <div className="bg-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-green-400">{result.items}</div>
              <div className="text-xs text-gray-500 mt-1">Items imported</div>
            </div>
          </div>
          <div className="text-sm text-gray-400 mb-1 font-semibold">Rooms created:</div>
          <div className="flex flex-wrap gap-2">
            {result.rooms.map((r: string) => (
              <span key={r} className="text-xs bg-surface px-3 py-1.5 rounded-full border border-border text-gray-300">{r}</span>
            ))}
          </div>
          <Link href={`/projects/${id}`}
            className="inline-block mt-4 bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
            View Project →
          </Link>
        </div>
      )}

      {/* Import button */}
      {!result && (
        <button onClick={importFile} disabled={!file || loading}
          className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-40">
          {loading ? "Importing…" : "🏥 Import Medical Checklist"}
        </button>
      )}

      {loading && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          Parsing Excel and creating checklists… this takes a few seconds.
        </div>
      )}
    </div>
  );
}
