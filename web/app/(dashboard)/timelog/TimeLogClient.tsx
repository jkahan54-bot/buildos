"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function TimeLogClient({ logs, projects, currentEntry }: any) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [loading, setLoading] = useState(false);
  const isClockedIn = !!currentEntry;

  useEffect(() => {
    if (!isClockedIn) return;
    const interval = setInterval(() => {
      const diff = Date.now() - new Date(currentEntry.clock_in).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h}h ${m.toString().padStart(2,"0")}m ${s.toString().padStart(2,"0")}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentEntry]);

  const clockIn = async () => {
    if (!selectedProject) return;
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("time_logs").insert({ profile_id: user!.id, project_id: selectedProject, org_id: profile?.org_id, clock_in: new Date().toISOString() });
    setLoading(false); router.refresh();
  };

  const clockOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("time_logs").update({ clock_out: new Date().toISOString() }).eq("id", currentEntry.id);
    setLoading(false); router.refresh();
  };

  const totalWeek = logs
    .filter((l: any) => l.hours && new Date(l.clock_in) > new Date(Date.now() - 7 * 86400000))
    .reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black">Time Log</h1>
        <p className="text-gray-500 text-sm mt-1">Clock in/out and view your hours</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:"This Week",    value: `${totalWeek.toFixed(1)} hrs`, color:"#F46519" },
          { label:"Entries",      value: logs.length,                   color:"#3B82F6" },
          { label:"Status",       value: isClockedIn ? "On Site" : "Off Site", color: isClockedIn ? "#22C55E" : "#6B7280" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Clock in/out */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {isClockedIn ? (
          <div className="text-center">
            <div className="text-green-600 font-bold text-sm uppercase tracking-wider mb-2">⏱ Clocked In</div>
            <div className="text-4xl font-black font-mono text-gray-900 mb-2">{elapsed || "0h 00m 00s"}</div>
            <div className="text-gray-500 text-sm mb-6">
              Started at {new Date(currentEntry.clock_in).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
            </div>
            <button onClick={clockOut} disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white font-black px-8 py-3 rounded-xl text-lg transition-colors disabled:opacity-50">
              {loading ? "…" : "Clock Out"}
            </button>
          </div>
        ) : (
          <div>
            <h2 className="font-bold mb-4">Clock In</h2>
            <div className="flex gap-3">
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                className="flex-1 bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand">
                <option value="">Select project...</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={clockIn} disabled={!selectedProject || loading}
                className="bg-brand hover:bg-brand-dark text-white font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loading ? "…" : "Clock In"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Date","Project","In","Out","Hours"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!logs.length ? (
              <tr><td colSpan={5} className="text-center text-gray-500 py-12">No time entries yet</td></tr>
            ) : logs.map((l: any) => (
              <tr key={l.id} className="border-b border-border/50 hover:bg-surface-card transition-colors">
                <td className="px-4 py-3 text-sm font-semibold">{new Date(l.clock_in).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{l.projects?.name ?? "—"}</td>
                <td className="px-4 py-3 text-sm font-mono">{new Date(l.clock_in).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</td>
                <td className="px-4 py-3 text-sm font-mono">{l.clock_out ? new Date(l.clock_out).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : <span className="text-green-600 font-bold" style={{ color:"#16a34a" }}>Active</span>}</td>
                <td className="px-4 py-3 font-mono font-bold" style={{ color: l.hours > 9 ? "#F59E0B" : "#111827" }}>
                  {l.hours ? l.hours.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
