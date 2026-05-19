"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, ChevronDown, CheckCircle, Clock, X } from "lucide-react";

const ROLE_META: Record<string,{ color:string; bg:string; label:string }> = {
  owner:  { color:"#7c3aed", bg:"#ede9fe", label:"Owner"          },
  admin:  { color:"#ea580c", bg:"#fff7ed", label:"Administrator"   },
  office: { color:"#2563eb", bg:"#eff6ff", label:"Office Manager"  },
  field:  { color:"#16a34a", bg:"#f0fdf4", label:"Field Worker"    },
};
const ROLES = ["owner","admin","office","field"] as const;

export default function TeamClient({ members, timeLogs, invitations, isAdmin }: any) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<typeof ROLES[number]>("field");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [error, setError]             = useState("");
  const [search, setSearch]           = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const weekHours = (id: string) =>
    (timeLogs ?? []).filter((l: any) => l.profile_id === id && new Date(l.clock_in) > new Date(Date.now() - 7*86400000))
      .reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  const filtered = members.filter((m: any) =>
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

  const revokeInvite = async (id: string) => {
    await fetch(`/api/invite?id=${id}`, { method:"DELETE" }); router.refresh();
  };

  const pendingInvites = (invitations ?? []).filter((i: any) => i.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""}
            {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending`}
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
                <div className="text-green-600 text-xs mt-0.5">{inviteEmail} will receive an email with a link to join.</div>
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
                  {ROLES.map(r => {
                    const m = ROLE_META[r];
                    return (
                      <button key={r} type="button" onClick={() => setInviteRole(r)}
                        className={`p-3 rounded-xl border text-left transition-all ${inviteRole === r ? "border-2" : "border border-gray-200 hover:border-gray-300"}`}
                        style={inviteRole === r ? { borderColor: m.color, background: m.bg } : {}}>
                        <div className="text-xs font-bold text-gray-900">{m.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {r==="owner"?"Progress only":r==="admin"?"Full access":r==="office"?"Budget & docs":"Site tools"}
                        </div>
                      </button>
                    );
                  })}
                </div>
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

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock size={14} className="text-orange-500" />
            <span className="font-semibold text-sm text-gray-900">Pending Invites</span>
            <span className="text-xs bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full ml-1">{pendingInvites.length}</span>
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
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 flex-shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm" />

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="font-semibold text-sm text-gray-900">Members ({filtered.length})</span>
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
                  {isAdmin ? (
                    <div className="relative flex-shrink-0">
                      <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                        disabled={updatingRole === m.id}
                        className="appearance-none text-xs font-semibold pl-3 pr-7 py-1.5 rounded-full cursor-pointer outline-none disabled:opacity-50 border border-transparent hover:border-gray-200 transition-all"
                        style={{ background: meta.bg, color: meta.color }}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
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
    </div>
  );
}
