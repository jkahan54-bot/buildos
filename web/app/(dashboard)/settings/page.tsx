"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AVAILABLE_MODELS } from "@/lib/ai";

export default function SettingsPage() {
  const [profile, setProfile]   = useState<any>(null);
  const [primary, setPrimary]   = useState("claude-sonnet-4-6");
  const [secondary, setSecondary] = useState("gpt-4o");
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      setProfile(data);
      setPrimary(data?.ai_primary_model ?? "claude-sonnet-4-6");
      setSecondary(data?.ai_secondary_model ?? "gpt-4o");
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("profiles").update({ ai_primary_model: primary, ai_secondary_model: secondary }).eq("id", user!.id);
    setSaved(true); setLoading(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const anthropicModels = AVAILABLE_MODELS.filter(m => m.provider === "anthropic");
  const openaiModels    = AVAILABLE_MODELS.filter(m => m.provider === "openai");

  const ModelCard = ({ model, selected, onSelect }: any) => (
    <button onClick={() => onSelect(model.id)}
      className={`p-4 rounded-xl border text-left transition-colors w-full ${selected ? "border-brand bg-brand/10" : "border-border hover:border-gray-500"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${model.provider === "anthropic" ? "bg-orange-400" : "bg-green-400"}`} />
        <span className="font-bold text-sm">{model.name}</span>
        {selected && <span className="ml-auto text-xs text-brand font-bold">Selected</span>}
      </div>
      <p className="text-xs text-gray-500">{model.description}</p>
    </button>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black">AI Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Choose which AI models power BuildBot and dual reviews. Swap anytime as new models release.
        </p>
      </div>

      {/* Primary model */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="font-bold mb-1">Primary AI Model <span className="text-brand">◆</span></div>
        <p className="text-sm text-gray-500 mb-4">Used for BuildBot chat, safety analysis, takeoff, and all main AI features.</p>
        <div className="mb-3 text-xs text-orange-400 font-bold uppercase tracking-wider">Claude (Anthropic)</div>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {anthropicModels.map(m => <ModelCard key={m.id} model={m} selected={primary === m.id} onSelect={setPrimary} />)}
        </div>
        <div className="mb-3 text-xs text-green-400 font-bold uppercase tracking-wider">GPT (OpenAI)</div>
        <div className="grid grid-cols-1 gap-2">
          {openaiModels.map(m => <ModelCard key={m.id} model={m} selected={primary === m.id} onSelect={setPrimary} />)}
        </div>
      </div>

      {/* Secondary model */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="font-bold mb-1">Cross-Check AI Model <span className="text-green-400">▲</span></div>
        <p className="text-sm text-gray-500 mb-4">Used to independently verify the primary AI's output in Dual Review.</p>
        <div className="grid grid-cols-1 gap-2">
          {AVAILABLE_MODELS.filter(m => m.id !== primary).map(m => (
            <ModelCard key={m.id} model={m} selected={secondary === m.id} onSelect={setSecondary} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={loading}
          className="bg-brand hover:bg-brand-dark text-white font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {loading ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span className="text-green-400 text-sm font-semibold">✓ Saved!</span>}
      </div>

      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="font-bold mb-3">Account</div>
        <div className="space-y-1 text-sm text-gray-400">
          <div><span className="text-gray-600">Name: </span>{profile?.full_name}</div>
          <div><span className="text-gray-600">Email: </span>{profile?.email}</div>
          <div><span className="text-gray-600">Role: </span>{profile?.role}</div>
        </div>
      </div>
    </div>
  );
}
