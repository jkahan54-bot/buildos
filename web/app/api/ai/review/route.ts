import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dualReview, DEFAULT_PRIMARY_MODEL, DEFAULT_SECONDARY_MODEL } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles")
    .select("org_id, ai_primary_model, ai_secondary_model").eq("id", user.id).single();

  const { content, context, scenario, projectId } = await req.json();

  const result = await dualReview(
    content, context,
    profile?.ai_primary_model   ?? DEFAULT_PRIMARY_MODEL,
    profile?.ai_secondary_model ?? DEFAULT_SECONDARY_MODEL
  );

  // Log to DB
  await supabase.from("ai_reviews").insert({
    org_id:          profile?.org_id,
    project_id:      projectId ?? null,
    created_by:      user.id,
    scenario,
    input_content:   content,
    primary_model:   result.primaryModel,
    primary_result:  result.primary   ? JSON.parse(result.primary)   : null,
    secondary_model: result.secondaryModel,
    secondary_result:result.secondary ? JSON.parse(result.secondary) : null,
  });

  return NextResponse.json(result);
}
