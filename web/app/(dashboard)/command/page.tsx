"use client";
import { useState, useEffect, useRef } from "react";
import { Send, Zap, RefreshCw, ShieldAlert, Clock, AlertTriangle, CheckCircle, BarChart2 } from "lucide-react";

type Message = { role: "user" | "ai"; text: string; ts: string };
type ScanResult = {
  scan_date: string;
  executive_summary: string;
  attention_required: string[];
  projects: { name: string; status: string; action_needed: string }[];
  safety_status: string;
  safety_notes: string;
  stats: Record<string, number>;
};

const STATUS_COLOR: Record<string, { c: string; b: string }> = {
  "On Track": { c: "#16a34a", b: "#dcfce7" },
  "At Risk":  { c: "#d97706", b: "#fef3c7" },
  "Blocked":  { c: "#f97316", b: "#fff7ed" },
  "Critical": { c: "#dc2626", b: "#fee2e2" },
};

export default function CommandPage() {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [lastScan, setLastScan]   = useState<ScanResult | null>(null);
  const [stats, setStats]         = useState<Record<string, number> | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load latest scan result and quick stats on mount
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/owner/stats");
      if (res.ok) {
        const d = await res.json();
        setStats(d.stats ?? null);
        setLastScan(d.lastScan ?? null);
      }
      setLoadingStats(false);
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(m => [...m, { role: "user", text, ts }]);
    setInput("");
    setSending(true);
    try {
      const res  = await fetch("/api/owner/prompt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "ai", text: data.answer ?? data.error ?? "No response.", ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "Connection error. Please try again.", ts: "" }]);
    }
    setSending(false);
  };

  const runScan = async () => {
    setScanning(true);
    setMessages(m => [...m, { role: "ai", text: "Running full master scan across all sites — this takes 30-60 seconds...", ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    try {
      const res  = await fetch("/api/owner/scan", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        // Reload the scan result
        const statsRes = await fetch("/api/owner/stats");
        if (statsRes.ok) {
          const d = await statsRes.json();
          setStats(d.stats ?? null);
          setLastScan(d.lastScan ?? null);
        }
        setMessages(m => [...m, { role: "ai", text: `✅ Scan complete — ${data.summary}\n\nFull report loaded below. You also received a WhatsApp summary.`, ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      }
    } catch {
      setMessages(m => [...m, { role: "ai", text: "Scan failed. Please try again.", ts: "" }]);
    }
    setScanning(false);
  };

  const statCards = [
    { label: "Open Items",      key: "total_open",     icon: BarChart2,    color: "#2563eb", bg: "#eff6ff" },
    { label: "High Priority",   key: "high_priority",  icon: AlertTriangle, color: "#dc2626", bg: "#fee2e2" },
    { label: "Blocked",         key: "blocked",        icon: Clock,         color: "#f97316", bg: "#fff7ed" },
    { label: "Safety Issues",   key: "incidents",      icon: ShieldAlert,   color: "#7c3aed", bg: "#ede9fe" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            👑 Command Center
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Ask anything about your sites, or run a full system scan</p>
        </div>
        <button onClick={runScan} disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-60 transition-all"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
          <Zap size={15} className={scanning ? "animate-pulse" : ""} />
          {scanning ? "Scanning…" : "Run Full Scan"}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(card => {
          const Icon  = card.icon;
          const value = stats?.[card.key] ?? "—";
          return (
            <div key={card.key} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: card.bg }}>
                  <Icon size={14} style={{ color: card.color }} />
                </div>
                <span className="text-xs font-medium text-gray-500">{card.label}</span>
              </div>
              <div className="text-2xl font-black mt-1" style={{ color: card.color }}>
                {loadingStats ? <span className="text-gray-300">…</span> : value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Last scan result */}
      {lastScan && (
        <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
          <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
            <span className="text-sm font-bold text-purple-900">Last Master Scan — {lastScan.scan_date}</span>
            {lastScan.safety_status === "All Clear"
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">✅ Safety All Clear</span>
              : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">🚨 Safety Issues Open</span>
            }
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">{lastScan.executive_summary}</p>

            {/* Attention items */}
            {(lastScan.attention_required ?? []).length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <div className="text-xs font-bold text-amber-800 mb-1.5">⚠️ Needs Your Attention</div>
                <ul className="space-y-1">
                  {lastScan.attention_required.map((item, i) => (
                    <li key={i} className="text-xs text-amber-700 flex gap-2">
                      <span className="flex-shrink-0">•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Per-project status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(lastScan.projects ?? []).map((p, i) => {
                const sc = STATUS_COLOR[p.status] ?? STATUS_COLOR["On Track"];
                return (
                  <div key={i} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-900">{p.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: sc.b, color: sc.c }}>{p.status}</span>
                    </div>
                    <p className="text-[11px] text-gray-500">{p.action_needed}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 min-h-[340px] overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">AI Assistant</span>
          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">Sonnet 4.6</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Ask anything about your projects, crew, safety, budget, or blockers.</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {["What's the status of Rambam Clinic?", "Any open safety issues?", "What items are stale or blocked?", "How many items are pending review?"].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "text-white rounded-br-sm"
                  : "bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-sm"
              }`} style={msg.role === "user" ? { background: "linear-gradient(135deg,#7c3aed,#6d28d9)" } : {}}>
                {msg.text}
                {msg.ts && <div className={`text-[10px] mt-1 opacity-60 text-right`}>{msg.ts}</div>}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about your sites, or give a command…"
            className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200"
          />
          <button onClick={send} disabled={sending || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-white disabled:opacity-40 flex-shrink-0 transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
