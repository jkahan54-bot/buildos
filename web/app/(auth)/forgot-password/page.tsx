"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, ArrowRight } from "lucide-react";

const inp = "w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Always show the same message so this page can't be used to find out which emails have accounts.
    await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false); setSent(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm" style={{ background: "#111827" }}>B</div>
          <span className="font-bold text-gray-900 text-lg">BuildOS</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Reset your password</h2>
          {sent ? (
            <div className="mt-3 text-sm text-gray-600 space-y-3">
              <p>If that email has an account, a reset link is on its way. Check your junk folder too.</p>
              <p className="text-gray-500">If nothing arrives within a few minutes, ask your administrator to send you a reset link.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 mt-4">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inp} />
              </div>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50" style={{ background: "#111827" }}>
                {loading ? "Sending…" : <><span>Send reset link</span><ArrowRight size={14} /></>}
              </button>
            </form>
          )}
          <p className="text-center text-sm mt-6"><Link href="/login" className="text-orange-500 hover:text-orange-600 font-semibold">Back to sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
