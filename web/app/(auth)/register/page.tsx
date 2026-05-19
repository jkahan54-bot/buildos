"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, Building2, ArrowRight, AlertCircle, Check } from "lucide-react";

const ROLES = [
  { value:"owner",  label:"Owner",           desc:"Progress & milestones", color:"#7c3aed", bg:"#ede9fe" },
  { value:"admin",  label:"Administrator",   desc:"Full access",            color:"#ea580c", bg:"#fff7ed" },
  { value:"office", label:"Office Manager",  desc:"Budget & billing",       color:"#2563eb", bg:"#eff6ff" },
  { value:"field",  label:"Field Worker",    desc:"Site tools",             color:"#16a34a", bg:"#f0fdf4" },
];

const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all shadow-sm";

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <span className="font-bold text-gray-900 text-lg">BuildOS</span>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-6">
          {[1,2].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s < step ? "bg-orange-500 text-white" : s === step ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                {s < step ? <Check size={12} /> : s}
              </div>
              <div className="text-xs font-medium text-gray-500">
                {s === 1 ? "Your company" : "Your login"}
              </div>
              {s < 2 && <div className={`flex-1 h-0.5 rounded-full ${s < step ? "bg-orange-500" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {step === 1 ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set up your organization</h2>
              <p className="text-gray-500 text-sm mb-6">Tell us about your company and your role</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
                  <div className="relative">
                    <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={orgName} onChange={e => setOrgName(e.target.value)}
                      placeholder="Brookstone Developers" className={inp.replace("px-4","pl-10 pr-4")} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your full name</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Joel Kahan" className={inp.replace("px-4","pl-10 pr-4")} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => (
                      <button key={r.value} type="button" onClick={() => setRole(r.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${role === r.value ? "border-2" : "border border-gray-200 hover:border-gray-300"}`}
                        style={role === r.value ? { borderColor: r.color, background: r.bg } : {}}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-900">{r.label}</span>
                          {role === r.value && (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: r.color }}>
                              <Check size={9} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => orgName && fullName && setStep(2)}
                  disabled={!orgName || !fullName}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-40 mt-2"
                  style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={register}>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Create your login</h2>
              <p className="text-gray-500 text-sm mb-6">Set your email and password</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" className={inp.replace("px-4","pl-10 pr-4")} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters" minLength={8} className={inp.replace("px-4","pl-10 pr-4")} required />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                    <AlertCircle size={14} className="flex-shrink-0" />{error}
                  </div>
                )}
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                    {loading ? "Creating…" : <><span>Create Account</span><ArrowRight size={14} /></>}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-500 hover:text-orange-600 font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
