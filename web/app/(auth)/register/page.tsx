"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, Building2, ArrowRight, AlertCircle, Check } from "lucide-react";

const ROLES = [
  { value:"owner",  label:"Owner",           desc:"Project progress & milestones",  color:"#a78bfa" },
  { value:"admin",  label:"Administrator",    desc:"Full access to everything",       color:"#f97316" },
  { value:"office", label:"Office Manager",   desc:"Budget, invoices, documents",    color:"#60a5fa" },
  { value:"field",  label:"Field Worker",     desc:"Time, safety, photos",           color:"#34d399" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep]         = useState(1);
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName]   = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("admin");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role, org_name: orgName } },
    });
    if (signUpError || !data.user) { setError(signUpError?.message ?? "Sign up failed"); setLoading(false); return; }

    const res = await fetch("/api/register", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ userId: data.user.id, orgName, role, fullName }),
    });
    const result = await res.json();
    if (result.error) { setError(result.error); setLoading(false); return; }
    router.push("/dashboard");
  };

  const inp = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/60 focus:bg-white/[0.06] transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background:"#0a0a0f" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <span className="font-bold text-white text-lg tracking-tight">BuildOS</span>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1,2].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full transition-all duration-500"
              style={{ background: s <= step ? "#f97316" : "rgba(255,255,255,0.06)" }} />
          ))}
        </div>

        <div className="rounded-2xl border border-white/[0.08] p-8"
          style={{ background:"linear-gradient(135deg,#0f0f17,#0a0a0f)" }}>

          {step === 1 ? (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Set up your organization</h2>
              <p className="text-gray-500 text-sm mb-6">Tell us about your company</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Company name</label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input value={orgName} onChange={e => setOrgName(e.target.value)} required
                      placeholder="Brookstone Developers" className={inp.replace("px-4","pl-9 pr-4")} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Your full name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input value={fullName} onChange={e => setFullName(e.target.value)} required
                      placeholder="Joel Kahan" className={inp.replace("px-4","pl-9 pr-4")} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Your role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => (
                      <button key={r.value} type="button" onClick={() => setRole(r.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${role === r.value ? "border-opacity-60" : "border-white/[0.06] hover:border-white/[0.12]"}`}
                        style={role === r.value ? { borderColor: r.color + "80", background: r.color + "10" } : {}}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{r.label}</span>
                          {role === r.value && <Check size={11} style={{ color: r.color }} />}
                        </div>
                        <div className="text-[10px] text-gray-600 leading-tight">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button type="button" onClick={() => { if (orgName && fullName) setStep(2); }}
                  disabled={!orgName || !fullName}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-30"
                  style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={register}>
              <h2 className="text-xl font-bold text-white mb-1">Create your login</h2>
              <p className="text-gray-500 text-sm mb-6">Set your email and password</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="you@company.com" className={inp.replace("px-4","pl-9 pr-4")} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                      placeholder="Min. 8 characters" className={inp.replace("px-4","pl-9 pr-4")} />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle size={14} className="flex-shrink-0" />{error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 py-3 rounded-lg text-sm font-semibold text-gray-400 border border-white/[0.08] hover:border-white/[0.16] transition-all">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                    {loading ? "Creating…" : <><span>Create Account</span><ArrowRight size={14} /></>}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
