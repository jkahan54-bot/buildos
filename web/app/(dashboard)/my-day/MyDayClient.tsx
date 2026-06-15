"use client";
import Link from "next/link";
import { Clock, ClipboardList, ShieldAlert, Camera, CalendarCheck, ArrowUpRight, CheckCircle2 } from "lucide-react";

const PRIORITY_STYLE: Record<string,string> = { high:"bg-red-50 text-red-600", medium:"bg-yellow-50 text-yellow-600", low:"bg-gray-100 text-gray-500" };

export default function MyDayClient({ profile, project, currentEntry, todayLogDone, punchItems, openIncidents }: any) {
  const name = profile?.full_name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Good {greeting}, {name} 👋</h1>
        <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" })}</p>
      </div>

      {/* Clock status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: currentEntry ? "#dcfce7" : "#fff7ed" }}>
            <Clock size={18} style={{ color: currentEntry ? "#16a34a" : "#f97316" }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-900">{currentEntry ? "Clocked in" : "Not clocked in"}</div>
            <div className="text-xs text-gray-400 truncate">
              {currentEntry ? `Since ${new Date(currentEntry.clock_in).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}` : "Tap Time Log to start your day"}
            </div>
          </div>
        </div>
        <Link href="/timelog" className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 flex-shrink-0">Time Log <ArrowUpRight size={12} /></Link>
      </div>

      {/* Today's site */}
      {project && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Today's Site</div>
          <div className="font-bold text-lg text-gray-900">{project.name}</div>
          <div className="text-sm text-gray-500 mt-0.5">{project.phase ?? "—"} · {project.progress ?? 0}% complete</div>
        </div>
      )}

      {/* Daily log status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: todayLogDone ? "#dcfce7" : "#fef3c7" }}>
            {todayLogDone ? <CheckCircle2 size={18} style={{ color:"#16a34a" }} /> : <CalendarCheck size={18} style={{ color:"#d97706" }} />}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-900">{todayLogDone ? "Daily log submitted" : "Daily log not yet submitted"}</div>
            <div className="text-xs text-gray-400 truncate">{todayLogDone ? "Nice work — see you tomorrow" : "Log today's progress before you clock out"}</div>
          </div>
        </div>
        <Link href="/daily-log" className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 flex-shrink-0">Daily Log <ArrowUpRight size={12} /></Link>
      </div>

      {/* Open safety incidents */}
      {openIncidents > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldAlert size={18} className="text-red-500 flex-shrink-0" />
          <div className="text-sm text-red-700 min-w-0"><span className="font-semibold">{openIncidents} open safety incident{openIncidents>1?"s":""}</span> on this site</div>
          <Link href="/safety" className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 flex-shrink-0">View <ArrowUpRight size={12} /></Link>
        </div>
      )}

      {/* Open punch list items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-gray-900">Open Punch List Items</h2>
          <Link href="/punch-list" className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-0.5">View all <ArrowUpRight size={12} /></Link>
        </div>
        {punchItems.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400">Nothing open — great job 🎉</div>
        ) : (
          <div className="space-y-1">
            {punchItems.map((item: any) => (
              <Link key={item.id} href="/punch-list" className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-all">
                <span className="text-gray-700 truncate">{item.title}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.low}`}>{item.priority}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href:"/safety",     icon:ShieldAlert,   label:"Report Incident", color:"#dc2626", bg:"#fee2e2" },
          { href:"/punch-list", icon:ClipboardList, label:"Punch List",      color:"#f97316", bg:"#fff7ed" },
          { href:"/photos",     icon:Camera,        label:"Photos",          color:"#2563eb", bg:"#dbeafe" },
          { href:"/daily-log",  icon:CalendarCheck, label:"Daily Log",       color:"#16a34a", bg:"#dcfce7" },
        ].map(a => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-all">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
                <Icon size={16} style={{ color: a.color }} />
              </div>
              <span className="text-sm font-medium text-gray-700">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
