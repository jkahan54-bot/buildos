"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard"); router.refresh();
  };

  return (
    <div className="min-h-screen flex" style={{ background:"#0a0a0f" }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background:"linear-gradient(135deg,#0f0f1a 0%,#0a0a0f 100%)" }}>
        <div className="absolute inset-0 opacity-30"
          style={{ background:"radial-gradient(ellipse at 30% 50%,#f97316 0%,transparent 60%)" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
            <span className="font-bold text-white text-lg tracking-tight">BuildOS</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Construction<br />management<br /><span className="text-orange-400">powered by AI</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-xs">
            Manage projects, teams, budgets and safety — with Claude + GPT-4 reviewing everything automatically.
          </p>
        </div>
        <div className="relative space-y-3">
          {[
            { icon:"🏗", text:"Real-time project tracking" },
            { icon:"🤖", text:"Dual AI review on every document" },
            { icon:"📱", text:"Mobile app for field workers" },
            { icon:"🏥", text:"Medical facility checklists" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-500">
              <span>{f.icon}</span><span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
            <span className="font-bold text-white tracking-tight">BuildOS</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-8">Sign in to your account</p>

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@brookstone.com"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/60 focus:bg-white/[0.06] transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/60 focus:bg-white/[0.06] transition-all" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={14} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              {loading ? "Signing in…" : <><span>Sign In</span><ArrowRight size={14} /></>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Don't have an account?{" "}
            <Link href="/register" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
