"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Lang = "en" | "es" | "yi";
const T: Record<Lang, Record<string, string>> = {
  en: { hello: "Hello", site: "Which site?", rec: "Tap to record", stop: "Tap to stop", hint: "Say what got done today, problems solved, new problems, and any new costs or change orders.",
    typeIt: "Or type it instead", send: "Send for review", working: "Understanding your note…", check: "Check what we understood", right: "Looks right — send it", redo: "Record again",
    progress: "Done today", sched: "Schedule updates", closes: "Marked as fixed", new: "New problems", solved: "Solved", cost: "New costs", co: "Change orders", delay: "Delays", unclear: "Not sure we heard this right", urgent: "Marked URGENT — the office is notified right away",
    done: "Sent. Thank you.", another: "Record another", bad: "This link is not valid. Ask the office for a new one.", edit: "Fix any line that is wrong before sending.", you: "What you said", none: "Nothing" },
  es: { hello: "Hola", site: "¿Cuál obra?", rec: "Toque para grabar", stop: "Toque para parar", hint: "Diga lo que se hizo hoy, problemas resueltos, problemas nuevos, y costos nuevos u órdenes de cambio.",
    typeIt: "O escríbalo", send: "Enviar para revisar", working: "Entendiendo su nota…", check: "Revise lo que entendimos", right: "Está bien — enviar", redo: "Grabar otra vez",
    progress: "Hecho hoy", sched: "Actualizar cronograma", closes: "Marcado como resuelto", new: "Problemas nuevos", solved: "Resuelto", cost: "Costos nuevos", co: "Órdenes de cambio", delay: "Retrasos", unclear: "No estamos seguros de haber oído esto bien", urgent: "Marcado URGENTE — la oficina recibe aviso de inmediato",
    done: "Enviado. Gracias.", another: "Grabar otra", bad: "Este enlace no es válido. Pida uno nuevo a la oficina.", edit: "Corrija cualquier línea incorrecta antes de enviar.", you: "Lo que dijo", none: "Nada" },
  yi: { hello: "שלום", site: "וועלכע סייט?", rec: "דריקט צו רעקארדירן", stop: "דריקט צו שטעלן", hint: "זאגט וואס מען האט היינט געטון, פראבלעמען געלייזט, נייע פראבלעמען, און נייע קאסטן אדער טשיינדזש אָרדערס.",
    typeIt: "אָדער שרייבט עס", send: "שיקן צום איבערקוקן", working: "פארשטייט אייער נאטיץ…", check: "קוקט איבער וואס מיר האבן פארשטאנען", right: "ריכטיג — שיקן", redo: "רעקארדירן נאכאמאל",
    progress: "היינט געטון", sched: "צייטפלאן אפדעיטס", closes: "מארקירט אלס געלייזט", new: "נייע פראבלעמען", solved: "געלייזט", cost: "נייע קאסטן", co: "טשיינדזש אָרדערס", delay: "פארשפעטיקונגען", unclear: "נישט זיכער אז מיר האבן דאס ריכטיג געהערט", urgent: "מארקירט דרינגענד — דער אפיס ווערט באנאכריכטיגט תיכף",
    done: "געשיקט. א דאנק.", another: "נאך א רעקארדירונג", bad: "דער לינק איז נישט גילטיג. בעט א נייעם פון אפיס.", edit: "פארריכט יעדע שורה וואס איז פאלש.", you: "וואס איר האט געזאגט", none: "גארנישט" },
};

type Ex = { summary_en?: string; summary_local?: string; progress: string[]; issues_new: { text: string; priority: string }[]; issues_solved: string[]; costs: { text: string; amount?: string }[]; change_orders: { text: string; amount?: string }[]; delays: { text: string; days?: number | null }[]; solved_matches?: { item_id: string; text: string }[]; schedule_updates?: { task_id: string; action: string; text: string }[]; unclear?: string[]; urgent?: boolean; urgent_reason?: string; crew_count?: number | null };

export default function FieldReportPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ name: string; language: Lang; projects: { id: string; name: string }[] } | null>(null);
  const [bad, setBad] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [proj, setProj] = useState("");
  const [recording, setRecording] = useState(false);
  const [stage, setStage] = useState<"record" | "working" | "review" | "done">("record");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [rep, setRep] = useState<{ id: string; transcript: string; ex: Ex } | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const t = T[lang];
  const rtl = lang === "yi";

  useEffect(() => {
    fetch("/api/field/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setInfo(d); setLang(d.language); if (d.projects.length === 1) setProj(d.projects[0].id); })
      .catch(() => setBad(true));
  }, [token]);

  const submit = async (body: BodyInit, headers?: HeadersInit) => {
    setStage("working"); setErr("");
    const r = await fetch("/api/field/process", { method: "POST", body, headers });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Error"); setStage("record"); return; }
    setRep({ id: j.id, transcript: j.transcript, ex: { solved_matches: [], schedule_updates: [], progress: [], issues_new: [], issues_solved: [], costs: [], change_orders: [], delays: [], ...j.extracted } });
    setStage("review");
  };

  const start = async () => {
    setErr("");
    if (!proj) { setErr(t.site); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((s) => s.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const fd = new FormData();
        fd.append("token", token); fd.append("project_id", proj);
        fd.append("audio", blob, `note.${(rec.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm"}`);
        submit(fd);
      };
      rec.start(); mr.current = rec; setRecording(true);
    } catch { setErr("Microphone is blocked. Allow the microphone, or type your note below."); }
  };
  const stop = () => { mr.current?.stop(); setRecording(false); };

  const sendTyped = () => {
    if (!proj) { setErr(t.site); return; }
    submit(JSON.stringify({ token, project_id: proj, transcript: typed }), { "content-type": "application/json" });
  };

  const confirm = async () => {
    if (!rep) return;
    const r = await fetch("/api/field/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, report_id: rep.id, extracted: rep.ex }) });
    if (r.ok) setStage("done"); else setErr((await r.json()).error ?? "Error");
  };

  const setLines = (key: keyof Ex, i: number, v: string, sub?: "text") =>
    setRep((p) => {
      if (!p) return p;
      const arr: any[] = [...(p.ex[key] as any[])];
      arr[i] = sub ? { ...arr[i], [sub]: v } : v;
      return { ...p, ex: { ...p.ex, [key]: arr.filter((x) => (sub ? x.text : x)) } };
    });

  if (bad) return <Shell><p className="text-center text-gray-600 mt-24">{T.en.bad}<br /><span dir="rtl">{T.es.bad}</span></p></Shell>;
  if (!info) return <Shell><p className="text-center text-gray-400 mt-24">…</p></Shell>;

  const Section = ({ title, k, sub }: { title: string; k: keyof Ex; sub?: "text" }) => {
    const items = (rep!.ex[k] as any[]) ?? [];
    if (!items.length) return null;
    return (
      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{title}</div>
        {items.map((it, i) => (
          <input key={i} value={sub ? it.text : it} onChange={(e) => setLines(k, i, e.target.value, sub)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] mb-1.5 bg-white" />
        ))}
      </div>
    );
  };

  return (
    <Shell>
      <div dir={rtl ? "rtl" : "ltr"} className="max-w-md mx-auto px-5 pb-16">
        <div className="flex items-center justify-between pt-6">
          <div className="text-xl font-semibold text-gray-900">{t.hello}, {info.name}</div>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            <option value="en">English</option><option value="es">Español</option><option value="yi">ייִדיש</option>
          </select>
        </div>

        {stage === "record" && (
          <>
            {info.projects.length > 1 && (
              <select value={proj} onChange={(e) => setProj(e.target.value)} className="w-full mt-5 border border-gray-200 rounded-xl px-3 py-3 bg-white text-[15px]">
                <option value="">{t.site}</option>{info.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {info.projects.length === 1 && <div className="mt-5 text-gray-600">{info.projects[0].name}</div>}
            <p className="text-gray-500 text-sm mt-4">{t.hint}</p>
            <div className="flex flex-col items-center mt-8">
              <button onClick={recording ? stop : start}
                className={`w-36 h-36 rounded-full text-white font-semibold shadow-lg active:scale-95 transition ${recording ? "bg-red-600 animate-pulse" : "bg-gray-900"}`}>
                {recording ? t.stop : t.rec}
              </button>
            </div>
            {err && <p className="text-red-600 text-sm mt-4 text-center">{err}</p>}
            <details className="mt-8">
              <summary className="text-sm text-gray-500 cursor-pointer">{t.typeIt}</summary>
              <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={5} className="w-full mt-2 border border-gray-200 rounded-xl p-3 text-[15px] bg-white" />
              <button onClick={sendTyped} disabled={typed.trim().length < 5} className="mt-2 w-full py-3 rounded-xl bg-gray-900 text-white font-semibold disabled:opacity-40">{t.send}</button>
            </details>
          </>
        )}

        {stage === "working" && <p className="text-center text-gray-500 mt-28">{t.working}</p>}

        {stage === "review" && rep && (
          <div className="mt-5">
            <h2 className="text-lg font-semibold">{t.check}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.edit}</p>
            {rep.ex.urgent && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm p-3">{t.urgent}{rep.ex.urgent_reason ? `: ${rep.ex.urgent_reason}` : ""}</div>}
            <div className="mt-3 rounded-xl bg-white border border-gray-200 p-3 text-[15px] text-gray-800">{rep.ex.summary_local || rep.ex.summary_en}</div>
            {lang !== "en" && rep.ex.summary_en && <div className="mt-2 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-500" dir="ltr">{rep.ex.summary_en}</div>}
            <Section title={t.progress} k="progress" />
            <Section title={t.new} k="issues_new" sub="text" />
            <Section title={t.solved} k="issues_solved" />
            <Section title={t.closes} k="solved_matches" sub="text" />
            <Section title={t.sched} k="schedule_updates" sub="text" />
            <Section title={t.cost} k="costs" sub="text" />
            <Section title={t.co} k="change_orders" sub="text" />
            <Section title={t.delay} k="delays" sub="text" />
            {!!rep.ex.unclear?.length && (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                <div className="font-semibold mb-1">{t.unclear}</div>{rep.ex.unclear.map((u, i) => <div key={i}>• {u}</div>)}
              </div>
            )}
            <details className="mt-4"><summary className="text-sm text-gray-500 cursor-pointer">{t.you}</summary><p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap" dir="auto">{rep.transcript}</p></details>
            {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
            <button onClick={confirm} className="mt-6 w-full py-4 rounded-xl bg-gray-900 text-white font-semibold text-base">{t.right}</button>
            <button onClick={() => { fetch("/api/field/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, report_id: rep.id, action: "discard" }) }); setRep(null); setStage("record"); }}
              className="mt-2 w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-medium">{t.redo}</button>
          </div>
        )}

        {stage === "done" && (
          <div className="text-center mt-24">
            <div className="text-4xl">✓</div>
            <p className="mt-3 text-lg font-semibold">{t.done}</p>
            <button onClick={() => { setRep(null); setTyped(""); setStage("record"); }} className="mt-8 px-6 py-3 rounded-xl border border-gray-200 font-medium">{t.another}</button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 text-gray-900">{children}</div>;
}
