"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { NAV, ROLE_META } from "@/components/Sidebar";
import ConfirmPassword from "@/components/ConfirmPassword";
import { Lock, Check, AlertTriangle, User as UserIcon } from "lucide-react";

// Roles shown on this page, in display order
const ROLE_ORDER = ["field", "office", "admin", "jobsite_owner", "owner"];
// Items that can never be hidden (so an admin can't lock themselves out of this page)
const ALWAYS_ON = ["/dashboard", "/my-day", "/permissions"];

export default function PermissionsPage() {
  const [profile, setProfile]   = useState<any>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  // hidden[role] = Set of hrefs hidden for that role
  const [hidden, setHidden]     = useState<Record<string, Set<string>>>({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // Per-person overrides
  const [members, setMembers]         = useState<any[]>([]);
  const [selectedId, setSelectedId]   = useState<string>("");
  const [userHidden, setUserHidden]   = useState<Record<string, Set<string>>>({});
  const [userTableMissing, setUserTableMissing] = useState(false);
  const [savingUser, setSavingUser]   = useState(false);
  const [savedUser, setSavedUser]     = useState(false);

  // Which sensitive save is pending password confirmation
  const [confirming, setConfirming] = useState<null | "role" | "user">(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthorized(false); return; }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);
      const role = prof?.role;
      if (role !== "owner" && role !== "admin") { setAuthorized(false); return; }
      setAuthorized(true);

      // Load existing role-level prefs
      const { data: prefs, error } = await supabase
        .from("role_menu_prefs").select("role, hidden").eq("org_id", prof.org_id);
      if (error && /does not exist|schema cache/i.test(error.message)) setTableMissing(true);
      const next: Record<string, Set<string>> = {};
      for (const r of ROLE_ORDER) next[r] = new Set();
      for (const p of prefs ?? []) next[p.role] = new Set(p.hidden ?? []);
      setHidden(next);

      // Load org members for per-person overrides
      const { data: mem } = await supabase
        .from("profiles").select("id, full_name, email, role")
        .eq("org_id", prof.org_id).eq("approval_status", "approved").order("full_name");
      setMembers(mem ?? []);

      // Load existing per-person prefs
      const { data: uprefs, error: uerr } = await supabase
        .from("user_menu_prefs").select("user_id, hidden").eq("org_id", prof.org_id);
      if (uerr && /does not exist|schema cache/i.test(uerr.message)) setUserTableMissing(true);
      const unext: Record<string, Set<string>> = {};
      for (const p of uprefs ?? []) unext[p.user_id] = new Set(p.hidden ?? []);
      setUserHidden(unext);
    })();
  }, []);

  // Owners can edit every role; admins can edit everyone except the owner role
  const editableRoles = ROLE_ORDER.filter(r => profile?.role === "owner" || r !== "owner");

  const toggle = (role: string, href: string) => {
    setHidden(prev => {
      const set = new Set(prev[role] ?? []);
      if (set.has(href)) set.delete(href); else set.add(href);
      return { ...prev, [role]: set };
    });
  };

  const doSaveRole = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const rows = editableRoles.map(role => ({
      org_id: profile.org_id,
      role,
      hidden: Array.from(hidden[role] ?? []),
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("role_menu_prefs").upsert(rows, { onConflict: "org_id,role" });
    setSaving(false);
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) setTableMissing(true);
      else alert("Could not save: " + error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const selectedMember = members.find(m => m.id === selectedId);
  const selectedRoleHidden = selectedMember ? (hidden[selectedMember.role] ?? new Set()) : new Set();

  const toggleUser = (href: string) => {
    if (!selectedId || selectedRoleHidden.has(href)) return; // can't un-hide a role default here
    setUserHidden(prev => {
      const set = new Set(prev[selectedId] ?? []);
      if (set.has(href)) set.delete(href); else set.add(href);
      return { ...prev, [selectedId]: set };
    });
  };

  const doSaveUser = async () => {
    if (!selectedId) return;
    setSavingUser(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("user_menu_prefs").upsert({
      org_id: profile.org_id,
      user_id: selectedId,
      hidden: Array.from(userHidden[selectedId] ?? []),
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id" });
    setSavingUser(false);
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) setUserTableMissing(true);
      else alert("Could not save: " + error.message);
      return;
    }
    setSavedUser(true);
    setTimeout(() => setSavedUser(false), 3000);
  };

  if (authorized === null) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>;
  }
  if (authorized === false) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <Lock size={36} className="text-gray-300 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-gray-900">Not available</h1>
        <p className="text-sm text-gray-500 mt-1">Only owners and administrators can manage role access.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {confirming && (
        <ConfirmPassword
          title="Confirm permission changes"
          description="Changing who can see what is sensitive — please confirm it's really you."
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const which = confirming;
            setConfirming(null);
            if (which === "role") doSaveRole(); else doSaveUser();
          }}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Lock size={20} className="text-orange-500" /> Role Access
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Check the menu items each role can see. Uncheck to hide an item from that role. Dashboard and this
          page are always visible so no one gets locked out.
        </p>
      </div>

      {/* One-time setup notice */}
      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <div className="font-bold mb-1">One-time setup needed</div>
            This page needs a small database table before it can save. Ask your developer to run the
            <code className="mx-1 px-1 bg-amber-100 rounded">005_role_menu_prefs.sql</code> setup once — after that,
            changes here save automatically.
          </div>
        </div>
      )}

      {/* Per-role cards */}
      {editableRoles.map(role => {
        const meta = ROLE_META[role];
        const items = (NAV[role] ?? []).filter(i => !ALWAYS_ON.includes(i.href));
        const hiddenSet = hidden[role] ?? new Set();
        const visibleCount = items.length - items.filter(i => hiddenSet.has(i.href)).length;
        return (
          <div key={role} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5"
              style={{ background: meta.bg }}>
              {meta.icon && <span>{meta.icon}</span>}
              <span className="font-bold text-sm" style={{ color: meta.color }}>{meta.label}</span>
              <span className="text-xs ml-auto font-semibold" style={{ color: meta.color }}>
                {visibleCount} of {items.length} visible
              </span>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {items.map(item => {
                const isHidden = hiddenSet.has(item.href);
                const Icon = item.icon;
                return (
                  <button key={item.href} onClick={() => toggle(role, item.href)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium border transition-all text-left ${
                      isHidden
                        ? "border-gray-200 bg-gray-50 text-gray-400"
                        : "border-orange-200 bg-orange-50 text-gray-800"
                    }`}>
                    <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                      isHidden ? "border-gray-300 bg-white" : "border-orange-500 bg-orange-500"
                    }`}>
                      {!isHidden && <Check size={11} className="text-white" strokeWidth={3} />}
                    </span>
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Save bar — role level */}
      <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-2 flex items-center gap-4">
        <button onClick={() => setConfirming("role")} disabled={saving || tableMissing}
          className="px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm disabled:opacity-50"
          style={{ background: "#111827" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-green-600 text-sm font-semibold flex items-center gap-1"><Check size={15} /> Saved — menus updated</span>}
      </div>

      {/* Per-person overrides */}
      <div className="pt-4 border-t border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <UserIcon size={18} className="text-orange-500" /> Per-Person Overrides
        </h2>
        <p className="text-gray-500 text-sm mt-1 mb-4">
          Hide additional items for one specific person, on top of what their role already allows. You can't
          un-hide something their role already hides here — change the role above for that.
        </p>

        {userTableMissing && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <div className="font-bold mb-1">One-time setup needed</div>
              This section needs the <code className="mx-1 px-1 bg-amber-100 rounded">user_menu_prefs</code> table —
              ask your developer to run the <code className="mx-1 px-1 bg-amber-100 rounded">005_user_menu_prefs.sql</code> migration.
            </div>
          </div>
        )}

        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full sm:w-80 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm mb-4">
          <option value="">Select a person…</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.full_name || m.email} — {ROLE_META[m.role]?.label ?? m.role}</option>
          ))}
        </select>

        {selectedMember && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5" style={{ background: ROLE_META[selectedMember.role]?.bg }}>
              <span className="font-bold text-sm" style={{ color: ROLE_META[selectedMember.role]?.color }}>
                {selectedMember.full_name || selectedMember.email}
              </span>
              <span className="text-xs text-gray-500">({ROLE_META[selectedMember.role]?.label})</span>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(NAV[selectedMember.role] ?? []).filter(i => !ALWAYS_ON.includes(i.href)).map(item => {
                const roleHidden = selectedRoleHidden.has(item.href);
                const extraHidden = (userHidden[selectedId] ?? new Set()).has(item.href);
                const isHidden = roleHidden || extraHidden;
                const Icon = item.icon;
                return (
                  <button key={item.href} onClick={() => toggleUser(item.href)} disabled={roleHidden}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium border transition-all text-left ${
                      roleHidden
                        ? "border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed"
                        : isHidden
                        ? "border-gray-200 bg-gray-50 text-gray-400"
                        : "border-orange-200 bg-orange-50 text-gray-800"
                    }`}>
                    <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                      isHidden ? "border-gray-300 bg-white" : "border-orange-500 bg-orange-500"
                    }`}>
                      {!isHidden && <Check size={11} className="text-white" strokeWidth={3} />}
                    </span>
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedMember && (
          <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-2 flex items-center gap-4">
            <button onClick={() => setConfirming("user")} disabled={savingUser || userTableMissing}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm disabled:opacity-50"
              style={{ background: "#111827" }}>
              {savingUser ? "Saving…" : "Save for this person"}
            </button>
            {savedUser && <span className="text-green-600 text-sm font-semibold flex items-center gap-1"><Check size={15} /> Saved</span>}
          </div>
        )}
      </div>
    </div>
  );
}
