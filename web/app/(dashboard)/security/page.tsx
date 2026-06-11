"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, AlertTriangle, CheckCircle, Clock, User, Globe, RefreshCw, Filter } from "lucide-react";

const SEVERITY_META = {
  info:     { color:"#2563eb", bg:"#eff6ff", label:"Info"     },
  warning:  { color:"#d97706", bg:"#fef3c7", label:"Warning"  },
  critical: { color:"#dc2626", bg:"#fee2e2", label:"Critical" },
};

const ACTION_ICONS: Record<string,string> = {
  login:              "🔓",
  logout:             "🚪",
  login_failed:       "❌",
  user_invited:       "📧",
  user_approved:      "✅",
  user_rejected:      "🚫",
  user_role_changed:  "🔄",
  invite_revoked:     "✂️",
  project_created:    "🏗️",
  project_updated:    "✏️",
  project_deleted:    "🗑️",
  punch_item_created: "📋",
  punch_item_verified:"✅",
  file_uploaded:      "📎",
  budget_updated:     "💰",
  invoice_created:    "🧾",
  settings_changed:   "⚙️",
  rate_limit_hit:     "🚦",
  suspicious_activity:"🚨",
  system_init:        "🔧",
};

export default function SecurityPage() {
  const [logs, setLogs]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all"|"warning"|"critical">("all");
  const [search, setSearch]     = useState("");
  const [stats, setStats]       = useState({ total:0, warnings:0, critical:0, logins:0 });

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase.from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "warning")  q = q.eq("severity", "warning");
    if (filter === "critical") q = q.eq("severity", "critical");
    const { data } = await q;
    setLogs(data ?? []);

    // Stats
    const { data: all } = await supabase.from("audit_logs").select("severity, action");
    if (all) {
      setStats({
        total:    all.length,
        warnings: all.filter(l => l.severity === "warning").length,
        critical: all.filter(l => l.severity === "critical").length,
        logins:   all.filter(l => l.action === "login").length,
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const filtered = logs.filter(l =>
    !search ||
    l.action?.includes(search.toLowerCase()) ||
    l.ip_address?.includes(search) ||
    JSON.stringify(l.details)?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString() + " " + dt.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-orange-500" /> Security & Audit Log
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Every action in BuildOS is recorded here — who did what, when, from where.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:"Total Events",  value:stats.total,    color:"#2563eb", icon:"📊" },
          { label:"Logins",        value:stats.logins,   color:"#16a34a", icon:"🔓" },
          { label:"Warnings",      value:stats.warnings, color:"#d97706", icon:"⚠️" },
          { label:"Critical",      value:stats.critical, color:"#dc2626", icon:"🚨" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all","warning","critical"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                filter===f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {f==="all"?"All Events":f==="warning"?"⚠️ Warnings":"🚨 Critical"}
            </button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search by action, IP, details…"
          className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm" />
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="font-semibold text-sm text-gray-900">{filtered.length} events</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading audit log…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Shield size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-medium">No events yet</p>
            <p className="text-gray-400 text-xs mt-1">Actions will appear here as the system is used</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-x-auto">
            {filtered.map(log => {
              const sev = SEVERITY_META[log.severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.info;
              const icon = ACTION_ICONS[log.action] ?? "📌";
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="text-lg flex-shrink-0 mt-0.5">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{log.action?.replace(/_/g," ")}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background:sev.bg, color:sev.color }}>{sev.label}</span>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {JSON.stringify(log.details).replace(/[{}"]/g,"").replace(/,/g," · ").slice(0,120)}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {log.ip_address && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
                        <Globe size={10} />{log.ip_address}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-0.5">{fmt(log.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>🔒 Security note:</strong> Only Master Owner and Administrators can view this log. All events are write-once and cannot be edited or deleted. Logs are retained permanently.
      </div>
    </div>
  );
}
