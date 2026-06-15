"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, ChevronDown, CheckCircle, Clock, X, ShieldCheck, ShieldX, AlertCircle } from "lucide-react";

const ROLE_META: Record<string,{ color:string; bg:string; label:string; icon?:string }> = {
  owner:         { color:"#92400e", bg:"#fef3c7", label:"Master Owner",   icon:"👑"  },
  jobsite_owner: { color:"#7c3aed", bg:"#ede9fe", label:"Jobsite Owner",  icon:"🏗️" },
  admin:         { color:"#ea580c", bg:"#fff7ed", label:"Administrator"              },
  office:        { color:"#2563eb", bg:"#eff6ff", label:"Office Manager"             },
  field:         { color:"#16a34a", bg:"#f0fdf4", label:"Field Worker"               },
};
const ALL_ROLES   = ["owner","jobsite_owner","admin","office","field"] as const;
const ADMIN_ROLES = ["jobsite_owner","admin","office","field"] as const; // admins can't assign master owner

export default function TeamClient({ members, timeLogs, invitations, projects, isAdmin, isOwner }: any) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<typeof ALL_ROLES[number]>("field");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [error, setError]             = useState("");
  const [search, setSearch]           = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [updatingSite, setUpdatingSite] = useState<string | null>(null);
  const [actioning, setActioning]     = useState<string | null>(null);

  const weekHours = (id: string) =>
    (timeLogs ?? []).filter((l: any) => l.profile_id === id && new Date(l.clock_in) > new Date(Date.now() - 7*86400000))
      .reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  // Separate approved vs pending members
  const pendingMembers  = members.filter((m: any) => m.approval_status === "pending");
  const rejectedMembers = members.filter((m: any) => m.approval_status === "rejected");
  const activeMembers   = members.filter((m: any) => !m.approval_status || m.approval_status === "approved");

  const filtered = activeMembers.filter((m: any) =>
    !search || m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())
  );

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSending(true);
    const res  = await fetch("/api/invite", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
    const data = await res.json();
    if (data.error) { setError(data.error); setSending(false); return; }
    setSending(false); setSent(true);
    setTimeout(() => { setSent(false); setShowInvite(false); setInviteEmail(""); setInviteRole("field"); }, 3000);
    router.refresh();
  };

  const changeRole = async (userId: string, role: string) => {
    setUpdatingRole(userId);
    await fetch("/api/invite", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId, role }) });
    setUpdatingRole(null); router.refresh();
  };

  const changeSite = async (userId: string, assignedProjectId: string) => {
    setUpdatingSite(userId);
    await fetch("/api/invite", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId, assignedProjectId }) });
    setUpdatingSite(null); router.refresh();
  };

  const revokeInvite = async (id: string) => {
    await fetch(`/api/invite?id=${id}`, { method:"DELETE" }); router.refresh();
  };

  const approveUser = async (userId: string) => {
    setActioning(userId);
    await fetch("/api/invite", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId, action:"approve" }) });
    setActioning(null); router.refresh();
  };

  const rejectUser = async (userId: string) => {
    if (!confirm("Reject this user? They will not be able to access BuildOS.")) return;
    setActioning(userId);
    await fetch("/api/invite", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId, action:"reject" }) });
    setActioning(null); router.refresh();
  };

  const pendingInvites = (invitations ?? []).filter((i: any) => i.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeMembers.length} active member{activeMembers.length !== 1 ? "s" : ""}
            {pendingMembers.length > 0 && <span className="ml-2 text-amber-600 font-semibold">· {pendingMembers.length} awaiting approval</span>}
            {pendingInvites.length > 0 && ` · ${pendingInvites.length} invite pending`}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(!showInvite)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm flex-shrink-0"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
            <UserPlus size={15} />Invite Member
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-white rounded-xl border border-orange-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus size={16} className="text-orange-500" />Invite Team Member
            </h2>
            <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          {sent ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
              <div>
                <div className="font-semibold text-green-700 text-sm">Invite sent!</div>
                <div className="text-green-600 text-xs mt-0.5">{inviteEmail} will receive an email. Once they sign up, you'll see them in the Awaiting Approval queue.</div>
              </div>
            </div>
          ) : (
            <form onSubmit={sendInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                    placeholder="worker@company.com"
                    className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role & access level</label>
                <div className="grid grid-cols-2 gap-2">
                  {(isOwner ? ALL_ROLES : ADMIN_ROLES).map(r => {
                    const m = ROLE_META[r];
                    return (
                      <button key={r} type="button" onClick={() => setInviteRole(r)}
                        className={`p-3 rounded-xl border text-left transition-all ${inviteRole === r ? "border-2" : "border border-gray-200 hover:border-gray-300"}`}
                        style={inviteRole === r ? { borderColor: m.color, background: m.bg } : {}}>
                        <div className="text-xs font-bold text-gray-900">{m.icon && <span className="mr-1">{m.icon}</span>}{m.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {r==="owner"?"Master — full system access":r==="jobsite_owner"?"Project visibility only":r==="admin"?"Full access + team manage":r==="office"?"Budget, docs & finance":"Site tools & punch list"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">After they sign up, their account will appear in <strong>Awaiting Approval</strong> — you'll need to approve them before they can log in.</p>
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">Cancel</button>
                <button type="submit" disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                  style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                  {sending ? "Sending…" : <><Mail size={14} />Send Invite</>}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── AWAITING APPROVAL ── */}
      {isAdmin && pendingMembers.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 flex items-center gap-2 bg-amber-50">
            <Clock size={14} className="text-amber-600" />
            <span className="font-semibold text-sm text-amber-800">Awaiting Approval</span>
            <span className="text-xs bg-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded-full ml-1">{pendingMembers.length}</span>
            <span className="text-xs text-amber-600 ml-1">— Review and approve each new team member before they can access BuildOS</span>
          </div>
          {pendingMembers.map((m: any) => {
            const meta = ROLE_META[m.role] ?? ROLE_META.field;
            const isLoading = actioning === m.id;
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-4 border-b border-amber-50 last:border-0">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 flex-shrink-0">
                  {m.full_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{m.full_name ?? "—"}</div>
                  <div className="text-xs text-gray-400 truncate">{m.email}</div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => approveUser(m.id)} disabled={isLoading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-all shadow-sm">
                    <ShieldCheck size={13} />{isLoading ? "…" : "Approve"}
                  </button>
                  <button onClick={() => rejectUser(m.id)} disabled={isLoading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-all border border-red-200">
                    <ShieldX size={13} />Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending email invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Mail size={14} className="text-orange-500" />
            <span className="font-semibold text-sm text-gray-900">Invite Emails Sent</span>
            <span className="text-xs bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full ml-1">{pendingInvites.length}</span>
            <span className="text-xs text-gray-400 ml-1">— waiting for them to sign up</span>
          </div>
          {pendingInvites.map((inv: any) => {
            const m = ROLE_META[inv.role] ?? ROLE_META.field;
            return (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Mail size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">{inv.email}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Invited {new Date(inv.created_at).toLocaleDateString()}</div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                {isAdmin && (
                  <button onClick={() => revokeInvite(inv.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 flex-shrink-0"
                    title="Cancel invite">
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search active members…"
        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm" />

      {/* Active members list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <CheckCircle size={14} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-900">Active Members ({filtered.length})</span>
        </div>
        {!filtered.length ? (
          <div className="p-12 text-center text-gray-400 text-sm">No members found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((m: any) => {
              const meta = ROLE_META[m.role] ?? ROLE_META.field;
              const hrs  = weekHours(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: meta.bg, color: meta.color }}>
                    {m.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{m.full_name ?? "—"}</div>
                    <div className="text-xs text-gray-400 truncate">{m.email}</div>
                  </div>
                  {hrs > 0 && (
                    <div className="hidden sm:block text-right flex-shrink-0 mr-2">
                      <div className="text-xs font-semibold text-gray-700">{hrs.toFixed(1)}h</div>
                      <div className="text-[10px] text-gray-400">this week</div>
                    </div>
                  )}
                  {/* Site assignment — only matters for field workers (scopes their Daily Review) */}
                  {m.role === "field" && (
                    isAdmin ? (
                      <div className="relative flex-shrink-0">
                        <select value={m.assigned_project_id ?? ""} onChange={e => changeSite(m.id, e.target.value)}
                          disabled={updatingSite === m.id}
                          className="appearance-none text-xs font-medium pl-3 pr-7 py-1.5 rounded-full cursor-pointer outline-none disabled:opacity-50 border border-gray-200 hover:border-gray-300 transition-all bg-gray-50 text-gray-600 max-w-[140px]">
                          <option value="">All sites</option>
                          {(projects ?? []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 flex-shrink-0 max-w-[140px] truncate">
                        {(projects ?? []).find((p: any) => p.id === m.assigned_project_id)?.name ?? "All sites"}
                      </span>
                    )
                  )}
                  {/* Owner badge — never editable by anyone except themselves */}
                  {m.role === "owner" ? (
                    <span className="text-xs font-bold px-2.5 py-1.5 rounded-full flex-shrink-0 flex items-center gap-1"
                      style={{ background: meta.bg, color: meta.color }}>
                      👑 {meta.label}
                    </span>
                  ) : isAdmin ? (
                    <div className="relative flex-shrink-0">
                      <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                        disabled={updatingRole === m.id}
                        className="appearance-none text-xs font-semibold pl-3 pr-7 py-1.5 rounded-full cursor-pointer outline-none disabled:opacity-50 border border-transparent hover:border-gray-200 transition-all"
                        style={{ background: meta.bg, color: meta.color }}>
                        {/* Admins can only assign non-owner roles; owners can assign any */}
                        {(isOwner ? ALL_ROLES : ADMIN_ROLES).map(r => (
                          <option key={r} value={r}>{ROLE_META[r].label}</option>
                        ))}
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: meta.color }} />
                    </div>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rejected members — hidden by default, admin info */}
      {isAdmin && rejectedMembers.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-gray-500 flex items-center gap-2 list-none select-none">
            <ShieldX size={14} className="text-red-400" />
            {rejectedMembers.length} Rejected Account{rejectedMembers.length > 1 ? "s" : ""}
          </summary>
          {rejectedMembers.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-100">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-400 flex-shrink-0">
                {m.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-500 truncate line-through">{m.full_name ?? "—"}</div>
                <div className="text-xs text-gray-400 truncate">{m.email}</div>
              </div>
              <button onClick={() => approveUser(m.id)} disabled={actioning === m.id}
                className="text-xs font-semibold text-green-600 hover:text-green-700 px-2 py-1 rounded bg-green-50 hover:bg-green-100 transition-all">
                Re-approve
              </button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
