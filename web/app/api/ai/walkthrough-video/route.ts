/**
 * AI Video Walkthrough Analysis
 * Takes frames sampled from a walkthrough video and returns an overall
 * summary plus a per-area breakdown shaped like the photo-based
 * /api/ai/walkthrough result, so it can merge into the same rooms[] list.
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData     = await req.formData();
    const frames       = formData.getAll("frames") as File[];
    const facilityName = (formData.get("facility_name") as string) || "the facility";
    const occupancyType = (formData.get("occupancy_type") as string) || "";

    if (!frames.length) return NextResponse.json({ error: "No frames" }, { status: 400 });

    const imageContents = await Promise.all(
      frames.slice(0, 10).map(async f => {
        const bytes  = await f.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        return { type: "image", source: { type: "base64", media_type: f.type || "image/jpeg", data: base64 } };
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
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: [
            ...imageContents,
            {
              type: "text",
              text: `You are analyzing sequential frames sampled in chronological order from a video walkthrough of "${facilityName}"${occupancyType ? ` (${occupancyType})` : ""}, recorded by a contractor for a pre-bid assessment of a medical facility/nursing home renovation project.

These ${imageContents.length} frames are sampled across the full walkthrough, NOT separate rooms — group frames that show the same area together into one entry.

Return ONLY valid JSON:
{
  "overall_summary": "2-3 sentence summary of the whole walkthrough: what was covered, overall condition, biggest concerns",
  "overall_condition": "Good|Fair|Poor|Critical",
  "overall_icra_risk": "I|II|III|IV",
  "areas": [
    {
      "name": "short descriptive name for this area, e.g. 'Room 204 - Patient Room' or 'Main Corridor'",
      "condition": "Good|Fair|Poor|Critical",
      "condition_notes": "brief description of current state",
      "icra_risk": "I|II|III|IV",
      "icra_notes": "why this ICRA level",
      "issues": ["specific issues observed"],
      "scope_items": [
        {"trade": "e.g. Flooring|Painting|Electrical|Plumbing|HVAC|Drywall", "description": "specific work needed", "estimated_qty": "e.g. 250 SF, 1 EA, 45 LF"}
      ],
      "hazard_flags": {"asbestos": false, "lead": false, "mold": false, "notes": ""}
    }
  ]
}

Only include areas you can actually distinguish from the frames — do not invent rooms you can't see.`
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
