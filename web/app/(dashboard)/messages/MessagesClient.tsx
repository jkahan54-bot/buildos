"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, MessageSquare, ArrowLeft, Plus } from "lucide-react";

export default function MessagesClient({ channels, userId, userName }: any) {
  const [active, setActive]     = useState<any>(null);
  const [msgs, setMsgs]         = useState<any[]>([]);
  const [input, setInput]       = useState("");
  const [allChannels, setAllChannels] = useState(channels);
  const [showNew, setShowNew]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selProj, setSelProj]   = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient().from("projects").select("id,name").then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!active) return;
    loadMsgs(active.id);
    const sub = createClient().channel(`msgs-${active.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`channel_id=eq.${active.id}` },
        payload => { setMsgs(prev => [...prev, payload.new]); setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior:"smooth" }), 100); })
      .subscribe();
    return () => { createClient().removeChannel(sub); };
  }, [active]);

  const loadMsgs = async (channelId: string) => {
    const { data } = await createClient().from("messages").select("*, profiles(full_name)").eq("channel_id", channelId).order("created_at").limit(100);
    setMsgs(data ?? []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 100);
  };

  const send = async () => {
    if (!input.trim() || !active) return;
    const msg = input.trim(); setInput("");
    await createClient().from("messages").insert({ channel_id: active.id, sender_id: userId, content: msg });
  };

  const createChannel = async () => {
    if (!newName.trim()) return;
    const supabase = createClient();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    const { data } = await supabase.from("message_channels").insert({
      name: newName, org_id: prof?.org_id, project_id: selProj || null, type: "team"
    }).select("*, projects(name)").single();
    if (data) { setAllChannels((c: any[]) => [...c, data]); setShowNew(false); setNewName(""); setSelProj(""); setActive(data); }
  };

  if (active) return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => setActive(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><ArrowLeft size={16} /></button>
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">{active.name[0]}</div>
        <div>
          <div className="font-semibold text-sm text-gray-900">{active.name}</div>
          {active.projects?.name && <div className="text-xs text-gray-400">{active.projects.name}</div>}
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.length === 0 && <div className="text-center text-gray-400 text-sm py-8">No messages yet — say hello!</div>}
        {msgs.map((m, i) => {
          const isMe = m.sender_id === userId;
          return (
            <div key={m.id ?? i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%]">
                {!isMe && <div className="text-xs text-orange-500 font-semibold mb-1">{m.profiles?.full_name ?? "User"}</div>}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? "text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}
                  style={isMe ? { background:"linear-gradient(135deg,#f97316,#ea580c)" } : {}}>
                  {m.content}
                </div>
                <div className={`text-[10px] text-gray-400 mt-1 ${isMe ? "text-right" : ""}`}>
                  {new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
          placeholder="Type a message…"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
        <button onClick={send} disabled={!input.trim()}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white disabled:opacity-40 transition-all"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500 text-sm mt-0.5">{allChannels.length} channel{allChannels.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
          style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>
          <Plus size={15} />New Channel
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl border border-orange-200 p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Create Channel</h2>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Channel name (e.g. Riverside Tower)"
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm" />
          <select value={selProj} onChange={e => setSelProj(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 shadow-sm">
            <option value="">No project (general channel)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">Cancel</button>
            <button onClick={createChannel} disabled={!newName.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>Create</button>
          </div>
        </div>
      )}

      {allChannels.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <MessageSquare size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No channels yet</p>
          <p className="text-gray-400 text-sm mt-1">Create a channel for each project or team</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {allChannels.map((ch: any, i: number) => (
            <button key={ch.id} onClick={() => setActive(ch)}
              className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition-all text-left ${i < allChannels.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 flex-shrink-0">
                {ch.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{ch.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{ch.projects?.name ?? ch.type ?? "channel"}</div>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
