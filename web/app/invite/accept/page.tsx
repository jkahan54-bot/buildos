"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, ArrowRight, CheckCircle } from "lucide-react";

export default function AcceptInvitePage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const inviteId     = params.get("invite_id");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [inviteData, setInviteData] = useState<any>(null);

  useEffect(() => {
    // Get invite details
    if (inviteId) {
      createClient().from("invitations").select("*, organizations(name)").eq("id", inviteId).single()
        .then(({ data }) => setInviteData(data));
    }
  }, [inviteId]);

  const complete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const supabase = createClient();

    // Update password (user is already logged in via magic link)
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) { setError("Session expired. Try the link again."); setLoading(false); return; }

    const { error: pwErr } = await supabase.auth.updateUser({ password, data: { full_name: fullName } });
    if (pwErr) { setError(pwErr.message); setLoading(false); return; }

    // Link to org and set role via API
    const res = await fetch("/api/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        orgName: inviteData?.organizations?.name ?? "Brookstone Developers",
        role: inviteData?.role ?? "field",
        fullName,
      }),
    });

    // Mark invite accepted
    if (inviteId) {
      await createClient().from("invitations").update({ status: "accepted" }).eq("id", inviteId);
    }

    setLoading(false);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm"
            style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>B</div>
          <span className="font-bold text-gray-900 text-lg">BuildOS</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {inviteData && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-6">
              <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-green-700">You've been invited to</span>
                <div className="text-green-600">{inviteData.organizations?.name} · <span className="font-semibold capitalize">{inviteData.role}</span></div>
              </div>
            </div>
          )}

          <h2 className="text-xl font-bold text-gray-900 mb-1">Complete your account</h2>
          <p className="text-gray-500 text-sm mb-6">Set your name and password to finish joining</p>

          <form onSubmit={complete} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your full name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required
                placeholder="Joel Kahan"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Create a password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm" />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              {loading ? "Setting up…" : <><span>Join BuildOS</span><ArrowRight size={14} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
