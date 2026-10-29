"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, Copy, Mic, X } from "lucide-react";

const inp = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400";

export default function FieldLinksPage() {
  const [role, setRole] = useState<string | null>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [form, setForm] = useState({ person_name: "", language: "en", notify: "", days: 90 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<{ name: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const r = await fetch("/api/field/links");
    if (r.ok) setLinks((await r.json()).links);
    const supabase = createClient();
    const { data } = await supabase.from("voice_reports").select("id, person_name, priority, status, created_at, extracted, projects(name)").eq("status", "confirmed").order("created_at", { ascending: false }).limit(20);
    setReports(data ?? []);
  };
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
      setRole(p?.role ?? "");
      if (p?.role === "owner" || p?.role === "admin") {
        const { data: s } = await supabase.from("projects").select("id, name").eq("status", "active").order("name");
        setSites(s ?? []); load();
      }
    })();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const r = await fetch("/api/field/links", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ person_name: form.person_name, language: form.language, days: form.days, project_ids: Array.from(picked), notify_emails: form.notify.split(/[,\s]+/).filter(Boolean) }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Could not create"); return; }
    setFresh({ name: form.person_name, url: j.url }); setCopied(false);
    setForm({ person_name: "", language: "en", notify: "", days: 90 }); setPicked(new Set()); load();
  };
  const revoke = async (id: string) => { if (confirm("Revoke this link? It stops working immediately.")) { await fetch(`/api/field/links?id=${id}`, { method: "DELETE" }); load(); } };

  if (role === null) return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>;
  if (role !== "owner" && role !== "admin") return <div className="p-10 text-center text-gray-500 text-sm">Only owners and administrators can manage field links.</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2"><Mic size={20} />Field Links</h1>
        <p className="text-gray-500 text-sm mt-1">A personal link for each site manager. No login. They record a voice note, check what the system understood, and send it. You can revoke any link at any time.</p>
      </div>

      {fresh && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="text-sm font-semibold text-green-900">Link for {fresh.name} — copy it now, it is shown only once</div>
          <div className="flex gap-2 mt-2">
            <input readOnly value={fresh.url} className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-sm font-mono" onFocus={(e) => e.target.select()} />
            <button onClick={() => { navigator.clipboard.writeText(fresh.url); setCopied(true); }} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold flex items-center gap-1.5">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
            <button onClick={() => setFresh(null)} className="px-2 text-green-900"><X size={16} /></button>
          </div>
          <p className="text-xs text-green-800 mt-2">Send it to them on WhatsApp. Anyone with this link can file reports for their sites, so treat it like a key.</p>
        </div>
      )}

      <form onSubmit={create} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="font-semibold text-sm">New link</div>
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Name *</label><input required className={inp} value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Language for the read-back</label>
            <select className={inp} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="es">Español</option><option value="yi">ייִדיש (Yiddish)</option></select></div>
          <div><label className="text-xs text-gray-500">Link valid for (days)</label><input type="number" min={1} max={365} className={inp} value={form.days} onChange={(e) => setForm({ ...form, days: +e.target.value })} /></div>
        </div>
        <div><label className="text-xs text-gray-500">Urgent items go to (emails, comma separated — blank = you)</label><input className={inp} value={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.value })} placeholder="yakov@…, ephraim@…" /></div>
        <div>
          <label className="text-xs text-gray-500">Sites this person can report on *</label>
          <div className="grid sm:grid-cols-2 gap-1.5 mt-1">
            {sites.map((s) => { const on = picked.has(s.id); return (
              <button type="button" key={s.id} onClick={() => setPicked((p) => { const n = new Set(p); on ? n.delete(s.id) : n.add(s.id); return n; })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm border text-left ${on ? "border-gray-900 bg-gray-50" : "border-gray-200 text-gray-500"}`}>
                <span className={`w-4 h-4 rounded flex items-center justify-center border ${on ? "bg-gray-900 border-gray-900" : "border-gray-300"}`}>{on && <Check size={11} className="text-white" strokeWidth={3} />}</span>{s.name}
              </button>); })}
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={!form.person_name || picked.size === 0} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 disabled:opacity-40">Create link</button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-3 text-sm font-semibold">Active links</div>
        {links.length === 0 && <div className="px-5 py-6 text-sm text-gray-400">None yet.</div>}
        {links.map((l) => (
          <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{l.person_name} <span className="text-xs text-gray-400">· {l.project_ids.length} site(s) · {l.language}</span></div>
              <div className="text-xs text-gray-400">{l.revoked ? "Revoked" : `Expires ${new Date(l.expires_at).toLocaleDateString()}`} · {l.last_used_at ? `last used ${new Date(l.last_used_at).toLocaleDateString()}` : "never used"}</div>
            </div>
            {!l.revoked && <button onClick={() => revoke(l.id)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-300 hover:text-red-600">Revoke</button>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-3 text-sm font-semibold">Recent voice reports</div>
        {reports.length === 0 && <div className="px-5 py-6 text-sm text-gray-400">No reports yet.</div>}
        {reports.map((r) => (
          <div key={r.id} className="px-5 py-3">
            <div className="text-sm font-medium">{r.projects?.name} <span className="text-xs text-gray-400">· {r.person_name} · {new Date(r.created_at).toLocaleString()}</span>{r.priority === "urgent" && <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">Urgent</span>}</div>
            <div className="text-sm text-gray-600 mt-0.5">{r.extracted?.summary_en}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
