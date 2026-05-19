"use client";
import { useState } from "react";

const ROLE_COLORS: Record<string, string> = { owner:"#A855F7", admin:"#F46519", office:"#3B82F6", field:"#22C55E" };

export default function TeamClient({ members, projects, timeLogs }: any) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const weekHours = (profileId: string) =>
    timeLogs.filter((l: any) => l.profile_id === profileId).reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  const filtered = members.filter((m: any) => {
    const matchSearch = !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  const onSite = members.filter((m: any) => m.role === "field").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Team</h1>
          <p className="text-gray-500 text-sm mt-1">{members.length} total members · {onSite} field workers</p>
        </div>
        <div className="text-sm text-gray-500 bg-surface border border-border rounded-lg px-4 py-2">
          Invite: share <span className="text-brand">buildos-six.vercel.app</span> → they register with their role
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(["owner","admin","office","field"] as const).map(role => {
          const count = members.filter((m: any) => m.role === role).length;
          return (
            <div key={role} className="bg-surface rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-black" style={{ color: ROLE_COLORS[role] }}>{count}</div>
              <div className="text-xs text-gray-500 mt-1 capitalize">{role === "admin" ? "Administrator" : role === "office" ? "Office Mgr" : role}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand" />
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {["all","owner","admin","office","field"].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded text-xs font-bold capitalize transition-colors ${roleFilter===r ? "bg-brand text-white" : "text-gray-500 hover:text-gray-200"}`}>
              {r === "admin" ? "Admin" : r === "office" ? "Office" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Team table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border">
            {["Member","Role","Email","Hours This Week","Status"].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {!filtered.length ? (
              <tr><td colSpan={5} className="text-center text-gray-500 py-12">No team members found</td></tr>
            ) : filtered.map((m: any) => {
              const hrs = weekHours(m.id);
              const color = ROLE_COLORS[m.role] ?? "#6B7280";
              return (
                <tr key={m.id} className="border-b border-border/50 hover:bg-surface-card transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: color+"33", color }}>
                        {m.full_name?.[0] ?? "?"}
                      </div>
                      <span className="font-semibold text-sm">{m.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ background: color+"22", color }}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{m.email}</td>
                  <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: hrs > 45 ? "#F59E0B" : "#F5F5F5" }}>
                    {hrs > 0 ? `${hrs.toFixed(1)}h` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${hrs > 0 ? "bg-green-500/20 text-green-400" : "bg-border text-gray-500"}`}>
                      {hrs > 0 ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
