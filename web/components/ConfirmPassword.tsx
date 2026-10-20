"use client";
/**
 * ConfirmPassword — re-asks for the current user's password before a sensitive
 * action (changing permissions, inviting an owner/admin) goes through, so a
 * hijacked but idle browser session can't silently make those changes.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, AlertCircle, X } from "lucide-react";

export default function ConfirmPassword({
  title = "Confirm your password",
  description = "For security, please re-enter your password to continue.",
  onConfirm,
  onCancel,
}: {
  title?: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setChecking(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setError("Session expired — please log in again."); setChecking(false); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    setChecking(false);
    if (signInError) { setError("Incorrect password."); return; }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <Lock size={18} className="text-orange-600" />
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
        <p className="text-gray-500 text-sm mb-4">{description}</p>
        <form onSubmit={submit}>
          <input
            type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm mb-3"
          />
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm mb-3">
              <AlertCircle size={14} className="flex-shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={checking || !password}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#111827" }}>
              {checking ? "Checking…" : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
