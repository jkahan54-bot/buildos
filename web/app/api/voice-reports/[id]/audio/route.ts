import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { admin } from "@/lib/reportLinks";
import { createClient } from "@/lib/supabase/server";

// Staff only: short-lived signed URL for the original audio. Org-checked through RLS.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { res } = await requireUser();
  if (res) return res;
  const supabase = await createClient();
  const { data: report } = await supabase.from("voice_reports").select("audio_path").eq("id", params.id).maybeSingle(); // RLS: own org only
  if (!report?.audio_path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data } = await admin.storage.from("voice-reports").createSignedUrl(report.audio_path, 300);
  return NextResponse.json({ url: data?.signedUrl ?? null });
}
