"use client";
import { useState } from "react";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Clock, Database, Globe, Zap, Server } from "lucide-react";

type Status = "idle" | "checking" | "done";

export default function SystemHealthPage() {
  const [status, setStatus]   = useState<Status>("idle");
  const [results, setResults] = useState<any>(null);
  const [error, setError]     = useState("");

  const runCheck = async () => {
    setStatus("checking"); setError(""); setResults(null);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.error) { setError(data.error); setStatus("idle"); return; }
      setResults(data);
    } catch (e: any) { setError(e.message); }
    setStatus("done");
  };

  const Icon = ({ ok, size = 16 }: { ok: boolean | null; size?: number }) =>
    ok === null ? <AlertCircle size={size} className="text-gray-400" /> :
    ok ? <CheckCircle size={size} className="text-green-500" /> :
    <XCircle size={size} className="text-red-500" />;

  const Badge = ({ ok, label }: { ok: boolean | null; label?: string }) => (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
      ok === null ? "bg-gray-100 text-gray-500" :
      ok ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
    }`}>{label ?? (ok ? "OK" : "FAIL")}</span>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 text-sm mt-0.5">Check all pages, database tables and APIs in one click</p>
        </div>
        <button onClick={runCheck} disabled={status === "checking"}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-60 flex-shrink-0"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <RefreshCw size={14} className={status === "checking" ? "animate-spin" : ""} />
          {status === "checking" ? "Checking…" : "Run Check"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{error}</div>
      )}

      {/* Idle state */}
      {status === "idle" && !results && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Server size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Click "Run Check" to test everything</p>
          <p className="text-gray-400 text-sm mt-1">Checks {16} pages · 13 database tables · AI + deployment</p>
        </div>
      )}

      {/* Checking animation */}
      {status === "checking" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <div className="flex justify-center gap-2 mb-4">
            {["Pages","Database","APIs","Deployment"].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-orange-100 animate-pulse flex items-center justify-center" style={{ animationDelay:`${i*200}ms` }}>
                  {i===0 ? <Globe size={14} className="text-orange-500" /> :
                   i===1 ? <Database size={14} className="text-orange-500" /> :
                   i===2 ? <Zap size={14} className="text-orange-500" /> :
                   <Server size={14} className="text-orange-500" />}
                </div>
                <span className="text-[10px] text-gray-400">{s}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm font-medium">Running checks… takes about 15 seconds</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div className={`rounded-xl border p-5 flex items-center gap-4 ${results.summary.healthy ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <Icon ok={results.summary.healthy} size={28} />
            <div className="flex-1">
              <div className={`font-bold text-base ${results.summary.healthy ? "text-green-700" : "text-red-700"}`}>
                {results.summary.healthy ? "✓ All systems healthy" : `⚠ Issues detected`}
              </div>
              <div className="text-sm mt-0.5" style={{ color: results.summary.healthy ? "#15803d" : "#b91c1c" }}>
                {results.summary.pagesFailing > 0 && `${results.summary.pagesFailing} page${results.summary.pagesFailing !== 1 ? "s" : ""} failing · `}
                {results.summary.tablesFailing > 0 && `${results.summary.tablesFailing} database table${results.summary.tablesFailing !== 1 ? "s" : ""} failing · `}
                Checked at {new Date(results.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Pages */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Globe size={15} className="text-orange-500" />
              <span className="font-semibold text-sm text-gray-900">Pages</span>
              <span className="text-xs text-gray-400 ml-1">
                {Object.values(results.pages).filter((p: any) => p.ok).length}/{Object.keys(results.pages).length} OK
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {Object.entries(results.pages).map(([page, data]: [string, any]) => (
                <div key={page} className={`flex items-center gap-3 px-5 py-2.5 ${!data.ok ? "bg-red-50" : ""}`}>
                  <Icon ok={data.ok} />
                  <span className="flex-1 text-sm font-mono text-gray-700">{page}</span>
                  <span className="text-xs text-gray-400">{data.ms}ms</span>
                  <Badge ok={data.ok} label={data.status ? String(data.status) : undefined} />
                </div>
              ))}
            </div>
          </div>

          {/* Database */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Database size={15} className="text-orange-500" />
              <span className="font-semibold text-sm text-gray-900">Database Tables</span>
              <span className="text-xs text-gray-400 ml-1">
                {Object.values(results.database).filter((d: any) => d.ok).length}/{Object.keys(results.database).length} OK
              </span>
            </div>
            <div className="grid grid-cols-2 divide-y divide-gray-100">
              {Object.entries(results.database).map(([table, data]: [string, any]) => (
                <div key={table} className={`flex items-center gap-3 px-5 py-2.5 ${!data.ok ? "bg-red-50" : ""}`}>
                  <Icon ok={data.ok} />
                  <span className="flex-1 text-sm font-mono text-gray-700 truncate">{table}</span>
                  <span className="text-xs text-gray-400">{data.ms}ms</span>
                </div>
              ))}
            </div>
          </div>

          {/* APIs + Deployment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={15} className="text-orange-500" />
                <span className="font-semibold text-sm text-gray-900">AI API</span>
              </div>
              <div className="flex items-center gap-3">
                <Icon ok={results.apis.ai_chat?.ok} />
                <div>
                  <div className="text-sm font-medium text-gray-700">Chat endpoint</div>
                  <div className="text-xs text-gray-400">{results.apis.ai_chat?.ms ? `${results.apis.ai_chat.ms}ms` : results.apis.ai_chat?.error}</div>
                </div>
                <Badge ok={results.apis.ai_chat?.ok} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Server size={15} className="text-orange-500" />
                <span className="font-semibold text-sm text-gray-900">Deployment</span>
              </div>
              {results.deployment.ok === null ? (
                <p className="text-xs text-gray-400">{results.deployment.error}</p>
              ) : (
                <div className="flex items-center gap-3">
                  <Icon ok={results.deployment.ok} />
                  <div>
                    <div className="text-sm font-medium text-gray-700">{results.deployment.state}</div>
                    {results.deployment.createdAt && (
                      <div className="text-xs text-gray-400">
                        {Math.round((Date.now() - new Date(results.deployment.createdAt).getTime()) / 3600000)}h ago
                      </div>
                    )}
                  </div>
                  <Badge ok={results.deployment.ok} />
                </div>
              )}
            </div>
          </div>

          {/* What to do if errors */}
          {!results.summary.healthy && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <div className="font-semibold text-orange-800 text-sm mb-2">What to do</div>
              <ul className="space-y-1 text-sm text-orange-700">
                <li>• If pages are failing → hard refresh (Ctrl+Shift+R) and try again</li>
                <li>• If database tables failing → likely a Supabase issue, check supabase.com/dashboard</li>
                <li>• If AI failing → check Anthropic credits at console.anthropic.com</li>
                <li>• For any other issue → mention it to me and I'll fix it</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
