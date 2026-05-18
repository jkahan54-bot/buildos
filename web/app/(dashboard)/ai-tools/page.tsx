"use client";
import { useState } from "react";

const TABS = [
  { id:"chat",   label:"BuildBot Chat",    icon:"💬" },
  { id:"review", label:"Dual AI Review",   icon:"🔁" },
  { id:"parse",  label:"Email Parser",     icon:"📧" },
];

export default function AIToolsPage() {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([
    { role:"assistant", content:"Hi! I'm BuildBot. Ask me anything about your projects, budget, safety, scheduling, or construction management." }
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewResult, setReviewResult]   = useState<any>(null);
  const [emailContent, setEmailContent]   = useState("");
  const [emailResult, setEmailResult]     = useState<any>(null);

  const sendChat = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim(); setInput(""); setLoading(true);
    const newMsgs = [...messages, { role:"user", content: userMsg }];
    setMessages(newMsgs);
    try {
      const res = await fetch("/api/ai/chat", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const { reply } = await res.json();
      setMessages(m => [...m, { role:"assistant", content: reply ?? "Error getting response." }]);
    } catch { setMessages(m => [...m, { role:"assistant", content:"Connection error. Try again." }]); }
    setLoading(false);
  };

  const runReview = async () => {
    if (!reviewContent.trim() || loading) return;
    setLoading(true); setReviewResult(null);
    try {
      const res = await fetch("/api/ai/review", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ content: reviewContent, context:"Review this construction output for accuracy.", scenario:"Manual Review" }),
      });
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
      const res = await fetch("/api/ai/chat", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          messages:[{ role:"user", content: `Parse this subcontractor email and return a JSON summary with fields: type, project, subcontractor, summary, keyData (object), action, urgency. Return ONLY valid JSON.\n\n${emailContent}` }],
        }),
      });
      const { reply } = await res.json();
      setEmailResult(JSON.parse(reply.replace(/```json|```/g,"").trim()));
    } catch { setEmailResult({ error:"Parse failed." }); }
    setLoading(false);
  };

  const inp = "w-full bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">AI Tools</h1>
        <p className="text-gray-500 text-sm mt-1">Powered by Claude + GPT-4 dual review</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl border border-border p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === t.id ? "bg-brand text-white" : "text-gray-500 hover:text-gray-200"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* BuildBot Chat */}
      {tab === "chat" && (
        <div className="bg-surface rounded-xl border border-border flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                  ${m.role === "user" ? "bg-brand text-white rounded-br-sm" : "bg-surface-card border border-border rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-card border border-border px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-gray-500">
                  Thinking…
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-border p-4 flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
              placeholder="Ask about budget, safety, scheduling, RFIs…" disabled={loading}
              className="flex-1 bg-surface-panel border border-border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand" />
            <button onClick={sendChat} disabled={loading || !input.trim()}
              className="bg-brand hover:bg-brand-dark text-white font-bold px-5 rounded-lg transition-colors disabled:opacity-50">→</button>
          </div>
        </div>
      )}

      {/* Dual Review */}
      {tab === "review" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="font-bold mb-3">Content to Review</div>
              <textarea value={reviewContent} onChange={e => setReviewContent(e.target.value)} rows={10}
                placeholder="Paste any AI-generated output, takeoff, safety report, or construction document…"
                className={inp + " resize-none"} />
              <button onClick={runReview} disabled={loading || !reviewContent.trim()}
                className="mt-3 w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loading ? "Reviewing…" : "🔁 Run Dual AI Review"}
              </button>
            </div>
          </div>
          <div>
            {reviewResult?.error ? (
              <div className="bg-surface rounded-xl border border-red-500/30 p-5 text-red-400">{reviewResult.error}</div>
            ) : reviewResult ? (
              <div className="space-y-3">
                <div className="bg-surface rounded-xl border border-brand/30 p-5">
                  <div className="font-bold text-sm text-orange-400 mb-3">◆ {reviewResult.primaryModel} — Self Review</div>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">{JSON.stringify(reviewResult.primary, null, 2)}</pre>
                </div>
                <div className="bg-surface rounded-xl border border-green-500/30 p-5">
                  <div className="font-bold text-sm text-green-400 mb-3">▲ {reviewResult.secondaryModel} — Cross Check</div>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">{JSON.stringify(reviewResult.secondary, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="text-4xl mb-3">◆ 🔁 ▲</div>
                <p className="text-gray-500 font-semibold">Paste content and run review</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Parser */}
      {tab === "parse" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-xl border border-border p-5 space-y-3">
            <div className="font-bold">Paste Subcontractor Email</div>
            <textarea value={emailContent} onChange={e => setEmailContent(e.target.value)} rows={12}
              placeholder="Paste any email from a subcontractor, vendor, or field worker…"
              className={inp + " resize-none"} />
            <button onClick={parseEmail} disabled={loading || !emailContent.trim()}
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {loading ? "Parsing…" : "🤖 Parse with AI"}
            </button>
          </div>
          <div>
            {emailResult?.error ? (
              <div className="bg-surface rounded-xl border border-red-500/30 p-5 text-red-400">{emailResult.error}</div>
            ) : emailResult ? (
              <div className="bg-surface rounded-xl border border-brand/30 p-5 space-y-3">
                <div className="font-bold text-brand">📧 Parsed Result</div>
                {Object.entries(emailResult).map(([k, v]) => (
                  <div key={k} className="bg-surface-panel rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{k}</div>
                    <div className="text-sm text-white">{typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center h-full">
                <div className="text-4xl mb-3">📧</div>
                <p className="text-gray-500 font-semibold">Paste an email to parse</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
