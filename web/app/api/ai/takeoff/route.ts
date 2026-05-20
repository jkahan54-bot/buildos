import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image    = formData.get("image") as File;
    const project  = formData.get("project") as string ?? "Project";

    if (!image) return NextResponse.json({ error: "No image" }, { status: 400 });

    const bytes  = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mtype  = image.type || "image/jpeg";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mtype, data: base64 } },
            { type: "text", text: `You are an expert construction estimator. Analyze this plan/drawing for project "${project}" and return ONLY valid JSON:
{
  "projectType": "Residential|Commercial|Industrial|Mixed-Use|Medical",
  "estimatedArea": "e.g. 5,200 SF",
  "floors": number or null,
  "confidence": "Low|Medium|High",
  "planNotes": "brief description of what you see",
  "assumptions": [string],
  "items": [
    {
      "category": "Concrete|Steel|Framing|MEP|Finishes|Roofing|Sitework|Other",
      "description": string,
      "quantity": number,
      "unit": "SF|LF|CY|EA|TON|LS",
      "unitCost": number,
      "laborCost": number,
      "notes": string
    }
  ]
}
Use realistic NYC construction costs. Return ONLY valid JSON, no markdown.` }
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
