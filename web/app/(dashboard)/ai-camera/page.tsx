"use client";
import { useState, useRef, useCallback } from "react";
import { Camera, Upload, RefreshCw, AlertTriangle, CheckCircle, ShieldAlert, BarChart2, Package, Wrench } from "lucide-react";

const MODES = [
  {
    id:    "safety",
    label: "Safety Scan",
    icon:  ShieldAlert,
    color: "#dc2626",
    bg:    "#fee2e2",
    desc:  "Detect hazards, missing PPE, violations",
  },
  {
    id:    "progress",
    label: "Progress Check",
    icon:  BarChart2,
    color: "#16a34a",
    bg:    "#dcfce7",
    desc:  "Estimate completion & phase",
  },
  {
    id:    "defects",
    label: "Defect Detection",
    icon:  Wrench,
    color: "#d97706",
    bg:    "#fef3c7",
    desc:  "Find quality issues & rework items",
  },
  {
    id:    "materials",
    label: "Material ID",
    icon:  Package,
    color: "#7c3aed",
    bg:    "#ede9fe",
    desc:  "Identify materials & equipment",
  },
];

const SEV_COLOR: Record<string, string> = {
  Low:"#16a34a", Minor:"#16a34a",
  Medium:"#d97706", Major:"#d97706",
  High:"#dc2626", Critical:"#dc2626",
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width:`${score}%`, background: color }} />
      </div>
      <span className="text-lg font-black w-12 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

export default function AICameraPage() {
  const [mode, setMode]         = useState("safety");
  const [image, setImage]       = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [error, setError]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const activeMode = MODES.find(m => m.id === mode)!;

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    setImageFile(file);
    setResult(null); setError("");
    const reader = new FileReader();
    reader.onload = e => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const analyze = async () => {
    if (!imageFile) return;
    setAnalyzing(true); setResult(null); setError("");
    const form = new FormData();
    form.append("image", imageFile);
    form.append("mode", mode);
    try {
      const res  = await fetch("/api/ai/camera", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) { setError(data.error); } else { setResult(data.result); }
    } catch (e: any) { setError("Analysis failed: " + e.message); }
    setAnalyzing(false);
  };

  const reset = () => { setImage(null); setImageFile(null); setResult(null); setError(""); };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">AI Camera Analysis</h1>
        <p className="text-gray-500 text-sm mt-0.5">Take or upload a site photo — Claude analyzes for safety, progress, defects & materials</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {MODES.map(m => {
          const Icon    = m.icon;
          const active  = mode === m.id;
          return (
            <button key={m.id} onClick={() => { setMode(m.id); setResult(null); }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${active ? "shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"}`}
              style={active ? { borderColor: m.color, background: m.bg } : {}}>
              <Icon size={20} className="mb-2" style={{ color: active ? m.color : "#9ca3af" }} />
              <div className="font-semibold text-sm" style={{ color: active ? m.color : "#374151" }}>{m.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Upload / Camera */}
      {!image ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-all">
            <Camera size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Drop a photo here or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, HEIC — supports site photos, screenshots, video stills</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all bg-white">
              <Upload size={16} />Upload Photo
            </button>
            <button onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-sm"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              <Camera size={16} />Take Photo
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Photo + controls */}
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <img src={image} alt="Site photo" className="w-full max-h-72 object-cover" />
            </div>
            <div className="flex gap-3">
              <button onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all bg-white">
                <RefreshCw size={14} />New Photo
              </button>
              <button onClick={analyze} disabled={analyzing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-60 transition-all"
                style={{ background: analyzing ? "#9ca3af" : `linear-gradient(135deg,${activeMode.color},${activeMode.color}cc)` }}>
                {analyzing ? <><RefreshCw size={14} className="animate-spin" />Analyzing…</> : <><activeMode.icon size={14} />Analyze: {activeMode.label}</>}
              </button>
            </div>
          </div>

          {/* Results */}
          <div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-red-600 text-sm">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />{error}
              </div>
            )}

            {analyzing && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center h-full flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: activeMode.bg }}>
                  <activeMode.icon size={24} style={{ color: activeMode.color }} />
                </div>
                <p className="font-semibold text-gray-700">Claude is analyzing…</p>
                <p className="text-sm text-gray-400">{activeMode.desc}</p>
              </div>
            )}

            {!analyzing && result && mode === "safety" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-900">Safety Analysis</div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    result.overallRisk === "Critical" ? "bg-red-100 text-red-600" :
                    result.overallRisk === "High"     ? "bg-orange-100 text-orange-600" :
                    result.overallRisk === "Medium"   ? "bg-yellow-100 text-yellow-600" :
                    "bg-green-100 text-green-600"}`}>
                    {result.overallRisk} Risk
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">Safety Score</div>
                  <ScoreBar score={result.safetyScore} color={result.safetyScore > 75 ? "#16a34a" : result.safetyScore > 50 ? "#d97706" : "#dc2626"} />
                </div>
                {result.violations?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Violations Found</div>
                    {result.violations.map((v: any, i: number) => (
                      <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: SEV_COLOR[v.severity]+"20", color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                          <span className="text-sm font-semibold text-gray-800">{v.issue}</span>
                        </div>
                        {v.location && <div className="text-xs text-gray-500">📍 {v.location}</div>}
                        {v.action  && <div className="text-xs text-orange-600 mt-1">→ {v.action}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {result.recommendations?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommendations</div>
                    {result.recommendations.map((r: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm text-gray-600 mb-1"><span className="text-orange-500">•</span>{r}</div>
                    ))}
                  </div>
                )}
                {result.requiresImmediateAction && (
                  <div className="bg-red-600 text-white rounded-lg p-3 text-sm font-bold flex items-center gap-2">
                    <AlertTriangle size={16} />Immediate action required — stop work if unsafe
                  </div>
                )}
              </div>
            )}

            {!analyzing && result && mode === "progress" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="font-bold text-gray-900">Progress Analysis</div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-3xl font-black text-green-600">{result.estimatedCompletion}</div>
                  <div className="text-xs text-green-700 mt-0.5">Estimated completion</div>
                </div>
                {result.phase && <div className="text-sm text-gray-600"><span className="font-semibold">Phase:</span> {result.phase}</div>}
                <div className="text-sm text-gray-600">{result.progressSummary}</div>
                {result.workVisible?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Work Visible</div>
                    {result.workVisible.map((w: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm text-gray-600 mb-1"><CheckCircle size={13} className="text-green-500 flex-shrink-0 mt-0.5" />{w}</div>
                    ))}
                  </div>
                )}
                {result.concerns?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">Concerns</div>
                    {result.concerns.map((c: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm text-gray-600 mb-1"><AlertTriangle size={13} className="text-orange-500 flex-shrink-0 mt-0.5" />{c}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!analyzing && result && mode === "defects" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-900">Quality Analysis</div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${result.passesInspection ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                    {result.passesInspection ? "✓ Passes" : "✗ Fails"}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">Quality Score</div>
                  <ScoreBar score={result.qualityScore} color={result.qualityScore > 75 ? "#16a34a" : result.qualityScore > 50 ? "#d97706" : "#dc2626"} />
                </div>
                {result.defectsFound?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Defects Found</div>
                    {result.defectsFound.map((d: any, i: number) => (
                      <div key={i} className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: SEV_COLOR[d.severity]+"20", color: SEV_COLOR[d.severity] }}>{d.severity}</span>
                          <span className="text-sm font-semibold text-gray-800">{d.type}</span>
                        </div>
                        {d.location && <div className="text-xs text-gray-500">📍 {d.location}</div>}
                        {d.action   && <div className="text-xs text-orange-600 mt-1">→ {d.action}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {result.notes && <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{result.notes}</div>}
              </div>
            )}

            {!analyzing && result && mode === "materials" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="font-bold text-gray-900">Materials & Equipment</div>
                <div className="text-sm text-gray-600">{result.summary}</div>
                {result.materials?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">Materials</div>
                    {result.materials.map((m: any, i: number) => (
                      <div key={i} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{m.name}</div>
                          {m.estimatedQuantity && <div className="text-xs text-gray-500">Qty: {m.estimatedQuantity}</div>}
                          {m.notes && <div className="text-xs text-gray-400">{m.notes}</div>}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          m.condition === "Good" ? "bg-green-100 text-green-600" : m.condition === "Fair" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"
                        }`}>{m.condition}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.equipment?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Equipment</div>
                    {result.equipment.map((e: any, i: number) => (
                      <div key={i} className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                        <span className="text-purple-500">•</span>{e.name} <span className="text-xs text-gray-400">({e.condition})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!analyzing && !result && !error && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center flex flex-col items-center justify-center h-full gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: activeMode.bg }}>
                  <activeMode.icon size={24} style={{ color: activeMode.color }} />
                </div>
                <p className="font-semibold text-gray-500">Ready to analyze</p>
                <p className="text-sm text-gray-400">Hit "Analyze" to run {activeMode.label}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
