import { NextRequest, NextResponse } from "next/server";
import { admin, resolveLink } from "@/lib/fieldLink";

// Who is this link for and which sites can it report on. Reveals nothing without a valid token.
export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const link = await resolveLink(token);
  if (!link) return NextResponse.json({ error: "invalid" }, { status: 401 });
  const { data: projects } = await admin.from("projects").select("id, name").in("id", link.project_ids).order("name");
  return NextResponse.json({ name: link.person_name, language: link.language, projects: projects ?? [] });
}
