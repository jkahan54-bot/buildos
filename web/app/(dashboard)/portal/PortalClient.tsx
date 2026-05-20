"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Copy, Check, Globe } from "lucide-react";

export default function PortalClient({ projects, appUrl }: { projects: any[]; appUrl: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${appUrl}/client/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-500 text-sm mt-0.5">Share read-only project views with owners and clients — no login required</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Globe size={14} />How it works</div>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Each project has a unique shareable link</li>
          <li>• Clients see: progress, budget, phase, milestones, recent photos</li>
          <li>• No login needed — just send the link</li>
          <li>• Perfect for owners who want to check status without calling you</li>
        </ul>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
          No projects yet — create a project first
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => {
            const pct = p.budget > 0 ? Math.round((p.spent ?? 0) / p.budget * 100) : 0;
            const portalUrl = `${appUrl}/client/${p.id}`;
            const wasCopied = copied === p.id;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.phase ?? "—"} · {p.progress ?? 0}% complete · Budget: {pct}% used
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${p.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                    {p.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width:`${p.progress ?? 0}%` }} />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-500 truncate">
                    {portalUrl}
                  </div>
                  <button onClick={() => copyLink(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap ${wasCopied ? "bg-green-50 border-green-200 text-green-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {wasCopied ? <><Check size={12} />Copied!</> : <><Copy size={12} />Copy link</>}
                  </button>
                  <Link href={`/client/${p.id}`} target="_blank"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all whitespace-nowrap shadow-sm"
                    style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
                    <ExternalLink size={12} />Preview
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
