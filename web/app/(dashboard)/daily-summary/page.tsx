"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, X, Edit2, MessageSquare, Mail, ChevronDown, ChevronUp, RefreshCw, CheckCheck, Trash2, FileText, AlertTriangle, Clock, Phone } from "lucide-react";
import { WAITING_ON_META } from "@/lib/waitingOn";

const SOURCE_META: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  whatsapp: { icon: "📱", color: "#16a34a", bg: "#f0fdf4", label: "WhatsApp" },
  email:    { icon: "📧", color: "#2563eb", bg: "#eff6ff", label: "Email"    },
  manual:   { icon: "✏️", color: "#6b7280", bg: "#f9fafb", label: "Manual"  },
};
const PRIORITY_COLOR: Record<string, { c: string; b: string }> = {
  low:       { c:"#16a34a", b:"#dcfce7" },
  medium:    { c:"#d97706", b:"#fef3c7" },
  high:      { c:"#f97316", b:"#fff7ed" },
  fire_code: { c:"#dc2626", b:"#fee2e2" },
};

type DailyReportProject = { name: string; summary: string; task_count: number; whatsapp_count: number; email_count: number };
type DailyReport = {
  report_date: string;
  overall_summary: string;
  projects: DailyReportProject[];
  emails_scanned: number;
  tasks_created: number;
  whatsapp_count: number;
  email_count: number;
  completed_count: number;
  blocker_count: number;
  incident_count: number;
};

type SiteData = {
  name: string;
  projectId: string;
  whatsappItems: any[];
  emailItems: any[];
  completedToday: any[];
  blockers: any[];
  incidents: any[];
  aiSummary?: string;
};

export default function DailySummaryPage() {
  const [items, setItems]           = useState<any[]>([]);
  const [projects, setProjects]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<string | null>(null);
  const [editVal, setEditVal]       = useState("");
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({});
  const [busy, setBusy]             = useState<string | null>(null);
  const [role, setRole]             = useState<string | null>(null);
  const [report, setReport]         = useState<DailyReport | null>(null);
  const [reportOpen, setReportOpen] = useState(true);
  const [sites, setSites]           = useState<SiteData[]>([]);
  const [siteCollapsed, setSiteCollapsed] = useState<Record<string, boolean>>({});
  const [tab, setTab]               = useState<"report" | "queue">("report");

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles")
      .select("role, assigned_project_id").eq("id", user!.id).single();
    setRole(profile?.role ?? null);

    // Today boundaries in ET (approximate: use 5 AM UTC as ET midnight)
    const now = new Date();
    const etDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const dayStartUTC = new Date(`${etDateStr}T05:00:00.000Z`).toISOString();
    const dayEndUTC   = new Date(new Date(`${etDateStr}T05:00:00.000Z`).getTime() + 24*60*60*1000 - 1).toISOString();

    let query = supabase.from("punch_list_items")
      .select("*, projects(name)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    if (profile?.role === "field") {
      query = query.eq("source", "whatsapp");
      if (profile.assigned_project_id) query = query.eq("project_id", profile.assigned_project_id);
    } else if (profile?.role === "office") {
      query = query.eq("source", "email");
    }

    const [{ data: pItems }, { data: pList }, reportRes, { data: todayItems }, { data: completedToday }, { data: blockers }, { data: incidents }] = await Promise.all([
      query,
      supabase.from("projects").select("id, name").order("name"),
      fetch("/api/daily-report"),
      // All items created today (any status)
      supabase.from("punch_list_items")
        .select("*, projects(name)")
        .gte("created_at", dayStartUTC)
        .lte("created_at", dayEndUTC)
        .order("created_at", { ascending: false }),
      // Completed today
      supabase.from("punch_list_items")
        .select("title, projects(name), project_id, updated_at")
        .eq("status", "completed")
        .gte("updated_at", dayStartUTC)
        .lte("updated_at", dayEndUTC),
      // All open blockers
      supabase.from("punch_list_items")
        .select("title, blocked_by, waiting_on, projects(name), project_id")
        .eq("status", "open")
        .not("blocked_by", "is", null),
      // Safety incidents today
      supabase.from("safety_incidents")
        .select("type, severity, description, project_id, projects(name)")
        .gte("created_at", dayStartUTC)
        .lte("created_at", dayEndUTC),
    ]);

    setItems(pItems ?? []);
    setProjects(pList ?? []);

    let reportData: DailyReport | null = null;
    if (reportRes.ok) {
      const { report: r } = await reportRes.json();
      reportData = r ?? null;
      setReport(reportData);
    }

    // Build live site-by-site data
    const siteMap: Record<string, SiteData> = {};
    for (const p of (pList ?? [])) {
      siteMap[p.id] = { name: p.name, projectId: p.id, whatsappItems: [], emailItems: [], completedToday: [], blockers: [], incidents: [] };
    }
    for (const item of (todayItems ?? [])) {
      const pid = item.project_id;
      if (!pid || !siteMap[pid]) continue;
      if (item.source === "whatsapp") siteMap[pid].whatsappItems.push(item);
      else if (item.source === "email") siteMap[pid].emailItems.push(item);
    }
    for (const item of (completedToday ?? [])) {
      const pid = (item as any).project_id;
      if (pid && siteMap[pid]) siteMap[pid].completedToday.push(item);
    }
    for (const item of (blockers ?? [])) {
      const pid = (item as any).project_id;
      if (pid && siteMap[pid]) siteMap[pid].blockers.push(item);
    }
    for (const item of (incidents ?? [])) {
      const pid = (item as any).project_id;
      if (pid && siteMap[pid]) siteMap[pid].incidents.push(item);
    }

    // Merge AI summaries from nightly report
    if (reportData?.projects) {
      for (const rp of reportData.projects) {
        const match = Object.values(siteMap).find(s => s.name === rp.name);
        if (match) match.aiSummary = rp.summary;
      }
    }

    // Only include sites that have any activity
    const activeSites = Object.values(siteMap).filter(s =>
      s.whatsappItems.length > 0 || s.emailItems.length > 0 || s.completedToday.length > 0 || s.blockers.length > 0 || s.incidents.length > 0
    );
    activeSites.sort((a, b) => {
      const aTotal = a.whatsappItems.length + a.emailItems.length + a.blockers.length + a.incidents.length;
      const bTotal = b.whatsappItems.length + b.emailItems.length + b.blockers.length + b.incidents.length;
      return bTotal - aTotal;
    });
    setSites(activeSites);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const call = async (action: string, extra: Record<string, string> = {}) => {
    const res = await fetch("/api/daily-summary", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    return res.ok;
  };

  const approve = async (id: string, newTitle?: string) => {
    setBusy(id);
    await call("approve", { itemId: id, ...(newTitle ? { newTitle } : {}) });
    setItems(prev => prev.filter(i => i.id !== id));
    setBusy(null); setEditing(null);
  };

  const reject = async (id: string) => {
    if (!confirm("Remove this item? It won't be added to the punch list.")) return;
    setBusy(id);
    await call("reject", { itemId: id });
    setItems(prev => prev.filter(i => i.id !== id));
    setBusy(null);
  };

  const approveAll = async (projectId?: string) => {
    setBusy(projectId ?? "all");
    await call("approve_all", projectId ? { projectId } : {});
    setItems(prev => projectId ? prev.filter(i => i.project_id !== projectId) : []);
    setBusy(null);
  };

  // Group pending items by project
  const byProject: Record<string, any[]> = {};
  for (const item of items) {
    const pid = item.project_id ?? "unknown";
    if (!byProject[pid]) byProject[pid] = [];
    byProject[pid].push(item);
  }

  const totalCount = items.length;
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", timeZone:"America/New_York" });

  const totalWA    = sites.reduce((s, site) => s + site.whatsappItems.length, 0);
  const totalEmail = sites.reduce((s, site) => s + site.emailItems.length, 0);
  const totalDone  = sites.reduce((s, site) => s + site.completedToday.length, 0);
  const totalBlock = sites.reduce((s, site) => s + site.blockers.length, 0);
  const totalIncident = sites.reduce((s, site) => s + site.incidents.length, 0);

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📋 Daily Review</h1>
          <p className="text-gray-500 text-sm mt-0.5">{today}</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all flex-shrink-0">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setTab("report")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all ${tab === "report" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          📊 Full Report
        </button>
        <button onClick={() => setTab("queue")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all ${tab === "queue" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          ✅ Approval Queue {totalCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700">{totalCount}</span>}
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading…</div>
      )}

      {/* ═══════════ FULL REPORT TAB ═══════════ */}
      {!loading && tab === "report" && (
        <div className="space-y-4">

          {/* Overall summary from AI (if available) */}
          {report?.overall_summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
              <p className="text-sm text-blue-900 leading-relaxed">{report.overall_summary}</p>
              <p className="text-[10px] text-blue-400 mt-2">AI summary from nightly scan · {report.report_date}</p>
            </div>
          )}

          {/* Stat boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatBox label="Sites Active" value={sites.length} icon="🏗️" />
            <StatBox label="WhatsApp" value={totalWA} icon="📱" color="green" />
            <StatBox label="Email" value={totalEmail} icon="📧" color="blue" />
            <StatBox label="Completed" value={totalDone} icon="✅" color="emerald" />
            <StatBox label="Blockers" value={totalBlock} icon="⏳" color={totalBlock > 0 ? "orange" : undefined} />
          </div>

          {totalIncident > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm font-semibold text-red-700">🚨 {totalIncident} safety incident{totalIncident !== 1 ? "s" : ""} reported today</span>
            </div>
          )}

          {sites.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
              <FileText size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No activity today yet</p>
              <p className="text-sm text-gray-400 mt-1">Items from WhatsApp & email will show up here as they come in</p>
            </div>
          )}

          {/* Per-site breakdown */}
          {sites.map(site => {
            const isOpen = !siteCollapsed[site.projectId];
            const itemCount = site.whatsappItems.length + site.emailItems.length;
            return (
              <div key={site.projectId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setSiteCollapsed(c => ({ ...c, [site.projectId]: !c[site.projectId] }))}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900">{site.name}</div>
                    {site.aiSummary && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{site.aiSummary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {site.whatsappItems.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">📱 {site.whatsappItems.length}</span>
                    )}
                    {site.emailItems.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">📧 {site.emailItems.length}</span>
                    )}
                    {site.completedToday.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✅ {site.completedToday.length}</span>
                    )}
                    {site.blockers.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">⏳ {site.blockers.length}</span>
                    )}
                    {site.incidents.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">🚨 {site.incidents.length}</span>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {/* AI narrative — the main thing */}
                    {site.aiSummary && (
                      <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">
                        <p className="text-sm text-gray-800 leading-relaxed">{site.aiSummary}</p>
                      </div>
                    )}

                    {/* WhatsApp items */}
                    {site.whatsappItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1">📱 WhatsApp ({site.whatsappItems.length})</h4>
                        <div className="space-y-1.5">
                          {site.whatsappItems.map(item => (
                            <ItemRow key={item.id} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Email items */}
                    {site.emailItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">📧 Email ({site.emailItems.length})</h4>
                        <div className="space-y-1.5">
                          {site.emailItems.map(item => (
                            <ItemRow key={item.id} item={item} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed today */}
                    {site.completedToday.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-emerald-700 mb-2">✅ Completed Today ({site.completedToday.length})</h4>
                        <div className="space-y-1">
                          {site.completedToday.map((item: any, i: number) => (
                            <p key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-emerald-200">{item.title}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Blockers */}
                    {site.blockers.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-orange-700 mb-2">⏳ Open Blockers ({site.blockers.length})</h4>
                        <div className="space-y-1.5">
                          {site.blockers.map((item: any, i: number) => (
                            <div key={i} className="bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                              <p className="text-xs font-medium text-gray-900">{item.title}</p>
                              <p className="text-[11px] text-orange-600 mt-0.5">Waiting for: <strong>{item.blocked_by}</strong></p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Safety incidents */}
                    {site.incidents.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-red-700 mb-2">🚨 Safety Incidents ({site.incidents.length})</h4>
                        <div className="space-y-1.5">
                          {site.incidents.map((item: any, i: number) => (
                            <div key={i} className="bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                              <p className="text-xs font-medium text-red-900">[{item.severity}] {item.type}</p>
                              {item.description && <p className="text-[11px] text-red-600 mt-0.5">{item.description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No detailed items — just counts from report */}
                    {site.whatsappItems.length === 0 && site.emailItems.length === 0 && site.completedToday.length === 0 && site.blockers.length === 0 && site.incidents.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No detailed activity to show</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ APPROVAL QUEUE TAB ═══════════ */}
      {!loading && tab === "queue" && (
        <div className="space-y-4">

          {/* All clear / Approve All */}
          {totalCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-amber-800 text-sm">{totalCount} item{totalCount !== 1 ? "s" : ""} waiting for your review</div>
                <div className="text-xs text-amber-600 mt-0.5">Review each item below, or approve everything at once</div>
              </div>
              <button onClick={() => approveAll()} disabled={busy === "all"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm flex-shrink-0 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                <CheckCheck size={15} />{busy === "all" ? "Approving…" : "Approve All Sites"}
              </button>
            </div>
          )}

          {totalCount === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">All clear — nothing to review</p>
              <p className="text-sm text-gray-400 mt-1">New items from WhatsApp & email will appear here after the 7 PM scan</p>
            </div>
          )}

          {/* Per-project sections */}
          {Object.entries(byProject).map(([projectId, projectItems]) => {
            const projName = projectItems[0]?.projects?.name ?? "Unknown Project";
            const isCollapsed = collapsed[projectId];
            const whatsappCount = projectItems.filter(i => i.source === "whatsapp").length;
            const emailCount    = projectItems.filter(i => i.source === "email").length;

            return (
              <div key={projectId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Project header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900">{projName}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{projectItems.length} item{projectItems.length !== 1 ? "s" : ""}</span>
                      {whatsappCount > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">📱 {whatsappCount} WhatsApp</span>}
                      {emailCount    > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">📧 {emailCount} Email</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => approveAll(projectId)} disabled={busy === projectId}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-all shadow-sm">
                      <CheckCheck size={12} />{busy === projectId ? "…" : "Approve Site"}
                    </button>
                    <button onClick={() => setCollapsed(c => ({ ...c, [projectId]: !c[projectId] }))}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all">
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>

                {/* Items */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {projectItems.map(item => {
                      const src  = SOURCE_META[item.source ?? "manual"] ?? SOURCE_META.manual;
                      const pri  = PRIORITY_COLOR[item.priority ?? "medium"] ?? PRIORITY_COLOR.medium;
                      const isEditing = editing === item.id;
                      const isBusy    = busy === item.id;

                      return (
                        <div key={item.id} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0 mt-0.5">{src.icon}</span>
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                                  className="w-full bg-white border border-orange-400 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-orange-500 shadow-sm"
                                  onKeyDown={e => { if (e.key === "Enter") approve(item.id, editVal); if (e.key === "Escape") setEditing(null); }} />
                              ) : (
                                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                              )}

                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: src.bg, color: src.color }}>{src.label}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: pri.b, color: pri.c }}>{item.priority}</span>
                                {item.waiting_on && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: WAITING_ON_META[item.waiting_on as keyof typeof WAITING_ON_META]?.bg, color: WAITING_ON_META[item.waiting_on as keyof typeof WAITING_ON_META]?.color }}>
                                    ⏳ {WAITING_ON_META[item.waiting_on as keyof typeof WAITING_ON_META]?.label ?? item.waiting_on}
                                  </span>
                                )}
                                {item.assigned_to && <span className="text-[10px] text-gray-400">👤 {item.assigned_to}</span>}
                              </div>

                              {item.blocked_by && (
                                <div className="mt-2 px-2.5 py-1.5 bg-orange-50 rounded-lg border border-orange-200 flex items-center gap-2">
                                  <span className="text-sm">⏳</span>
                                  <p className="text-[11px] text-orange-700 font-medium">Waiting for: <strong>{item.blocked_by}</strong></p>
                                </div>
                              )}

                              {item.source_message && (
                                <div className="mt-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                  <p className="text-[11px] text-gray-500 italic">"{item.source_message}"</p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isEditing ? (
                                <>
                                  <button onClick={() => approve(item.id, editVal)} disabled={isBusy}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-green-500 hover:bg-green-600 transition-all shadow-sm">
                                    Save ✓
                                  </button>
                                  <button onClick={() => setEditing(null)} className="px-2 py-1.5 rounded-lg text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200">
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => approve(item.id)} disabled={isBusy}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-all shadow-sm"
                                    title="Approve — add to punch list">
                                    <CheckCircle size={12} />{isBusy ? "…" : "✓"}
                                  </button>
                                  <button onClick={() => { setEditing(item.id); setEditVal(item.title); }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all"
                                    title="Edit before approving">
                                    <Edit2 size={12} />Edit
                                  </button>
                                  <button onClick={() => reject(item.id)} disabled={isBusy}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-all"
                                    title="Remove — don't add to punch list">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {totalCount > 0 && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
              ✅ <strong>Approve</strong> = item goes live on the punch list for the crew &nbsp;·&nbsp;
              ✏️ <strong>Edit</strong> = fix the wording first &nbsp;·&nbsp;
              🗑️ <strong>Remove</strong> = not a real task, delete it
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon, color }: { label: string; value: number; icon: string; color?: string }) {
  const bg = color === "green" ? "bg-green-50 border-green-200" :
             color === "blue" ? "bg-blue-50 border-blue-200" :
             color === "emerald" ? "bg-emerald-50 border-emerald-200" :
             color === "orange" ? "bg-orange-50 border-orange-200" :
             "bg-gray-50 border-gray-200";
  const text = color === "green" ? "text-green-700" :
               color === "blue" ? "text-blue-700" :
               color === "emerald" ? "text-emerald-700" :
               color === "orange" ? "text-orange-700" :
               "text-gray-700";
  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${bg}`}>
      <div className="text-lg">{icon}</div>
      <div className={`text-xl font-bold ${text}`}>{value}</div>
      <div className="text-[10px] font-semibold text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function ItemRow({ item }: { item: any }) {
  const pri = PRIORITY_COLOR[item.priority ?? "medium"] ?? PRIORITY_COLOR.medium;
  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900">{item.title}</p>
        {item.source_message && (
          <p className="text-[11px] text-gray-400 italic mt-0.5 line-clamp-1">"{item.source_message}"</p>
        )}
      </div>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: pri.b, color: pri.c }}>
        {item.priority}
      </span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0">
        {item.status === "pending_review" ? "pending" : item.status}
      </span>
    </div>
  );
}
