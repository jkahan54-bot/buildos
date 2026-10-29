"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, ArrowRight } from "lucide-react";

const inp = "w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm";

// First sign-in after an admin added you with a temporary password: choose your own.
export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (password.length < 12) { setError("Password must be at least 12 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    const { error: err } = await createClient().auth.updateUser({ password, data: { must_change_password: false } });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.push("/dashboard"); router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm" style={{ background: "#111827" }}>B</div>
          <span className="font-bold text-gray-900 text-lg">BuildOS</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Choose your own password</h2>
          <p className="text-gray-500 text-sm mb-5">You signed in with a temporary password. Set a new one that only you know (12+ characters).</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative"><Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className={inp} /></div>
            <div className="relative"><Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" required minLength={12} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className={inp} /></div>
            {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
            <button disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#111827" }}>
              {loading ? "Saving…" : <><span>Save and continue</span><ArrowRight size={14} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
