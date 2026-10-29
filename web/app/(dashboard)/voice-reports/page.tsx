"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Link = { id: string; person_name: string; language: string; project_ids: string[]; expires_at: string; revoked_at: string | null; last_used_at: string | null };
type Report = { id: string; report_date: string; status: string; transcript_english: string | null; confirmed_items: any[] | null; link_id: string; sent_at: string | null };
type Draft = { id: string; report_id: string; kind: string; summary: string; amount: number | null; status: string };

export default function VoiceReportsPage() {
  const supabase = createClient();
  const [links, setLinks] = useState<Link[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ person_name: "", phone: "", language: "en", project_ids: [] as string[] });
  const [newUrl, setNewUrl] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [l, r, d, p, s] = await Promise.all([
      fetch("/api/report-links").then(x => x.json()).catch(() => ({})),
      supabase.from("voice_reports").select("id, report_date, status, transcript_english, confirmed_items, link_id, sent_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("report_drafts").select("id, report_id, kind, summary, amount, status").eq("status", "draft").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").eq("status", "active").order("name"),
      fetch("/api/report-settings").then(x => x.json()).catch(() => ({})),
    ]);
    setLinks(l.links ?? []); setReports((r.data as Report[]) ?? []); setDrafts((d.data as Draft[]) ?? []); setProjects(p.data ?? []);
    setAmount(s.settings?.cost_alert_amount ?? "");
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const call = async (method: string, body: any, url = "/api/report-links") => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(j.error ?? "Failed"); else setMsg("");
    return j;
  };
  const create = async () => {
    if (!form.person_name.trim()) return;
    const j = await call("POST", form); if (j.url) { setNewUrl(j.url); setForm({ ...form, person_name: "", phone: "" }); load(); }
  };
  const act = async (id: string, action: string) => {
    if (action === "revoke" && !confirm("Turn this link off?")) return;
    const j = await call("PATCH", { id, action }); if (j.url) setNewUrl(j.url); load();
  };
  const play = async (id: string) => {
    const j = await fetch(`/api/voice-reports/${id}/audio`).then(r => r.json()); if (j.url) new Audio(j.url).play();
  };
  const saveAmount = async () => { await call("PUT", { cost_alert_amount: amount === "" ? null : Number(amount) }, "/api/report-settings"); setMsg("Saved"); };
  const nameOf = (id: string) => links.find(l => l.id === id)?.person_name ?? "";

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">Voice Reports</h1>
      {msg && <p className="text-sm text-amber-700">{msg}</p>}

      {newUrl && <div className="bg-green-50 border border-green-300 rounded-xl p-4">
        <b>Send this link to the person. It is shown only once.</b>
        <div className="font-mono text-sm break-all my-2">{newUrl}</div>
        <button className="px-3 py-1 rounded bg-gray-900 text-white" onClick={() => { navigator.clipboard.writeText(newUrl); }}>Copy</button>
        <button className="px-3 py-1 ml-2" onClick={() => setNewUrl("")}>Done</button></div>}

      <section>
        <h2 className="font-semibold mb-2">Needs approval ({drafts.length})</h2>
        {drafts.length === 0 && <p className="text-sm text-gray-500">Nothing waiting. Costs, change orders and date changes from voice notes land here as drafts.</p>}
        {drafts.map(d => <div key={d.id} className="border rounded-lg p-3 mb-2 bg-white text-sm"><b>{d.kind.replace("_", " ")}</b>{d.amount != null && ` · $${Number(d.amount).toLocaleString()}`} · {d.summary}</div>)}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Personal links</h2>
        <div className="grid gap-2 sm:grid-cols-4 mb-2">
          <input className="border rounded p-2" placeholder="Name" value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} />
          <input className="border rounded p-2" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <select className="border rounded p-2" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
            <option value="en">English</option><option value="es">Spanish</option><option value="yi">Yiddish</option><option value="mixed">Mixed</option></select>
          <button className="rounded bg-gray-900 text-white p-2" onClick={create}>Create link</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">{projects.map(p => (
          <label key={p.id} className="text-sm border rounded px-2 py-1 bg-white"><input type="checkbox" checked={form.project_ids.includes(p.id)}
            onChange={e => setForm({ ...form, project_ids: e.target.checked ? [...form.project_ids, p.id] : form.project_ids.filter(x => x !== p.id) })} /> {p.name}</label>))}</div>
        {links.map(l => (
          <div key={l.id} className="border rounded-lg p-3 mb-2 bg-white text-sm flex flex-wrap items-center gap-3">
            <b>{l.person_name}</b><span>{l.language}</span><span>{l.project_ids.length} jobs</span>
            <span className={l.revoked_at ? "text-red-600" : "text-green-700"}>{l.revoked_at ? "off" : "active"}</span>
            <span className="text-gray-500">last used {l.last_used_at ? new Date(l.last_used_at).toLocaleString() : "never"}</span>
            <span className="flex-1" />
            {!l.revoked_at && <button className="underline" onClick={() => act(l.id, "revoke")}>Turn off</button>}
            <button className="underline" onClick={() => act(l.id, "replace")}>New link</button>
            {!l.revoked_at && <button className="underline" onClick={() => act(l.id, "renew")}>Extend</button>}
          </div>))}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Cost alert</h2>
        <p className="text-sm text-gray-600 mb-2">Costs at or above this amount alert the office right away. Blank means every cost alerts.</p>
        <input className="border rounded p-2 mr-2" placeholder="$ amount" value={amount} onChange={e => setAmount(e.target.value)} />
        <button className="rounded bg-gray-900 text-white px-3 py-2" onClick={saveAmount}>Save</button>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Recent reports</h2>
        {reports.map(r => (
          <div key={r.id} className="border rounded-lg p-3 mb-2 bg-white text-sm">
            <div className="flex gap-3"><b>{nameOf(r.link_id)}</b><span>{r.report_date}</span><span className="text-gray-500">{r.status.replace("_", " ")}</span>
              <span className="flex-1" /><button className="underline" onClick={() => play(r.id)}>Play audio</button></div>
            {(r.confirmed_items ?? []).map((i: any) => <div key={i.id} className="mt-1">• {i.text_en}</div>)}
          </div>))}
      </section>
    </div>
  );
}
