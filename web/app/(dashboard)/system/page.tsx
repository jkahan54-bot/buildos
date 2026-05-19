"use client";
import { useState } from "react";
import {
  CheckCircle, XCircle, AlertCircle, RefreshCw,
  Database, Globe, Zap, Server, Key, HardDrive,
  Mail, Shield, ExternalLink, ChevronDown, ChevronRight
} from "lucide-react";

type CheckResult = { ok: boolean | null; ms?: number; error?: string; result?: any };

const Dot = ({ ok }: { ok: boolean | null }) => (
  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${ok === null ? "bg-gray-300" : ok ? "bg-green-500" : "bg-red-500"}`} />
);

const Pill = ({ ok, label }: { ok: boolean | null; label?: string }) => (
  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
    ok === null ? "bg-gray-100 text-gray-500" :
    ok ? "bg-green-50 text-green-600 border border-green-100" :
    "bg-red-50 text-red-600 border border-red-100"
  }`}>{label ?? (ok === null ? "N/A" : ok ? "OK" : "FAIL")}</span>
);

function Section({ icon: Icon, title, color, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-all text-left border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="font-semibold text-sm text-gray-900 flex-1">{title}</span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Row({ label, data, sub, fix }: { label: string; data: CheckResult; sub?: string; fix?: { text: string; url: string } }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 ${data.ok === false ? "bg-red-50/50" : ""}`}>
      <Dot ok={data.ok} />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-800 font-mono">{label}</span>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        {data.ok === false && data.error && <div className="text-xs text-red-500 mt-0.5">⚠ {data.error}</div>}
        {data.ok === true && data.result && typeof data.result === "object" && (
          <div className="text-xs text-gray-400 mt-0.5">
            {Object.entries(data.result).slice(0,2).map(([k,v]) => `${k}: ${v}`).join(" · ")}
          </div>
        )}
      </div>
      {data.ms && <span className="text-xs text-gray-400 flex-shrink-0">{data.ms}ms</span>}
      <Pill ok={data.ok} />
      {data.ok === false && fix && (
        <a href={fix.url} target="_blank" rel="noopener noreferrer"
          className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
          Fix <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

export default function SystemPage() {
  const [status, setStatus]   = useState<"idle"|"checking"|"done">("idle");
  const [data, setData]       = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);

  const run = async () => {
    setStatus("checking"); setData(null);
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 500);
    try {
      const res = await fetch("/api/health");
      const json = await res.json();
      clearInterval(interval); setElapsed(Math.round((Date.now() - start) / 1000));
      setData(json); setStatus("done");
    } catch (e: any) {
      clearInterval(interval); setStatus("idle");
      alert("Health check failed: " + e.message);
    }
  };

  const passCount  = data ? Object.values({ ...data.pages, ...data.database }).filter((x: any) => x.ok).length : 0;
  const totalCount = data ? Object.keys({ ...data.pages, ...data.database }).length : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Full check — pages, database, auth, storage, AI, email, deployment, env vars
          </p>
        </div>
        <button onClick={run} disabled={status === "checking"}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-60 flex-shrink-0"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <RefreshCw size={14} className={status === "checking" ? "animate-spin" : ""} />
          {status === "checking" ? `Checking… ${elapsed}s` : "Run Full Check"}
        </button>
      </div>

      {/* Idle */}
      {status === "idle" && !data && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="flex justify-center gap-4 mb-4">
            {[[Globe,"#2563eb"],[Database,"#16a34a"],[Key,"#f97316"],[Server,"#7c3aed"]].map(([I, c]: any, i) => (
              <div key={i} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c+"15" }}>
                <I size={18} style={{ color: c }} />
              </div>
            ))}
          </div>
          <p className="text-gray-500 font-medium">Click "Run Full Check" to test everything</p>
          <p className="text-gray-400 text-sm mt-1">17 pages · 20 DB tables · Auth · Storage · AI · Email · Deployment · Env vars</p>
        </div>
      )}

      {/* Checking */}
      {status === "checking" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <div className="flex justify-center gap-3 mb-5">
            {[
              [Globe,"Pages",   "#2563eb"],
              [Database,"Database","#16a34a"],
              [Key,"AI Keys",  "#f97316"],
              [HardDrive,"Storage","#7c3aed"],
              [Server,"Deploy","#ea580c"],
            ].map(([I, label, c]: any, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse" style={{ background: c+"20", animationDelay:`${i*150}ms` }}>
                  <I size={15} style={{ color: c }} />
                </div>
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm font-medium">Running all checks — takes ~15 seconds</p>
          <p className="text-gray-400 text-xs mt-1">{elapsed}s elapsed</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`rounded-xl border p-5 ${data.summary.healthy ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
            <div className="flex items-center gap-3">
              {data.summary.healthy
                ? <CheckCircle size={24} className="text-green-500 flex-shrink-0" />
                : <AlertCircle size={24} className="text-orange-500 flex-shrink-0" />}
              <div className="flex-1">
                <div className={`font-bold ${data.summary.healthy ? "text-green-700" : "text-orange-700"}`}>
                  {data.summary.healthy ? "✓ All systems healthy" : `${data.summary.issues.length} issue${data.summary.issues.length !== 1 ? "s" : ""} found`}
                </div>
                {data.summary.issues.length > 0 && (
                  <div className="text-sm mt-0.5 text-orange-600">{data.summary.issues.join(" · ")}</div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-black text-gray-900">{data.summary.score}%</div>
                <div className="text-xs text-gray-400">{passCount}/{totalCount} passing</div>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <Section icon={Key} title="Environment Variables" color="#f97316">
            {Object.entries(data.env).map(([k, v]: [string, any]) => (
              <Row key={k} label={k} data={{ ok: v.ok || (v.optional && !v.ok) ? v.ok : v.ok, ...v }}
                sub={v.optional ? "Optional" : "Required"}
                fix={!v.ok && !v.optional ? { text:"Add to Vercel", url:"https://vercel.com" } : undefined} />
            ))}
          </Section>

          {/* Auth & Email */}
          <Section icon={Shield} title="Auth & Email" color="#7c3aed">
            <Row label="Supabase Auth" data={data.auth} sub="User sign-in system"
              fix={!data.auth.ok ? { text:"Check Supabase", url:"https://supabase.com/dashboard" } : undefined} />
            <Row label="Email system" data={data.email} sub="Invite emails"
              fix={!data.email.ok ? { text:"Check Auth settings", url:`https://supabase.com/dashboard/project/biizphtfbiqgkinnfbgy/auth/providers` } : undefined} />
          </Section>

          {/* Storage */}
          <Section icon={HardDrive} title="File Storage" color="#2563eb">
            <Row label="buildos bucket" data={data.storage} sub="Photos, documents, uploads"
              fix={!data.storage.ok ? { text:"Check Storage", url:"https://supabase.com/dashboard/project/biizphtfbiqgkinnfbgy/storage/buckets" } : undefined} />
          </Section>

          {/* AI APIs */}
          <Section icon={Zap} title="AI APIs" color="#f97316">
            <Row label="Anthropic Claude" data={data.anthropic} sub="BuildBot, dual review, email parser"
              fix={!data.anthropic.ok ? { text:"Check credits", url:"https://console.anthropic.com/settings/billing" } : undefined} />
            <Row label="OpenAI GPT-4" data={data.openai} sub="Cross-check reviewer (optional)"
              fix={!data.openai.ok && data.openai.ok !== null ? { text:"Add API key", url:"https://platform.openai.com/api-keys" } : undefined} />
          </Section>

          {/* Deployment */}
          <Section icon={Server} title="Vercel Deployment" color="#16a34a">
            <Row label="Latest deployment" data={data.deployment}
              sub={data.deployment.result?.age ? `Deployed ${data.deployment.result.age}` : undefined}
              fix={!data.deployment.ok && data.deployment.ok !== null ? { text:"View Vercel", url:"https://vercel.com" } : undefined} />
          </Section>

          {/* Database */}
          <Section icon={Database} title="Database Tables" color="#16a34a" defaultOpen={Object.values(data.database).some((t: any) => !t.ok)}>
            <div className="grid grid-cols-2">
              {Object.entries(data.database).map(([table, d]: [string, any]) => (
                <div key={table} className={`flex items-center gap-2.5 px-5 py-2.5 border-b border-r border-gray-50 ${!d.ok ? "bg-red-50/60" : ""}`}>
                  <Dot ok={d.ok} />
                  <span className="text-xs font-mono text-gray-700 flex-1 truncate">{table}</span>
                  <span className="text-[10px] text-gray-400">{d.ms}ms</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Pages */}
          <Section icon={Globe} title="Pages" color="#2563eb" defaultOpen={Object.values(data.pages).some((p: any) => !p.ok)}>
            <div className="grid grid-cols-2">
              {Object.entries(data.pages).map(([page, d]: [string, any]) => (
                <div key={page} className={`flex items-center gap-2.5 px-5 py-2.5 border-b border-r border-gray-50 ${!d.ok ? "bg-red-50/60" : ""}`}>
                  <Dot ok={d.ok} />
                  <span className="text-xs font-mono text-gray-700 flex-1">{page}</span>
                  <span className="text-[10px] text-gray-400">{d.ms}ms</span>
                  {d.ok === false && <Pill ok={false} />}
                </div>
              ))}
            </div>
          </Section>

          {/* Fix guide */}
          {!data.summary.healthy && (
            <div className="bg-white rounded-xl border border-orange-200 p-5 shadow-sm">
              <div className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle size={15} className="text-orange-500" />What to do
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                {!data.anthropic.ok && <div className="flex gap-2"><span className="text-orange-500">•</span><span><b>AI not working:</b> Add credits at <a href="https://console.anthropic.com/settings/billing" target="_blank" className="text-orange-500 underline">console.anthropic.com</a></span></div>}
                {Object.values(data.env).some((e: any) => !e.ok && !e.optional) && <div className="flex gap-2"><span className="text-orange-500">•</span><span><b>Missing env vars:</b> Go to vercel.com → your project → Settings → Environment Variables</span></div>}
                {Object.values(data.database).some((t: any) => !t.ok) && <div className="flex gap-2"><span className="text-orange-500">•</span><span><b>Database issue:</b> Check <a href="https://supabase.com/dashboard" target="_blank" className="text-orange-500 underline">supabase.com/dashboard</a> for status</span></div>}
                {Object.values(data.pages).some((p: any) => !p.ok) && <div className="flex gap-2"><span className="text-orange-500">•</span><span><b>Pages failing:</b> Message me — I'll fix it immediately</span></div>}
                {data.deployment.ok === false && <div className="flex gap-2"><span className="text-orange-500">•</span><span><b>Deployment issue:</b> Message me — I'll redeploy</span></div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
