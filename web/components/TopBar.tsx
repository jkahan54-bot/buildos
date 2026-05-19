"use client";
import Link from "next/link";
import { Settings, Sparkles } from "lucide-react";

export default function TopBar({ profile }: { profile: any }) {
  const org = (profile as any)?.organizations?.name ?? "BuildOS";
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)
    : "?";

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
      <span className="text-sm font-medium text-gray-500">{org}</span>
      <div className="flex-1" />
      <Link href="/ai-tools"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-all">
        <Sparkles size={12} />AI Tools
      </Link>
      <Link href="/settings"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
        <Settings size={16} />
      </Link>
      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-[11px] font-bold text-orange-600">
        {initials}
      </div>
    </header>
  );
}
