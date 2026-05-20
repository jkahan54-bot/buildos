"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, Edit3, MessageSquare, Clock } from "lucide-react";

export default function DailyReportReviewPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [draft, setDraft]       = useState<any>(null);
  const [project, setProject]   = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [form, setForm]         = useState<any>({});
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: d } = await supabase.from("daily_log_drafts").select("*, projects(name)").eq("id", id).single();
      if (!d) return;
      setDraft(d);
      setProject(d.projects);
      setForm(d.draft_content ?? {});
      // Load today's group messages
      const { data: msgs } = await supabase.from("whatsapp_messages")
        .select("sender, content, created_at").eq("project_id", d.project_id).eq("message_date", d.log_date).order("created_at");
      setMessages(msgs ?? []);
    })();
  }, [id]);

  const confirm = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();

    // Save as official daily log
    const { data: log } = await supabase.from("daily_logs").insert({
      project_id: draft.project_id,
      org_id: prof?.org_id,
      profile_id: user!.id,
      log_date: draft.log_date,
      work_done: form.work_done,
      crew_count: form.crew_count ? parseInt(form.crew_count) : null,
      weather: form.weather,
      materials: form.materials,
      equipment: form.equipment,
      issues: form.issues,
    }).select().single();

    // Mark draft as confirmed
    await supabase.from("daily_log_drafts").update({
      status: "confirmed",
      confirmed_by: user!.id,
      confirmed_at: new Date().toISOString(),
      final_log_id: log?.id,
    }).eq("id", id);

    setSaving(false); setDone(true);
    setTimeout(() => router.push("/daily-log"), 2000);
  };

  const inp = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm";

  if (done) return (
    <div className="max-w-lg mx-auto mt-20 text-center">
      <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900">Daily log confirmed!</h2>
      <p className="text-gray-500 mt-2">Saved as the official log for {project?.name}</p>
    </div>
  );

  if (!draft) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading report…</div>
  );

  if (draft.status === "confirmed") return (
    <div className="max-w-lg mx-auto mt-20 text-center">
      <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900">Already confirmed</h2>
      <p className="text-gray-500 mt-2">This report was already approved.</p>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-orange-500 font-semibold mb-1">
          <MessageSquare size={14} />AI-generated from WhatsApp group
        </div>
        <h1 className="text-xl font-bold text-gray-900">{project?.name} — Daily Report</h1>
        <p className="text-gray-500 text-sm">{new Date(draft.log_date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
      </div>

      {/* WhatsApp messages source */}
      {messages.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="font-semibold text-sm text-green-700 mb-3 flex items-center gap-2">
            <MessageSquare size={14} />Based on {messages.length} WhatsApp message{messages.length !== 1 ? "s" : ""} from today
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-2 text-xs text-green-700">
                <span className="text-green-500 flex-shrink-0 flex items-center gap-1">
                  <Clock size={10} />{new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </span>
                <span className="font-medium">{m.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editable form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <Edit3 size={14} className="text-orange-500" />Review & edit before confirming
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Work performed today *</label>
          <textarea value={form.work_done ?? ""} onChange={e => setForm((f: any) => ({...f, work_done: e.target.value}))} rows={4}
            className={inp + " resize-none"} placeholder="Describe all work completed today…" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Crew count</label>
            <input type="number" value={form.crew_count ?? ""} onChange={e => setForm((f: any) => ({...f, crew_count: e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Weather</label>
            <input value={form.weather ?? ""} onChange={e => setForm((f: any) => ({...f, weather: e.target.value}))} className={inp} placeholder="Clear, 72°F" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Materials received</label>
          <input value={form.materials ?? ""} onChange={e => setForm((f: any) => ({...f, materials: e.target.value}))} className={inp} placeholder="e.g. 40 tons rebar" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Equipment used</label>
          <input value={form.equipment ?? ""} onChange={e => setForm((f: any) => ({...f, equipment: e.target.value}))} className={inp} placeholder="e.g. Tower crane, concrete pump" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Issues / delays</label>
          <textarea value={form.issues ?? ""} onChange={e => setForm((f: any) => ({...f, issues: e.target.value}))} rows={2}
            className={inp + " resize-none"} placeholder="Any issues, delays or safety concerns…" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => router.back()}
            className="flex-1 py-3 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
            Cancel
          </button>
          <button onClick={confirm} disabled={saving || !form.work_done}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all"
            style={{ background:"linear-gradient(135deg,#16a34a,#15803d)" }}>
            <CheckCircle size={15} />
            {saving ? "Saving…" : "Confirm & Save Official Log"}
          </button>
        </div>
      </div>
    </div>
  );
}
