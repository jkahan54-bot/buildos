import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listSharePointFolder, searchSharePoint } from "@/lib/graph";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder");   // e.g. "Projects/123-125 ditmas"
  const query  = searchParams.get("q");        // search term

  try {
    let files;
    if (folder) {
      files = await listSharePointFolder(folder);
    } else if (query) {
      files = await searchSharePoint(query);
    } else {
      // List top-level Projects folders
      files = await listSharePointFolder("Shared Documents/Projects");
    }

    return NextResponse.json({
      files: files.map((f: any) => ({
        id:           f.id,
        name:         f.name,
        webUrl:       f.webUrl,
        size:         f.size,
        modified:     f.lastModifiedDateTime,
        isFolder:     !!f.folder,
        fileType:     f.file?.mimeType ?? null,
        ext:          f.name.split(".").pop()?.toUpperCase() ?? "—",
      }))
    });
  } catch (e: any) {
    // If Azure not configured, return helpful error
    if (e.message.includes("not configured")) {
      return NextResponse.json({ error: "azure_not_configured", message: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
