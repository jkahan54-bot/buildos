import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  const { projectId, files } = await req.json();

  // files: [{ name, webUrl, size, ext, modified }]
  const inserts = files.map((f: any) => ({
    org_id:       profile?.org_id,
    project_id:   projectId,
    uploaded_by:  user.id,
    name:         f.name,
    file_type:    f.ext ?? f.name.split(".").pop()?.toUpperCase(),
    file_size:    f.size ?? null,
    url:          f.webUrl,
    storage_path: `sharepoint:${f.webUrl}`,  // marker so we know it's a SharePoint link
  }));

  const { error } = await supabase.from("documents").insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ linked: inserts.length });
}
