"use client";
import Link from "next/link";
import { Settings, Sparkles } from "lucide-react";

export default function TopBar({ profile }: { profile: any }) {
  const org = (profile as any)?.organizations?.name ?? "BuildOS";
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)
    : "?";

  return (
    <header className="h-14 flex items-center px-6 gap-4 flex-shrink-0 border-b border-white/[0.06]"
      style={{ background:"rgba(10,10,15,0.8)", backdropFilter:"blur(12px)" }}>

      {/* Org name */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-medium text-gray-400">{org}</span>
      </div>

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        <Link href="/ai-tools"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all border border-white/[0.06]">
          <Sparkles size={12} className="text-orange-400" />
          AI Tools
        </Link>
        <Link href="/settings"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/[0.06] transition-all">
          <Settings size={15} />
        </Link>
        <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[11px] font-bold text-orange-400">
          {initials}
        </div>
      </div>
    </header>
  );
}
