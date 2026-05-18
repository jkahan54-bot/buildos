"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "owner",  label: "Owner",          desc: "Project progress & milestones" },
  { value: "admin",  label: "Administrator",   desc: "Full access to all modules" },
  { value: "office", label: "Office Manager",  desc: "Budget, billing & documents" },
  { value: "field",  label: "Field Worker",    desc: "Logs, timecards & safety" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep]           = useState(1);
  const [fullName, setFullName]   = useState("");
  const [orgName, setOrgName]     = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [role, setRole]           = useState("admin");
  const [inviteCode, setInvite]   = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role, org_name: orgName } },
    });
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Sign up failed");
      setLoading(false); return;
    }

    // Create org + link profile via edge function / server action (simplified here)
    const { error: orgError } = await supabase.from("organizations").insert({
      name: orgName,
      slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
    }).select().single();

    if (orgError) { setError(orgError.message); setLoading(false); return; }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-surface-panel flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand rounded-xl text-2xl mb-4">🏗</div>
          <h1 className="text-3xl font-black tracking-tight">BuildOS</h1>
          <p className="text-gray-500 mt-1">Set up your organization</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-8">
          {/* Steps */}
          <div className="flex gap-2 mb-8">
            {[1,2].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? "bg-brand" : "bg-border"}`} />
            ))}
          </div>

          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : register} className="space-y-4">
            {step === 1 ? (
              <>
                <h2 className="text-xl font-bold mb-4">Your organization</h2>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Company / Organization name</label>
                  <input value={orgName} onChange={e => setOrgName(e.target.value)} required
                    className="w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand"
                    placeholder="Acme Construction LLC" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Your full name</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} required
                    className="w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand"
                    placeholder="Joe Kahan" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Your role</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {ROLES.map(r => (
                      <button key={r.value} type="button" onClick={() => setRole(r.value)}
                        className={`p-3 rounded-lg border text-left transition-colors ${role === r.value ? "border-brand bg-brand/10" : "border-border hover:border-gray-500"}`}>
                        <div className="font-semibold text-sm">{r.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit"
                  className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors">
                  Continue →
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Create your login</h2>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand"
                    placeholder="you@company.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Password (min 8 characters)</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                    className="w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand"
                    placeholder="••••••••" />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 bg-surface-card border border-border text-gray-300 font-bold py-2.5 rounded-lg hover:border-gray-400 transition-colors">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                    {loading ? "Creating…" : "Create Account"}
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brand hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
