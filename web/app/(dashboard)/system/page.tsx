"use client";
import { useState, useEffect } from "react";
import {
  CheckCircle, XCircle, AlertCircle, RefreshCw, Database,
  Globe, Zap, Server, Key, HardDrive, Shield, ExternalLink,
  ChevronDown, ChevronRight, Archive, Activity, Clock, Wrench
} from "lucide-react";

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

function Section({ icon: Icon, title, color, badge, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-all text-left border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="font-semibold text-sm text-gray-900 flex-1">{title}</span>
        {badge}
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Row({ label, data, sub, fix }: { label: string; data: any; sub?: string; fix?: { text: string; url: string } }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 ${data?.ok === false ? "bg-red-50/50" : ""}`}>
      <Dot ok={data?.ok ?? null} />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-800 font-mono">{label}</span>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        {data?.ok === false && data?.error && <div className="text-xs text-red-500 mt-0.5">⚠ {data.error}</div>}
        {data?.ok === true && data?.result && typeof data.result === "object" && (
          <div className="text-xs text-gray-400 mt-0.5">{Object.entries(data.result).slice(0,2).map(([k,v]) => `${k}: ${v}`).join(" · ")}</div>
        )}
      </div>
      {data?.ms && <span className="text-xs text-gray-400 flex-shrink-0">{data.ms}ms</span>}
      <Pill ok={data?.ok ?? null} />
      {data?.ok === false && fix && (
        <a href={fix.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 flex-shrink-0">
          Fix <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

export default function SystemPage() {
  const [tab, setTab]           = useState<"health"|"history"|"backups">("health");
  const [checkStatus, setCheck] = useState<"idle"|"checking"|"done">("idle");
  const [health, setHealth]     = useState<any>(null);
  const [history, setHistory]   = useState<any[]>([]);
  const [backups, setBackups]   = useState<any[]>([]);
  const [elapsed, setElapsed]   = useState(0);
  const [fixing, setFixing]     = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const res = await fetch("/api/monitor");
    const d = await res.json();
    setHistory(d.events ?? []);
    setBackups(d.backups ?? []);
  };

  const runHealthCheck = async () => {
    setCheck("checking"); setHealth(null); setElapsed(0);
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 500);
    try {
      const res = await fetch("/api/health");
      const json = await res.json();
      clearInterval(interval); setElapsed(Math.round((Date.now() - start) / 1000));
      setHealth(json); setCheck("done");
    } catch { clearInterval(interval); setCheck("idle"); }
  };

  const runAutoFix = async () => {
    setFixing(true); setFixResult(null);
    try {
      const res = await fetch("/api/monitor", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ source:"manual" }) });
      const d = await res.json();
      setFixResult(d); await loadHistory();
    } catch (e: any) { setFixResult({ error: e.message }); }
    setFixing(false);
  };

  const createBackup = async () => {
    const res = await fetch("/api/backup?trigger=manual", { method:"POST" });
    const d = await res.json();
    alert(`✓ Backup created — ${d.total_rows} rows saved`);
    await loadHistory();
  };

  const hasIssues = health && !health.summary?.healthy;
  const passCount = health ? Object.values({ ...health.pages, ...health.database }).filter((x: any) => x.ok).length : 0;
  const totalCount = health ? Object.keys({ ...health.pages, ...health.database }).length : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 text-sm mt-0.5">Monitor, auto-fix, backup and verify your BuildOS platform</p>
        </div>
        <div className="flex gap-2">
          <button onClick={createBackup} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-300 shadow-sm hover:bg-gray-50 transition-all">
            <Archive size={14} />Backup Now
          </button>
          <button onClick={runHealthCheck} disabled={checkStatus === "checking"}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
            <RefreshCw size={14} className={checkStatus === "checking" ? "animate-spin" : ""} />
            {checkStatus === "checking" ? `${elapsed}s…` : "Run Check"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[["health","Health Check","🔍"],["history","Event Log","📋"],["backups","Backups","💾"]].map(([t,l,e]) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab===t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <span>{e}</span>{l}
          </button>
        ))}
      </div>

      {/* ── HEALTH CHECK TAB ──────────────────────────────────── */}
      {tab === "health" && (
        <div className="space-y-4">
          {checkStatus === "idle" && !health && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <Activity size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Click "Run Check" to test everything</p>
              <p className="text-gray-400 text-sm mt-1">17 pages · 20 DB tables · Auth · Storage · AI · Email · Deployment · Env vars</p>
            </div>
          )}

          {checkStatus === "checking" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
              <div className="flex justify-center gap-3 mb-5">
                {[[Globe,"Pages","#2563eb"],[Database,"Database","#16a34a"],[Key,"AI","#f97316"],[HardDrive,"Storage","#7c3aed"],[Server,"Deploy","#ea580c"]].map(([I,l,c]:any,i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse" style={{ background: c+"20", animationDelay:`${i*150}ms` }}>
                      <I size={15} style={{ color: c }} />
                    </div>
                    <span className="text-[10px] text-gray-400">{l}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-sm font-medium">Running full check — ~15 seconds</p>
            </div>
          )}

          {health && (
            <>
              {/* Summary */}
              <div className={`rounded-xl border p-5 ${health.summary.healthy ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                <div className="flex items-center gap-3">
                  {health.summary.healthy ? <CheckCircle size={24} className="text-green-500" /> : <AlertCircle size={24} className="text-orange-500" />}
                  <div className="flex-1">
                    <div className={`font-bold ${health.summary.healthy ? "text-green-700" : "text-orange-700"}`}>
                      {health.summary.healthy ? "✓ All systems healthy" : `${health.summary.issues.length} issue${health.summary.issues.length !== 1 ? "s" : ""} found`}
                    </div>
                    {health.summary.issues.length > 0 && <div className="text-sm mt-0.5 text-orange-600">{health.summary.issues.join(" · ")}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black text-gray-900">{health.summary.score}%</div>
                    <div className="text-xs text-gray-400">{passCount}/{totalCount}</div>
                  </div>
                </div>

                {/* Auto-fix button when issues exist */}
                {hasIssues && (
                  <div className="mt-4 pt-4 border-t border-orange-200 flex items-center gap-3">
                    <button onClick={runAutoFix} disabled={fixing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                      style={{ background:"linear-gradient(135deg,#dc2626,#b91c1c)" }}>
                      <Wrench size={14} className={fixing ? "animate-spin" : ""} />
                      {fixing ? "Backing up + fixing…" : "Auto-Fix Issues"}
                    </button>
                    <p className="text-xs text-orange-600">Will backup your data first, then attempt fixes, then verify nothing was lost.</p>
                  </div>
                )}
              </div>

              {/* Fix result */}
              {fixResult && (
                <div className={`rounded-xl border p-4 text-sm ${fixResult.error ? "bg-red-50 border-red-200 text-red-600" : "bg-blue-50 border-blue-200"}`}>
                  {fixResult.error ? `Fix failed: ${fixResult.error}` : (
                    <div className="space-y-1">
                      <div className="font-semibold text-blue-700">Fix report</div>
                      {fixResult.backup && <div className="text-blue-600">✓ Backup created — {fixResult.backup.total_rows} rows saved</div>}
                      {fixResult.fixes?.map((f: any, i: number) => <div key={i} className="text-blue-600">✓ {f.type}: {f.action}</div>)}
                      {fixResult.data_integrity && (
                        <div className={fixResult.data_integrity.data_lost ? "text-red-600 font-semibold" : "text-green-600"}>
                          {fixResult.data_integrity.data_lost ? "⚠ Data loss detected — restore from backup immediately" : "✓ Verified: no data lost"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sections */}
              <Section icon={Key} title="Environment Variables" color="#f97316">
                {Object.entries(health.env ?? {}).map(([k, v]: [string, any]) => (
                  <Row key={k} label={k} data={{ ok: v.ok || v.optional, ...v }} sub={v.optional ? "Optional" : "Required"}
                    fix={!v.ok && !v.optional ? { text:"Fix in Vercel", url:"https://vercel.com" } : undefined} />
                ))}
              </Section>
              <Section icon={Shield} title="Auth & Email" color="#7c3aed">
                <Row label="Supabase Auth" data={health.auth} fix={!health.auth?.ok ? { text:"Check Supabase", url:"https://supabase.com/dashboard" } : undefined} />
                <Row label="Email system" data={health.email} />
              </Section>
              <Section icon={HardDrive} title="Storage" color="#2563eb">
                <Row label="buildos bucket" data={health.storage} sub="Photos, docs, backups"
                  fix={!health.storage?.ok ? { text:"Check Storage", url:"https://supabase.com/dashboard/project/biizphtfbiqgkinnfbgy/storage/buckets" } : undefined} />
              </Section>
              <Section icon={Zap} title="AI APIs" color="#f97316">
                <Row label="Anthropic Claude" data={health.anthropic} fix={!health.anthropic?.ok ? { text:"Add credits", url:"https://console.anthropic.com/settings/billing" } : undefined} />
                <Row label="OpenAI GPT-4" data={health.openai} sub="Optional" />
              </Section>
              <Section icon={Server} title="Deployment" color="#16a34a">
                <Row label="Latest deployment" data={health.deployment}
                  sub={health.deployment?.result?.age ? `Deployed ${health.deployment.result.age}` : undefined} />
              </Section>
              <Section icon={Database} title="Database" color="#16a34a"
                defaultOpen={Object.values(health.database ?? {}).some((t: any) => !t.ok)}
                badge={<span className="text-xs text-gray-400 mr-2">{Object.values(health.database ?? {}).filter((t: any) => t.ok).length}/{Object.keys(health.database ?? {}).length} OK</span>}>
                <div className="grid grid-cols-2">
                  {Object.entries(health.database ?? {}).map(([t, d]: [string, any]) => (
                    <div key={t} className={`flex items-center gap-2 px-5 py-2.5 border-b border-r border-gray-50 ${!d.ok ? "bg-red-50/60" : ""}`}>
                      <Dot ok={d.ok} /><span className="text-xs font-mono text-gray-700 flex-1 truncate">{t}</span>
                      <span className="text-[10px] text-gray-400">{d.ms}ms</span>
                    </div>
                  ))}
                </div>
              </Section>
              <Section icon={Globe} title="Pages" color="#2563eb"
                defaultOpen={Object.values(health.pages ?? {}).some((p: any) => !p.ok)}
                badge={<span className="text-xs text-gray-400 mr-2">{Object.values(health.pages ?? {}).filter((p: any) => p.ok).length}/{Object.keys(health.pages ?? {}).length} OK</span>}>
                <div className="grid grid-cols-2">
                  {Object.entries(health.pages ?? {}).map(([p, d]: [string, any]) => (
                    <div key={p} className={`flex items-center gap-2 px-5 py-2.5 border-b border-r border-gray-50 ${!d.ok ? "bg-red-50/60" : ""}`}>
                      <Dot ok={d.ok} /><span className="text-xs font-mono text-gray-700 flex-1">{p}</span>
                      <span className="text-[10px] text-gray-400">{d.ms}ms</span>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      )}

      {/* ── EVENT LOG TAB ─────────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-3">
          <button onClick={loadHistory} className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
            <RefreshCw size={11} />Refresh
          </button>
          {history.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <Activity size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No events yet — run a health check to start logging</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {history.map((e: any, i: number) => (
                <div key={e.id} className={`flex items-start gap-3 px-5 py-3.5 ${i < history.length-1 ? "border-b border-gray-100" : ""}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    e.status === "complete" || e.status === "passed" || e.status === "redeployed" ? "bg-green-500" :
                    e.status === "data_lost" || e.status === "alert_only" ? "bg-red-500" : "bg-orange-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">{e.type?.replace(/_/g," ")}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        e.fixed ? "bg-green-50 text-green-600" : e.status === "data_lost" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
                      }`}>{e.fixed ? "FIXED" : e.status}</span>
                    </div>
                    {e.details && <div className="text-xs text-gray-400 mt-0.5 truncate">{JSON.stringify(e.details).slice(0,80)}</div>}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1">
                    <Clock size={10} />{new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BACKUPS TAB ───────────────────────────────────────── */}
      {tab === "backups" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">A backup is created automatically before every fix. You can also backup manually.</p>
            <button onClick={createBackup}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              <Archive size={14} />Backup Now
            </button>
          </div>
          {backups.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <Archive size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No backups yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-4 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span>Date & Time</span><span>Trigger</span><span>Rows Saved</span><span>Status</span>
              </div>
              {backups.map((b: any, i: number) => {
                const totalRows = b.row_counts ? Object.values(b.row_counts).reduce((a: any, c: any) => a + c, 0) : 0;
                return (
                  <div key={b.id} className={`px-5 py-3.5 grid grid-cols-4 gap-2 items-center ${i < backups.length-1 ? "border-b border-gray-100" : ""}`}>
                    <span className="text-sm text-gray-700">{new Date(b.created_at).toLocaleString()}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${
                      b.trigger === "manual" ? "bg-blue-50 text-blue-600" :
                      b.trigger === "auto-fix" ? "bg-orange-50 text-orange-600" : "bg-gray-100 text-gray-500"
                    }`}>{b.trigger}</span>
                    <span className="text-sm font-mono text-gray-700">{totalRows.toLocaleString()} rows</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${b.status === "complete" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>{b.status}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <div className="font-semibold mb-1">How backups work</div>
            <ul className="space-y-1 text-blue-600">
              <li>• Every backup saves full row counts + complete data for all critical tables</li>
              <li>• Stored securely in your Supabase storage bucket</li>
              <li>• Before any auto-fix runs, a backup is always created first</li>
              <li>• After every fix, row counts are compared to verify nothing was lost</li>
              <li>• The nightly check at 2 AM also monitors and auto-fixes issues</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
