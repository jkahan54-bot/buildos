import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { admin, resolveLink } from "@/lib/fieldLink";

// Photos are attached AFTER the report is confirmed, so a discarded report leaves no orphan photos.
export async function POST(req: NextRequest) {
  const f = await req.formData();
  const link = await resolveLink(String(f.get("token") ?? ""));
  if (!link) return NextResponse.json({ error: "Link not valid" }, { status: 401 });

  const { data: rep } = await admin.from("voice_reports").select("id, project_id, status").eq("id", String(f.get("report_id") ?? "")).eq("link_id", link.id).single();
  if (!rep || rep.status !== "confirmed" || !link.project_ids.includes(rep.project_id)) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const file = f.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo" }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Photos only (JPG, PNG or WebP)" }, { status: 415 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Photo too large" }, { status: 413 });

  // Cap photos per report so a leaked link can't be used to fill storage.
  const { count } = await admin.from("site_photos").select("id", { count: "exact", head: true }).eq("project_id", rep.project_id).eq("ai_analysis->>voice_report_id", rep.id);
  if ((count ?? 0) >= 20) return NextResponse.json({ error: "Maximum 20 photos per report" }, { status: 429 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `field-photos/${link.org_id}/${rep.project_id}/${randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from("buildos").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (upErr) return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  const { data: { publicUrl } } = admin.storage.from("buildos").getPublicUrl(path);

  const tag = ["Progress", "Inspection", "Safety", "Materials", "General"].includes(String(f.get("tag"))) ? String(f.get("tag")) : "Progress";
  await admin.from("site_photos").insert({
    org_id: link.org_id, project_id: rep.project_id, label: `${tag} — ${link.person_name}`, tag, storage_path: path, url: publicUrl, ai_analysis: { voice_report_id: rep.id },
  });
  return NextResponse.json({ success: true });
}
