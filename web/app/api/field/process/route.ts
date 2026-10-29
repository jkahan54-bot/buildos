import { NextRequest, NextResponse } from "next/server";
import { admin, resolveLink } from "@/lib/fieldLink";

export const maxDuration = 60;

const LANG_NAME: Record<string, string> = { en: "English", es: "Spanish", yi: "Yiddish" };

// Step 1 of a voice report: audio (or typed/dictated text) -> transcript -> structured draft.
// Nothing is filed here. The manager must confirm the read-back first (/api/field/confirm).
export async function POST(req: NextRequest) {
  let token = "", projectId = "", transcript = "", audio: File | null = null;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const f = await req.formData();
    token = String(f.get("token") ?? ""); projectId = String(f.get("project_id") ?? "");
    transcript = String(f.get("transcript") ?? "");
    const a = f.get("audio"); if (a instanceof File) audio = a;
  } else {
    const b = await req.json(); token = b.token; projectId = b.project_id; transcript = b.transcript ?? "";
  }

  const link = await resolveLink(token);
  if (!link) return NextResponse.json({ error: "This link is not valid any more. Ask the office for a new one." }, { status: 401 });
  if (!link.project_ids.includes(projectId)) return NextResponse.json({ error: "Pick one of your sites" }, { status: 403 });

  // 1. Speech to text (Whisper auto-detects Spanish / Yiddish / accented English)
  let detected = "";
  if (audio) {
    if (audio.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Recording too long — please split it into shorter notes" }, { status: 413 });
    const fd = new FormData();
    fd.append("file", audio, audio.name || "note.webm");
    fd.append("model", "whisper-1");
    fd.append("response_format", "verbose_json");
    // Context helps with construction words and names.
    fd.append("prompt", "Construction site daily report: concrete, rebar, sheetrock, framing, plumber, electrician, DOB inspection, permit, change order, SOE, scaffolding.");
    const w = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd, signal: AbortSignal.timeout(45000),
    });
    if (!w.ok) return NextResponse.json({ error: "Could not transcribe the recording. You can type it instead." }, { status: 502 });
    const wj = await w.json();
    transcript = String(wj.text ?? "").trim(); detected = String(wj.language ?? "");
  }
  transcript = transcript.trim().slice(0, 8000);
  if (transcript.length < 5) return NextResponse.json({ error: "Nothing was heard. Please try again." }, { status: 422 });

  // 2. Extract structure
  const { data: proj } = await admin.from("projects").select("name").eq("id", projectId).single();
  const target = LANG_NAME[link.language] ?? "English";
  // Existing records on this site, so the AI can match what was said to real items instead of inventing new ones.
  const [{ data: openItems }, { data: sched }] = await Promise.all([
    admin.from("punch_list_items").select("id, title").eq("project_id", projectId).in("status", ["open", "in_progress", "pending_review"]).order("created_at", { ascending: false }).limit(40),
    admin.from("schedule_tasks").select("id, title, status").eq("project_id", projectId).neq("status", "complete").order("sort_order").limit(40),
  ]);
  const openList = (openItems ?? []).map((i) => `${i.id} :: ${i.title}`).join("\n") || "(none)";
  const schedList = (sched ?? []).map((s) => `${s.id} :: ${s.title} [${s.status}]`).join("\n") || "(none)";
  const prompt = `You file daily reports for a NYC construction company. A site manager (${link.person_name}) recorded a voice note about the site "${proj?.name}". It may be in English with an accent, Spanish or Yiddish, and the transcript may contain recognition errors — use context to fix obvious ones, but NEVER invent facts, names, numbers or costs. If unsure, put the doubt in "unclear".

Transcript:
"""${transcript}"""

Return ONLY JSON:
{
 "summary_en": "2-4 sentence plain English summary",
 "summary_local": "the same summary in ${target}${target === "English" ? " (identical)" : ""}",
 "progress": ["what got done today, one short line each"],
 "issues_new": [{"text":"...","priority":"high|medium|low"}],
 "issues_solved": ["..."],
 "costs": [{"text":"what and who","amount":"as spoken or null"}],
 "change_orders": [{"text":"...","amount":"as spoken or null"}],
 "delays": [{"text":"what is delayed and why","days":number|null}],
 "solved_matches": [{"item_id":"id from OPEN ITEMS","text":"short label"}],
 "schedule_updates": [{"task_id":"id from SCHEDULE","action":"started|complete","text":"short label"}],
 "crew_count": number|null,
 "unclear": ["anything you were not sure you heard right"],
 "urgent": true|false,
 "urgent_reason": "why, or empty"
}
OPEN ITEMS on this site (use ONLY these ids in solved_matches, and only when the speaker clearly says that exact problem is now fixed):
${openList}

SCHEDULE items on this site (use ONLY these ids in schedule_updates, only when the speaker clearly says that work started or finished):
${schedList}

"urgent" is true ONLY for: injury/accident, safety hazard, stop-work or violation, work stopped, a cost or change order that needs a decision today, or a problem that will delay other trades within 48 hours. Questions are not facts. Empty arrays when nothing applies.`;

  let ex: any = null;
  for (const [model, ms] of [["claude-sonnet-5-5", 40000], ["claude-haiku-4-5-20251001", 15000]] as const) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2500, ...(model.includes("sonnet-5") ? { thinking: { type: "between_tools" } } : {}), messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(ms),
      });
      const j = await r.json();
      const text = (j.content ?? []).find((b: any) => b.type === "text")?.text ?? "";
      if (text) { ex = JSON.parse(text.replace(/```json|```/g, "").trim()); break; }
    } catch { /* try next model */ }
  }
  if (!ex) return NextResponse.json({ error: "Could not understand the note. Please try again or type it." }, { status: 502 });

  // Too thin to file: ask for more rather than saving a log that says "unclear".
  const n = (k: string) => (Array.isArray(ex[k]) ? ex[k].length : 0);
  if (n("progress") + n("issues_new") + n("issues_solved") + n("costs") + n("change_orders") + n("delays") + n("schedule_updates") + n("solved_matches") === 0) {
    return NextResponse.json({ error: "That was too short to file. Please say what was done, any problems, and any costs or changes.", transcript }, { status: 422 });
  }

  const { data: row, error } = await admin.from("voice_reports").insert({
    org_id: link.org_id, link_id: link.id, person_name: link.person_name, project_id: projectId,
    language: detected || link.language, transcript, extracted: ex, priority: ex.urgent ? "urgent" : "normal", status: "draft",
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Could not save the draft" }, { status: 500 });

  return NextResponse.json({ id: row.id, transcript, extracted: ex, language: link.language });
}
