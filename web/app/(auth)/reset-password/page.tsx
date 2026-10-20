"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, ArrowRight, AlertCircle, Check } from "lucide-react";

const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady]       = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const code = params.get("code");

    (async () => {
      // Supabase's recovery link uses the PKCE flow (a ?code=... param), which
      // needs to be explicitly exchanged for a session — it isn't auto-detected
      // the way the older hash-token flow was.
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("This reset link is invalid or has expired. Request a new one from the login page.");
          setReady(true);
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setError("This reset link is invalid or has expired. Request a new one from the login page."); }
      setReady(true);
    })();
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm"
            style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <span className="font-bold text-gray-900 text-lg">BuildOS</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {done ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <Check size={18} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Password updated</h2>
              <p className="text-gray-500 text-sm mt-1">Taking you to the dashboard…</p>
            </div>
          ) : !ready ? (
            <p className="text-center text-gray-400 text-sm py-6">Checking reset link…</p>
          ) : (
            <form onSubmit={submit}>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set a new password</h2>
              <p className="text-gray-500 text-sm mb-6">Choose a password you'll remember.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters" minLength={8} className={inp.replace("px-4", "pl-10 pr-4")} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Retype password" minLength={8} className={inp.replace("px-4", "pl-10 pr-4")} required />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                    <AlertCircle size={14} className="flex-shrink-0" />{error}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 mt-2"
                  style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
                  {loading ? "Updating…" : <><span>Update password</span><ArrowRight size={14} /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
