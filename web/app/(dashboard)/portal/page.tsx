import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ExternalLink, Copy } from "lucide-react";

export default async function ClientPortalPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name, status, progress, phase, budget, spent, deadline").order("name");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildos-six.vercel.app";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-500 text-sm mt-0.5">Share read-only project views with owners and clients — no login required</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="font-semibold text-blue-800 mb-2">How it works</div>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Each project has a unique shareable link</li>
          <li>• Clients see: progress, budget used, phase, milestones, photos — nothing else</li>
          <li>• No login needed · Link expires if you regenerate it</li>
          <li>• Perfect for owners who want to check status without bothering you</li>
        </ul>
      </div>

      <div className="space-y-3">
        {projects?.map(p => {
          const portalUrl = `${appUrl}/client/${p.id}`;
          const pct = p.budget > 0 ? Math.round((p.spent ?? 0) / p.budget * 100) : 0;
          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.phase ?? "—"} · {p.progress ?? 0}% complete · Budget used: {pct}%</div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${p.status==="active"?"bg-green-50 text-green-600":"bg-gray-100 text-gray-500"}`}>{p.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-500 truncate">{portalUrl}</div>
                <button
                  onClick={() => {}}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all whitespace-nowrap"
                  title="Copy link">
                  <Copy size={12} />Copy
                </button>
                <Link href={`/client/${p.id}`} target="_blank"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all whitespace-nowrap"
                  style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                  <ExternalLink size={12} />Preview
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
