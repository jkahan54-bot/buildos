"use client";
import { useState } from "react";
import { Sparkles, RefreshCw, Send } from "lucide-react";

const TABS = [
  { id:"chat",   label:"BuildBot Chat",  icon:"💬" },
  { id:"review", label:"Dual AI Review", icon:"🔁" },
  { id:"parse",  label:"Email Parser",   icon:"📧" },
];

export default function AIToolsPage() {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([
    { role:"assistant", content:"Hi! I'm BuildBot. Ask me anything about your projects, budget, safety, scheduling, or construction management." }
  ]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [reviewContent, setReview]    = useState("");
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [emailContent, setEmail]      = useState("");
  const [emailResult, setEmailResult] = useState<any>(null);

  const sendChat = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim(); setInput(""); setLoading(true);
    const newMsgs = [...messages, { role:"user", content: userMsg }];
    setMessages(newMsgs);
    try {
      const res = await fetch("/api/ai/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ messages: newMsgs }) });
      const { reply } = await res.json();
      setMessages(m => [...m, { role:"assistant", content: reply ?? "Error getting response." }]);
    } catch { setMessages(m => [...m, { role:"assistant", content:"Connection error. Make sure Anthropic credits are loaded." }]); }
    setLoading(false);
  };

  const runReview = async () => {
    if (!reviewContent.trim() || loading) return;
    setLoading(true); setReviewResult(null);
    try {
      const res = await fetch("/api/ai/review", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ content: reviewContent, context:"Review this construction output for accuracy.", scenario:"Manual Review" }) });
      const data = await res.json();
      let primary = null, secondary = null;
      try { primary   = typeof data.primary   === "string" ? JSON.parse(data.primary)   : data.primary;   } catch {}
      try { secondary = typeof data.secondary === "string" ? JSON.parse(data.secondary) : data.secondary; } catch {}
      setReviewResult({ ...data, primary, secondary });
    } catch { setReviewResult({ error:"Review failed." }); }
    setLoading(false);
  };

  const parseEmail = async () => {
    if (!emailContent.trim() || loading) return;
    setLoading(true); setEmailResult(null);
    try {
      const res = await fetch("/api/ai/chat", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages:[{ role:"user", content:`Parse this subcontractor email and return a JSON summary with fields: type, project, subcontractor, summary, keyData (object), action, urgency. Return ONLY valid JSON.\n\n${emailContent}` }] }) });
      const { reply } = await res.json();
      setEmailResult(JSON.parse(reply.replace(/```json|```/g,"").trim()));
    } catch { setEmailResult({ error:"Parse failed. Check Anthropic credits." }); }
    setLoading(false);
  };

  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles size={20} className="text-orange-500" />AI Tools
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Powered by Claude + GPT-4 dual review</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 lg:px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab===t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <span className="mr-1">{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── BuildBot Chat ───────────────────────────────────── */}
      {tab==="chat" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ height:"calc(100vh - 280px)", minHeight:400 }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role==="user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role==="user"
                    ? "text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm border border-gray-200"
                }`} style={m.role==="user" ? { background:"linear-gradient(135deg,#f97316,#ea580c)" } : {}}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-gray-500 flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin text-orange-500" />Thinking…
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
              placeholder="Ask about budget, safety, scheduling, RFIs…" disabled={loading}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500" />
            <button onClick={sendChat} disabled={loading||!input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Dual AI Review ──────────────────────────────────── */}
      {tab==="review" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="font-semibold text-gray-900">Paste content to review</div>
            <p className="text-xs text-gray-500">Any AI output, takeoff, safety report, or construction document — Claude reviews it, GPT-4 cross-checks it.</p>
            <textarea value={reviewContent} onChange={e=>setReview(e.target.value)} rows={10}
              placeholder="Paste content here…" className={inp+" resize-none"} />
            <button onClick={runReview} disabled={loading||!reviewContent.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              {loading ? <><RefreshCw size={14} className="animate-spin" />Reviewing…</> : "🔁 Run Dual AI Review"}
            </button>
          </div>
          <div>
            {reviewResult?.error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-600 text-sm">{reviewResult.error}</div>
            ) : reviewResult ? (
              <div className="space-y-3">
                <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm">
                  <div className="font-semibold text-sm text-orange-600 mb-2">◆ {reviewResult.primaryModel} — Review</div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 overflow-auto max-h-48">{JSON.stringify(reviewResult.primary, null, 2)}</pre>
                </div>
                <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
                  <div className="font-semibold text-sm text-green-600 mb-2">▲ {reviewResult.secondaryModel} — Cross Check</div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 overflow-auto max-h-48">{JSON.stringify(reviewResult.secondary, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center h-full flex flex-col items-center justify-center gap-3">
                <div className="text-3xl">◆ 🔁 ▲</div>
                <p className="text-gray-500 font-semibold text-sm">Paste content and run review</p>
                <p className="text-gray-400 text-xs">Claude + GPT-4 will independently analyze and cross-check</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Email Parser ────────────────────────────────────── */}
      {tab==="parse" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="font-semibold text-gray-900">Paste a subcontractor email</div>
            <p className="text-xs text-gray-500">Claude extracts the type, project, key data, action needed, and urgency — in seconds.</p>
            <textarea value={emailContent} onChange={e=>setEmail(e.target.value)} rows={10}
              placeholder="Paste email here…" className={inp+" resize-none"} />
            <button onClick={parseEmail} disabled={loading||!emailContent.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
              {loading ? <><RefreshCw size={14} className="animate-spin" />Parsing…</> : "🤖 Parse with AI"}
            </button>
          </div>
          <div>
            {emailResult?.error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-600 text-sm">{emailResult.error}</div>
            ) : emailResult ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <div className="font-semibold text-orange-600">📧 Parsed Result</div>
                {Object.entries(emailResult).map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{k}</div>
                    <div className="text-sm text-gray-900 font-medium">{typeof v==="object" ? JSON.stringify(v,null,2) : String(v)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center flex flex-col items-center justify-center gap-3 h-full">
                <div className="text-4xl">📧</div>
                <p className="text-gray-500 font-semibold text-sm">Paste an email to parse</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
