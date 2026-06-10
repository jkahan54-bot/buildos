"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { NAV, ROLE_META } from "@/components/Sidebar";
import { Lock, Check, AlertTriangle } from "lucide-react";

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

      // Load existing prefs
      const { data: prefs, error } = await supabase
        .from("role_menu_prefs").select("role, hidden").eq("org_id", prof.org_id);
      if (error && /does not exist|schema cache/i.test(error.message)) setTableMissing(true);
      const next: Record<string, Set<string>> = {};
      for (const r of ROLE_ORDER) next[r] = new Set();
      for (const p of prefs ?? []) next[p.role] = new Set(p.hidden ?? []);
      setHidden(next);
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

  const save = async () => {
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

      {/* Save bar */}
      <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-2 flex items-center gap-4">
        <button onClick={save} disabled={saving || tableMissing}
          className="px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-green-600 text-sm font-semibold flex items-center gap-1"><Check size={15} /> Saved — menus updated</span>}
      </div>
    </div>
  );
}
