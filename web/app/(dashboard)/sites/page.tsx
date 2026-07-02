import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Milestone, ClipboardList, Hourglass, ShieldAlert, ArrowUpRight, CalendarDays } from "lucide-react";
import { WAITING_ON_META } from "@/lib/waitingOn";

export const dynamic = "force-dynamic";

const fmtMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toLocaleString()}`;
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: "#16a34a", bg: "#dcfce7", label: "Active" },
  completed: { color: "#2563eb", bg: "#dbeafe", label: "Completed" },
  on_hold:   { color: "#d97706", bg: "#fef3c7", label: "On Hold" },
  at_risk:   { color: "#dc2626", bg: "#fee2e2", label: "At Risk" },
  cancelled: { color: "#9ca3af", bg: "#f3f4f6", label: "Cancelled" },
};

export default async function SitesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: projects }, { data: milestones }, { data: punch }, { data: incidents },
    { data: wRfis }, { data: wSubs }, { data: wCos }, preconRes,
  ] = await Promise.all([
    supabase.from("projects").select("*").neq("status", "cancelled").order("created_at"),
    supabase.from("milestones").select("id,project_id,title,due_date,critical").eq("completed", false).order("due_date"),
    supabase.from("punch_list_items").select("id,project_id,status,waiting_on,blocked_by,title,created_at").in("status", ["open", "in_progress"]),
    supabase.from("safety_incidents").select("id,project_id").eq("status", "Open"),
    supabase.from("rfis").select("id,project_id,title,waiting_on,created_at").not("waiting_on", "is", null).neq("status", "Closed"),
    supabase.from("submittals").select("id,project_id,title,waiting_on,created_at").not("waiting_on", "is", null).in("status", ["pending", "under_review"]),
    supabase.from("change_orders").select("id,project_id,title,waiting_on,created_at").not("waiting_on", "is", null).eq("status", "submitted"),
    supabase.from("precon_stages").select("*").order("sort_order"),
  ]);
  // precon table may not exist yet — treat as empty
  const precon = preconRes.error ? [] : (preconRes.data ?? []);

  const sites = (projects ?? []).map(p => {
    const ms = (milestones ?? []).filter(m => m.project_id === p.id);
    const pn = (punch ?? []).filter(i => i.project_id === p.id);
    const waiting = [
      ...(wRfis ?? []).filter(i => i.project_id === p.id).map(i => ({ ...i, type: "RFI", href: "/rfis" })),
      ...(wSubs ?? []).filter(i => i.project_id === p.id).map(i => ({ ...i, type: "Submittal", href: "/submittals" })),
      ...(wCos ?? []).filter(i => i.project_id === p.id).map(i => ({ ...i, type: "CO", href: "/change-orders" })),
      ...pn.filter(i => i.waiting_on).map(i => ({ ...i, type: "Punch", href: "/punch-list" })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const ps = precon.filter(s => s.project_id === p.id);
    const preconCurrent = ps.find(s => s.status !== "done" && s.status !== "na") ?? null;
    const preconDone = ps.length > 0 && !preconCurrent;
    return {
      ...p, ms, pn, waiting, preconCurrent, preconDone, preconCount: ps.length,
      blockedCount: pn.filter(i => i.blocked_by).length,
      incidentCount: (incidents ?? []).filter(i => i.project_id === p.id).length,
    };
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Site Command</h1>
        <p className="text-gray-500 text-sm mt-0.5">Every site at a glance — progress, schedule, blockers, and whose court the ball is in</p>
      </div>

      {sites.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">No projects yet</div>
      )}

      {sites.map(s => {
        const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.active;
        const budgetPct = s.budget > 0 ? Math.round((s.spent ?? 0) / s.budget * 100) : 0;
        const overdue = s.ms.filter((m: any) => m.due_date && new Date(m.due_date) < today);
        return (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header row */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: st.color }} />
                <div className="min-w-0">
                  <Link href={`/projects/${s.id}`} className="font-bold text-gray-900 hover:text-orange-600 transition-colors flex items-center gap-1">
                    {s.name}<ArrowUpRight size={13} className="text-gray-300" />
                  </Link>
                  <div className="text-xs text-gray-400 truncate">{s.phase ?? "—"} · {s.address ?? ""}</div>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              {s.incidentCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 flex items-center gap-1"><ShieldAlert size={11} />{s.incidentCount} safety</span>
              )}
              {/* Progress */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.progress ?? 0}%`, background: st.color }} />
                </div>
                <span className="text-sm font-bold" style={{ color: st.color }}>{s.progress ?? 0}%</span>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">
                {fmtMoney(s.spent ?? 0)} / {fmtMoney(s.budget ?? 0)} <span className={budgetPct > 100 ? "text-red-500 font-bold" : ""}>({budgetPct}%)</span>
              </div>
            </div>

            {/* Pre-con banner if in pre-con */}
            {s.preconCurrent && (
              <div className="px-5 py-2 bg-purple-50 border-b border-purple-100 flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-purple-700">PRE-CON:</span>
                <span className="text-purple-700">{s.preconCurrent.stage}</span>
                {s.preconCurrent.status === "waiting" && s.preconCurrent.waiting_on && (
                  <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: WAITING_ON_META[s.preconCurrent.waiting_on as keyof typeof WAITING_ON_META]?.bg, color: WAITING_ON_META[s.preconCurrent.waiting_on as keyof typeof WAITING_ON_META]?.color }}>
                    ⏳ {WAITING_ON_META[s.preconCurrent.waiting_on as keyof typeof WAITING_ON_META]?.label}
                  </span>
                )}
                {s.preconCurrent.waiting_for && <span className="text-purple-600">— {s.preconCurrent.waiting_for}</span>}
                <Link href="/precon" className="ml-auto text-purple-500 font-semibold hover:text-purple-700">Open Pre-Con →</Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {/* Schedule: next milestones */}
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  <Milestone size={13} />Schedule {overdue.length > 0 && <span className="text-red-500 normal-case">· {overdue.length} overdue</span>}
                </div>
                {s.ms.length === 0 ? (
                  <div className="text-xs text-gray-300 py-2">No open milestones</div>
                ) : s.ms.slice(0, 4).map((m: any) => {
                  const late = m.due_date && new Date(m.due_date) < today;
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span className="text-gray-700 truncate">{m.critical ? "🔴 " : ""}{m.title}</span>
                      <span className={`text-xs flex-shrink-0 flex items-center gap-1 ${late ? "text-red-500 font-bold" : "text-gray-400"}`}>
                        <CalendarDays size={11} />{m.due_date ? new Date(m.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Whose court is the ball in */}
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  <Hourglass size={13} />Waiting On
                </div>
                {s.waiting.length === 0 ? (
                  <div className="text-xs text-gray-300 py-2">Ball&apos;s in our court 🎉</div>
                ) : s.waiting.slice(0, 4).map((w: any) => {
                  const meta = WAITING_ON_META[w.waiting_on as keyof typeof WAITING_ON_META];
                  return (
                    <Link key={`${w.type}-${w.id}`} href={w.href} className="flex items-center justify-between gap-2 py-1 text-sm hover:bg-gray-50 rounded px-1 -mx-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{w.type}</span>
                        <span className="text-gray-700 truncate">{w.title}</span>
                      </span>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        {meta && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>}
                        <span className={`text-xs ${daysAgo(w.created_at) >= 5 ? "text-red-500 font-bold" : "text-gray-400"}`}>{daysAgo(w.created_at)}d</span>
                      </span>
                    </Link>
                  );
                })}
                {s.waiting.length > 4 && <div className="text-xs text-gray-400 pt-1">+{s.waiting.length - 4} more…</div>}
              </div>

              {/* Punch list summary */}
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  <ClipboardList size={13} />Punch List
                </div>
                <div className="flex gap-4 py-1">
                  <div>
                    <div className="text-xl font-black text-gray-900">{s.pn.length}</div>
                    <div className="text-[10px] text-gray-400 uppercase">open</div>
                  </div>
                  <div>
                    <div className={`text-xl font-black ${s.blockedCount > 0 ? "text-orange-500" : "text-gray-300"}`}>{s.blockedCount}</div>
                    <div className="text-[10px] text-gray-400 uppercase">blocked</div>
                  </div>
                  <div>
                    <div className={`text-xl font-black ${overdue.length > 0 ? "text-red-500" : "text-gray-300"}`}>{overdue.length}</div>
                    <div className="text-[10px] text-gray-400 uppercase">overdue</div>
                  </div>
                </div>
                <Link href={`/projects/${s.id}/punch-list`} className="text-xs text-orange-500 font-semibold hover:text-orange-600">View punch list →</Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
