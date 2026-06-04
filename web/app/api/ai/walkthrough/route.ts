/**
 * AI Walkthrough Analysis
 * Analyzes photos taken during a site walkthrough and extracts:
 * - Room type and condition
 * - Issues and deficiencies
 * - ICRA risk level
 * - Scope of work items
 * - Estimated quantities
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const images   = formData.getAll("images") as File[];
    const roomName = formData.get("room") as string ?? "Room";
    const notes    = formData.get("notes") as string ?? "";

    if (!images.length) return NextResponse.json({ error: "No images" }, { status: 400 });

    // Convert all images to base64
    const imageContents = await Promise.all(
      images.slice(0, 4).map(async img => {
        const bytes  = await img.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        return { type:"image", source:{ type:"base64", media_type: img.type || "image/jpeg", data:base64 } };
      })
    );

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":     process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type":  "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            ...imageContents,
            {
              type: "text",
              text: `You are analyzing site walkthrough photos for a construction contractor bidding on a medical facility/nursing home renovation project.

Room/Area: ${roomName}
Field notes: ${notes || "None"}

Analyze all photos and return ONLY valid JSON:
{
  "room_type": "e.g. Patient Room, Corridor, Bathroom, Nurse Station, etc.",
  "condition": "Good|Fair|Poor|Critical",
  "condition_notes": "brief description of current state",
  "icra_risk": "I|II|III|IV",
  "icra_notes": "why this ICRA level",
  "issues": ["list of specific issues observed"],
  "scope_items": [
    {"trade": "e.g. Flooring|Painting|Electrical|Plumbing|HVAC|Drywall", "description": "specific work needed", "estimated_qty": "e.g. 250 SF, 1 EA, 45 LF"}
  ],
  "hazard_flags": {"asbestos": false, "lead": false, "mold": false, "notes": ""},
  "photos_captured": ["brief description of what each photo shows"],
  "summary": "one sentence overall assessment"
}`
            }
          ]
        }]
      })
    });

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

    const text   = data.content?.[0]?.text ?? "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
