import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, DEFAULT_PRIMARY_MODEL } from "@/lib/ai";

// Keywords that signal a milestone has been completed
const COMPLETION_SIGNALS = [
  "approved","approval","ready","complete","completed","done","issued","received",
  "confirmed","signed","accepted","cleared","passed","finalized","delivered",
  "permit","drawings","inspection","certificate","authorization","stamp",
];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { milestones } = await req.json();
  if (!milestones?.length) return NextResponse.json({ updates: [] });

  // NOTE: Real email ingestion runs through the evening Outlook scan, which posts
  // actionable emails into the Daily Review queue. This endpoint must NOT fabricate
  // emails — returning [] so nothing is ever invented. (Previously it asked the AI to
  // "simulate" emails, which could mark milestones complete based on made-up data.)
  return NextResponse.json({ updates: [] });

  // eslint-disable-next-line no-unreachable
  try {
    const prompt = `You are a construction project manager AI.

The following milestones are currently PENDING (not completed):
${milestones.map((m: string, i: number) => `${i+1}. ${m}`).join("\n")}

Simulate finding 1-2 recent emails that would indicate some of these milestones are now complete.
Return ONLY valid JSON array:
[
  {
    "milestone": "exact milestone title from the list",
    "keyword": "key word from the milestone (e.g. architect, permit)",
    "from": "sender name and email",
    "date": "today or yesterday",
    "subject": "realistic email subject",
    "summary": "one sentence summary of what the email says (should indicate completion)"
  }
]
If no milestones seem completable, return [].`;

    const result = await callAI(DEFAULT_PRIMARY_MODEL, "You are a construction AI assistant.", prompt, 500);
    let updates = [];
    try { updates = JSON.parse(result.replace(/```json|```/g,"").trim()); } catch {}
    return NextResponse.json({ updates });
  } catch (e: any) {
    return NextResponse.json({ updates: [], error: e.message });
  }
}
