"use client";
import { useEffect, useRef, useState } from "react";

type Item = {
  id: string; kind: string; text_en: string; text_original?: string; project_id: string | null;
  amount?: number | null; quantity?: string | null; days?: number | null; date?: string | null; needs_person?: boolean;
};
type Info = {
  person: string; language: string; projects: { id: string; name: string }[];
  pending: { id: string; items: Item[]; transcript_english: string | null; low_confidence: boolean } | null;
  history: { id: string; date: string; items: number }[];
};
type Decision = { ok: boolean; fixing?: boolean; text?: string; amount?: string; date?: string; quantity?: string; days?: string; ack: Record<string, boolean> };

const PROMPTS = [
  "1. What did we get done today?",
  "2. What got solved?",
  "3. What is new or blocked?",
  "4. Any new costs or change orders?",
  "5. What is planned for tomorrow?",
];
const KIND: Record<string, string> = {
  progress: "Progress", solved: "Solved", issue: "Issue", delay: "Delay", cost: "Cost", change_order: "Change order",
  safety: "Safety", inspection: "Inspection", failed_inspection: "Failed inspection", stop_work: "Stop work", injury: "Injury",
  neighbor_damage: "Neighbor damage", permit: "Permit", neighbor_legal: "Neighbor / legal", schedule: "Schedule", note: "Note",
};
const critical = (it: Item) => [
  ...(it.amount != null ? ["amount"] : []), ...(it.date ? ["date"] : []),
  ...(it.quantity ? ["quantity"] : []), ...(it.days != null ? ["days"] : []),
];

export default function ReportPage({ params }: { params: { token: string } }) {
  const base = `/api/r/${params.token}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [state, setState] = useState<"loading" | "dead" | "ready" | "recording" | "uploading" | "confirm" | "done">("loading");
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [report, setReport] = useState<NonNullable<Info["pending"]> | null>(null);
  const [dec, setDec] = useState<Record<string, Decision>>({});
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timer = useRef<any>(null);

  const load = async () => {
    const r = await fetch(base, { cache: "no-store" });
    if (!r.ok) { setState("dead"); return; }
    const j: Info = await r.json();
    setInfo(j);
    if (j.pending) openConfirm(j.pending); else setState("ready");
  };
  useEffect(() => { load(); return () => clearInterval(timer.current); /* eslint-disable-next-line */ }, []);

  const openConfirm = (p: NonNullable<Info["pending"]>) => {
    setReport(p);
    const d: Record<string, Decision> = {};
    p.items.forEach(i => { d[i.id] = { ok: false, ack: {} }; });
    setDec(d);
    setState("confirm");
  };

  const start = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(m => (window as any).MediaRecorder?.isTypeSupported?.(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = e => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setBlob(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
        clearInterval(timer.current);
      };
      rec.start(1000);
      recRef.current = rec; setSecs(0); setBlob(null); setState("recording");
      timer.current = setInterval(() => setSecs(s => s + 1), 1000);
    } catch { setErr("I can't use the microphone. Allow it in your browser settings, then try again."); }
  };
  const stop = () => { recRef.current?.stop(); setState("ready"); };

  const send = async () => {
    if (!blob) return;
    setErr(""); setState("uploading");
    try {
      const fd = new FormData(); fd.append("audio", blob, "report");
      const r = await fetch(`${base}/upload`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Upload failed");
      setBlob(null);
      await load();
    } catch (e: any) {
      // The recording is kept on screen so nothing is lost on a bad connection
      setErr((navigator.onLine ? e.message : "No connection. Your recording is saved here. Tap Send again when you have signal.") || "Upload failed");
      setState("ready");
    }
  };

  const confirm = async () => {
    if (!report) return;
    setErr("");
    const decisions = report.items.map(it => {
      const d = dec[it.id];
      const fix = d.fixing ? {
        text_en: d.text ?? it.text_en,
        amount: d.amount !== undefined && d.amount !== "" ? Number(d.amount) : it.amount,
        date: d.date !== undefined ? d.date || null : it.date,
        quantity: d.quantity !== undefined ? d.quantity || null : it.quantity,
        days: d.days !== undefined && d.days !== "" ? Number(d.days) : it.days,
      } : undefined;
      return { id: it.id, ok: d.ok, fix, ack: d.ack };
    });
    const r = await fetch(`${base}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report_id: report.id, decisions }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Could not send"); return; }
    setState("done");
  };

  const allSet = report?.items.every(it => {
    const d = dec[it.id]; if (!d) return false;
    if (!d.ok && !d.fixing) return false;
    return d.fixing || d.ok ? true : false;
  }) ?? false;
  const needsAck = report?.items.some(it => (dec[it.id]?.ok || dec[it.id]?.fixing) && critical(it).some(f => !dec[it.id].ack[f])) ?? false;
  const mm = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  const proj = (id: string | null) => info?.projects.find(p => p.id === id)?.name ?? "Job not identified";

  const box = "min-h-screen bg-gray-50 text-gray-900 p-4 max-w-md mx-auto";
  const big = "w-full rounded-2xl py-5 text-lg font-bold";

  if (state === "loading") return <div className={box}>Loading…</div>;
  if (state === "dead") return <div className={box}><h1 className="text-xl font-bold mt-10">This link is not active</h1><p className="mt-2 text-gray-600">Ask the office for a new link.</p></div>;
  if (state === "done") return (
    <div className={box}><h1 className="text-2xl font-bold mt-10">Sent. Thank you.</h1>
      <p className="mt-2 text-gray-600">The office has your report.</p>
      <button className={`${big} bg-gray-900 text-white mt-6`} onClick={() => { setReport(null); load(); }}>Record another</button></div>
  );

  if (state === "confirm" && report) return (
    <div className={box}>
      <h1 className="text-xl font-bold">Here is what I understood</h1>
      <p className="text-sm text-gray-600 mb-3">Check each line. Tap <b>Correct</b> or <b>Fix</b>. Nothing is sent until you tap Send.</p>
      {report.low_confidence && <p className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm mb-3">I may have misheard some of this. Please read every line carefully.</p>}
      {report.items.length === 0 && <p className="bg-white rounded-xl p-4 border">I did not catch anything. Please record again.</p>}
      {report.items.map(it => {
        const d = dec[it.id]; const crit = critical(it);
        return (
          <div key={it.id} className={`bg-white rounded-2xl border p-4 mb-3 ${d.ok || d.fixing ? "border-green-400" : "border-gray-200"}`}>
            <div className="text-xs font-semibold text-gray-500">{KIND[it.kind] ?? it.kind} · {proj(it.project_id)}{it.needs_person ? " · office will check" : ""}</div>
            {d.fixing
              ? <textarea className="w-full border rounded-lg p-2 mt-1" rows={3} defaultValue={it.text_en} onChange={e => setDec({ ...dec, [it.id]: { ...d, text: e.target.value } })} />
              : <p className="text-base mt-1">{it.text_en}</p>}
            {it.text_original && !d.fixing && <p className="text-xs text-gray-400 mt-1">“{it.text_original}”</p>}
            {crit.map(f => {
              const val = f === "amount" ? `$${Number(it.amount).toLocaleString()}` : f === "days" ? `${it.days} days` : String((it as any)[f]);
              return (
                <div key={f} className="mt-3 bg-gray-50 rounded-xl p-3">
                  <div className="text-xs uppercase text-gray-500">{f}</div>
                  {d.fixing
                    ? <input className="w-full border rounded-lg p-2 text-2xl font-bold" defaultValue={f === "amount" ? it.amount ?? "" : f === "days" ? it.days ?? "" : (it as any)[f] ?? ""} onChange={e => setDec({ ...dec, [it.id]: { ...d, [f]: e.target.value } })} />
                    : <div className="text-3xl font-extrabold">{val}</div>}
                  <label className="flex items-center gap-2 mt-2 text-base">
                    <input type="checkbox" className="w-6 h-6" checked={!!d.ack[f]} onChange={e => setDec({ ...dec, [it.id]: { ...d, ack: { ...d.ack, [f]: e.target.checked } } })} />
                    This {f} is right
                  </label>
                </div>
              );
            })}
            <div className="flex gap-2 mt-3">
              <button className={`flex-1 rounded-xl py-3 font-bold ${d.ok && !d.fixing ? "bg-green-600 text-white" : "bg-gray-100"}`} onClick={() => setDec({ ...dec, [it.id]: { ...d, ok: true, fixing: false } })}>Correct</button>
              <button className={`flex-1 rounded-xl py-3 font-bold ${d.fixing ? "bg-amber-500 text-white" : "bg-gray-100"}`} onClick={() => setDec({ ...dec, [it.id]: { ...d, fixing: true, ok: false } })}>Fix</button>
            </div>
          </div>
        );
      })}
      {err && <p className="text-red-600 my-2">{err}</p>}
      <button disabled={!allSet || needsAck} className={`${big} ${allSet && !needsAck ? "bg-green-600 text-white" : "bg-gray-300 text-gray-500"}`} onClick={confirm}>Send to the office</button>
      <button className="w-full py-4 text-gray-600" onClick={() => { setReport(null); setState("ready"); }}>Record again instead</button>
    </div>
  );

  return (
    <div className={box}>
      <h1 className="text-2xl font-bold mt-4">Hi {info?.person}</h1>
      <p className="text-gray-600">Daily report · {info?.projects.map(p => p.name).join(", ") || "your jobs"}</p>
      <ul className="bg-white rounded-2xl border p-4 my-4 space-y-1 text-base">{PROMPTS.map(p => <li key={p}>{p}</li>)}</ul>
      <p className="text-sm text-gray-500 mb-3">Speak in English, Spanish or Yiddish. One long note or a few short ones both work. You will check everything before it is sent.</p>
      {err && <p className="text-red-600 mb-2">{err}</p>}
      {state === "recording" && <><div className="text-center text-4xl font-mono my-4">{mm(secs)}</div><button className={`${big} bg-red-600 text-white`} onClick={stop}>Stop</button></>}
      {state === "ready" && !blob && <button className={`${big} bg-gray-900 text-white`} onClick={start}>Start recording</button>}
      {state === "ready" && blob && <>
        <audio controls src={URL.createObjectURL(blob)} className="w-full mb-3" />
        <button className={`${big} bg-green-600 text-white`} onClick={send}>Send recording</button>
        <button className="w-full py-4 text-gray-600" onClick={start}>Record again</button></>}
      {state === "uploading" && <p className="text-center text-lg my-8">Listening to your report… this can take a minute.</p>}
      {!!info?.history.length && <div className="mt-6 text-sm text-gray-500"><div className="font-semibold">Your recent reports</div>{info.history.map(h => <div key={h.id}>{h.date} · {h.items} items</div>)}</div>}
    </div>
  );
}
