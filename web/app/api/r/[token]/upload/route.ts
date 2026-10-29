import { NextRequest, NextResponse } from "next/server";
import { admin, lookupLink, logUse } from "@/lib/reportLinks";
import { rateLimit, getIP } from "@/lib/ratelimit";
import { transcribe, extractItems } from "@/lib/voiceReport";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024;            // ~10+ minutes of compressed audio
const MAX_PER_DAY = 40;                         // per link
const OK_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a", "audio/aac", "video/webm", "video/mp4"];

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!rateLimit(`rl:up:${getIP(req)}`, { windowMs: 60_000, max: 10 }).allowed) {
    return NextResponse.json({ error: "Too many uploads. Wait a minute." }, { status: 429 });
  }
  const link = await lookupLink(params.token);
  if (!link) return NextResponse.json({ error: "This link is not active." }, { status: 404 });

  // Cost / abuse cap per link, enforced in the database so it survives serverless restarts
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("voice_reports").select("id", { count: "exact", head: true }).eq("link_id", link.id).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_DAY) return NextResponse.json({ error: "Daily limit reached. Call the office." }, { status: 429 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof File) file = f;
  } catch { /* fall through */ }
  if (!file || file.size === 0) return NextResponse.json({ error: "No recording received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Recording too long. Please record in shorter parts." }, { status: 413 });
  const baseType = (file.type || "").split(";")[0].toLowerCase();
  if (!OK_TYPES.includes(baseType)) return NextResponse.json({ error: "Unsupported audio type." }, { status: 415 });

  await logUse(link.id, "upload", req);

  // A new recording replaces any unconfirmed one (nothing was filed from it)
  await admin.from("voice_reports").update({ status: "abandoned" }).eq("link_id", link.id).eq("status", "needs_confirmation");

  const ext = baseType.includes("mp4") || baseType.includes("m4a") || baseType.includes("aac") ? "m4a" : baseType.includes("ogg") ? "ogg" : baseType.includes("mpeg") ? "mp3" : baseType.includes("wav") ? "wav" : "webm";
  const { data: report, error: insErr } = await admin.from("voice_reports").insert({
    org_id: link.org_id, link_id: link.id, status: "processing", language_hint: link.language, audio_bytes: file.size,
  }).select("id").single();
  if (insErr || !report) return NextResponse.json({ error: "Could not save the recording." }, { status: 500 });

  const path = `${link.org_id}/${link.id}/${report.id}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const up = await admin.storage.from("voice-reports").upload(path, bytes, { contentType: baseType, upsert: false });
  if (up.error) {
    await admin.from("voice_reports").update({ status: "failed", error: "audio storage failed" }).eq("id", report.id);
    return NextResponse.json({ error: "Could not save the recording. Try again." }, { status: 500 });
  }
  await admin.from("voice_reports").update({ audio_path: path }).eq("id", report.id);

  try {
    const { data: projects } = link.project_ids.length
      ? await admin.from("projects").select("id, name, address").in("id", link.project_ids).eq("org_id", link.org_id)
      : { data: [] as { id: string; name: string; address: string | null }[] };
    const vocab = [link.person_name, ...(projects ?? []).flatMap(p => [p.name, p.address ?? ""])].filter(Boolean);

    const transcript = await transcribe(new Blob([bytes], { type: baseType }), `report.${ext}`, link.language, vocab);
    if (!transcript) throw new Error("empty transcript");
    const ex = await extractItems(transcript, projects ?? []);
    const low = link.language === "yi" || link.language === "mixed" || ex.items.some(i => i.needs_person);
    await admin.from("voice_reports").update({
      status: "needs_confirmation", transcript_original: transcript, transcript_english: ex.transcript_english, items: ex.items, low_confidence: low,
    }).eq("id", report.id);
    return NextResponse.json({ report_id: report.id });
  } catch (e: any) {
    // Audio is kept, so the office can still listen. Manager is told to try again.
    await admin.from("voice_reports").update({ status: "failed", error: String(e?.message ?? e).slice(0, 300) }).eq("id", report.id);
    return NextResponse.json({ error: "I could not understand that recording. Please record it again.", report_id: report.id }, { status: 502 });
  }
}
