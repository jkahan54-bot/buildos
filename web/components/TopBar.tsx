"use client";
import { useState } from "react";
import Link from "next/link";

export default function TopBar({ profile }: { profile: any }) {
  const [aiOpen, setAiOpen] = useState(false);
  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-5 gap-4 flex-shrink-0">
      <div className="text-sm text-gray-500">{profile?.organizations?.name ?? "BuildOS"}</div>
      <div className="flex-1" />
      <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">⚙ AI Settings</Link>
      <button
        onClick={() => setAiOpen(!aiOpen)}
        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors border ${
          aiOpen ? "bg-brand text-white border-brand" : "bg-surface-card text-gray-400 border-border"
        }`}>
        {aiOpen ? "✕ AI" : "✦ AI"}
      </button>
    </header>
  );
}
