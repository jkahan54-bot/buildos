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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 bg-white border-r border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <span className="font-bold text-gray-900 text-lg">BuildOS</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
            Construction management<br />
            <span className="text-orange-500">powered by AI</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-sm">
            Projects, teams, budgets and safety — all in one place. Claude + GPT-4 reviews everything automatically.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon:"📊", text:"Real-time project & budget tracking" },
              { icon:"🤖", text:"Dual AI review on every document" },
              { icon:"📱", text:"Mobile app for field workers" },
              { icon:"🏥", text:"Medical facility division with checklists" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="text-base">{f.icon}</span><span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400">© 2025 BuildOS · Brookstone Developers</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm shadow-sm"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
            <span className="font-bold text-gray-900">BuildOS</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h2>
          <p className="text-gray-500 text-sm mb-8">Welcome back to BuildOS</p>

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                <AlertCircle size={14} className="flex-shrink-0" />{error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 mt-2"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              {loading ? "Signing in…" : <><span>Sign In</span><ArrowRight size={14} /></>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{" "}
            <Link href="/register" className="text-orange-500 hover:text-orange-600 font-semibold">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
