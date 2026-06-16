"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, X, Edit2, MessageSquare, Mail, ChevronDown, ChevronUp, RefreshCw, CheckCheck, Trash2, FileText } from "lucide-react";
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

type DailyReportProject = { name: string; summary: string; task_count: number };
type DailyReport = {
  report_date: string;
  overall_summary: string;
  projects: DailyReportProject[];
  emails_scanned: number;
  tasks_created: number;
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

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles")
      .select("role, assigned_project_id").eq("id", user!.id).single();
    setRole(profile?.role ?? null);

    let query = supabase.from("punch_list_items")
      .select("*, projects(name)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    // Field workers only see job-site (WhatsApp) items for their assigned project.
    // Office staff only see office (email) items. Admins/owners see everything.
    if (profile?.role === "field") {
      query = query.eq("source", "whatsapp");
      if (profile.assigned_project_id) query = query.eq("project_id", profile.assigned_project_id);
    } else if (profile?.role === "office") {
      query = query.eq("source", "email");
    }

    const [{ data: pItems }, { data: pList }, reportRes] = await Promise.all([
      query,
      supabase.from("projects").select("id, name").order("name"),
      fetch("/api/daily-report"),
    ]);
    setItems(pItems ?? []);
    setProjects(pList ?? []);
    if (reportRes.ok) {
      const { report: r } = await reportRes.json();
      setReport(r ?? null);
    }
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

  // Group items by project
  const byProject: Record<string, any[]> = {};
  for (const item of items) {
    const pid = item.project_id ?? "unknown";
    if (!byProject[pid]) byProject[pid] = [];
    byProject[pid].push(item);
  }

  const totalCount = items.length;
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Daily Report Card */}
      {report && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setReportOpen(o => !o)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-blue-50 transition-colors"
          >
            <FileText size={18} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 text-sm">Today's Jobsite Activity</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">{report.overall_summary}</div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                📧 {report.emails_scanned} emails
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                ✅ {report.tasks_created} tasks
              </span>
              {reportOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
          </button>

          {reportOpen && (
            <div className="border-t border-blue-100 px-5 py-4 space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed">{report.overall_summary}</p>
              <div className="space-y-2">
                {report.projects.map((p, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-gray-800">{p.name}</span>
                      <span className="text-xs text-gray-600"> — {p.summary}</span>
                      {p.task_count > 0 && (
                        <span className="ml-2 text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                          {p.task_count} task{p.task_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 pt-1">Generated by nightly scan · {report.report_date}</p>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📋 Daily Review Queue</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {today} · {
              role === "field" ? "Job-site items from WhatsApp waiting for your approval" :
              role === "office" ? "Office items from email waiting for your approval" :
              "All items from WhatsApp & email scans waiting for your approval"
            }
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all flex-shrink-0">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh
        </button>
      </div>

      {/* All clear / Approve All */}
      {!loading && totalCount > 0 && (
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

      {!loading && totalCount === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">All clear — nothing to review</p>
          <p className="text-sm text-gray-400 mt-1">New items from WhatsApp & email will appear here after the 7 PM scan</p>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading…</div>
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
                          {/* Title — editable */}
                          {isEditing ? (
                            <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                              className="w-full bg-white border border-orange-400 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-orange-500 shadow-sm"
                              onKeyDown={e => { if (e.key === "Enter") approve(item.id, editVal); if (e.key === "Escape") setEditing(null); }} />
                          ) : (
                            <p className="text-sm font-medium text-gray-900">{item.title}</p>
                          )}

                          {/* Meta row */}
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

                          {/* Blocker badge */}
                          {item.blocked_by && (
                            <div className="mt-2 px-2.5 py-1.5 bg-orange-50 rounded-lg border border-orange-200 flex items-center gap-2">
                              <span className="text-sm">⏳</span>
                              <p className="text-[11px] text-orange-700 font-medium">Waiting for: <strong>{item.blocked_by}</strong></p>
                            </div>
                          )}

                          {/* Original message */}
                          {item.source_message && (
                            <div className="mt-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                              <p className="text-[11px] text-gray-500 italic">"{item.source_message}"</p>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
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

      {/* Help footer */}
      {totalCount > 0 && (
        <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
          ✅ <strong>Approve</strong> = item goes live on the punch list for the crew &nbsp;·&nbsp;
          ✏️ <strong>Edit</strong> = fix the wording first &nbsp;·&nbsp;
          🗑️ <strong>Remove</strong> = not a real task, delete it
        </div>
      )}
    </div>
  );
}
